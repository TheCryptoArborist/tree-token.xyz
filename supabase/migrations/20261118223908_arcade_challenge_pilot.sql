-- Nonpaying server-authoritative Arborist Trials pilot storage only.
-- No pilot is inserted or enabled. No ordinary game, attendance, badge, Event,
-- reward, payment, schedule or existing RPC is changed by this migration.
-- Only the service role may call the RPCs. The trusted game adapter, not this
-- persistence layer, derives moves/results; a browser report is never authority.
begin;

create function private.arcade_challenge_pilot_safe_json_v1(p_value jsonb,p_depth integer default 0)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare v_key text; v_value jsonb;
begin
  if p_value is null or p_depth>24 then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for v_key,v_value in select key,value from jsonb_each(p_value) loop
      if v_key in ('payable','prizeEligible','awardsEnabled','paymentEnabled','payoutEnabled','rewardEligible','identityVerified','canonicalPlayerVerified') and v_value<>'false'::jsonb then return false; end if;
      if v_key='mode' and v_value<>'"nonpaying-pilot"'::jsonb then return false; end if;
      if v_key='identityScope' and v_value<>'"wallet-session-only"'::jsonb then return false; end if;
      if not private.arcade_challenge_pilot_safe_json_v1(v_value,p_depth+1) then return false; end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v_value in select value from jsonb_array_elements(p_value) loop
      if not private.arcade_challenge_pilot_safe_json_v1(v_value,p_depth+1) then return false; end if;
    end loop;
  end if;
  return true;
end $$;

create function private.arcade_challenge_pilot_utc_v1(p_value timestamptz)
returns text language sql immutable security invoker set search_path='' as $$
  select to_char(p_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create function private.arcade_challenge_pilot_require_session_v1(p_token_sha256 text,p_origin text)
returns private.arcade_growth_sessions language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_growth_sessions;
begin
  -- Hold the same row lock through the RPC transaction. A concurrent revocation
  -- either commits before this validation or waits until this operation ends.
  select * into s from private.arcade_growth_sessions where token_sha256=p_token_sha256 and origin=p_origin for share;
  if not found then raise exception 'arcade-growth-invalid-session'; end if;
  return private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
end $$;

create table private.arcade_challenge_pilot_configs (
  pilot_id text primary key check (pilot_id ~ '^[a-z0-9][a-z0-9._:-]{1,127}$'),
  status text not null default 'draft' check (status in ('draft','enabled','disabled')),
  rules_hash text not null check (rules_hash ~ '^[a-f0-9]{64}$'),
  adapter_id text not null check (adapter_id ~ '^[a-z0-9][a-z0-9._:-]{1,127}$'),
  adapter_version text not null check (adapter_version ~ '^[a-z0-9][a-z0-9._:-]{1,127}$'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  config jsonb not null check (jsonb_typeof(config)='object' and octet_length(config::text)<=16384 and private.arcade_challenge_pilot_safe_json_v1(config)),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_attempt_seconds integer not null check (max_attempt_seconds between 1 and 3600),
  mode text not null default 'nonpaying-pilot' check (mode='nonpaying-pilot'),
  identity_scope text not null default 'wallet-session-only' check (identity_scope='wallet-session-only'),
  payable boolean not null default false check (payable=false),
  prize_eligible boolean not null default false check (prize_eligible=false),
  awards_enabled boolean not null default false check (awards_enabled=false),
  created_at timestamptz not null default clock_timestamp(),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at)
);

create function private.arcade_challenge_pilot_config_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c jsonb; v_start timestamptz; v_end timestamptz; v_date date;
begin
  -- UPDATE(status) is granted solely for SELECT ... FOR SHARE row locking.
  -- The application service still cannot activate, disable or edit any config.
  if current_user='service_role' then raise exception 'challenge-config-operator-required'; end if;
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'challenge-config-locked'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.status<>'draft' then
    if new.status<>'disabled' or (to_jsonb(new)-'status')<>(to_jsonb(old)-'status') then raise exception 'challenge-config-locked'; end if;
    return new;
  end if;
  c:=new.config;
  if jsonb_typeof(c)<>'object' or not (c ?& array['schemaVersion','mode','pilotId','game','adapter','challengeDate','window','maxAttemptSeconds','objective','access','identityScope','payable','prizeEligible','awardsEnabled'])
     or c-array['schemaVersion','mode','pilotId','game','adapter','challengeDate','window','maxAttemptSeconds','objective','access','identityScope','payable','prizeEligible','awardsEnabled']<>'{}'::jsonb
     or c->'schemaVersion' is distinct from '1'::jsonb or c->>'mode' is distinct from 'nonpaying-pilot' or c->>'pilotId' is distinct from new.pilot_id
     or c->>'identityScope' is distinct from 'wallet-session-only' or c->'payable' is distinct from 'false'::jsonb or c->'prizeEligible' is distinct from 'false'::jsonb or c->'awardsEnabled' is distinct from 'false'::jsonb
     or c->'maxAttemptSeconds'<>to_jsonb(new.max_attempt_seconds)
     or c->'objective'<>'{"metric":"wins","operator":"eq","targetUnits":"1"}'::jsonb
     or c->'access'<>'{"entry":"free","purchaseRequired":false,"standardCards":4,"paidAdvantages":"forbidden"}'::jsonb
     or jsonb_typeof(c->'game')<>'object' or not ((c->'game') ?& array['id','version','ruleset','sourceHash'])
     or (c->'game')-array['id','version','ruleset','sourceHash']<>'{}'::jsonb
     or c#>>'{game,id}' is distinct from 'arborist-trials' or c#>>'{game,sourceHash}' is distinct from new.source_hash
     or coalesce(c#>>'{game,version}','') !~ '^[a-z0-9][a-z0-9._:-]{1,127}$'
     or coalesce(c#>>'{game,ruleset}','') !~ '^[a-z0-9][a-z0-9._:-]{1,127}$'
     or c->'adapter'<>jsonb_build_object('id',new.adapter_id,'version',new.adapter_version)
     or jsonb_typeof(c->'window')<>'object' or not ((c->'window') ?& array['startsAt','endsAt'])
     or (c->'window')-array['startsAt','endsAt']<>'{}'::jsonb
     or coalesce(c->>'challengeDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or coalesce(c#>>'{window,startsAt}','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$'
     or coalesce(c#>>'{window,endsAt}','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$'
     or not private.arcade_challenge_pilot_safe_json_v1(c) then raise exception 'challenge-invalid-config'; end if;
  begin
    v_start:=(c#>>'{window,startsAt}')::timestamptz; v_end:=(c#>>'{window,endsAt}')::timestamptz; v_date:=(c->>'challengeDate')::date;
  exception when others then raise exception 'challenge-invalid-config'; end;
  if v_start<>new.starts_at or v_end<>new.ends_at or to_char(v_date,'YYYY-MM-DD')<>c->>'challengeDate' then raise exception 'challenge-invalid-config'; end if;
  return new;
end $$;
create trigger arcade_challenge_pilot_config_guard before insert or update or delete on private.arcade_challenge_pilot_configs
for each row execute function private.arcade_challenge_pilot_config_guard_v1();

create table private.arcade_challenge_pilot_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  attempt_token_sha256 text not null unique check (attempt_token_sha256 ~ '^[a-f0-9]{64}$'),
  pilot_id text not null references private.arcade_challenge_pilot_configs(pilot_id),
  rules_hash text not null check (rules_hash ~ '^[a-f0-9]{64}$'),
  adapter_id text not null, adapter_version text not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  config jsonb not null check (jsonb_typeof(config)='object' and octet_length(config::text)<=16384 and private.arcade_challenge_pilot_safe_json_v1(config)),
  challenge_hash text not null check (challenge_hash ~ '^[a-f0-9]{64}$'),
  seed_hex text not null check (seed_hex ~ '^[a-f0-9]{64}$'),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  origin text not null check (origin in ('https://tree-token.xyz','https://www.tree-token.xyz')),
  session_hash text not null references private.arcade_growth_sessions(token_sha256),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  moves integer[] not null default '{}'::integer[] check (cardinality(moves)<=100 and array_position(moves,null) is null and moves<@array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]),
  version integer not null default 0 check (version between 0 and 100 and version=cardinality(moves)),
  status text not null default 'active' check (status in ('active','completed')),
  result jsonb,
  completed_at timestamptz,
  check (isfinite(started_at) and isfinite(expires_at) and expires_at>started_at),
  check ((status='active' and result is null and completed_at is null) or
         (status='completed' and jsonb_typeof(result)='object' and octet_length(result::text)<=16384 and private.arcade_challenge_pilot_safe_json_v1(result)
          and completed_at is not null and completed_at>=started_at and completed_at<expires_at))
);
create index arcade_challenge_pilot_active_attempts on private.arcade_challenge_pilot_attempts(wallet,pilot_id,expires_at) where status='active';

create function private.arcade_challenge_pilot_attempt_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'challenge-attempt-immutable'; end if;
  if (to_jsonb(new)-array['moves','version','status','result','completed_at'])<>(to_jsonb(old)-array['moves','version','status','result','completed_at'])
     or old.status<>'active' or new.version<>old.version+1
     or cardinality(new.moves)<>cardinality(old.moves)+1 or new.moves[1:cardinality(old.moves)]<>old.moves
     or (new.completed_at is not null and new.completed_at>clock_timestamp()) then raise exception 'challenge-attempt-immutable'; end if;
  return new;
end $$;
create trigger arcade_challenge_pilot_attempt_guard before update or delete on private.arcade_challenge_pilot_attempts
for each row execute function private.arcade_challenge_pilot_attempt_guard_v1();

create table private.arcade_challenge_pilot_requests (
  attempt_id uuid not null references private.arcade_challenge_pilot_attempts(attempt_id),
  request_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  expected_version integer not null check (expected_version between 0 and 99),
  move_id integer not null check (move_id between 1 and 30),
  public_response jsonb not null check (jsonb_typeof(public_response)='object' and octet_length(public_response::text)<=65536 and private.arcade_challenge_pilot_safe_json_v1(public_response)
    and public_response->'payable'='false'::jsonb and public_response->'prizeEligible'='false'::jsonb and public_response->'awardsEnabled'='false'::jsonb
    and public_response->>'mode'='nonpaying-pilot' and public_response->>'identityScope'='wallet-session-only'),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (attempt_id,request_id),
  unique (attempt_id,expected_version)
);
create function private.arcade_challenge_pilot_request_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'challenge-request-immutable'; end $$;
create trigger arcade_challenge_pilot_request_guard before update or delete on private.arcade_challenge_pilot_requests
for each row execute function private.arcade_challenge_pilot_request_guard_v1();

alter table private.arcade_challenge_pilot_configs enable row level security;
alter table private.arcade_challenge_pilot_attempts enable row level security;
alter table private.arcade_challenge_pilot_requests enable row level security;
revoke all on private.arcade_challenge_pilot_configs,private.arcade_challenge_pilot_attempts,private.arcade_challenge_pilot_requests from public,anon,authenticated;
grant select on private.arcade_challenge_pilot_configs to service_role;
grant update(status) on private.arcade_challenge_pilot_configs to service_role;
grant select,insert,update on private.arcade_challenge_pilot_attempts to service_role;
grant select,insert on private.arcade_challenge_pilot_requests to service_role;

create function private.arcade_challenge_pilot_attempt_json_v1(p_attempt private.arcade_challenge_pilot_attempts,p_now timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('attemptId',p_attempt.attempt_id,'pilotId',p_attempt.pilot_id,'rulesHash',p_attempt.rules_hash,
    'adapterId',p_attempt.adapter_id,'adapterVersion',p_attempt.adapter_version,'sourceHash',p_attempt.source_hash,'config',p_attempt.config,
    'challengeHash',p_attempt.challenge_hash,'seedHex',p_attempt.seed_hex,'wallet',p_attempt.wallet,'origin',p_attempt.origin,'sessionHash',p_attempt.session_hash,
    'startedAt',private.arcade_challenge_pilot_utc_v1(p_attempt.started_at),'expiresAt',private.arcade_challenge_pilot_utc_v1(p_attempt.expires_at),
    'moves',to_jsonb(p_attempt.moves),'version',p_attempt.version,'status',p_attempt.status,'result',p_attempt.result,
    'completedAt',private.arcade_challenge_pilot_utc_v1(p_attempt.completed_at),'serverNow',private.arcade_challenge_pilot_utc_v1(p_now),
    'mode','nonpaying-pilot','identityScope','wallet-session-only','payable',false,'prizeEligible',false,'awardsEnabled',false,'replay',null)
$$;

create function public.arcade_challenge_pilot_load_config_v1(p_token_sha256 text,p_origin text,p_pilot_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.arcade_challenge_pilot_configs;
begin
  perform private.arcade_challenge_pilot_require_session_v1(p_token_sha256,p_origin);
  select * into c from private.arcade_challenge_pilot_configs where pilot_id=p_pilot_id;
  if not found then return null; end if;
  return jsonb_build_object('pilotId',c.pilot_id,'status',c.status,'enabled',c.status='enabled','rulesHash',c.rules_hash,
    'adapterId',c.adapter_id,'adapterVersion',c.adapter_version,'sourceHash',c.source_hash,'config',c.config,
    'startsAt',private.arcade_challenge_pilot_utc_v1(c.starts_at),'endsAt',private.arcade_challenge_pilot_utc_v1(c.ends_at),
    'maxAttemptSeconds',c.max_attempt_seconds,'serverNow',private.arcade_challenge_pilot_utc_v1(clock_timestamp()),
    'mode','nonpaying-pilot','identityScope','wallet-session-only','payable',false,'prizeEligible',false,'awardsEnabled',false);
end $$;

create function public.arcade_challenge_pilot_start_v1(p_token_sha256 text,p_origin text,p_pilot_id text,p_rules_hash text,p_attempt_token_sha256 text,p_seed_hex text,p_challenge_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.arcade_growth_sessions; c private.arcade_challenge_pilot_configs; a private.arcade_challenge_pilot_attempts; t timestamptz; x timestamptz;
begin
  s:=private.arcade_challenge_pilot_require_session_v1(p_token_sha256,p_origin);
  select * into c from private.arcade_challenge_pilot_configs where pilot_id=p_pilot_id for share;
  if not found or c.status<>'enabled' then raise exception 'challenge-not-open'; end if;
  if p_rules_hash is distinct from c.rules_hash then raise exception 'challenge-rules-conflict'; end if;
  if coalesce(p_attempt_token_sha256,'') !~ '^[a-f0-9]{64}$' or coalesce(p_seed_hex,'') !~ '^[a-f0-9]{64}$' or coalesce(p_challenge_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'challenge-invalid-start'; end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge-pilot:'||s.wallet||':'||c.pilot_id,0));
  t:=clock_timestamp();
  if t<c.starts_at or t>=c.ends_at or s.expires_at<=t then raise exception 'challenge-not-open'; end if;
  if (select count(*) from private.arcade_challenge_pilot_attempts where wallet=s.wallet and pilot_id=c.pilot_id and status='active' and expires_at>t)>=20 then raise exception 'challenge-attempt-limit'; end if;
  x:=least(c.ends_at,t+make_interval(secs=>c.max_attempt_seconds),s.expires_at);
  insert into private.arcade_challenge_pilot_attempts(attempt_token_sha256,pilot_id,rules_hash,adapter_id,adapter_version,source_hash,config,challenge_hash,seed_hex,wallet,origin,session_hash,started_at,expires_at)
    values(p_attempt_token_sha256,c.pilot_id,c.rules_hash,c.adapter_id,c.adapter_version,c.source_hash,c.config,p_challenge_hash,p_seed_hex,s.wallet,p_origin,p_token_sha256,t,x) returning * into a;
  return private.arcade_challenge_pilot_attempt_json_v1(a,clock_timestamp());
end $$;

create function public.arcade_challenge_pilot_load_attempt_v1(p_token_sha256 text,p_origin text,p_attempt_token_sha256 text,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.arcade_growth_sessions; a private.arcade_challenge_pilot_attempts; r private.arcade_challenge_pilot_requests; v jsonb;
begin
  s:=private.arcade_challenge_pilot_require_session_v1(p_token_sha256,p_origin);
  select * into a from private.arcade_challenge_pilot_attempts where attempt_token_sha256=p_attempt_token_sha256 and session_hash=p_token_sha256 and wallet=s.wallet and origin=p_origin;
  if not found then raise exception 'challenge-attempt-not-found'; end if;
  if s.expires_at<=clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
  v:=private.arcade_challenge_pilot_attempt_json_v1(a,clock_timestamp());
  if p_request_id is not null then
    select * into r from private.arcade_challenge_pilot_requests where attempt_id=a.attempt_id and request_id=p_request_id;
    if found then v:=v||jsonb_build_object('replay',jsonb_build_object('requestHash',r.request_sha256,'expectedVersion',r.expected_version,'moveId',r.move_id,'response',r.public_response)); end if;
  end if;
  return v;
end $$;

create function public.arcade_challenge_pilot_commit_move_v1(p_token_sha256 text,p_origin text,p_attempt_token_sha256 text,p_expected_version integer,p_request_id uuid,p_request_sha256 text,p_move_id integer,p_public_response jsonb,p_terminal boolean,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.arcade_growth_sessions; a private.arcade_challenge_pilot_attempts; c private.arcade_challenge_pilot_configs; r private.arcade_challenge_pilot_requests;
  t timestamptz; v_response jsonb; v_result jsonb;
begin
  s:=private.arcade_challenge_pilot_require_session_v1(p_token_sha256,p_origin);
  if p_request_id is null or coalesce(p_request_sha256,'') !~ '^[a-f0-9]{64}$' or p_expected_version is null or p_expected_version not between 0 and 99 or p_move_id is null or p_move_id not between 1 and 30 then raise exception 'challenge-invalid-move'; end if;
  -- This lock serializes both distinct concurrent moves and identical retries.
  select * into a from private.arcade_challenge_pilot_attempts where attempt_token_sha256=p_attempt_token_sha256 and session_hash=p_token_sha256 and wallet=s.wallet and origin=p_origin for update;
  if not found then raise exception 'challenge-attempt-not-found'; end if;
  if s.expires_at<=clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
  select * into r from private.arcade_challenge_pilot_requests where attempt_id=a.attempt_id and request_id=p_request_id;
  if found then
    if r.request_sha256<>p_request_sha256 or r.expected_version<>p_expected_version or r.move_id<>p_move_id then raise exception 'challenge-request-conflict'; end if;
    return r.public_response;
  end if;
  if a.version<>p_expected_version then raise exception 'challenge-version-conflict'; end if;
  if a.status<>'active' then raise exception 'challenge-attempt-completed'; end if;
  select * into c from private.arcade_challenge_pilot_configs where pilot_id=a.pilot_id for share;
  t:=clock_timestamp();
  if c.status<>'enabled' or t<a.started_at or t>=a.expires_at or t<c.starts_at or t>=c.ends_at or s.expires_at<=t then raise exception 'challenge-attempt-expired'; end if;
  if p_terminal is null or p_public_response is null or jsonb_typeof(p_public_response)<>'object' or octet_length(p_public_response::text)>60000 or not private.arcade_challenge_pilot_safe_json_v1(p_public_response)
     or (p_terminal and (p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>14000 or not private.arcade_challenge_pilot_safe_json_v1(p_result)))
     or (not p_terminal and p_result is not null) or (a.version=99 and not p_terminal) then raise exception 'challenge-invalid-result'; end if;
  v_result:=case when p_terminal then p_result||jsonb_build_object('mode','nonpaying-pilot','identityScope','wallet-session-only','payable',false,'prizeEligible',false,'awardsEnabled',false,'completedAt',private.arcade_challenge_pilot_utc_v1(t)) else null end;
  update private.arcade_challenge_pilot_attempts set moves=moves||p_move_id,version=version+1,
    status=case when p_terminal then 'completed' else 'active' end,result=v_result,completed_at=case when p_terminal then t else null end
    where attempt_id=a.attempt_id returning * into a;
  v_response:=p_public_response||jsonb_build_object('attemptId',a.attempt_id,'version',a.version,'attemptStatus',a.status,
    'startedAt',private.arcade_challenge_pilot_utc_v1(a.started_at),'expiresAt',private.arcade_challenge_pilot_utc_v1(a.expires_at),
    'completedAt',private.arcade_challenge_pilot_utc_v1(a.completed_at),'result',v_result,'serverNow',private.arcade_challenge_pilot_utc_v1(t),
    'mode','nonpaying-pilot','identityScope','wallet-session-only','payable',false,'prizeEligible',false,'awardsEnabled',false);
  insert into private.arcade_challenge_pilot_requests(attempt_id,request_id,request_sha256,expected_version,move_id,public_response,recorded_at)
    values(a.attempt_id,p_request_id,p_request_sha256,p_expected_version,p_move_id,v_response,t);
  return v_response;
end $$;

revoke all on function private.arcade_challenge_pilot_safe_json_v1(jsonb,integer),private.arcade_challenge_pilot_utc_v1(timestamptz),private.arcade_challenge_pilot_require_session_v1(text,text),
  private.arcade_challenge_pilot_config_guard_v1(),private.arcade_challenge_pilot_attempt_guard_v1(),private.arcade_challenge_pilot_request_guard_v1(),
  private.arcade_challenge_pilot_attempt_json_v1(private.arcade_challenge_pilot_attempts,timestamptz),
  public.arcade_challenge_pilot_load_config_v1(text,text,text),public.arcade_challenge_pilot_start_v1(text,text,text,text,text,text,text),
  public.arcade_challenge_pilot_load_attempt_v1(text,text,text,uuid),public.arcade_challenge_pilot_commit_move_v1(text,text,text,integer,uuid,text,integer,jsonb,boolean,jsonb)
  from public,anon,authenticated;
grant execute on function private.arcade_challenge_pilot_safe_json_v1(jsonb,integer),private.arcade_challenge_pilot_utc_v1(timestamptz),private.arcade_challenge_pilot_require_session_v1(text,text),
  private.arcade_challenge_pilot_attempt_json_v1(private.arcade_challenge_pilot_attempts,timestamptz),
  public.arcade_challenge_pilot_load_config_v1(text,text,text),public.arcade_challenge_pilot_start_v1(text,text,text,text,text,text,text),
  public.arcade_challenge_pilot_load_attempt_v1(text,text,text,uuid),public.arcade_challenge_pilot_commit_move_v1(text,text,text,integer,uuid,text,integer,jsonb,boolean,jsonb)
  to service_role;
commit;
