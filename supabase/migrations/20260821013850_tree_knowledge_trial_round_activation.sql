alter table private.tree_knowledge_trial_admin_events
  drop constraint tree_knowledge_trial_admin_events_action_check;

alter table private.tree_knowledge_trial_admin_events
  add constraint tree_knowledge_trial_admin_events_action_check
  check (action in ('draft-prepared', 'round-scheduled'));

create or replace function public.schedule_tree_knowledge_trial_round_v1(
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
  v_daily_count integer := 0;
  v_tiebreak_count integer := 0;
  v_request_sha256 text;
  v_now timestamptz := clock_timestamp();
begin
  if p_round_id is null or p_round_id !~ '^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial round ID.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-knowledge-admin:' || p_round_id, 0)
  );

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The Knowledge Trial draft does not exist.';
  end if;
  if v_round.state <> 'draft' then
    raise exception using errcode = '55000', message = 'Only a reviewed draft Knowledge Trial round can be scheduled.';
  end if;
  if v_now >= v_round.challenge_closes_at then
    raise exception using errcode = '22023', message = 'The Knowledge Trial challenge window has already closed.';
  end if;

  select question_count into v_daily_count
  from private.tree_knowledge_trial_question_sets
  where question_set_version = v_round.question_set_version;

  select count(*) into v_tiebreak_count
  from private.tree_knowledge_trial_tiebreak_questions
  where round_id = v_round.round_id;

  select request_sha256 into v_request_sha256
  from private.tree_knowledge_trial_admin_events
  where round_id = v_round.round_id and action = 'draft-prepared'
  order by created_at desc, event_id desc
  limit 1;

  if v_daily_count <> 5 or v_tiebreak_count not between 3 and 10 or v_request_sha256 is null then
    raise exception using errcode = '55000', message = 'The Knowledge Trial draft is not ready for review and scheduling.';
  end if;

  if exists (
    select 1
    from private.tree_knowledge_trial_rounds other
    where other.round_id <> v_round.round_id
      and other.state in ('open', 'tiebreak')
      and other.challenge_opens_at < v_round.challenge_closes_at
      and other.challenge_closes_at > v_round.challenge_opens_at
  ) then
    raise exception using errcode = '55000', message = 'Another Knowledge Trial round overlaps this challenge window.';
  end if;

  update private.tree_knowledge_trial_rounds
  set state = 'open', updated_at = v_now
  where round_id = v_round.round_id
  returning * into v_round;

  insert into private.tree_knowledge_trial_admin_events (
    round_id, action, question_set_version, daily_question_count,
    tiebreak_question_count, request_sha256, created_at
  ) values (
    v_round.round_id, 'round-scheduled', v_round.question_set_version,
    v_daily_count, v_tiebreak_count, v_request_sha256, v_now
  );

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
    'scheduledAt', v_now
  );
end;
$$;

revoke all on function public.schedule_tree_knowledge_trial_round_v1(text)
  from public, anon, authenticated;
grant execute on function public.schedule_tree_knowledge_trial_round_v1(text)
  to service_role;
