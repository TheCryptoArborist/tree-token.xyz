create extension if not exists pgcrypto with schema extensions;

create table if not exists private.tree_raffle_draw_snapshots (
  round_id text not null references private.tree_raffle_rounds(round_id) on delete restrict,
  prize_class text not null check (prize_class in ('main', 'lucky')),
  onchain_draw_id text not null unique
    check (onchain_draw_id ~ '^[a-z0-9][a-z0-9:_-]{2,95}$'),
  selection_scheme text not null
    check (selection_scheme = 'wallet-asc-cumulative-v1'),
  ticket_ranges jsonb not null check (jsonb_typeof(ticket_ranges) = 'array'),
  ledger_commitment text not null check (ledger_commitment ~ '^[0-9a-f]{64}$'),
  total_tickets bigint not null check (total_tickets > 0),
  created_at timestamptz not null default now(),
  primary key (round_id, prize_class)
);

alter table private.tree_raffle_draw_snapshots enable row level security;
revoke all on private.tree_raffle_draw_snapshots from public, anon, authenticated;

alter table private.tree_raffle_winners
  add column if not exists onchain_draw_id text,
  add column if not exists ledger_commitment text,
  add column if not exists selection_scheme text default 'wallet-asc-cumulative-v1';

alter table private.tree_raffle_winners
  alter column onchain_draw_id set not null,
  alter column ledger_commitment set not null,
  alter column selection_scheme set not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tree_raffle_winners_onchain_draw_id_check'
      and conrelid = 'private.tree_raffle_winners'::regclass
  ) then
    alter table private.tree_raffle_winners
      add constraint tree_raffle_winners_onchain_draw_id_check
      check (onchain_draw_id ~ '^[a-z0-9][a-z0-9:_-]{2,95}$');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tree_raffle_winners_ledger_commitment_check'
      and conrelid = 'private.tree_raffle_winners'::regclass
  ) then
    alter table private.tree_raffle_winners
      add constraint tree_raffle_winners_ledger_commitment_check
      check (ledger_commitment ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tree_raffle_winners_selection_scheme_check'
      and conrelid = 'private.tree_raffle_winners'::regclass
  ) then
    alter table private.tree_raffle_winners
      add constraint tree_raffle_winners_selection_scheme_check
      check (selection_scheme = 'wallet-asc-cumulative-v1');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tree_raffle_winners_snapshot_fkey'
      and conrelid = 'private.tree_raffle_winners'::regclass
  ) then
    alter table private.tree_raffle_winners
      add constraint tree_raffle_winners_snapshot_fkey
      foreign key (round_id, prize_class)
      references private.tree_raffle_draw_snapshots(round_id, prize_class)
      on delete restrict;
  end if;
end
$$;

create unique index if not exists tree_raffle_winners_onchain_draw_id_idx
  on private.tree_raffle_winners (onchain_draw_id);

create or replace function private.guard_tree_raffle_round_wallet_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round_id text := case when tg_op = 'DELETE' then old.round_id else new.round_id end;
  v_status text;
begin
  select status into v_status
  from private.tree_raffle_rounds
  where round_id = v_round_id;

  if v_status is distinct from 'collecting' then
    raise exception using
      errcode = '55000',
      message = 'TREE raffle tickets cannot change after the round is locked.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists tree_raffle_round_wallet_mutation_guard
  on private.tree_raffle_round_wallets;
create trigger tree_raffle_round_wallet_mutation_guard
before insert or update or delete on private.tree_raffle_round_wallets
for each row execute function private.guard_tree_raffle_round_wallet_mutation();

create or replace function private.guard_tree_raffle_round_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'collecting' and (
    new.total_main_tickets is distinct from old.total_main_tickets
    or new.total_lucky_leaf_tickets is distinct from old.total_lucky_leaf_tickets
    or new.qualifying_transactions is distinct from old.qualifying_transactions
  ) then
    raise exception using
      errcode = '55000',
      message = 'TREE raffle totals cannot change after the round is locked.';
  end if;
  return new;
end;
$$;

drop trigger if exists tree_raffle_round_totals_guard
  on private.tree_raffle_rounds;
create trigger tree_raffle_round_totals_guard
before update on private.tree_raffle_rounds
for each row execute function private.guard_tree_raffle_round_totals();

create or replace function public.lock_tree_raffle_draw(
  p_round_id text,
  p_prize_class text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_round private.tree_raffle_rounds%rowtype;
  v_onchain_draw_id text;
  v_ticket_ranges jsonb;
  v_canonical_ranges text;
  v_total_tickets bigint;
  v_expected_total bigint;
  v_ledger_commitment text;
  v_existing private.tree_raffle_draw_snapshots%rowtype;
begin
  if p_round_id is null or p_round_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$' then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle round ID.';
  end if;
  if p_prize_class is null or p_prize_class not in ('main', 'lucky') then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle prize class.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-raffle-draw:' || p_round_id || ':' || p_prize_class, 0)
  );

  select * into v_round
  from private.tree_raffle_rounds
  where round_id = p_round_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TREE raffle round was not found.';
  end if;
  if v_round.status not in ('collecting', 'locked') then
    raise exception using errcode = '55000', message = 'TREE raffle round is not available for locking.';
  end if;
  if v_round.closes_at is null or v_round.closes_at > now() then
    raise exception using errcode = '55000', message = 'TREE raffle round has not reached its configured close time.';
  end if;
  if p_prize_class = 'lucky' and v_round.kind <> 'weekly' then
    raise exception using errcode = '22023', message = 'Lucky Leaf draws are only valid for weekly rounds.';
  end if;
  if p_prize_class = 'main' and v_round.prize_amount_raw is null then
    raise exception using errcode = '55000', message = 'TREE raffle main prize is not configured.';
  end if;
  if p_prize_class = 'lucky' and v_round.lucky_prize_amount_raw is null then
    raise exception using errcode = '55000', message = 'TREE raffle Lucky Leaf prize is not configured.';
  end if;

  v_onchain_draw_id := p_round_id || ':' || p_prize_class;
  if length(v_onchain_draw_id) > 96 then
    raise exception using errcode = '22023', message = 'TREE raffle on-chain draw ID is too long.';
  end if;

  with ordered as (
    select
      wallet,
      case when p_prize_class = 'main' then main_tickets else lucky_leaf_tickets end as tickets
    from private.tree_raffle_round_wallets
    where round_id = p_round_id
  ), positive as (
    select wallet, tickets
    from ordered
    where tickets > 0
  ), ranged as (
    select
      wallet,
      tickets,
      coalesce(sum(tickets) over (
        order by wallet rows between unbounded preceding and 1 preceding
      ), 0)::bigint as range_start,
      sum(tickets) over (
        order by wallet rows between unbounded preceding and current row
      )::bigint as range_end_exclusive
    from positive
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'wallet', wallet,
      'tickets', tickets::text,
      'start', range_start::text,
      'endExclusive', range_end_exclusive::text
    ) order by wallet), '[]'::jsonb),
    coalesce(string_agg(
      wallet || ':' || tickets || ':' || range_start || ':' || range_end_exclusive,
      E'\n' order by wallet
    ), ''),
    coalesce(max(range_end_exclusive), 0)
  into v_ticket_ranges, v_canonical_ranges, v_total_tickets
  from ranged;

  v_expected_total := case
    when p_prize_class = 'main' then v_round.total_main_tickets
    else v_round.total_lucky_leaf_tickets
  end;

  if v_total_tickets <= 0 or v_total_tickets <> v_expected_total then
    raise exception using
      errcode = '55000',
      message = 'TREE raffle canonical ticket ranges do not match the round total.';
  end if;

  v_ledger_commitment := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'tree-raffle-ledger-v1' || E'\n' || v_onchain_draw_id || E'\n' || v_canonical_ranges,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into private.tree_raffle_draw_snapshots (
    round_id, prize_class, onchain_draw_id, selection_scheme,
    ticket_ranges, ledger_commitment, total_tickets
  ) values (
    p_round_id, p_prize_class, v_onchain_draw_id, 'wallet-asc-cumulative-v1',
    v_ticket_ranges, v_ledger_commitment, v_total_tickets
  ) on conflict (round_id, prize_class) do nothing;

  select * into v_existing
  from private.tree_raffle_draw_snapshots
  where round_id = p_round_id and prize_class = p_prize_class;

  if v_existing.onchain_draw_id <> v_onchain_draw_id
     or v_existing.ledger_commitment <> v_ledger_commitment
     or v_existing.total_tickets <> v_total_tickets
     or v_existing.ticket_ranges <> v_ticket_ranges then
    raise exception using errcode = '23505', message = 'TREE raffle draw snapshot conflicts with the locked ledger.';
  end if;

  update private.tree_raffle_rounds
  set status = 'locked', updated_at = now()
  where round_id = p_round_id and status = 'collecting';

  return jsonb_build_object(
    'roundId', v_existing.round_id,
    'prizeClass', v_existing.prize_class,
    'onchainDrawId', v_existing.onchain_draw_id,
    'selectionScheme', v_existing.selection_scheme,
    'ticketRanges', v_existing.ticket_ranges,
    'ledgerCommitment', v_existing.ledger_commitment,
    'totalTickets', v_existing.total_tickets::text
  );
end;
$$;

revoke all on function public.lock_tree_raffle_draw(text, text)
  from public, anon, authenticated;
grant execute on function public.lock_tree_raffle_draw(text, text)
  to service_role;
