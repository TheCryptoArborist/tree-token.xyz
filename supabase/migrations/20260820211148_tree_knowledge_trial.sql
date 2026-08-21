create table private.tree_knowledge_trial_rounds (
  round_id text primary key check (round_id ~ '^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  state text not null default 'draft' check (state in ('draft', 'open', 'closed', 'scored', 'awarded', 'cancelled')),
  question_set_version text not null check (length(question_set_version) between 3 and 96),
  duration_seconds integer not null default 180 check (duration_seconds between 60 and 900),
  question_count integer not null default 5 check (question_count between 1 and 50),
  minimum_qualifying_usd_cents integer not null default 500 check (minimum_qualifying_usd_cents >= 500),
  purchase_window_opens_at timestamptz not null,
  purchase_window_closes_at timestamptz not null,
  challenge_opens_at timestamptz not null,
  challenge_closes_at timestamptz not null,
  prize_token_type text not null check (length(prize_token_type) between 3 and 512),
  prize_amount_raw numeric(78, 0) not null check (prize_amount_raw > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (purchase_window_opens_at < purchase_window_closes_at),
  check (challenge_opens_at < challenge_closes_at)
);

create table private.tree_knowledge_trial_passes (
  pass_id uuid primary key default gen_random_uuid(),
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  qualifying_tx_digest text not null references private.tree_raffle_verified_buys(tx_digest) on delete restrict,
  qualifying_usd_cents bigint not null check (qualifying_usd_cents >= 500),
  issued_at timestamptz not null default now(),
  consumed_at timestamptz,
  unique (round_id, wallet),
  unique (round_id, qualifying_tx_digest)
);

create table private.tree_knowledge_trial_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  pass_id uuid not null unique references private.tree_knowledge_trial_passes(pass_id) on delete restrict,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  attempt_token_sha256 text not null unique check (attempt_token_sha256 ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  answers jsonb,
  correct_count integer check (correct_count between 0 and 5),
  elapsed_ms integer check (elapsed_ms between 0 and 3600000),
  disqualified boolean not null default false,
  disqualification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (started_at < expires_at),
  check ((submitted_at is null and answers is null and correct_count is null and elapsed_ms is null)
    or (submitted_at is not null and answers is not null and correct_count is not null and elapsed_ms is not null))
);

create index tree_knowledge_trial_passes_wallet_idx
  on private.tree_knowledge_trial_passes (wallet, issued_at desc);

create index tree_knowledge_trial_attempts_leaderboard_idx
  on private.tree_knowledge_trial_attempts (round_id, disqualified, correct_count desc, elapsed_ms asc, wallet asc)
  where submitted_at is not null;

create index tree_knowledge_trial_attempts_wallet_idx
  on private.tree_knowledge_trial_attempts (wallet, started_at desc);

alter table private.tree_knowledge_trial_rounds enable row level security;
alter table private.tree_knowledge_trial_passes enable row level security;
alter table private.tree_knowledge_trial_attempts enable row level security;

revoke all on private.tree_knowledge_trial_rounds from public, anon, authenticated;
revoke all on private.tree_knowledge_trial_passes from public, anon, authenticated;
revoke all on private.tree_knowledge_trial_attempts from public, anon, authenticated;

create or replace function public.issue_tree_knowledge_trial_pass_v1(
  p_round_id text,
  p_wallet text,
  p_qualifying_tx_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := lower(p_wallet);
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_buy private.tree_raffle_verified_buys%rowtype;
  v_pass private.tree_knowledge_trial_passes%rowtype;
begin
  if v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid normalized Sui wallet.';
  end if;

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;
  if not found or v_round.state <> 'open' then
    raise exception using errcode = '55000', message = 'The Knowledge Trial round is not open.';
  end if;

  select * into v_buy
  from private.tree_raffle_verified_buys
  where tx_digest = p_qualifying_tx_digest;
  if not found or v_buy.buyer <> v_wallet or not v_buy.qualifies
     or v_buy.qualifying_usd_cents < v_round.minimum_qualifying_usd_cents
     or v_buy.finalized_at < v_round.purchase_window_opens_at
     or v_buy.finalized_at >= v_round.purchase_window_closes_at then
    raise exception using errcode = '22023', message = 'The verified TREE purchase does not qualify for this round.';
  end if;

  insert into private.tree_knowledge_trial_passes (
    round_id, wallet, qualifying_tx_digest, qualifying_usd_cents
  ) values (
    v_round.round_id, v_wallet, v_buy.tx_digest, v_buy.qualifying_usd_cents
  )
  on conflict (round_id, wallet) do update
    set qualifying_tx_digest = private.tree_knowledge_trial_passes.qualifying_tx_digest
  returning * into v_pass;

  return jsonb_build_object(
    'passId', v_pass.pass_id,
    'roundId', v_pass.round_id,
    'wallet', v_pass.wallet,
    'qualifyingTxDigest', v_pass.qualifying_tx_digest,
    'qualifyingUsdCents', v_pass.qualifying_usd_cents,
    'consumed', v_pass.consumed_at is not null
  );
end;
$$;

create or replace function public.start_tree_knowledge_trial_attempt_v1(
  p_round_id text,
  p_wallet text,
  p_attempt_token_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := lower(p_wallet);
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_pass private.tree_knowledge_trial_passes%rowtype;
  v_attempt private.tree_knowledge_trial_attempts%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_attempt_token_sha256 is null or p_attempt_token_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial attempt authorization.';
  end if;

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;
  if not found or v_round.state <> 'open'
     or v_now < v_round.challenge_opens_at or v_now >= v_round.challenge_closes_at then
    raise exception using errcode = '55000', message = 'The Knowledge Trial is not accepting attempts.';
  end if;

  select * into v_pass
  from private.tree_knowledge_trial_passes
  where round_id = p_round_id and wallet = v_wallet
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'This wallet has no qualifying Challenge Pass.';
  end if;

  select * into v_attempt
  from private.tree_knowledge_trial_attempts
  where pass_id = v_pass.pass_id;
  if found then
    return jsonb_build_object(
      'outcome', 'existing',
      'attemptId', v_attempt.attempt_id,
      'roundId', v_attempt.round_id,
      'startedAt', v_attempt.started_at,
      'expiresAt', v_attempt.expires_at,
      'submitted', v_attempt.submitted_at is not null
    );
  end if;

  insert into private.tree_knowledge_trial_attempts (
    round_id, pass_id, wallet, attempt_token_sha256, started_at, expires_at
  ) values (
    v_round.round_id,
    v_pass.pass_id,
    v_wallet,
    p_attempt_token_sha256,
    v_now,
    least(v_now + make_interval(secs => v_round.duration_seconds), v_round.challenge_closes_at)
  ) returning * into v_attempt;

  update private.tree_knowledge_trial_passes
  set consumed_at = v_now
  where pass_id = v_pass.pass_id;

  return jsonb_build_object(
    'outcome', 'started',
    'attemptId', v_attempt.attempt_id,
    'roundId', v_attempt.round_id,
    'startedAt', v_attempt.started_at,
    'expiresAt', v_attempt.expires_at,
    'submitted', false
  );
end;
$$;

create or replace function public.submit_tree_knowledge_trial_attempt_v1(
  p_attempt_token_sha256 text,
  p_answers jsonb,
  p_correct_count integer,
  p_elapsed_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_attempt private.tree_knowledge_trial_attempts%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_attempt_token_sha256 is null or p_attempt_token_sha256 !~ '^[0-9a-f]{64}$'
     or p_answers is null or jsonb_typeof(p_answers) <> 'array'
     or p_correct_count is null or p_correct_count < 0 or p_correct_count > 5
     or p_elapsed_ms is null or p_elapsed_ms < 0 or p_elapsed_ms > 3600000 then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial submission.';
  end if;

  select * into v_attempt
  from private.tree_knowledge_trial_attempts
  where attempt_token_sha256 = p_attempt_token_sha256
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Knowledge Trial attempt not found.';
  end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'attemptId', v_attempt.attempt_id,
      'roundId', v_attempt.round_id,
      'correctCount', v_attempt.correct_count,
      'elapsedMs', v_attempt.elapsed_ms
    );
  end if;
  if v_now > v_attempt.expires_at + interval '2 seconds' then
    raise exception using errcode = '57014', message = 'The Knowledge Trial attempt expired.';
  end if;

  update private.tree_knowledge_trial_attempts
  set submitted_at = v_now,
      answers = p_answers,
      correct_count = p_correct_count,
      elapsed_ms = least(p_elapsed_ms, floor(extract(epoch from (v_attempt.expires_at - v_attempt.started_at)) * 1000)::integer),
      updated_at = v_now
  where attempt_id = v_attempt.attempt_id
  returning * into v_attempt;

  return jsonb_build_object(
    'outcome', 'recorded',
    'attemptId', v_attempt.attempt_id,
    'roundId', v_attempt.round_id,
    'correctCount', v_attempt.correct_count,
    'elapsedMs', v_attempt.elapsed_ms
  );
end;
$$;

revoke all on function public.issue_tree_knowledge_trial_pass_v1(text, text, text)
  from public, anon, authenticated;
revoke all on function public.start_tree_knowledge_trial_attempt_v1(text, text, text)
  from public, anon, authenticated;
revoke all on function public.submit_tree_knowledge_trial_attempt_v1(text, jsonb, integer, integer)
  from public, anon, authenticated;

grant execute on function public.issue_tree_knowledge_trial_pass_v1(text, text, text)
  to service_role;
grant execute on function public.start_tree_knowledge_trial_attempt_v1(text, text, text)
  to service_role;
grant execute on function public.submit_tree_knowledge_trial_attempt_v1(text, jsonb, integer, integer)
  to service_role;
