alter table private.tree_knowledge_trial_tiebreak_questions
  add column explanation text not null default 'Answer explanation retained in the private setup ledger.'
    check (length(explanation) between 3 and 1000);

create table private.tree_knowledge_trial_admin_events (
  event_id bigint generated always as identity primary key,
  round_id text not null references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  action text not null check (action in ('draft-prepared')),
  question_set_version text not null,
  daily_question_count integer not null check (daily_question_count = 5),
  tiebreak_question_count integer not null check (tiebreak_question_count between 3 and 10),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index tree_knowledge_trial_admin_events_round_idx
  on private.tree_knowledge_trial_admin_events (round_id, created_at desc);

alter table private.tree_knowledge_trial_admin_events enable row level security;
revoke all on private.tree_knowledge_trial_admin_events from public, anon, authenticated;

create or replace function public.prepare_tree_knowledge_trial_round_v1(
  p_round_id text,
  p_question_set_version text,
  p_questions jsonb,
  p_tiebreak_questions jsonb,
  p_purchase_window_opens_at timestamptz,
  p_purchase_window_closes_at timestamptz,
  p_challenge_opens_at timestamptz,
  p_challenge_closes_at timestamptz,
  p_prize_token_type text,
  p_prize_amount_raw numeric,
  p_request_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '8s'
as $$
declare
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_tiebreak_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_round_id is null or p_round_id !~ '^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or p_question_set_version is null or length(p_question_set_version) not between 3 and 96
     or p_request_sha256 is null or p_request_sha256 !~ '^[0-9a-f]{64}$'
     or p_prize_token_type is null or length(p_prize_token_type) not between 3 and 512
     or p_prize_amount_raw is null or p_prize_amount_raw <= 0
     or p_purchase_window_opens_at is null or p_purchase_window_closes_at is null
     or p_challenge_opens_at is null or p_challenge_closes_at is null
     or p_purchase_window_opens_at >= p_purchase_window_closes_at
     or p_challenge_opens_at >= p_challenge_closes_at then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial draft configuration.';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> 5 then
    raise exception using errcode = '22023', message = 'A Knowledge Trial draft requires exactly five daily questions.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_questions) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(length(item ->> 'id'), 0) not between 2 and 64
      or coalesce(length(item ->> 'prompt'), 0) not between 8 and 500
      or jsonb_typeof(item -> 'options') <> 'array'
      or jsonb_array_length(item -> 'options') not between 2 and 6
      or coalesce(length(item ->> 'correctOptionId'), 0) not between 1 and 8
      or coalesce(length(item ->> 'explanation'), 0) not between 3 and 1000
      or not exists (
        select 1 from jsonb_array_elements(item -> 'options') option
        where option ->> 'id' = item ->> 'correctOptionId'
      )
  ) then
    raise exception using errcode = '22023', message = 'A daily Knowledge Trial question or answer key is invalid.';
  end if;
  if (select count(distinct item ->> 'id') from jsonb_array_elements(p_questions) item) <> 5 then
    raise exception using errcode = '22023', message = 'Daily Knowledge Trial question IDs must be unique.';
  end if;

  if p_tiebreak_questions is null or jsonb_typeof(p_tiebreak_questions) <> 'array'
     or jsonb_array_length(p_tiebreak_questions) not between 3 and 10 then
    raise exception using errcode = '22023', message = 'A Knowledge Trial draft requires three to ten sudden-death questions.';
  end if;
  v_tiebreak_count := jsonb_array_length(p_tiebreak_questions);
  if exists (
    select 1 from jsonb_array_elements(p_tiebreak_questions) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(length(item ->> 'id'), 0) not between 2 and 64
      or coalesce(length(item ->> 'prompt'), 0) not between 8 and 500
      or jsonb_typeof(item -> 'options') <> 'array'
      or jsonb_array_length(item -> 'options') not between 2 and 6
      or coalesce(length(item ->> 'correctOptionId'), 0) not between 1 and 8
      or coalesce(length(item ->> 'explanation'), 0) not between 3 and 1000
      or not exists (
        select 1 from jsonb_array_elements(item -> 'options') option
        where option ->> 'id' = item ->> 'correctOptionId'
      )
  ) then
    raise exception using errcode = '22023', message = 'A sudden-death question or answer key is invalid.';
  end if;
  if (select count(distinct item ->> 'id') from jsonb_array_elements(p_tiebreak_questions) item) <> v_tiebreak_count then
    raise exception using errcode = '22023', message = 'Sudden-death question IDs must be unique.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_tiebreak_questions) tiebreak
    join jsonb_array_elements(p_questions) daily
      on tiebreak ->> 'id' = daily ->> 'id'
  ) then
    raise exception using errcode = '22023', message = 'Question IDs must be unique across the entire draft.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tree-knowledge-admin:' || p_round_id, 0));
  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;
  if found and v_round.state <> 'draft' then
    raise exception using errcode = '55000', message = 'Only a draft Knowledge Trial round can be revised.';
  end if;

  insert into private.tree_knowledge_trial_question_sets (
    question_set_version, question_count, questions, created_at, updated_at
  ) values (
    p_question_set_version, 5, p_questions, v_now, v_now
  )
  on conflict (question_set_version) do update
    set question_count = excluded.question_count,
        questions = excluded.questions,
        updated_at = v_now;

  insert into private.tree_knowledge_trial_rounds (
    round_id, state, question_set_version, duration_seconds, question_count,
    minimum_qualifying_usd_cents, purchase_window_opens_at, purchase_window_closes_at,
    challenge_opens_at, challenge_closes_at, prize_token_type, prize_amount_raw,
    created_at, updated_at
  ) values (
    p_round_id, 'draft', p_question_set_version, 180, 5,
    500, p_purchase_window_opens_at, p_purchase_window_closes_at,
    p_challenge_opens_at, p_challenge_closes_at, p_prize_token_type, p_prize_amount_raw,
    v_now, v_now
  )
  on conflict (round_id) do update
    set question_set_version = excluded.question_set_version,
        duration_seconds = 180,
        question_count = 5,
        minimum_qualifying_usd_cents = 500,
        purchase_window_opens_at = excluded.purchase_window_opens_at,
        purchase_window_closes_at = excluded.purchase_window_closes_at,
        challenge_opens_at = excluded.challenge_opens_at,
        challenge_closes_at = excluded.challenge_closes_at,
        prize_token_type = excluded.prize_token_type,
        prize_amount_raw = excluded.prize_amount_raw,
        updated_at = v_now;

  delete from private.tree_knowledge_trial_tiebreak_questions
  where round_id = p_round_id;

  insert into private.tree_knowledge_trial_tiebreak_questions (
    round_id, stage, question, correct_option_id, duration_seconds, explanation, created_at, updated_at
  )
  select
    p_round_id,
    ordinal::integer,
    item - 'correctOptionId' - 'explanation',
    item ->> 'correctOptionId',
    30,
    item ->> 'explanation',
    v_now,
    v_now
  from jsonb_array_elements(p_tiebreak_questions) with ordinality as questions(item, ordinal);

  insert into private.tree_knowledge_trial_admin_events (
    round_id, action, question_set_version, daily_question_count,
    tiebreak_question_count, request_sha256, created_at
  ) values (
    p_round_id, 'draft-prepared', p_question_set_version, 5,
    v_tiebreak_count, p_request_sha256, v_now
  );

  return jsonb_build_object(
    'roundId', p_round_id,
    'state', 'draft',
    'questionSetVersion', p_question_set_version,
    'dailyQuestionCount', 5,
    'tiebreakQuestionCount', v_tiebreak_count,
    'durationSeconds', 180,
    'minimumQualifyingUsdCents', 500,
    'purchaseWindowOpensAt', p_purchase_window_opens_at,
    'purchaseWindowClosesAt', p_purchase_window_closes_at,
    'challengeOpensAt', p_challenge_opens_at,
    'challengeClosesAt', p_challenge_closes_at,
    'prizeAmountRaw', p_prize_amount_raw,
    'preparedAt', v_now
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_round_setup_v1(
  p_round_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_daily_count integer := 0;
  v_tiebreak_count integer := 0;
  v_last_prepared_at timestamptz;
begin
  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id;
  if not found then return null; end if;

  select question_count into v_daily_count
  from private.tree_knowledge_trial_question_sets
  where question_set_version = v_round.question_set_version;

  select count(*) into v_tiebreak_count
  from private.tree_knowledge_trial_tiebreak_questions
  where round_id = v_round.round_id;

  select max(created_at) into v_last_prepared_at
  from private.tree_knowledge_trial_admin_events
  where round_id = v_round.round_id and action = 'draft-prepared';

  return jsonb_build_object(
    'roundId', v_round.round_id,
    'state', v_round.state,
    'questionSetVersion', v_round.question_set_version,
    'dailyQuestionCount', v_daily_count,
    'tiebreakQuestionCount', v_tiebreak_count,
    'durationSeconds', v_round.duration_seconds,
    'minimumQualifyingUsdCents', v_round.minimum_qualifying_usd_cents,
    'purchaseWindowOpensAt', v_round.purchase_window_opens_at,
    'purchaseWindowClosesAt', v_round.purchase_window_closes_at,
    'challengeOpensAt', v_round.challenge_opens_at,
    'challengeClosesAt', v_round.challenge_closes_at,
    'prizeAmountRaw', v_round.prize_amount_raw,
    'readyForReview', v_round.state = 'draft' and v_daily_count = 5 and v_tiebreak_count >= 3,
    'lastPreparedAt', v_last_prepared_at
  );
end;
$$;

revoke all on function public.prepare_tree_knowledge_trial_round_v1(
  text, text, jsonb, jsonb, timestamptz, timestamptz, timestamptz, timestamptz, text, numeric, text
) from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_round_setup_v1(text)
  from public, anon, authenticated;

grant execute on function public.prepare_tree_knowledge_trial_round_v1(
  text, text, jsonb, jsonb, timestamptz, timestamptz, timestamptz, timestamptz, text, numeric, text
) to service_role;
grant execute on function public.read_tree_knowledge_trial_round_setup_v1(text)
  to service_role;
