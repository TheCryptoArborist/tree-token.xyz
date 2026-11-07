-- Attendance recovery is deliberately separate from verified quest evidence.
begin;
alter table private.arcade_growth_checkins drop constraint arcade_growth_checkins_source_check;
alter table private.arcade_growth_checkins add constraint arcade_growth_checkins_source_check
 check (source in ('manual','verified-game','game-participation','paid-recovery'));
create table private.arcade_checkin_recovery_intents (
 id uuid primary key default gen_random_uuid(), wallet text not null, date_key date not null,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default (clock_timestamp()+interval '15 minutes'),
 digest text unique check (digest ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'), paid_at timestamptz,
 confirmed_at timestamptz, check ((digest is null) = (confirmed_at is null)),
 check ((digest is null) = (paid_at is null))
);
create index arcade_recovery_wallet_day on private.arcade_checkin_recovery_intents(wallet,date_key);
create unique index arcade_recovery_paid_day on private.arcade_checkin_recovery_intents(wallet,date_key) where digest is not null;
create table private.arcade_monthly_reward_qualifications (
 wallet text not null, month_key date not null, rule_version text not null default 'verified-quest-days-v1',
 required_days integer not null default 20 check (required_days=20),
 qualified_at timestamptz not null default clock_timestamp(), qualifying_dates date[] not null,
 primary key(wallet,month_key), check (cardinality(qualifying_dates)>=20)
);
alter table private.arcade_checkin_recovery_intents enable row level security;
alter table private.arcade_monthly_reward_qualifications enable row level security;
revoke all on private.arcade_checkin_recovery_intents,private.arcade_monthly_reward_qualifications from public,anon,authenticated;
grant select,insert,update on private.arcade_checkin_recovery_intents to service_role;
grant select,insert on private.arcade_monthly_reward_qualifications to service_role;
create function public.arcade_monthly_status_v1(p_token_sha256 text,p_origin text) returns jsonb
language plpgsql set search_path='' as $$
declare v_session private.arcade_growth_sessions; v_today date:=(clock_timestamp() at time zone 'UTC')::date;
 v_month date:=date_trunc('month',v_today)::date; v_dates date[]; v_streak integer; v_anchor date;
begin
 v_session:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 -- Multiple completed results on one UTC day count once. Run starts never count.
 select coalesce(array_agg(distinct date_key order by date_key),'{}'::date[]) into v_dates
 from private.arcade_growth_game_events where wallet=v_session.wallet and date_key between v_month and v_today
 and evidence_kind='completed-result';
 if cardinality(v_dates)>=20 then
  insert into private.arcade_monthly_reward_qualifications(wallet,month_key,qualifying_dates)
  values(v_session.wallet,v_month,v_dates) on conflict(wallet,month_key) do nothing;
 end if;
 v_anchor:=case when exists(select 1 from private.arcade_growth_checkins where wallet=v_session.wallet and date_key=v_today) then v_today else v_today-1 end;
 select count(*) into v_streak from (select date_key,row_number() over(order by date_key desc)::integer as n
 from private.arcade_growth_checkins where wallet=v_session.wallet and date_key<=v_anchor) d where date_key=v_anchor-(n-1);
 return jsonb_build_object('wallet',v_session.wallet,'dateKey',to_char(v_today,'YYYY-MM-DD'),'monthKey',to_char(v_month,'YYYY-MM'),
 'attendance',jsonb_build_object('streak',v_streak,'checkedInDays',(select count(*) from private.arcade_growth_checkins where wallet=v_session.wallet and date_key between v_month and v_today),
 'recoveredDates',coalesce((select jsonb_agg(to_char(date_key,'YYYY-MM-DD') order by date_key) from private.arcade_growth_checkins where wallet=v_session.wallet and date_key between v_month and v_today and source='paid-recovery'),'[]'::jsonb),
 'missedDates',coalesce((select jsonb_agg(to_char(d::date,'YYYY-MM-DD') order by d) from generate_series(v_month::timestamp,(v_today-1)::timestamp,interval '1 day') d
 where not exists(select 1 from private.arcade_growth_checkins c where c.wallet=v_session.wallet and c.date_key=d::date)),'[]'::jsonb)),
 'monthlyReward',jsonb_build_object('requiredQuestDays',20,'verifiedQuestDays',cardinality(v_dates),'qualified',cardinality(v_dates)>=20,'qualifyingDates',to_jsonb(v_dates),'todayQualified',v_today=any(v_dates),'rewardDetails','To be announced','ruleVersion','verified-quest-days-v1'));
end $$;
create function public.arcade_recovery_intent_v1(p_token_sha256 text,p_origin text,p_date_key date,p_intent_id uuid default null) returns jsonb
language plpgsql set search_path='' as $$
declare v_session private.arcade_growth_sessions; v_today date:=(clock_timestamp() at time zone 'UTC')::date; v_intent private.arcade_checkin_recovery_intents;
begin
 v_session:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 perform pg_advisory_xact_lock(hashtextextended('arcade-recovery:'||v_session.wallet,0));
 if p_intent_id is not null then
  select * into v_intent from private.arcade_checkin_recovery_intents where id=p_intent_id and wallet=v_session.wallet;
  if not found then raise exception 'arcade-recovery-invalid-intent'; end if;
 else
  if p_date_key is null or p_date_key>=v_today or p_date_key<date_trunc('month',v_today)::date then raise exception 'arcade-recovery-invalid-date'; end if;
  if exists(select 1 from private.arcade_growth_checkins where wallet=v_session.wallet and date_key=p_date_key) then raise exception 'arcade-recovery-already-checked-in'; end if;
  select * into v_intent from private.arcade_checkin_recovery_intents where wallet=v_session.wallet and date_key=p_date_key and digest is null and expires_at>clock_timestamp() order by created_at desc limit 1;
  if not found then insert into private.arcade_checkin_recovery_intents(wallet,date_key) values(v_session.wallet,p_date_key) returning * into v_intent; end if;
 end if;
 return jsonb_build_object('id',v_intent.id,'wallet',v_intent.wallet,'dateKey',to_char(v_intent.date_key,'YYYY-MM-DD'),
 'createdAt',v_intent.created_at,'expiresAt',v_intent.expires_at,'digest',v_intent.digest);
end $$;
create function public.arcade_recovery_confirm_v1(p_token_sha256 text,p_origin text,p_intent_id uuid,p_digest text,p_paid_at timestamptz) returns jsonb
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
 if v_intent.date_key>=v_today or v_intent.date_key<date_trunc('month',v_today)::date then raise exception 'arcade-recovery-invalid-date'; end if;
 if p_paid_at is null or p_paid_at<v_intent.created_at-interval '5 seconds' or p_paid_at>v_intent.expires_at or p_paid_at>clock_timestamp()+interval '5 seconds' then raise exception 'arcade-recovery-payment-time'; end if;
 if exists(select 1 from private.arcade_growth_checkins where wallet=v_session.wallet and date_key=v_intent.date_key) then raise exception 'arcade-recovery-already-checked-in'; end if;
 update private.arcade_checkin_recovery_intents set digest=p_digest,paid_at=p_paid_at,confirmed_at=clock_timestamp() where id=v_intent.id;
 insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_session.wallet,v_intent.date_key,'paid-recovery');
 -- Existing attendance badges remain attendance awards. No quest/event is inserted.
 perform private.arcade_growth_award_badges_v1(v_session.wallet,date_trunc('month',v_today)::date,
 private.arcade_growth_month_games_v1(date_trunc('month',v_today)::date,array['garden-bot','pvp','arborist-trials','treeforce89']::text[],true));
 return public.arcade_monthly_status_v1(p_token_sha256,p_origin);
end $$;
revoke all on function public.arcade_monthly_status_v1(text,text),public.arcade_recovery_intent_v1(text,text,date,uuid),public.arcade_recovery_confirm_v1(text,text,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.arcade_monthly_status_v1(text,text),public.arcade_recovery_intent_v1(text,text,date,uuid),public.arcade_recovery_confirm_v1(text,text,uuid,text,timestamptz) to service_role;
commit;
