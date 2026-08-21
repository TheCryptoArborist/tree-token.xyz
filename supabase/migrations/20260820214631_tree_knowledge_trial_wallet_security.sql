create table private.tree_knowledge_trial_question_sets (
  question_set_version text primary key check (length(question_set_version) between 3 and 96),
  question_count integer not null check (question_count between 1 and 50),
  questions jsonb not null check (
    jsonb_typeof(questions) = 'array'
    and jsonb_array_length(questions) = question_count
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.tree_knowledge_trial_rounds
  add constraint tree_knowledge_trial_rounds_question_set_fk
  foreign key (question_set_version)
  references private.tree_knowledge_trial_question_sets(question_set_version)
  on update restrict on delete restrict;

create table private.tree_knowledge_trial_wallet_challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  qualifying_tx_digest text not null references private.tree_raffle_verified_buys(tx_digest) on delete restrict,
  nonce_sha256 text not null unique check (nonce_sha256 ~ '^[0-9a-f]{64}$'),
  message text not null check (length(message) between 40 and 2048),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (created_at < expires_at),
  check (consumed_at is null or consumed_at >= created_at)
);

alter table private.tree_knowledge_trial_rounds
  drop constraint tree_knowledge_trial_rounds_state_check;

alter table private.tree_knowledge_trial_rounds
  add constraint tree_knowledge_trial_rounds_state_check
  check (state in ('draft', 'open', 'closed', 'tiebreak', 'scored', 'awarded', 'cancelled')),
  add column winner_wallet text check (winner_wallet is null or winner_wallet ~ '^0x[0-9a-f]{64}$'),
  add column winner_attempt_id uuid references private.tree_knowledge_trial_attempts(attempt_id) on delete restrict,
  add column resolution_reason text check (resolution_reason is null or resolution_reason in ('highest-score-fastest-time', 'sudden-death', 'no-entries')),
  add column resolved_at timestamptz;

create table private.tree_knowledge_trial_tiebreak_qualifiers (
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  source_attempt_id uuid not null unique references private.tree_knowledge_trial_attempts(attempt_id) on delete restrict,
  state text not null default 'pending' check (state in ('pending', 'completed', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, wallet)
);

create index tree_knowledge_trial_challenges_wallet_created_idx
  on private.tree_knowledge_trial_wallet_challenges (wallet, created_at desc);

create index tree_knowledge_trial_challenges_fingerprint_created_idx
  on private.tree_knowledge_trial_wallet_challenges (request_fingerprint, created_at desc);

alter table private.tree_knowledge_trial_question_sets enable row level security;
alter table private.tree_knowledge_trial_wallet_challenges enable row level security;
alter table private.tree_knowledge_trial_tiebreak_qualifiers enable row level security;

revoke all on private.tree_knowledge_trial_question_sets from public, anon, authenticated;
revoke all on private.tree_knowledge_trial_wallet_challenges from public, anon, authenticated;
revoke all on private.tree_knowledge_trial_tiebreak_qualifiers from public, anon, authenticated;

create or replace function public.create_tree_knowledge_trial_wallet_challenge_v1(
  p_round_id text,
  p_wallet text,
  p_qualifying_tx_digest text,
  p_nonce_sha256 text,
  p_message_prefix text,
  p_request_fingerprint text,
  p_expires_at timestamptz
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
  v_challenge private.tree_knowledge_trial_wallet_challenges%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_nonce_sha256 is null or p_nonce_sha256 !~ '^[0-9a-f]{64}$'
     or p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_message_prefix is null or length(p_message_prefix) not between 40 and 1800
     or p_expires_at is null or p_expires_at <= v_now
     or p_expires_at > v_now + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial wallet challenge.';
  end if;

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for share;
  if not found or v_round.state <> 'open'
     or v_now < v_round.challenge_opens_at or v_now >= v_round.challenge_closes_at then
    raise exception using errcode = '55000', message = 'The Knowledge Trial is not accepting wallet challenges.';
  end if;

  select * into v_buy
  from private.tree_raffle_verified_buys
  where buyer = v_wallet
    and qualifies
    and qualifying_usd_cents >= v_round.minimum_qualifying_usd_cents
    and finalized_at >= v_round.purchase_window_opens_at
    and finalized_at < v_round.purchase_window_closes_at
    and (p_qualifying_tx_digest is null or tx_digest = p_qualifying_tx_digest)
  order by finalized_at desc, tx_digest asc
  limit 1;
  if not found then
    raise exception using errcode = '22023', message = 'No verified qualifying TREE purchase was found for this wallet and round.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tree-knowledge-wallet:' || v_wallet, 0));
  if (select count(*) from private.tree_knowledge_trial_wallet_challenges
      where wallet = v_wallet and created_at >= v_now - interval '10 minutes') >= 6 then
    raise exception using errcode = '54000', message = 'Too many wallet challenge requests. Try again later.';
  end if;
  if (select count(*) from private.tree_knowledge_trial_wallet_challenges
      where request_fingerprint = p_request_fingerprint and created_at >= v_now - interval '10 minutes') >= 20 then
    raise exception using errcode = '54000', message = 'Too many challenge requests. Try again later.';
  end if;

  insert into private.tree_knowledge_trial_wallet_challenges (
    round_id, wallet, qualifying_tx_digest, nonce_sha256, message,
    request_fingerprint, expires_at
  ) values (
    v_round.round_id, v_wallet, v_buy.tx_digest, p_nonce_sha256,
    p_message_prefix || E'\nQualifying TREE transaction: ' || v_buy.tx_digest,
    p_request_fingerprint, p_expires_at
  ) returning * into v_challenge;

  return jsonb_build_object(
    'challengeId', v_challenge.challenge_id,
    'roundId', v_challenge.round_id,
    'wallet', v_challenge.wallet,
    'qualifyingTxDigest', v_challenge.qualifying_tx_digest,
    'message', v_challenge.message,
    'expiresAt', v_challenge.expires_at,
    'consumed', false
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_wallet_challenge_v1(
  p_challenge_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select jsonb_build_object(
    'challengeId', challenge_id,
    'roundId', round_id,
    'wallet', wallet,
    'qualifyingTxDigest', qualifying_tx_digest,
    'message', message,
    'expiresAt', expires_at,
    'consumed', consumed_at is not null
  )
  from private.tree_knowledge_trial_wallet_challenges
  where challenge_id = p_challenge_id;
$$;

create or replace function public.consume_tree_knowledge_trial_wallet_challenge_v1(
  p_challenge_id uuid,
  p_wallet text,
  p_round_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_challenge private.tree_knowledge_trial_wallet_challenges%rowtype;
begin
  update private.tree_knowledge_trial_wallet_challenges
  set consumed_at = clock_timestamp()
  where challenge_id = p_challenge_id
    and wallet = lower(p_wallet)
    and round_id = p_round_id
    and consumed_at is null
    and expires_at > clock_timestamp()
  returning * into v_challenge;
  if not found then
    raise exception using errcode = '55000', message = 'The wallet challenge is invalid, expired, or already used.';
  end if;
  return jsonb_build_object(
    'challengeId', v_challenge.challenge_id,
    'roundId', v_challenge.round_id,
    'wallet', v_challenge.wallet,
    'qualifyingTxDigest', v_challenge.qualifying_tx_digest,
    'message', v_challenge.message,
    'expiresAt', v_challenge.expires_at,
    'consumed', true
  );
end;
$$;

create or replace function public.start_tree_knowledge_trial_attempt_v2(
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
  v_outcome text := 'started';
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
  where pass_id = v_pass.pass_id
  for update;
  if found then
    if v_attempt.submitted_at is not null then
      v_outcome := 'submitted';
    elsif v_now >= v_attempt.expires_at then
      v_outcome := 'expired';
    else
      update private.tree_knowledge_trial_attempts
      set attempt_token_sha256 = p_attempt_token_sha256,
          updated_at = v_now
      where attempt_id = v_attempt.attempt_id
      returning * into v_attempt;
      v_outcome := 'resumed';
    end if;
  else
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
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'attemptId', v_attempt.attempt_id,
    'roundId', v_attempt.round_id,
    'wallet', v_attempt.wallet,
    'questionSetVersion', v_round.question_set_version,
    'startedAt', v_attempt.started_at,
    'expiresAt', v_attempt.expires_at,
    'submitted', v_attempt.submitted_at is not null
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_attempt_context_v1(
  p_attempt_token_sha256 text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select jsonb_build_object(
    'attemptId', attempt.attempt_id,
    'roundId', attempt.round_id,
    'wallet', attempt.wallet,
    'questionSetVersion', round.question_set_version,
    'startedAt', attempt.started_at,
    'expiresAt', attempt.expires_at,
    'submitted', attempt.submitted_at is not null
  )
  from private.tree_knowledge_trial_attempts as attempt
  join private.tree_knowledge_trial_rounds as round using (round_id)
  where attempt.attempt_token_sha256 = p_attempt_token_sha256;
$$;

create or replace function public.read_tree_knowledge_trial_question_set_v1(
  p_question_set_version text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select jsonb_build_object(
    'questionSetVersion', question_set_version,
    'questionCount', question_count,
    'questions', questions
  )
  from private.tree_knowledge_trial_question_sets
  where question_set_version = p_question_set_version;
$$;

create or replace function public.submit_tree_knowledge_trial_attempt_v2(
  p_attempt_token_sha256 text,
  p_answers jsonb,
  p_correct_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_attempt private.tree_knowledge_trial_attempts%rowtype;
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_now timestamptz := clock_timestamp();
  v_elapsed_ms integer;
begin
  if p_attempt_token_sha256 is null or p_attempt_token_sha256 !~ '^[0-9a-f]{64}$'
     or p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial submission.';
  end if;

  select * into v_attempt
  from private.tree_knowledge_trial_attempts
  where attempt_token_sha256 = p_attempt_token_sha256
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Knowledge Trial attempt not found.';
  end if;
  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = v_attempt.round_id;
  if p_correct_count is null or p_correct_count < 0 or p_correct_count > v_round.question_count
     or jsonb_array_length(p_answers) > v_round.question_count then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial score.';
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

  v_elapsed_ms := greatest(0, least(
    v_round.duration_seconds * 1000,
    floor(extract(epoch from (least(v_now, v_attempt.expires_at) - v_attempt.started_at)) * 1000)::integer
  ));

  update private.tree_knowledge_trial_attempts
  set submitted_at = v_now,
      answers = p_answers,
      correct_count = p_correct_count,
      elapsed_ms = v_elapsed_ms,
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

create or replace function public.resolve_tree_knowledge_trial_round_v1(
  p_round_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '8s'
as $$
declare
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_leader private.tree_knowledge_trial_attempts%rowtype;
  v_tie_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Knowledge Trial round not found.';
  end if;
  if v_round.state in ('scored', 'awarded') then
    return jsonb_build_object(
      'outcome', 'winner',
      'roundId', v_round.round_id,
      'winnerWallet', v_round.winner_wallet,
      'winnerAttemptId', v_round.winner_attempt_id
    );
  end if;
  if v_round.state not in ('open', 'closed', 'tiebreak')
     or (v_round.state = 'open' and v_now < v_round.challenge_closes_at) then
    raise exception using errcode = '55000', message = 'Knowledge Trial round is not ready to resolve.';
  end if;
  if v_round.state = 'tiebreak' then
    return jsonb_build_object(
      'outcome', 'sudden-death-required',
      'roundId', v_round.round_id,
      'tiedWallets', (
        select coalesce(jsonb_agg(wallet order by wallet), '[]'::jsonb)
        from private.tree_knowledge_trial_tiebreak_qualifiers
        where round_id = v_round.round_id and state = 'pending'
      )
    );
  end if;

  select * into v_leader
  from private.tree_knowledge_trial_attempts
  where round_id = v_round.round_id
    and submitted_at is not null
    and not disqualified
  order by correct_count desc, elapsed_ms asc, wallet asc
  limit 1;

  if not found then
    update private.tree_knowledge_trial_rounds
    set state = 'cancelled',
        resolution_reason = 'no-entries',
        resolved_at = v_now,
        updated_at = v_now
    where round_id = v_round.round_id;
    return jsonb_build_object('outcome', 'no-entries', 'roundId', v_round.round_id);
  end if;

  select count(*) into v_tie_count
  from private.tree_knowledge_trial_attempts
  where round_id = v_round.round_id
    and submitted_at is not null
    and not disqualified
    and correct_count = v_leader.correct_count
    and elapsed_ms = v_leader.elapsed_ms;

  if v_tie_count = 1 then
    update private.tree_knowledge_trial_rounds
    set state = 'scored',
        winner_wallet = v_leader.wallet,
        winner_attempt_id = v_leader.attempt_id,
        resolution_reason = 'highest-score-fastest-time',
        resolved_at = v_now,
        updated_at = v_now
    where round_id = v_round.round_id;
    return jsonb_build_object(
      'outcome', 'winner',
      'roundId', v_round.round_id,
      'winnerWallet', v_leader.wallet,
      'winnerAttemptId', v_leader.attempt_id,
      'correctCount', v_leader.correct_count,
      'elapsedMs', v_leader.elapsed_ms
    );
  end if;

  insert into private.tree_knowledge_trial_tiebreak_qualifiers (
    round_id, wallet, source_attempt_id
  )
  select round_id, wallet, attempt_id
  from private.tree_knowledge_trial_attempts
  where round_id = v_round.round_id
    and submitted_at is not null
    and not disqualified
    and correct_count = v_leader.correct_count
    and elapsed_ms = v_leader.elapsed_ms
  on conflict (round_id, wallet) do nothing;

  update private.tree_knowledge_trial_rounds
  set state = 'tiebreak',
      winner_wallet = null,
      winner_attempt_id = null,
      resolution_reason = null,
      resolved_at = null,
      updated_at = v_now
  where round_id = v_round.round_id;

  return jsonb_build_object(
    'outcome', 'sudden-death-required',
    'roundId', v_round.round_id,
    'tiedWallets', (
      select coalesce(jsonb_agg(wallet order by wallet), '[]'::jsonb)
      from private.tree_knowledge_trial_tiebreak_qualifiers
      where round_id = v_round.round_id and state = 'pending'
    )
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_public_snapshot_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_submission_count integer := 0;
  v_leaderboard jsonb := '[]'::jsonb;
begin
  select * into v_round
  from private.tree_knowledge_trial_rounds
  where state <> 'draft'
  order by challenge_opens_at desc
  limit 1;
  if not found then
    return jsonb_build_object('round', null, 'submissionCount', 0, 'leaderboard', '[]'::jsonb);
  end if;

  select count(*) into v_submission_count
  from private.tree_knowledge_trial_attempts
  where round_id = v_round.round_id and submitted_at is not null and not disqualified;

  if v_round.state in ('scored', 'awarded') then
    select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.rank, ranked.wallet), '[]'::jsonb)
    into v_leaderboard
    from (
      select
        dense_rank() over (order by correct_count desc, elapsed_ms asc)::integer as rank,
        wallet,
        correct_count as "correctCount",
        elapsed_ms as "elapsedMs"
      from private.tree_knowledge_trial_attempts
      where round_id = v_round.round_id and submitted_at is not null and not disqualified
      order by correct_count desc, elapsed_ms asc, wallet asc
      limit 50
    ) as ranked;
  end if;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'roundId', v_round.round_id,
      'state', v_round.state,
      'questionSetVersion', v_round.question_set_version,
      'durationSeconds', v_round.duration_seconds,
      'questionCount', v_round.question_count,
      'minimumQualifyingUsdCents', v_round.minimum_qualifying_usd_cents,
      'purchaseWindowOpensAt', v_round.purchase_window_opens_at,
      'purchaseWindowClosesAt', v_round.purchase_window_closes_at,
      'challengeOpensAt', v_round.challenge_opens_at,
      'challengeClosesAt', v_round.challenge_closes_at,
      'prizeTokenType', v_round.prize_token_type,
      'prizeAmountRaw', v_round.prize_amount_raw,
      'winnerWallet', case when v_round.state in ('scored', 'awarded') then v_round.winner_wallet else null end,
      'resolutionReason', v_round.resolution_reason,
      'suddenDeathRequired', v_round.state = 'tiebreak'
    ),
    'submissionCount', v_submission_count,
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke execute on function public.start_tree_knowledge_trial_attempt_v1(text, text, text) from service_role;
revoke execute on function public.submit_tree_knowledge_trial_attempt_v1(text, jsonb, integer, integer) from service_role;

revoke all on function public.create_tree_knowledge_trial_wallet_challenge_v1(text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_wallet_challenge_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.consume_tree_knowledge_trial_wallet_challenge_v1(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.start_tree_knowledge_trial_attempt_v2(text, text, text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_attempt_context_v1(text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_question_set_v1(text)
  from public, anon, authenticated;
revoke all on function public.submit_tree_knowledge_trial_attempt_v2(text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.resolve_tree_knowledge_trial_round_v1(text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_public_snapshot_v1()
  from public, anon, authenticated;

grant execute on function public.create_tree_knowledge_trial_wallet_challenge_v1(text, text, text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_wallet_challenge_v1(uuid)
  to service_role;
grant execute on function public.consume_tree_knowledge_trial_wallet_challenge_v1(uuid, text, text)
  to service_role;
grant execute on function public.start_tree_knowledge_trial_attempt_v2(text, text, text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_attempt_context_v1(text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_question_set_v1(text)
  to service_role;
grant execute on function public.submit_tree_knowledge_trial_attempt_v2(text, jsonb, integer)
  to service_role;
grant execute on function public.resolve_tree_knowledge_trial_round_v1(text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_public_snapshot_v1()
  to service_role;
