-- Additive campaign progress only. Requires the reviewed arcade_social migration.
begin;
create table private.arcade_campaign_enrollments (
 wallet text primary key check(wallet ~ '^0x[0-9a-f]{64}$'),
 started_at timestamptz not null default clock_timestamp()
);
create table private.arcade_campaign_quiz_attempts (
 id uuid primary key default gen_random_uuid(), wallet text not null check(wallet ~ '^0x[0-9a-f]{64}$'),
 week_key date not null, submitted_at timestamptz not null default clock_timestamp(),
 score smallint not null check(score between 0 and 3)
);
create index arcade_campaign_quiz_wallet_time on private.arcade_campaign_quiz_attempts(wallet,submitted_at desc);
create unique index arcade_campaign_quiz_pass_once on private.arcade_campaign_quiz_attempts(wallet,week_key) where score=3;
create table private.arcade_campaign_claims (
 wallet text primary key references private.arcade_campaign_enrollments(wallet),
 badge_id text not null default 'first-round-v1' check(badge_id='first-round-v1'),
 claimed_at timestamptz not null default clock_timestamp(), evidence jsonb not null
);
alter table private.arcade_campaign_enrollments enable row level security;
alter table private.arcade_campaign_quiz_attempts enable row level security;
alter table private.arcade_campaign_claims enable row level security;
revoke all on private.arcade_campaign_enrollments,private.arcade_campaign_quiz_attempts,private.arcade_campaign_claims from public,anon,authenticated;
grant select,insert on private.arcade_campaign_enrollments,private.arcade_campaign_quiz_attempts,private.arcade_campaign_claims to service_role;

create function private.arcade_campaign_snapshot_v1(p_wallet text) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare start_time timestamptz; tasks jsonb; claimed timestamptz; week date;
begin
 select started_at into start_time from private.arcade_campaign_enrollments where wallet=p_wallet;
 week:=date_trunc('week',clock_timestamp() at time zone 'UTC')::date;
 tasks:=jsonb_build_object(
 'checkIn',start_time is not null and exists(select 1 from private.arcade_growth_checkins where wallet=p_wallet and date_key >= (start_time at time zone 'UTC')::date and date_key <= (clock_timestamp() at time zone 'UTC')::date),
 'quiz',start_time is not null and exists(select 1 from private.arcade_campaign_quiz_attempts where wallet=p_wallet and score=3 and week_key >= date_trunc('week',start_time at time zone 'UTC')::date),
 'game',start_time is not null and exists(select 1 from private.arcade_growth_game_events where wallet=p_wallet and evidence_kind='completed-result' and completed_at>=start_time and completed_at<=clock_timestamp()),
 'share',start_time is not null and exists(select 1 from private.arcade_social_entries where wallet=p_wallet and mission='share-score' and status='completed' and week_key>=date_trunc('week',start_time at time zone 'UTC')::date));
 select claimed_at into claimed from private.arcade_campaign_claims where wallet=p_wallet;
 return jsonb_build_object('wallet',p_wallet,'campaignId','first-round-v1','startedAt',start_time,'tasks',tasks,'claimedAt',claimed,
 'weekKey',week,'quizCompleteThisWeek',exists(select 1 from private.arcade_campaign_quiz_attempts where wallet=p_wallet and score=3 and week_key=week),
 'learningStamps',(select count(*) from private.arcade_campaign_quiz_attempts where wallet=p_wallet and score=3),
 'canClaim',start_time is not null and claimed is null and not exists(select 1 from jsonb_each(tasks) t where t.value <> 'true'::jsonb));
end $$;

create function public.arcade_campaign_v1(p_token_sha256 text,p_origin text,p_action text default 'status',p_answers text[] default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_growth_sessions; progress jsonb; v_score int; result jsonb; week date;
begin
 s:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 if p_action is null or p_action not in ('status','start','quiz','claim') then raise exception 'arcade-campaign-invalid-request'; end if;
 if p_action<>'quiz' and p_answers is not null then raise exception 'arcade-campaign-invalid-request'; end if;
 -- The same lock serializes enroll, quiz awards and badge claims for this wallet.
 if p_action<>'status' then
  perform pg_advisory_xact_lock(hashtextextended('arcade-campaign:'||s.wallet,0));
  if s.expires_at<=clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
 end if;
 week:=date_trunc('week',clock_timestamp() at time zone 'UTC')::date;
 if p_action='start' then
  insert into private.arcade_campaign_enrollments(wallet) values(s.wallet) on conflict(wallet) do nothing;
 elsif p_action='quiz' then
  if p_answers is null or cardinality(p_answers)<>3 or array_ndims(p_answers)<>1 or array_lower(p_answers,1)<>1 or array_upper(p_answers,1)<>3 or array_position(p_answers,null) is not null
    or p_answers[1] not in ('arcade','chart','wallet') or p_answers[2] not in ('buy','attendance','post') or p_answers[3] not in ('open','paste','review')
    then raise exception 'arcade-campaign-invalid-request'; end if;
  if exists(select 1 from private.arcade_campaign_quiz_attempts where wallet=s.wallet and week_key=week and score=3) then
   result:=jsonb_build_object('score',3,'passed',true,'alreadyEarned',true);
  else
   if (select count(*) from private.arcade_campaign_quiz_attempts where wallet=s.wallet and submitted_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'arcade-campaign-rate-limited'; end if;
   v_score:=(case when p_answers[1]='arcade' then 1 else 0 end)+(case when p_answers[2]='attendance' then 1 else 0 end)+(case when p_answers[3]='review' then 1 else 0 end);
   insert into private.arcade_campaign_quiz_attempts(wallet,week_key,score) values(s.wallet,week,v_score);
   result:=jsonb_build_object('score',v_score,'passed',v_score=3,'alreadyEarned',false);
  end if;
 elsif p_action='claim' then
  progress:=private.arcade_campaign_snapshot_v1(s.wallet);
  if progress->>'claimedAt' is null then
   if not (progress->>'canClaim')::boolean then raise exception 'arcade-campaign-incomplete'; end if;
   insert into private.arcade_campaign_claims(wallet,evidence) values(s.wallet,progress) on conflict(wallet) do nothing;
  end if;
 end if;
 return jsonb_build_object('progress',private.arcade_campaign_snapshot_v1(s.wallet),'quizResult',result);
end $$;
revoke all on function private.arcade_campaign_snapshot_v1(text),public.arcade_campaign_v1(text,text,text,text[]) from public,anon,authenticated;
grant execute on function private.arcade_campaign_snapshot_v1(text),public.arcade_campaign_v1(text,text,text,text[]) to service_role;
commit;
