create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.tree_raffle_verified_buys (
  tx_digest text primary key,
  fingerprint text not null,
  buyer text not null,
  tree_amount_raw numeric(78, 0) not null check (tree_amount_raw > 0),
  qualifying_usd_cents bigint not null check (qualifying_usd_cents >= 0),
  route text not null check (route in ('suidex-v2', 'suidex-v3', 'turbos')),
  finalized_checkpoint bigint not null check (finalized_checkpoint > 0),
  finalized_at timestamptz not null,
  raffle_date date not null,
  daily_round_id text not null,
  weekly_round_id text not null,
  rules_version text not null,
  qualifies boolean not null,
  streak_days integer,
  main_tickets bigint not null check (main_tickets >= 0),
  lucky_leaf_tickets bigint not null check (lucky_leaf_tickets >= 0),
  recorded_at timestamptz not null default now(),
  check (buyer ~ '^0x[0-9a-f]{64}$'),
  check (tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  check (daily_round_id <> weekly_round_id)
);

create table private.tree_raffle_wallet_streaks (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{64}$'),
  last_raffle_date date not null,
  streak_days integer not null check (streak_days > 0),
  updated_at timestamptz not null default now()
);

create table private.tree_raffle_rounds (
  round_id text primary key,
  kind text not null check (kind in ('daily', 'weekly')),
  total_main_tickets bigint not null default 0 check (total_main_tickets >= 0),
  total_lucky_leaf_tickets bigint not null default 0 check (total_lucky_leaf_tickets >= 0),
  qualifying_transactions bigint not null default 0 check (qualifying_transactions >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.tree_raffle_round_wallets (
  round_id text not null references private.tree_raffle_rounds(round_id) on delete restrict,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  main_tickets bigint not null default 0 check (main_tickets >= 0),
  lucky_leaf_tickets bigint not null default 0 check (lucky_leaf_tickets >= 0),
  qualifying_transactions bigint not null default 0 check (qualifying_transactions >= 0),
  updated_at timestamptz not null default now(),
  primary key (round_id, wallet)
);

create table private.tree_raffle_keeper_cursors (
  stream_id text primary key check (stream_id in ('suidex-v2', 'suidex-v3', 'turbos')),
  event_type text not null check (length(event_type) between 3 and 512),
  cursor text not null check (length(cursor) between 1 and 2048),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create index tree_raffle_verified_buys_buyer_date_idx
  on private.tree_raffle_verified_buys (buyer, raffle_date desc);

create index tree_raffle_round_wallets_main_idx
  on private.tree_raffle_round_wallets (round_id, main_tickets desc, wallet asc);

alter table private.tree_raffle_verified_buys enable row level security;
alter table private.tree_raffle_wallet_streaks enable row level security;
alter table private.tree_raffle_rounds enable row level security;
alter table private.tree_raffle_round_wallets enable row level security;
alter table private.tree_raffle_keeper_cursors enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;

create or replace function public.record_tree_raffle_verified_buy(
  p_tx_digest text,
  p_buyer text,
  p_tree_amount_raw text,
  p_qualifying_usd_cents bigint,
  p_route text,
  p_finalized_checkpoint bigint,
  p_finalized_at timestamptz,
  p_raffle_date date,
  p_daily_round_id text,
  p_weekly_round_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_buyer text := lower(p_buyer);
  v_fingerprint text;
  v_existing private.tree_raffle_verified_buys%rowtype;
  v_qualifies boolean := p_qualifying_usd_cents >= 500;
  v_previous private.tree_raffle_wallet_streaks%rowtype;
  v_streak_days integer;
  v_date_difference integer;
  v_multiplier_basis_points integer;
  v_main_tickets bigint := 0;
  v_lucky_leaf_tickets bigint := 0;
  v_milestone_usd_cents bigint := 0;
  v_round_kind text;
  v_multiplier_table integer[] := array[
    10000, 11000, 12500, 14000, 15000,
    16000, 17500, 18500, 19500, 20000,
    21000, 22000, 23000, 24000, 25000
  ];
begin
  if p_tx_digest is null or p_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$' then
    raise exception using errcode = '22023', message = 'Invalid Sui transaction digest.';
  end if;
  if v_buyer is null or v_buyer !~ '^0x[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid normalized Sui buyer address.';
  end if;
  if p_tree_amount_raw is null or p_tree_amount_raw !~ '^(0|[1-9][0-9]*)$'
     or p_tree_amount_raw::numeric <= 0 then
    raise exception using errcode = '22023', message = 'Invalid TREE base-unit amount.';
  end if;
  if p_qualifying_usd_cents is null or p_qualifying_usd_cents < 0 then
    raise exception using errcode = '22023', message = 'Invalid qualifying USD cents.';
  end if;
  if p_route is null or p_route not in ('suidex-v2', 'suidex-v3', 'turbos') then
    raise exception using errcode = '22023', message = 'Route is not allowlisted.';
  end if;
  if p_finalized_checkpoint is null or p_finalized_checkpoint < 1 then
    raise exception using errcode = '22023', message = 'Finalized checkpoint is required.';
  end if;
  if p_finalized_at is null or p_raffle_date is null then
    raise exception using errcode = '22023', message = 'Finalized time and raffle date are required.';
  end if;
  if p_daily_round_id is null or p_daily_round_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$'
     or p_weekly_round_id is null or p_weekly_round_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$'
     or p_daily_round_id = p_weekly_round_id then
    raise exception using errcode = '22023', message = 'Invalid raffle round identifiers.';
  end if;

  v_fingerprint := jsonb_build_object(
    'txDigest', p_tx_digest,
    'buyer', v_buyer,
    'treeAmountRaw', p_tree_amount_raw,
    'qualifyingUsdCents', p_qualifying_usd_cents,
    'route', p_route,
    'finalizedCheckpoint', p_finalized_checkpoint,
    'finalizedAt', to_char(p_finalized_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'raffleDate', p_raffle_date::text,
    'dailyRoundId', p_daily_round_id,
    'weeklyRoundId', p_weekly_round_id
  )::text;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tree-raffle-tx:' || p_tx_digest, 0));

  select * into v_existing
  from private.tree_raffle_verified_buys
  where tx_digest = p_tx_digest;

  if found then
    if v_existing.fingerprint <> v_fingerprint then
      raise exception using
        errcode = '23505',
        message = 'Conflicting verified data for existing TREE raffle transaction digest.';
    end if;
    return jsonb_build_object(
      'outcome', 'duplicate',
      'qualifies', v_existing.qualifies,
      'streakDays', v_existing.streak_days,
      'mainTickets', v_existing.main_tickets,
      'luckyLeafTickets', v_existing.lucky_leaf_tickets,
      'dailyRoundId', v_existing.daily_round_id,
      'weeklyRoundId', v_existing.weekly_round_id
    );
  end if;

  if v_qualifies then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tree-raffle-wallet:' || v_buyer, 0));

    select * into v_previous
    from private.tree_raffle_wallet_streaks
    where wallet = v_buyer
    for update;

    if not found then
      v_streak_days := 1;
    else
      v_date_difference := p_raffle_date - v_previous.last_raffle_date;
      if v_date_difference < 0 then
        raise exception using
          errcode = '22023',
          message = 'Verified buys must be applied in raffle-date order for each wallet.';
      elsif v_date_difference = 0 then
        v_streak_days := v_previous.streak_days;
      elsif v_date_difference = 1 then
        v_streak_days := v_previous.streak_days + 1;
      else
        v_streak_days := 1;
      end if;
    end if;

    v_multiplier_basis_points := v_multiplier_table[least(v_streak_days, 15)];
    v_main_tickets := greatest(
      1,
      floor(
        power(p_qualifying_usd_cents::numeric / 100, 0.9457)
        * 0.288368
        * v_multiplier_basis_points
        / 10000
      )::bigint
    );

    if (v_streak_days = 7 or v_streak_days = 15)
       and (v_previous.wallet is null or v_previous.streak_days < v_streak_days) then
      v_milestone_usd_cents := case when v_streak_days = 7 then 5000 else 20000 end;
      v_main_tickets := v_main_tickets + greatest(
        1,
        floor(
          power(v_milestone_usd_cents::numeric / 100, 0.9457)
          * 0.288368
        )::bigint
      );
    end if;

    v_lucky_leaf_tickets := 1;

    insert into private.tree_raffle_wallet_streaks (wallet, last_raffle_date, streak_days)
    values (v_buyer, p_raffle_date, v_streak_days)
    on conflict (wallet) do update set
      last_raffle_date = excluded.last_raffle_date,
      streak_days = excluded.streak_days,
      updated_at = now();

    insert into private.tree_raffle_rounds (round_id, kind)
    values (p_daily_round_id, 'daily')
    on conflict (round_id) do nothing;
    select kind into v_round_kind from private.tree_raffle_rounds where round_id = p_daily_round_id;
    if v_round_kind <> 'daily' then
      raise exception using errcode = '22023', message = 'Daily round ID has a conflicting cadence.';
    end if;

    insert into private.tree_raffle_rounds (round_id, kind)
    values (p_weekly_round_id, 'weekly')
    on conflict (round_id) do nothing;
    select kind into v_round_kind from private.tree_raffle_rounds where round_id = p_weekly_round_id;
    if v_round_kind <> 'weekly' then
      raise exception using errcode = '22023', message = 'Weekly round ID has a conflicting cadence.';
    end if;

    update private.tree_raffle_rounds set
      total_main_tickets = total_main_tickets + v_main_tickets,
      qualifying_transactions = qualifying_transactions + 1,
      updated_at = now()
    where round_id = p_daily_round_id;

    update private.tree_raffle_rounds set
      total_main_tickets = total_main_tickets + v_main_tickets,
      total_lucky_leaf_tickets = total_lucky_leaf_tickets + v_lucky_leaf_tickets,
      qualifying_transactions = qualifying_transactions + 1,
      updated_at = now()
    where round_id = p_weekly_round_id;

    insert into private.tree_raffle_round_wallets (
      round_id, wallet, main_tickets, lucky_leaf_tickets, qualifying_transactions
    ) values (
      p_daily_round_id, v_buyer, v_main_tickets, 0, 1
    ) on conflict (round_id, wallet) do update set
      main_tickets = private.tree_raffle_round_wallets.main_tickets + excluded.main_tickets,
      lucky_leaf_tickets = private.tree_raffle_round_wallets.lucky_leaf_tickets + excluded.lucky_leaf_tickets,
      qualifying_transactions = private.tree_raffle_round_wallets.qualifying_transactions + 1,
      updated_at = now();

    insert into private.tree_raffle_round_wallets (
      round_id, wallet, main_tickets, lucky_leaf_tickets, qualifying_transactions
    ) values (
      p_weekly_round_id, v_buyer, v_main_tickets, v_lucky_leaf_tickets, 1
    ) on conflict (round_id, wallet) do update set
      main_tickets = private.tree_raffle_round_wallets.main_tickets + excluded.main_tickets,
      lucky_leaf_tickets = private.tree_raffle_round_wallets.lucky_leaf_tickets + excluded.lucky_leaf_tickets,
      qualifying_transactions = private.tree_raffle_round_wallets.qualifying_transactions + 1,
      updated_at = now();
  end if;

  insert into private.tree_raffle_verified_buys (
    tx_digest, fingerprint, buyer, tree_amount_raw, qualifying_usd_cents, route,
    finalized_checkpoint, finalized_at, raffle_date, daily_round_id, weekly_round_id,
    rules_version, qualifies, streak_days, main_tickets, lucky_leaf_tickets
  ) values (
    p_tx_digest, v_fingerprint, v_buyer, p_tree_amount_raw::numeric,
    p_qualifying_usd_cents, p_route, p_finalized_checkpoint, p_finalized_at,
    p_raffle_date, p_daily_round_id, p_weekly_round_id,
    'canopy-draw-proposal-v2', v_qualifies, v_streak_days,
    v_main_tickets, v_lucky_leaf_tickets
  );

  return jsonb_build_object(
    'outcome', 'recorded',
    'qualifies', v_qualifies,
    'streakDays', v_streak_days,
    'mainTickets', v_main_tickets,
    'luckyLeafTickets', v_lucky_leaf_tickets,
    'dailyRoundId', p_daily_round_id,
    'weeklyRoundId', p_weekly_round_id
  );
end;
$$;

revoke all on function public.record_tree_raffle_verified_buy(
  text, text, text, bigint, text, bigint, timestamptz, date, text, text
) from public, anon, authenticated;

grant execute on function public.record_tree_raffle_verified_buy(
  text, text, text, bigint, text, bigint, timestamptz, date, text, text
) to service_role;

create or replace function public.load_tree_raffle_keeper_cursors()
returns jsonb
language sql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'streamId', stream_id,
        'eventType', event_type,
        'cursor', cursor,
        'version', version
      ) order by stream_id
    ),
    '[]'::jsonb
  )
  from private.tree_raffle_keeper_cursors;
$$;

create or replace function public.save_tree_raffle_keeper_cursor(
  p_stream_id text,
  p_event_type text,
  p_expected_cursor text,
  p_next_cursor text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_existing private.tree_raffle_keeper_cursors%rowtype;
begin
  if p_stream_id is null or p_stream_id not in ('suidex-v2', 'suidex-v3', 'turbos') then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle keeper stream.';
  end if;
  if p_event_type is null or length(p_event_type) not between 3 and 512 then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle keeper event type.';
  end if;
  if p_next_cursor is null or length(p_next_cursor) not between 1 and 2048 then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle keeper cursor.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-raffle-cursor:' || p_stream_id, 0)
  );

  select * into v_existing
  from private.tree_raffle_keeper_cursors
  where stream_id = p_stream_id
  for update;

  if not found then
    if p_expected_cursor is not null then
      raise exception using errcode = '40001', message = 'TREE raffle keeper cursor changed concurrently.';
    end if;
    insert into private.tree_raffle_keeper_cursors (stream_id, event_type, cursor)
    values (p_stream_id, p_event_type, p_next_cursor)
    returning * into v_existing;
  else
    if v_existing.event_type <> p_event_type then
      raise exception using errcode = '22023', message = 'TREE raffle keeper stream event type changed.';
    end if;
    if v_existing.cursor is distinct from p_expected_cursor then
      raise exception using errcode = '40001', message = 'TREE raffle keeper cursor changed concurrently.';
    end if;
    update private.tree_raffle_keeper_cursors set
      cursor = p_next_cursor,
      version = version + 1,
      updated_at = now()
    where stream_id = p_stream_id
    returning * into v_existing;
  end if;

  return jsonb_build_object(
    'streamId', v_existing.stream_id,
    'eventType', v_existing.event_type,
    'cursor', v_existing.cursor,
    'version', v_existing.version
  );
end;
$$;

revoke all on function public.load_tree_raffle_keeper_cursors()
  from public, anon, authenticated;
revoke all on function public.save_tree_raffle_keeper_cursor(text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.load_tree_raffle_keeper_cursors()
  to service_role;
grant execute on function public.save_tree_raffle_keeper_cursor(text, text, text, text)
  to service_role;
