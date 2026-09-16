alter table private.tree_raffle_rounds
  add column if not exists status text not null default 'collecting'
    check (status in ('collecting', 'locked', 'drawing', 'winner-published', 'completed', 'cancelled')),
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists prize_symbol text,
  add column if not exists prize_coin_type text,
  add column if not exists prize_amount_raw numeric(78, 0)
    check (prize_amount_raw is null or prize_amount_raw > 0),
  add column if not exists prize_decimals integer
    check (prize_decimals is null or prize_decimals between 0 and 18),
  add column if not exists lucky_prize_symbol text,
  add column if not exists lucky_prize_coin_type text,
  add column if not exists lucky_prize_amount_raw numeric(78, 0)
    check (lucky_prize_amount_raw is null or lucky_prize_amount_raw > 0),
  add column if not exists lucky_prize_decimals integer
    check (lucky_prize_decimals is null or lucky_prize_decimals between 0 and 18),
  add column if not exists drawing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add constraint tree_raffle_round_window_check
    check (opens_at is null or closes_at is null or opens_at < closes_at),
  add constraint tree_raffle_main_prize_check
    check (
      (prize_symbol is null and prize_coin_type is null and prize_amount_raw is null and prize_decimals is null)
      or (prize_symbol is not null and prize_coin_type is not null and prize_amount_raw is not null and prize_decimals is not null)
    ),
  add constraint tree_raffle_lucky_prize_check
    check (
      (lucky_prize_symbol is null and lucky_prize_coin_type is null and lucky_prize_amount_raw is null and lucky_prize_decimals is null)
      or (kind = 'weekly' and lucky_prize_symbol is not null and lucky_prize_coin_type is not null and lucky_prize_amount_raw is not null and lucky_prize_decimals is not null)
    );

create table if not exists private.tree_raffle_winners (
  round_id text not null references private.tree_raffle_rounds(round_id) on delete restrict,
  prize_class text not null check (prize_class in ('main', 'lucky')),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  winning_ticket bigint not null check (winning_ticket >= 0),
  total_tickets bigint not null check (total_tickets > 0 and winning_ticket < total_tickets),
  token_symbol text not null,
  token_type text not null,
  amount_raw numeric(78, 0) not null check (amount_raw > 0),
  token_decimals integer not null check (token_decimals between 0 and 18),
  draw_tx_digest text not null check (draw_tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  register_tx_digest text not null check (register_tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  claimed boolean not null default false,
  claim_tx_digest text check (claim_tx_digest is null or claim_tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  published_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (round_id, prize_class),
  check ((claimed = false and claim_tx_digest is null and claimed_at is null)
    or (claimed = true and claim_tx_digest is not null and claimed_at is not null))
);

alter table private.tree_raffle_winners enable row level security;
revoke all on private.tree_raffle_winners from public, anon, authenticated;

create index if not exists tree_raffle_winners_wallet_idx
  on private.tree_raffle_winners (wallet, claimed, published_at desc);

create or replace function public.read_tree_raffle_public_snapshot(p_wallet text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := case when p_wallet is null or btrim(p_wallet) = '' then null else lower(p_wallet) end;
  v_rounds jsonb;
  v_history jsonb;
  v_claims jsonb;
begin
  if v_wallet is not null and v_wallet !~ '^0x[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid normalized Sui wallet address.';
  end if;

  select coalesce(jsonb_object_agg(kind, payload), '{}'::jsonb)
  into v_rounds
  from (
    select distinct on (r.kind)
      r.kind,
      jsonb_build_object(
        'id', r.round_id,
        'kind', r.kind,
        'state', r.status,
        'opensAt', r.opens_at,
        'closesAt', r.closes_at,
        'totalMainTickets', r.total_main_tickets,
        'totalLuckyLeafTickets', r.total_lucky_leaf_tickets,
        'qualifyingTransactions', r.qualifying_transactions,
        'totalBuyers', (select count(*) from private.tree_raffle_round_wallets rw where rw.round_id = r.round_id),
        'prize', case when r.prize_amount_raw is null then null else jsonb_build_object(
          'symbol', r.prize_symbol,
          'coinType', r.prize_coin_type,
          'amountRaw', r.prize_amount_raw::text,
          'decimals', r.prize_decimals
        ) end,
        'luckyPrize', case when r.lucky_prize_amount_raw is null then null else jsonb_build_object(
          'symbol', r.lucky_prize_symbol,
          'coinType', r.lucky_prize_coin_type,
          'amountRaw', r.lucky_prize_amount_raw::text,
          'decimals', r.lucky_prize_decimals
        ) end,
        'wallet', case when v_wallet is null then null else (
          select jsonb_build_object(
            'mainTickets', rw.main_tickets,
            'luckyLeafTickets', rw.lucky_leaf_tickets,
            'qualifyingTransactions', rw.qualifying_transactions
          )
          from private.tree_raffle_round_wallets rw
          where rw.round_id = r.round_id and rw.wallet = v_wallet
        ) end
      ) as payload
    from private.tree_raffle_rounds r
    order by r.kind,
      case r.status when 'collecting' then 0 when 'locked' then 1 when 'drawing' then 2 else 3 end,
      r.updated_at desc,
      r.round_id desc
  ) latest;

  select coalesce(jsonb_agg(jsonb_build_object(
    'roundId', w.round_id,
    'kind', r.kind,
    'prizeClass', w.prize_class,
    'wallet', w.wallet,
    'token', w.token_symbol,
    'amountRaw', w.amount_raw::text,
    'decimals', w.token_decimals,
    'drawTxDigest', w.draw_tx_digest,
    'registerTxDigest', w.register_tx_digest,
    'claimed', w.claimed,
    'claimTxDigest', w.claim_tx_digest,
    'publishedAt', w.published_at
  ) order by w.published_at desc), '[]'::jsonb)
  into v_history
  from (
    select * from private.tree_raffle_winners order by published_at desc limit 20
  ) w
  join private.tree_raffle_rounds r on r.round_id = w.round_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'roundId', w.round_id,
    'prizeClass', w.prize_class,
    'onchainDrawId', w.onchain_draw_id,
    'token', w.token_symbol,
    'tokenType', w.token_type,
    'amountRaw', w.amount_raw::text,
    'decimals', w.token_decimals,
    'registerTxDigest', w.register_tx_digest
  ) order by w.published_at desc), '[]'::jsonb)
  into v_claims
  from private.tree_raffle_winners w
  where v_wallet is not null and w.wallet = v_wallet and w.claimed = false;

  return jsonb_build_object(
    'rounds', v_rounds,
    'history', v_history,
    'wallet', case when v_wallet is null then null else jsonb_build_object(
      'address', v_wallet,
      'streak', (select jsonb_build_object(
        'days', s.streak_days,
        'lastRaffleDate', s.last_raffle_date
      ) from private.tree_raffle_wallet_streaks s where s.wallet = v_wallet),
      'unclaimedPrizes', v_claims
    ) end
  );
end;
$$;

revoke all on function public.read_tree_raffle_public_snapshot(text)
  from public, anon, authenticated;
grant execute on function public.read_tree_raffle_public_snapshot(text)
  to service_role;
