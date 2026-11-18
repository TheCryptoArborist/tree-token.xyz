-- The November 2026 season and every subsequent season close at the next UTC
-- month boundary. Preserve earlier checkout terms and all recorded receipts.
-- This migration changes validation only; it does not truncate or erase intents,
-- check-ins, earned badges, or qualifications.
begin;

create or replace function public.arcade_recovery_intent_v1(
 p_token_sha256 text,p_origin text,p_date_key date,p_intent_id uuid default null
) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare
 v_cutoff_effective_month constant date := date '2026-11-01';
 v_session private.arcade_growth_sessions;
 v_intent private.arcade_checkin_recovery_intents;
 v_now timestamptz;
 v_today date;
 v_month date;
 v_expires_at timestamptz;
begin
 v_session:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 perform pg_advisory_xact_lock(hashtextextended('arcade-recovery:'||v_session.wallet,0));
 if p_intent_id is not null then
  -- Looking up an old checkout must remain possible for receipt reconciliation.
  select * into v_intent from private.arcade_checkin_recovery_intents
   where id=p_intent_id and wallet=v_session.wallet;
  if not found then raise exception 'arcade-recovery-invalid-intent'; end if;
 else
  -- Read the clock after obtaining the lock, so waiting across midnight cannot
  -- create a checkout for a season that has already ended.
  v_now:=clock_timestamp();
  v_today:=(v_now at time zone 'UTC')::date;
  v_month:=date_trunc('month',v_now at time zone 'UTC')::date;
  if p_date_key is null or p_date_key>=v_today or p_date_key<v_month then
   raise exception 'arcade-recovery-invalid-date';
  end if;
  if exists(select 1 from private.arcade_growth_checkins
   where wallet=v_session.wallet and date_key=p_date_key) then
   raise exception 'arcade-recovery-already-checked-in';
  end if;
  select * into v_intent from private.arcade_checkin_recovery_intents
   where wallet=v_session.wallet and date_key=p_date_key and digest is null
    and expires_at>v_now order by created_at desc limit 1;
  if not found then
   v_expires_at:=v_now+interval '15 minutes';
   if v_month>=v_cutoff_effective_month then
    v_expires_at:=least(v_expires_at,(v_month+interval '1 month') at time zone 'UTC');
   end if;
   insert into private.arcade_checkin_recovery_intents(wallet,date_key,created_at,expires_at)
    values(v_session.wallet,p_date_key,v_now,v_expires_at) returning * into v_intent;
  end if;
 end if;
 return jsonb_build_object('id',v_intent.id,'wallet',v_intent.wallet,
  'dateKey',to_char(v_intent.date_key,'YYYY-MM-DD'),'createdAt',v_intent.created_at,
  'expiresAt',v_intent.expires_at,'digest',v_intent.digest);
end $$;

create or replace function public.arcade_recovery_confirm_v1(
 p_token_sha256 text,p_origin text,p_intent_id uuid,p_digest text,p_paid_at timestamptz
) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare
 v_cutoff_effective_month constant date := date '2026-11-01';
 v_session private.arcade_growth_sessions;
 v_intent private.arcade_checkin_recovery_intents;
 v_month date;
 v_month_end timestamptz;
begin
 v_session:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 perform pg_advisory_xact_lock(hashtextextended('arcade-recovery:'||v_session.wallet,0));
 select * into v_intent from private.arcade_checkin_recovery_intents
  where id=p_intent_id and wallet=v_session.wallet for update;
 if not found then raise exception 'arcade-recovery-invalid-intent'; end if;
 if v_intent.digest is not null then
  -- Previously recorded receipts remain idempotent, including older terms.
  if v_intent.digest<>p_digest then raise exception 'arcade-recovery-payment-used'; end if;
  return public.arcade_monthly_status_v1(p_token_sha256,p_origin);
 end if;
 if v_intent.date_key >= (v_intent.created_at at time zone 'UTC')::date
  or v_intent.date_key < date_trunc('month',v_intent.created_at at time zone 'UTC')::date then
  raise exception 'arcade-recovery-invalid-date';
 end if;
 v_month:=date_trunc('month',v_intent.date_key::timestamp)::date;
 v_month_end:=(v_month+interval '1 month') at time zone 'UTC';
 -- Validate the actual on-chain payment time, not when its receipt is verified.
 -- The month boundary is exclusive and has no clock-skew grace period. Check it
 -- independently of expires_at so an older, longer checkout or direct service
 -- RPC call cannot authorize a late November-or-later payment. Earlier seasons
 -- retain their original expiry terms; existing rows are deliberately unchanged.
 if v_month>=v_cutoff_effective_month and p_paid_at>=v_month_end then
  raise exception 'arcade-recovery-payment-season-closed';
 end if;
 if p_paid_at is null
  or p_paid_at<v_intent.created_at-interval '5 seconds'
  or p_paid_at>v_intent.expires_at
  or p_paid_at>clock_timestamp()+interval '5 seconds' then
  raise exception 'arcade-recovery-payment-time';
 end if;
 if exists(select 1 from private.arcade_growth_checkins
  where wallet=v_session.wallet and date_key=v_intent.date_key) then
  raise exception 'arcade-recovery-already-checked-in';
 end if;
 update private.arcade_checkin_recovery_intents
  set digest=p_digest,paid_at=p_paid_at,confirmed_at=clock_timestamp() where id=v_intent.id;
 insert into private.arcade_growth_checkins(wallet,date_key,source)
  values(v_session.wallet,v_intent.date_key,'paid-recovery');
 -- Reconciliation can happen in a later month or year, but attendance and badges
 -- belong to the checkout's original month. No quest or completed-result event
 -- is inserted, and previously earned badges remain untouched.
 perform private.arcade_growth_award_badges_v1(v_session.wallet,v_month,
  private.arcade_growth_month_games_v1(v_month,
   array['garden-bot','pvp','arborist-trials','treeforce89']::text[],true));
 return public.arcade_monthly_status_v1(p_token_sha256,p_origin);
end $$;

revoke all on function public.arcade_recovery_intent_v1(text,text,date,uuid),
 public.arcade_recovery_confirm_v1(text,text,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.arcade_recovery_intent_v1(text,text,date,uuid),
 public.arcade_recovery_confirm_v1(text,text,uuid,text,timestamptz) to service_role;
commit;
