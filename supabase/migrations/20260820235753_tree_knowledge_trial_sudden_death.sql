alter table private.tree_knowledge_trial_wallet_challenges
  alter column qualifying_tx_digest drop not null,
  add column purpose text not null default 'daily'
    check (purpose in ('daily', 'tiebreak')),
  add column tiebreak_stage integer
    check (tiebreak_stage is null or tiebreak_stage >= 1),
  add constraint tree_knowledge_trial_wallet_challenge_purpose_check check (
    (purpose = 'daily' and qualifying_tx_digest is not null and tiebreak_stage is null)
    or (purpose = 'tiebreak' and qualifying_tx_digest is null and tiebreak_stage is not null)
  );

alter table private.tree_knowledge_trial_tiebreak_qualifiers
  drop constraint tree_knowledge_trial_tiebreak_qualifiers_state_check,
  add column active_stage integer not null default 1 check (active_stage >= 1),
  add constraint tree_knowledge_trial_tiebreak_qualifiers_state_check
    check (state in ('pending', 'completed', 'eliminated', 'withdrawn'));

alter table private.tree_knowledge_trial_rounds
  add column tiebreak_stage integer not null default 0 check (tiebreak_stage >= 0),
  add column tiebreak_response_window_seconds integer not null default 3600
    check (tiebreak_response_window_seconds between 300 and 86400),
  add column tiebreak_stage_opens_at timestamptz,
  add column tiebreak_stage_closes_at timestamptz,
  add constraint tree_knowledge_trial_tiebreak_window_check check (
    (tiebreak_stage = 0 and tiebreak_stage_opens_at is null and tiebreak_stage_closes_at is null)
    or (tiebreak_stage >= 1 and (
      (tiebreak_stage_opens_at is null and tiebreak_stage_closes_at is null)
      or tiebreak_stage_opens_at < tiebreak_stage_closes_at
    ))
  );

create table private.tree_knowledge_trial_tiebreak_questions (
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  stage integer not null check (stage >= 1),
  question jsonb not null check (
    jsonb_typeof(question) = 'object'
    and jsonb_typeof(question -> 'options') = 'array'
    and jsonb_array_length(question -> 'options') between 2 and 8
  ),
  correct_option_id text not null check (length(correct_option_id) between 1 and 64),
  duration_seconds integer not null default 30 check (duration_seconds between 10 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, stage)
);

create table private.tree_knowledge_trial_tiebreak_attempts (
  tiebreak_attempt_id uuid primary key default gen_random_uuid(),
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  stage integer not null check (stage >= 1),
  attempt_token_sha256 text not null unique check (attempt_token_sha256 ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  selected_option_id text,
  correct boolean,
  elapsed_ms integer check (elapsed_ms is null or elapsed_ms between 0 and 120000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, wallet, stage),
  foreign key (round_id, stage)
    references private.tree_knowledge_trial_tiebreak_questions(round_id, stage)
    on delete restrict,
  check (started_at < expires_at),
  check (
    (submitted_at is null and selected_option_id is null and correct is null and elapsed_ms is null)
    or (submitted_at is not null and selected_option_id is not null and correct is not null and elapsed_ms is not null)
  )
);

alter table private.tree_knowledge_trial_rounds
  add column winner_tiebreak_attempt_id uuid
    references private.tree_knowledge_trial_tiebreak_attempts(tiebreak_attempt_id) on delete restrict;

create index tree_knowledge_trial_tiebreak_attempts_rank_idx
  on private.tree_knowledge_trial_tiebreak_attempts
  (round_id, stage, correct desc, elapsed_ms asc, wallet asc)
  where submitted_at is not null;

alter table private.tree_knowledge_trial_tiebreak_questions enable row level security;
alter table private.tree_knowledge_trial_tiebreak_attempts enable row level security;

revoke all on private.tree_knowledge_trial_tiebreak_questions from public, anon, authenticated;
revoke all on private.tree_knowledge_trial_tiebreak_attempts from public, anon, authenticated;

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
    and purpose = 'daily'
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

create or replace function public.create_tree_knowledge_trial_tiebreak_challenge_v1(
  p_round_id text,
  p_wallet text,
  p_nonce_sha256 text,
  p_message text,
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
  v_challenge private.tree_knowledge_trial_wallet_challenges%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_nonce_sha256 is null or p_nonce_sha256 !~ '^[0-9a-f]{64}$'
     or p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_message is null or length(p_message) not between 40 and 1800
     or p_expires_at is null or p_expires_at <= v_now
     or p_expires_at > v_now + interval '10 minutes' then
    raise exception using errcode = '22023', message = 'Invalid sudden-death wallet challenge.';
  end if;

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for share;
  if not found or v_round.state <> 'tiebreak'
     or v_round.tiebreak_stage < 1
     or v_round.tiebreak_stage_opens_at is null
     or v_now < v_round.tiebreak_stage_opens_at
     or v_now >= v_round.tiebreak_stage_closes_at then
    raise exception using errcode = '55000', message = 'Sudden death is not accepting attempts.';
  end if;

  perform 1
  from private.tree_knowledge_trial_tiebreak_qualifiers
  where round_id = v_round.round_id
    and wallet = v_wallet
    and state = 'pending'
    and active_stage = v_round.tiebreak_stage;
  if not found then
    raise exception using errcode = '22023', message = 'This wallet is not eligible for the current sudden-death stage.';
  end if;

  perform 1
  from private.tree_knowledge_trial_tiebreak_questions
  where round_id = v_round.round_id and stage = v_round.tiebreak_stage;
  if not found then
    raise exception using errcode = '55000', message = 'The sudden-death question is not ready.';
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
    request_fingerprint, expires_at, purpose, tiebreak_stage
  ) values (
    v_round.round_id, v_wallet, null, p_nonce_sha256, p_message,
    p_request_fingerprint, least(p_expires_at, v_round.tiebreak_stage_closes_at),
    'tiebreak', v_round.tiebreak_stage
  ) returning * into v_challenge;

  return jsonb_build_object(
    'challengeId', v_challenge.challenge_id,
    'roundId', v_challenge.round_id,
    'wallet', v_challenge.wallet,
    'stage', v_challenge.tiebreak_stage,
    'message', v_challenge.message,
    'expiresAt', v_challenge.expires_at,
    'consumed', false
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_tiebreak_challenge_v1(
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
    'stage', tiebreak_stage,
    'message', message,
    'expiresAt', expires_at,
    'consumed', consumed_at is not null
  )
  from private.tree_knowledge_trial_wallet_challenges
  where challenge_id = p_challenge_id and purpose = 'tiebreak';
$$;

create or replace function public.consume_tree_knowledge_trial_tiebreak_challenge_v1(
  p_challenge_id uuid,
  p_wallet text,
  p_round_id text,
  p_stage integer
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
    and purpose = 'tiebreak'
    and tiebreak_stage = p_stage
    and consumed_at is null
    and expires_at > clock_timestamp()
  returning * into v_challenge;
  if not found then
    raise exception using errcode = '55000', message = 'The sudden-death wallet challenge is invalid, expired, or already used.';
  end if;
  return jsonb_build_object(
    'challengeId', v_challenge.challenge_id,
    'roundId', v_challenge.round_id,
    'wallet', v_challenge.wallet,
    'stage', v_challenge.tiebreak_stage,
    'message', v_challenge.message,
    'expiresAt', v_challenge.expires_at,
    'consumed', true
  );
end;
$$;

create or replace function public.start_tree_knowledge_trial_tiebreak_attempt_v1(
  p_round_id text,
  p_wallet text,
  p_stage integer,
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
  v_question private.tree_knowledge_trial_tiebreak_questions%rowtype;
  v_attempt private.tree_knowledge_trial_tiebreak_attempts%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_stage is null or p_stage < 1
     or p_attempt_token_sha256 is null or p_attempt_token_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid sudden-death attempt authorization.';
  end if;

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;
  if not found or v_round.state <> 'tiebreak' or v_round.tiebreak_stage <> p_stage
     or v_round.tiebreak_stage_opens_at is null
     or v_now < v_round.tiebreak_stage_opens_at
     or v_now >= v_round.tiebreak_stage_closes_at then
    raise exception using errcode = '55000', message = 'Sudden death is not accepting attempts.';
  end if;

  perform 1
  from private.tree_knowledge_trial_tiebreak_qualifiers
  where round_id = v_round.round_id and wallet = v_wallet
    and state = 'pending' and active_stage = p_stage
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'This wallet is not eligible for the current sudden-death stage.';
  end if;

  select * into v_question
  from private.tree_knowledge_trial_tiebreak_questions
  where round_id = v_round.round_id and stage = p_stage;
  if not found then
    raise exception using errcode = '55000', message = 'The sudden-death question is not ready.';
  end if;

  select * into v_attempt
  from private.tree_knowledge_trial_tiebreak_attempts
  where round_id = v_round.round_id and wallet = v_wallet and stage = p_stage;
  if found then
    raise exception using errcode = '55000', message = 'This sudden-death attempt has already started.';
  end if;

  insert into private.tree_knowledge_trial_tiebreak_attempts (
    round_id, wallet, stage, attempt_token_sha256, started_at, expires_at
  ) values (
    v_round.round_id, v_wallet, p_stage, p_attempt_token_sha256, v_now,
    least(v_now + make_interval(secs => v_question.duration_seconds), v_round.tiebreak_stage_closes_at)
  ) returning * into v_attempt;

  return jsonb_build_object(
    'attemptId', v_attempt.tiebreak_attempt_id,
    'roundId', v_attempt.round_id,
    'wallet', v_attempt.wallet,
    'stage', v_attempt.stage,
    'startedAt', v_attempt.started_at,
    'expiresAt', v_attempt.expires_at,
    'submitted', false
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_tiebreak_attempt_context_v1(
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
    'attemptId', tiebreak_attempt_id,
    'roundId', round_id,
    'wallet', wallet,
    'stage', stage,
    'startedAt', started_at,
    'expiresAt', expires_at,
    'submitted', submitted_at is not null
  )
  from private.tree_knowledge_trial_tiebreak_attempts
  where attempt_token_sha256 = p_attempt_token_sha256;
$$;

create or replace function public.read_tree_knowledge_trial_tiebreak_question_v1(
  p_round_id text,
  p_stage integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select question
  from private.tree_knowledge_trial_tiebreak_questions
  where round_id = p_round_id and stage = p_stage;
$$;

create or replace function public.submit_tree_knowledge_trial_tiebreak_attempt_v1(
  p_attempt_token_sha256 text,
  p_selected_option_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_attempt private.tree_knowledge_trial_tiebreak_attempts%rowtype;
  v_question private.tree_knowledge_trial_tiebreak_questions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_attempt_token_sha256 is null or p_attempt_token_sha256 !~ '^[0-9a-f]{64}$'
     or p_selected_option_id is null or length(p_selected_option_id) not between 1 and 64 then
    raise exception using errcode = '22023', message = 'Invalid sudden-death submission.';
  end if;

  select * into v_attempt
  from private.tree_knowledge_trial_tiebreak_attempts
  where attempt_token_sha256 = p_attempt_token_sha256
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Sudden-death attempt not found.';
  end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object(
      'outcome', 'duplicate',
      'attemptId', v_attempt.tiebreak_attempt_id,
      'roundId', v_attempt.round_id,
      'stage', v_attempt.stage,
      'correct', v_attempt.correct,
      'elapsedMs', v_attempt.elapsed_ms
    );
  end if;
  if v_now > v_attempt.expires_at + interval '2 seconds' then
    raise exception using errcode = '57014', message = 'The sudden-death attempt expired.';
  end if;

  select * into v_question
  from private.tree_knowledge_trial_tiebreak_questions
  where round_id = v_attempt.round_id and stage = v_attempt.stage;

  if not exists (
    select 1
    from jsonb_array_elements(v_question.question -> 'options') option
    where option ->> 'id' = p_selected_option_id
  ) then
    raise exception using errcode = '22023', message = 'The selected sudden-death answer is invalid.';
  end if;

  update private.tree_knowledge_trial_tiebreak_attempts
  set submitted_at = v_now,
      selected_option_id = p_selected_option_id,
      correct = p_selected_option_id = v_question.correct_option_id,
      elapsed_ms = least(
        floor(extract(epoch from (v_now - v_attempt.started_at)) * 1000)::integer,
        floor(extract(epoch from (v_attempt.expires_at - v_attempt.started_at)) * 1000)::integer
      ),
      updated_at = v_now
  where tiebreak_attempt_id = v_attempt.tiebreak_attempt_id
  returning * into v_attempt;

  return jsonb_build_object(
    'outcome', 'recorded',
    'attemptId', v_attempt.tiebreak_attempt_id,
    'roundId', v_attempt.round_id,
    'stage', v_attempt.stage,
    'correct', v_attempt.correct,
    'elapsedMs', v_attempt.elapsed_ms
  );
end;
$$;

create or replace function public.resolve_tree_knowledge_trial_round_v2(
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
  v_tiebreak_leader private.tree_knowledge_trial_tiebreak_attempts%rowtype;
  v_source_attempt_id uuid;
  v_tie_count integer := 0;
  v_pending_count integer := 0;
  v_submitted_count integer := 0;
  v_next_stage integer;
  v_question_ready boolean := false;
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
      'outcome', 'winner', 'roundId', v_round.round_id,
      'winnerWallet', v_round.winner_wallet,
      'winnerAttemptId', v_round.winner_attempt_id,
      'winnerTiebreakAttemptId', v_round.winner_tiebreak_attempt_id
    );
  end if;
  if v_round.state not in ('open', 'closed', 'tiebreak')
     or (v_round.state = 'open' and v_now < v_round.challenge_closes_at) then
    raise exception using errcode = '55000', message = 'Knowledge Trial round is not ready to resolve.';
  end if;

  if v_round.state <> 'tiebreak' then
    select * into v_leader
    from private.tree_knowledge_trial_attempts
    where round_id = v_round.round_id and submitted_at is not null and not disqualified
    order by correct_count desc, elapsed_ms asc, wallet asc
    limit 1;

    if not found then
      update private.tree_knowledge_trial_rounds
      set state = 'cancelled', resolution_reason = 'no-entries', resolved_at = v_now, updated_at = v_now
      where round_id = v_round.round_id;
      return jsonb_build_object('outcome', 'no-entries', 'roundId', v_round.round_id);
    end if;

    select count(*) into v_tie_count
    from private.tree_knowledge_trial_attempts
    where round_id = v_round.round_id and submitted_at is not null and not disqualified
      and correct_count = v_leader.correct_count and elapsed_ms = v_leader.elapsed_ms;

    if v_tie_count = 1 then
      update private.tree_knowledge_trial_rounds
      set state = 'scored', winner_wallet = v_leader.wallet,
          winner_attempt_id = v_leader.attempt_id,
          resolution_reason = 'highest-score-fastest-time', resolved_at = v_now, updated_at = v_now
      where round_id = v_round.round_id;
      return jsonb_build_object(
        'outcome', 'winner', 'roundId', v_round.round_id,
        'winnerWallet', v_leader.wallet, 'winnerAttemptId', v_leader.attempt_id,
        'correctCount', v_leader.correct_count, 'elapsedMs', v_leader.elapsed_ms
      );
    end if;

    insert into private.tree_knowledge_trial_tiebreak_qualifiers (
      round_id, wallet, source_attempt_id, state, active_stage
    )
    select round_id, wallet, attempt_id, 'pending', 1
    from private.tree_knowledge_trial_attempts
    where round_id = v_round.round_id and submitted_at is not null and not disqualified
      and correct_count = v_leader.correct_count and elapsed_ms = v_leader.elapsed_ms
    on conflict (round_id, wallet) do update
      set state = 'pending', active_stage = 1, updated_at = v_now;

    select exists (
      select 1 from private.tree_knowledge_trial_tiebreak_questions
      where round_id = v_round.round_id and stage = 1
    ) into v_question_ready;

    update private.tree_knowledge_trial_rounds
    set state = 'tiebreak', tiebreak_stage = 1,
        tiebreak_stage_opens_at = case when v_question_ready then v_now else null end,
        tiebreak_stage_closes_at = case when v_question_ready then v_now + make_interval(secs => tiebreak_response_window_seconds) else null end,
        winner_wallet = null, winner_attempt_id = null, winner_tiebreak_attempt_id = null,
        resolution_reason = null, resolved_at = null, updated_at = v_now
    where round_id = v_round.round_id
    returning * into v_round;

    if not v_question_ready then
      return jsonb_build_object('outcome', 'sudden-death-question-required', 'roundId', v_round.round_id, 'stage', 1);
    end if;
    return jsonb_build_object(
      'outcome', 'sudden-death-open', 'roundId', v_round.round_id, 'stage', 1,
      'closesAt', v_round.tiebreak_stage_closes_at, 'qualifierCount', v_tie_count
    );
  end if;

  if v_round.tiebreak_stage_opens_at is null then
    select exists (
      select 1 from private.tree_knowledge_trial_tiebreak_questions
      where round_id = v_round.round_id and stage = v_round.tiebreak_stage
    ) into v_question_ready;
    if not v_question_ready then
      return jsonb_build_object(
        'outcome', 'sudden-death-question-required', 'roundId', v_round.round_id,
        'stage', v_round.tiebreak_stage
      );
    end if;
    update private.tree_knowledge_trial_rounds
    set tiebreak_stage_opens_at = v_now,
        tiebreak_stage_closes_at = v_now + make_interval(secs => tiebreak_response_window_seconds),
        updated_at = v_now
    where round_id = v_round.round_id
    returning * into v_round;
  end if;

  select count(*) into v_pending_count
  from private.tree_knowledge_trial_tiebreak_qualifiers
  where round_id = v_round.round_id and state = 'pending' and active_stage = v_round.tiebreak_stage;

  select count(*) into v_submitted_count
  from private.tree_knowledge_trial_tiebreak_attempts
  where round_id = v_round.round_id and stage = v_round.tiebreak_stage and submitted_at is not null;

  if v_now < v_round.tiebreak_stage_closes_at and v_submitted_count < v_pending_count then
    return jsonb_build_object(
      'outcome', 'sudden-death-pending', 'roundId', v_round.round_id,
      'stage', v_round.tiebreak_stage, 'closesAt', v_round.tiebreak_stage_closes_at,
      'qualifierCount', v_pending_count, 'submissionCount', v_submitted_count
    );
  end if;

  select * into v_tiebreak_leader
  from private.tree_knowledge_trial_tiebreak_attempts
  where round_id = v_round.round_id and stage = v_round.tiebreak_stage and submitted_at is not null
  order by correct desc, elapsed_ms asc, wallet asc
  limit 1;

  if not found then
    update private.tree_knowledge_trial_tiebreak_qualifiers
    set state = 'eliminated', updated_at = v_now
    where round_id = v_round.round_id and state = 'pending' and active_stage = v_round.tiebreak_stage;
    update private.tree_knowledge_trial_rounds
    set state = 'cancelled', resolution_reason = 'no-entries', resolved_at = v_now, updated_at = v_now
    where round_id = v_round.round_id;
    return jsonb_build_object('outcome', 'no-tiebreak-responses', 'roundId', v_round.round_id);
  end if;

  select count(*) into v_tie_count
  from private.tree_knowledge_trial_tiebreak_attempts
  where round_id = v_round.round_id and stage = v_round.tiebreak_stage and submitted_at is not null
    and correct = v_tiebreak_leader.correct and elapsed_ms = v_tiebreak_leader.elapsed_ms;

  if v_tie_count = 1 then
    select source_attempt_id into v_source_attempt_id
    from private.tree_knowledge_trial_tiebreak_qualifiers
    where round_id = v_round.round_id and wallet = v_tiebreak_leader.wallet;

    update private.tree_knowledge_trial_tiebreak_qualifiers
    set state = case when wallet = v_tiebreak_leader.wallet then 'completed' else 'eliminated' end,
        updated_at = v_now
    where round_id = v_round.round_id and state = 'pending';

    update private.tree_knowledge_trial_rounds
    set state = 'scored', winner_wallet = v_tiebreak_leader.wallet,
        winner_attempt_id = v_source_attempt_id,
        winner_tiebreak_attempt_id = v_tiebreak_leader.tiebreak_attempt_id,
        resolution_reason = 'sudden-death', resolved_at = v_now, updated_at = v_now
    where round_id = v_round.round_id;
    return jsonb_build_object(
      'outcome', 'winner', 'roundId', v_round.round_id,
      'winnerWallet', v_tiebreak_leader.wallet,
      'winnerAttemptId', v_source_attempt_id,
      'winnerTiebreakAttemptId', v_tiebreak_leader.tiebreak_attempt_id,
      'stage', v_round.tiebreak_stage,
      'correct', v_tiebreak_leader.correct,
      'elapsedMs', v_tiebreak_leader.elapsed_ms
    );
  end if;

  v_next_stage := v_round.tiebreak_stage + 1;
  select exists (
    select 1 from private.tree_knowledge_trial_tiebreak_questions
    where round_id = v_round.round_id and stage = v_next_stage
  ) into v_question_ready;
  if not v_question_ready then
    return jsonb_build_object(
      'outcome', 'sudden-death-question-required', 'roundId', v_round.round_id,
      'stage', v_next_stage, 'qualifierCount', v_tie_count
    );
  end if;

  update private.tree_knowledge_trial_tiebreak_qualifiers qualifier
  set state = case when exists (
        select 1 from private.tree_knowledge_trial_tiebreak_attempts attempt
        where attempt.round_id = v_round.round_id and attempt.stage = v_round.tiebreak_stage
          and attempt.wallet = qualifier.wallet and attempt.submitted_at is not null
          and attempt.correct = v_tiebreak_leader.correct and attempt.elapsed_ms = v_tiebreak_leader.elapsed_ms
      ) then 'pending' else 'eliminated' end,
      active_stage = case when exists (
        select 1 from private.tree_knowledge_trial_tiebreak_attempts attempt
        where attempt.round_id = v_round.round_id and attempt.stage = v_round.tiebreak_stage
          and attempt.wallet = qualifier.wallet and attempt.submitted_at is not null
          and attempt.correct = v_tiebreak_leader.correct and attempt.elapsed_ms = v_tiebreak_leader.elapsed_ms
      ) then v_next_stage else qualifier.active_stage end,
      updated_at = v_now
  where qualifier.round_id = v_round.round_id and qualifier.state = 'pending';

  update private.tree_knowledge_trial_rounds
  set tiebreak_stage = v_next_stage, tiebreak_stage_opens_at = v_now,
      tiebreak_stage_closes_at = v_now + make_interval(secs => tiebreak_response_window_seconds),
      updated_at = v_now
  where round_id = v_round.round_id
  returning * into v_round;

  return jsonb_build_object(
    'outcome', 'sudden-death-open', 'roundId', v_round.round_id,
    'stage', v_next_stage, 'closesAt', v_round.tiebreak_stage_closes_at,
    'qualifierCount', v_tie_count
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
      select dense_rank() over (order by correct_count desc, elapsed_ms asc)::integer as rank,
        wallet, correct_count as "correctCount", elapsed_ms as "elapsedMs"
      from private.tree_knowledge_trial_attempts
      where round_id = v_round.round_id and submitted_at is not null and not disqualified
      order by correct_count desc, elapsed_ms asc, wallet asc
      limit 50
    ) as ranked;
  end if;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'roundId', v_round.round_id, 'state', v_round.state,
      'questionSetVersion', v_round.question_set_version,
      'durationSeconds', v_round.duration_seconds, 'questionCount', v_round.question_count,
      'minimumQualifyingUsdCents', v_round.minimum_qualifying_usd_cents,
      'purchaseWindowOpensAt', v_round.purchase_window_opens_at,
      'purchaseWindowClosesAt', v_round.purchase_window_closes_at,
      'challengeOpensAt', v_round.challenge_opens_at,
      'challengeClosesAt', v_round.challenge_closes_at,
      'prizeTokenType', v_round.prize_token_type, 'prizeAmountRaw', v_round.prize_amount_raw,
      'winnerWallet', case when v_round.state in ('scored', 'awarded') then v_round.winner_wallet else null end,
      'resolutionReason', v_round.resolution_reason,
      'suddenDeathRequired', v_round.state = 'tiebreak',
      'tiebreakStage', case when v_round.state = 'tiebreak' then v_round.tiebreak_stage else null end,
      'tiebreakOpensAt', case when v_round.state = 'tiebreak' then v_round.tiebreak_stage_opens_at else null end,
      'tiebreakClosesAt', case when v_round.state = 'tiebreak' then v_round.tiebreak_stage_closes_at else null end
    ),
    'submissionCount', v_submission_count,
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke all on function public.create_tree_knowledge_trial_tiebreak_challenge_v1(text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_tiebreak_challenge_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.consume_tree_knowledge_trial_tiebreak_challenge_v1(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.start_tree_knowledge_trial_tiebreak_attempt_v1(text, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_tiebreak_attempt_context_v1(text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_tiebreak_question_v1(text, integer)
  from public, anon, authenticated;
revoke all on function public.submit_tree_knowledge_trial_tiebreak_attempt_v1(text, text)
  from public, anon, authenticated;
revoke all on function public.resolve_tree_knowledge_trial_round_v2(text)
  from public, anon, authenticated;

grant execute on function public.create_tree_knowledge_trial_tiebreak_challenge_v1(text, text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_tiebreak_challenge_v1(uuid)
  to service_role;
grant execute on function public.consume_tree_knowledge_trial_tiebreak_challenge_v1(uuid, text, text, integer)
  to service_role;
grant execute on function public.start_tree_knowledge_trial_tiebreak_attempt_v1(text, text, integer, text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_tiebreak_attempt_context_v1(text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_tiebreak_question_v1(text, integer)
  to service_role;
grant execute on function public.submit_tree_knowledge_trial_tiebreak_attempt_v1(text, text)
  to service_role;
grant execute on function public.resolve_tree_knowledge_trial_round_v2(text)
  to service_role;
