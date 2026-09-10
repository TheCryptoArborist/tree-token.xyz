create table if not exists private.tree_knowledge_trial_awards (
  round_id text primary key references private.tree_knowledge_trial_rounds(round_id) on delete restrict,
  onchain_draw_id text not null unique
    check (onchain_draw_id ~ '^[a-z0-9][a-z0-9:_-]{2,95}$'),
  resolution_commitment text not null
    check (resolution_commitment ~ '^[0-9a-f]{64}$'),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  token_type text not null check (length(token_type) between 3 and 512),
  amount_raw numeric(78, 0) not null check (amount_raw > 0 and amount_raw <= 18446744073709551615),
  draw_tx_digest text check (draw_tx_digest is null or draw_tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  register_tx_digest text check (register_tx_digest is null or register_tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  awarded_at timestamptz,
  claimed boolean not null default false,
  claim_tx_digest text check (claim_tx_digest is null or claim_tx_digest ~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((draw_tx_digest is null and register_tx_digest is null and awarded_at is null)
    or (draw_tx_digest is not null and register_tx_digest is not null and awarded_at is not null)),
  check ((not claimed and claim_tx_digest is null and claimed_at is null)
    or (claimed and claim_tx_digest is not null and claimed_at is not null))
);

alter table private.tree_knowledge_trial_awards enable row level security;
revoke all on private.tree_knowledge_trial_awards from public, anon, authenticated;

create or replace function public.lock_next_tree_knowledge_trial_award_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_round private.tree_knowledge_trial_rounds%rowtype;
  v_award private.tree_knowledge_trial_awards%rowtype;
  v_onchain_draw_id text;
  v_canonical_resolution text;
  v_resolution_commitment text;
begin
  select * into v_round
  from private.tree_knowledge_trial_rounds
  where state = 'scored' and winner_wallet is not null
  order by resolved_at asc, round_id asc
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-knowledge-award:' || v_round.round_id, 0)
  );

  if v_round.winner_attempt_id is null or v_round.resolution_reason is null or v_round.resolved_at is null then
    raise exception using errcode = '55000', message = 'The Knowledge Trial winner resolution is incomplete.';
  end if;
  if v_round.prize_amount_raw > 18446744073709551615 then
    raise exception using errcode = '22003', message = 'The Knowledge Trial prize exceeds the on-chain u64 limit.';
  end if;

  v_onchain_draw_id := v_round.round_id || ':award';
  v_canonical_resolution := pg_catalog.concat_ws(E'\n',
    'tree-knowledge-award-v1',
    v_round.round_id,
    v_round.winner_wallet,
    v_round.winner_attempt_id::text,
    pg_catalog.coalesce(v_round.winner_tiebreak_attempt_id::text, ''),
    v_round.resolution_reason,
    v_round.prize_token_type,
    v_round.prize_amount_raw::text
  );
  v_resolution_commitment := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_canonical_resolution, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into private.tree_knowledge_trial_awards (
    round_id, onchain_draw_id, resolution_commitment, wallet, token_type, amount_raw
  ) values (
    v_round.round_id, v_onchain_draw_id, v_resolution_commitment,
    v_round.winner_wallet, v_round.prize_token_type, v_round.prize_amount_raw
  ) on conflict (round_id) do nothing;

  select * into v_award
  from private.tree_knowledge_trial_awards
  where round_id = v_round.round_id;

  if v_award.onchain_draw_id <> v_onchain_draw_id
     or v_award.resolution_commitment <> v_resolution_commitment
     or v_award.wallet <> v_round.winner_wallet
     or v_award.token_type <> v_round.prize_token_type
     or v_award.amount_raw <> v_round.prize_amount_raw then
    raise exception using errcode = '23505', message = 'The Knowledge Trial award conflicts with the resolved winner.';
  end if;

  return jsonb_build_object(
    'roundId', v_award.round_id,
    'onchainDrawId', v_award.onchain_draw_id,
    'resolutionCommitment', v_award.resolution_commitment,
    'totalTickets', '1',
    'wallet', v_award.wallet,
    'tokenType', v_award.token_type,
    'amountRaw', v_award.amount_raw::text,
    'alreadyAwarded', v_award.awarded_at is not null,
    'drawTxDigest', v_award.draw_tx_digest,
    'registerTxDigest', v_award.register_tx_digest
  );
end;
$$;

create or replace function public.record_tree_knowledge_trial_award_v1(
  p_round_id text,
  p_onchain_draw_id text,
  p_resolution_commitment text,
  p_wallet text,
  p_draw_tx_digest text,
  p_register_tx_digest text
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
  v_award private.tree_knowledge_trial_awards%rowtype;
  v_outcome text := 'recorded';
begin
  if p_round_id is null or p_round_id !~ '^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or p_onchain_draw_id is null or p_onchain_draw_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$'
     or p_resolution_commitment is null or p_resolution_commitment !~ '^[0-9a-f]{64}$'
     or v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_draw_tx_digest is null or p_draw_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'
     or p_register_tx_digest is null or p_register_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial award record.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-knowledge-award:' || p_round_id, 0)
  );

  select * into v_round
  from private.tree_knowledge_trial_rounds
  where round_id = p_round_id
  for update;
  if not found or v_round.state not in ('scored', 'awarded') then
    raise exception using errcode = '55000', message = 'The Knowledge Trial round is not ready for an award.';
  end if;

  select * into v_award
  from private.tree_knowledge_trial_awards
  where round_id = p_round_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The Knowledge Trial award snapshot was not found.';
  end if;

  if v_award.onchain_draw_id <> p_onchain_draw_id
     or v_award.resolution_commitment <> p_resolution_commitment
     or v_award.wallet <> v_wallet
     or v_round.winner_wallet <> v_wallet then
    raise exception using errcode = '22023', message = 'The on-chain Knowledge Trial award does not match the resolved winner.';
  end if;

  if v_award.awarded_at is not null then
    if v_award.draw_tx_digest <> p_draw_tx_digest or v_award.register_tx_digest <> p_register_tx_digest then
      raise exception using errcode = '23505', message = 'The Knowledge Trial award conflicts with the recorded transactions.';
    end if;
    v_outcome := 'duplicate';
  else
    update private.tree_knowledge_trial_awards
    set draw_tx_digest = p_draw_tx_digest,
        register_tx_digest = p_register_tx_digest,
        awarded_at = now(),
        updated_at = now()
    where round_id = p_round_id
    returning * into v_award;
  end if;

  update private.tree_knowledge_trial_rounds
  set state = 'awarded', updated_at = now()
  where round_id = p_round_id and state = 'scored';

  return jsonb_build_object(
    'outcome', v_outcome,
    'roundId', v_award.round_id,
    'onchainDrawId', v_award.onchain_draw_id,
    'wallet', v_award.wallet,
    'tokenType', v_award.token_type,
    'amountRaw', v_award.amount_raw::text,
    'drawTxDigest', v_award.draw_tx_digest,
    'registerTxDigest', v_award.register_tx_digest,
    'awardedAt', v_award.awarded_at
  );
end;
$$;

create or replace function public.read_tree_knowledge_trial_award_v1(
  p_round_id text,
  p_wallet text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := lower(p_wallet);
  v_award private.tree_knowledge_trial_awards%rowtype;
begin
  if p_round_id is null or p_round_id !~ '^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial award lookup.';
  end if;

  select * into v_award
  from private.tree_knowledge_trial_awards
  where round_id = p_round_id and wallet = v_wallet and awarded_at is not null;
  if not found then return null; end if;

  return jsonb_build_object(
    'roundId', v_award.round_id,
    'onchainDrawId', v_award.onchain_draw_id,
    'wallet', v_award.wallet,
    'tokenType', v_award.token_type,
    'amountRaw', v_award.amount_raw::text,
    'awardedAt', v_award.awarded_at,
    'claimed', v_award.claimed,
    'claimTxDigest', v_award.claim_tx_digest,
    'claimedAt', v_award.claimed_at
  );
end;
$$;

create or replace function public.record_tree_knowledge_trial_claim_v1(
  p_round_id text,
  p_wallet text,
  p_claim_tx_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := lower(p_wallet);
  v_award private.tree_knowledge_trial_awards%rowtype;
  v_outcome text := 'recorded';
begin
  if p_round_id is null or p_round_id !~ '^knowledge:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_claim_tx_digest is null or p_claim_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$' then
    raise exception using errcode = '22023', message = 'Invalid Knowledge Trial claim record.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-knowledge-claim:' || p_round_id, 0)
  );

  select * into v_award
  from private.tree_knowledge_trial_awards
  where round_id = p_round_id
  for update;
  if not found or v_award.awarded_at is null or v_award.wallet <> v_wallet then
    raise exception using errcode = 'P0002', message = 'The claimable Knowledge Trial award was not found.';
  end if;

  if v_award.claimed then
    if v_award.claim_tx_digest <> p_claim_tx_digest then
      raise exception using errcode = '23505', message = 'The Knowledge Trial claim conflicts with the recorded transaction.';
    end if;
    v_outcome := 'duplicate';
  else
    update private.tree_knowledge_trial_awards
    set claimed = true, claim_tx_digest = p_claim_tx_digest,
        claimed_at = now(), updated_at = now()
    where round_id = p_round_id
    returning * into v_award;
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'roundId', v_award.round_id,
    'wallet', v_award.wallet,
    'claimTxDigest', v_award.claim_tx_digest,
    'claimedAt', v_award.claimed_at
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
  v_award private.tree_knowledge_trial_awards%rowtype;
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

  select * into v_award
  from private.tree_knowledge_trial_awards
  where round_id = v_round.round_id;

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
      'tiebreakClosesAt', case when v_round.state = 'tiebreak' then v_round.tiebreak_stage_closes_at else null end,
      'award', case when v_award.round_id is null then null else jsonb_build_object(
        'onchainDrawId', v_award.onchain_draw_id,
        'wallet', v_award.wallet,
        'tokenType', v_award.token_type,
        'amountRaw', v_award.amount_raw::text,
        'claimable', v_award.awarded_at is not null and not v_award.claimed,
        'claimed', v_award.claimed,
        'claimTxDigest', v_award.claim_tx_digest,
        'awardedAt', v_award.awarded_at,
        'claimedAt', v_award.claimed_at
      ) end
    ),
    'submissionCount', v_submission_count,
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke all on function public.lock_next_tree_knowledge_trial_award_v1()
  from public, anon, authenticated;
revoke all on function public.record_tree_knowledge_trial_award_v1(text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_award_v1(text, text)
  from public, anon, authenticated;
revoke all on function public.record_tree_knowledge_trial_claim_v1(text, text, text)
  from public, anon, authenticated;
revoke all on function public.read_tree_knowledge_trial_public_snapshot_v1()
  from public, anon, authenticated;

grant execute on function public.lock_next_tree_knowledge_trial_award_v1()
  to service_role;
grant execute on function public.record_tree_knowledge_trial_award_v1(text, text, text, text, text, text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_award_v1(text, text)
  to service_role;
grant execute on function public.record_tree_knowledge_trial_claim_v1(text, text, text)
  to service_role;
grant execute on function public.read_tree_knowledge_trial_public_snapshot_v1()
  to service_role;
