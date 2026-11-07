-- A paid checkout stays reconcilable after UTC month rollover.
create or replace function public.arcade_recovery_confirm_v1(p_token_sha256 text,p_origin text,p_intent_id uuid,p_digest text,p_paid_at timestamptz) returns jsonb
language plpgsql set search_path='' as $$
declare v_session private.arcade_growth_sessions; v_today date:=(clock_timestamp() at time zone 'UTC')::date; v_intent private.arcade_checkin_recovery_intents;
begin
 v_session:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 perform pg_advisory_xact_lock(hashtextextended('arcade-recovery:'||v_session.wallet,0));
 select * into v_intent from private.arcade_checkin_recovery_intents where id=p_intent_id and wallet=v_session.wallet for update;
 if not found then raise exception 'arcade-recovery-invalid-intent'; end if;
 if v_intent.digest is not null then
  if v_intent.digest<>p_digest then raise exception 'arcade-recovery-payment-used'; end if;
  return public.arcade_monthly_status_v1(p_token_sha256,p_origin);
 end if;
 if v_intent.date_key >= (v_intent.created_at at time zone 'UTC')::date or v_intent.date_key < date_trunc('month',v_intent.created_at at time zone 'UTC')::date then raise exception 'arcade-recovery-invalid-date'; end if;
 if p_paid_at is null or p_paid_at<v_intent.created_at-interval '5 seconds' or p_paid_at>v_intent.expires_at or p_paid_at>clock_timestamp()+interval '5 seconds' then raise exception 'arcade-recovery-payment-time'; end if;
 if exists(select 1 from private.arcade_growth_checkins where wallet=v_session.wallet and date_key=v_intent.date_key) then raise exception 'arcade-recovery-already-checked-in'; end if;
 update private.arcade_checkin_recovery_intents set digest=p_digest,paid_at=p_paid_at,confirmed_at=clock_timestamp() where id=v_intent.id;
 insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_session.wallet,v_intent.date_key,'paid-recovery');
 -- Existing attendance badges remain attendance awards. No quest/event is inserted.
 perform private.arcade_growth_award_badges_v1(v_session.wallet,date_trunc('month',v_intent.date_key)::date,
 private.arcade_growth_month_games_v1(date_trunc('month',v_intent.date_key)::date,array['garden-bot','pvp','arborist-trials','treeforce89']::text[],true));
 return public.arcade_monthly_status_v1(p_token_sha256,p_origin);
end $$;
