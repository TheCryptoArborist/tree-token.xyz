-- Isolated personal-message authentication for the free, no-prize pilot.
-- Existing Arcade wallet challenges, sessions, eligibility and RPC definitions
-- are not altered. A pilot-only session never enters an Arcade session table.
-- The trusted service verifies the signature before consuming a challenge.
begin;

create table private.arcade_challenge_pilot_wallet_challenges (
  challenge_id uuid primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet<>'0x'||repeat('0',64)),
  origin text not null check (origin in ('https://tree-token.xyz','https://www.tree-token.xyz')),
  message text not null check (octet_length(message) between 100 and 4096),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at and expires_at<=issued_at+interval '5 minutes'),
  check (consumed_at is null or (isfinite(consumed_at) and consumed_at>=issued_at and consumed_at<expires_at))
);
create index arcade_challenge_pilot_challenges_wallet_time on private.arcade_challenge_pilot_wallet_challenges(wallet,issued_at desc);

create table private.arcade_challenge_pilot_sessions (
  token_sha256 text primary key check (token_sha256 ~ '^[a-f0-9]{64}$'),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet<>'0x'||repeat('0',64)),
  origin text not null check (origin in ('https://tree-token.xyz','https://www.tree-token.xyz')),
  auth_challenge_id uuid not null unique references private.arcade_challenge_pilot_wallet_challenges(challenge_id),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at and expires_at<=issued_at+interval '1 hour'),
  check (revoked_at is null or (isfinite(revoked_at) and revoked_at>=issued_at))
);
create index arcade_challenge_pilot_sessions_wallet_time on private.arcade_challenge_pilot_sessions(wallet,issued_at desc);

create table private.arcade_challenge_pilot_session_bindings (
  session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
  arcade_session_hash text unique references private.arcade_growth_sessions(token_sha256),
  pilot_session_hash text unique references private.arcade_challenge_pilot_sessions(token_sha256),
  created_at timestamptz not null default clock_timestamp(),
  check ((arcade_session_hash is not null)::integer+(pilot_session_hash is not null)::integer=1),
  check (coalesce(arcade_session_hash,pilot_session_hash)=session_hash)
);

create type private.arcade_challenge_pilot_session_context as (
  token_sha256 text,wallet text,origin text,expires_at timestamptz,session_scope text
);

create function private.arcade_challenge_pilot_auth_challenge_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'challenge-auth-record-immutable'; end if;
  if tg_op='UPDATE' and ((to_jsonb(new)-'consumed_at')<>(to_jsonb(old)-'consumed_at')
    or old.consumed_at is not null or new.consumed_at is null or new.consumed_at>clock_timestamp()) then
    raise exception 'challenge-auth-record-immutable';
  end if;
  return new;
end $$;
create trigger arcade_challenge_pilot_auth_challenge_guard before update or delete on private.arcade_challenge_pilot_wallet_challenges
for each row execute function private.arcade_challenge_pilot_auth_challenge_guard_v1();

create function private.arcade_challenge_pilot_auth_session_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c private.arcade_challenge_pilot_wallet_challenges;
begin
  if tg_op='DELETE' then raise exception 'challenge-auth-record-immutable'; end if;
  if tg_op='INSERT' then
    select * into c from private.arcade_challenge_pilot_wallet_challenges where challenge_id=new.auth_challenge_id for share;
    if not found or c.wallet<>new.wallet or c.origin<>new.origin or c.consumed_at is null
      or new.issued_at<>c.consumed_at or new.issued_at>clock_timestamp()
      or exists(select 1 from private.arcade_growth_sessions where token_sha256=new.token_sha256) then
      raise exception 'challenge-auth-invalid-session';
    end if;
  elsif (to_jsonb(new)-'revoked_at')<>(to_jsonb(old)-'revoked_at')
    or old.revoked_at is not null or new.revoked_at is null or new.revoked_at>clock_timestamp() then
    raise exception 'challenge-auth-record-immutable';
  end if;
  return new;
end $$;
create trigger arcade_challenge_pilot_auth_session_guard before insert or update or delete on private.arcade_challenge_pilot_sessions
for each row execute function private.arcade_challenge_pilot_auth_session_guard_v1();

create function private.arcade_challenge_pilot_binding_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'challenge-session-binding-immutable'; end $$;
create trigger arcade_challenge_pilot_binding_guard before update or delete on private.arcade_challenge_pilot_session_bindings
for each row execute function private.arcade_challenge_pilot_binding_guard_v1();

-- Preserve every pre-existing attempt and its original Arcade session identity.
-- Hold the attempt table while backfilling and replacing its FK so a concurrent
-- legacy start cannot add an unbound row between the backfill and validation.
lock table private.arcade_challenge_pilot_attempts in access exclusive mode;
insert into private.arcade_challenge_pilot_session_bindings(session_hash,arcade_session_hash)
  select distinct session_hash,session_hash from private.arcade_challenge_pilot_attempts;
alter table private.arcade_challenge_pilot_attempts drop constraint arcade_challenge_pilot_attempts_session_hash_fkey;
alter table private.arcade_challenge_pilot_attempts add constraint arcade_challenge_pilot_attempts_session_hash_fkey
  foreign key(session_hash) references private.arcade_challenge_pilot_session_bindings(session_hash);

create function private.arcade_challenge_pilot_require_session_v2(p_token_sha256 text,p_origin text)
returns private.arcade_challenge_pilot_session_context language plpgsql volatile security invoker set search_path='' as $$
declare p private.arcade_challenge_pilot_sessions; a private.arcade_growth_sessions;
begin
  if coalesce(p_token_sha256,'') !~ '^[a-f0-9]{64}$' or p_origin is null or p_origin not in ('https://tree-token.xyz','https://www.tree-token.xyz') then
    raise exception 'arcade-growth-invalid-session';
  end if;
  -- A row lock remains held through the consuming gameplay RPC, including its
  -- final commit. Re-check time after waiting; a revocation cannot race past it.
  select * into p from private.arcade_challenge_pilot_sessions where token_sha256=p_token_sha256 and origin=p_origin for share;
  if found then
    if p.revoked_at is not null or p.expires_at<=clock_timestamp()
      or exists(select 1 from private.arcade_growth_sessions where token_sha256=p_token_sha256) then
      raise exception 'arcade-growth-invalid-session';
    end if;
    return row(p.token_sha256,p.wallet,p.origin,p.expires_at,'challenge-pilot')::private.arcade_challenge_pilot_session_context;
  end if;
  -- Calling the unchanged legacy helper retains its complete validation policy.
  a:=private.arcade_challenge_pilot_require_session_v1(p_token_sha256,p_origin);
  return row(a.token_sha256,a.wallet,a.origin,a.expires_at,'arcade')::private.arcade_challenge_pilot_session_context;
end $$;

create function public.arcade_challenge_pilot_auth_create_challenge_v1(p_challenge_id uuid,p_wallet text,p_origin text,p_message text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare t timestamptz; c private.arcade_challenge_pilot_wallet_challenges;
begin
  if p_challenge_id is null or coalesce(p_wallet,'') !~ '^0x[0-9a-f]{64}$' or p_wallet='0x'||repeat('0',64)
    or p_origin is null or p_origin not in ('https://tree-token.xyz','https://www.tree-token.xyz')
    or p_message is null or octet_length(p_message) not between 100 and 4096 then raise exception 'challenge-auth-invalid-input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge-pilot-auth-wallet:'||p_wallet,0));
  t:=clock_timestamp();
  if p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=t or p_expires_at>t+interval '5 minutes' then raise exception 'challenge-auth-invalid-input'; end if;
  if (select count(*) from private.arcade_challenge_pilot_wallet_challenges where wallet=p_wallet and issued_at>t-interval '5 minutes')>=5
    or (select count(*) from private.arcade_challenge_pilot_wallet_challenges where wallet=p_wallet and issued_at>t-interval '1 hour')>=20 then
    raise exception 'challenge-auth-rate-limit';
  end if;
  insert into private.arcade_challenge_pilot_wallet_challenges(challenge_id,wallet,origin,message,issued_at,expires_at)
    values(p_challenge_id,p_wallet,p_origin,p_message,t,p_expires_at) returning * into c;
  return jsonb_build_object('id',c.challenge_id,'wallet',c.wallet,'origin',c.origin,'message',c.message,
    'issuedAt',private.arcade_challenge_pilot_utc_v1(c.issued_at),'expiresAt',private.arcade_challenge_pilot_utc_v1(c.expires_at),'consumedAt',null,'sessionScope','challenge-pilot');
exception when unique_violation then raise exception 'challenge-auth-invalid-input';
end $$;

create function public.arcade_challenge_pilot_auth_read_challenge_v1(p_challenge_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare c private.arcade_challenge_pilot_wallet_challenges;
begin
  select * into c from private.arcade_challenge_pilot_wallet_challenges where challenge_id=p_challenge_id;
  if not found or c.consumed_at is not null or c.expires_at<=clock_timestamp() then return null; end if;
  return jsonb_build_object('id',c.challenge_id,'wallet',c.wallet,'origin',c.origin,'message',c.message,
    'issuedAt',private.arcade_challenge_pilot_utc_v1(c.issued_at),'expiresAt',private.arcade_challenge_pilot_utc_v1(c.expires_at),'consumedAt',null,'sessionScope','challenge-pilot');
end $$;

create function public.arcade_challenge_pilot_auth_create_session_v1(p_challenge_id uuid,p_wallet text,p_origin text,p_token_sha256 text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare t timestamptz; c private.arcade_challenge_pilot_wallet_challenges; s private.arcade_challenge_pilot_sessions;
begin
  if p_challenge_id is null or coalesce(p_token_sha256,'') !~ '^[a-f0-9]{64}$'
    or coalesce(p_wallet,'') !~ '^0x[0-9a-f]{64}$' or p_wallet='0x'||repeat('0',64)
    or p_origin is null or p_origin not in ('https://tree-token.xyz','https://www.tree-token.xyz') then raise exception 'challenge-auth-invalid-input'; end if;
  select * into c from private.arcade_challenge_pilot_wallet_challenges where challenge_id=p_challenge_id for update;
  if not found or c.wallet<>p_wallet or c.origin<>p_origin or c.consumed_at is not null then raise exception 'challenge-auth-invalid-challenge'; end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge-pilot-auth-wallet:'||p_wallet,0));
  t:=clock_timestamp();
  if c.expires_at<=t then raise exception 'challenge-auth-invalid-challenge'; end if;
  if p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=t or p_expires_at>t+interval '1 hour'
    or exists(select 1 from private.arcade_growth_sessions where token_sha256=p_token_sha256) then raise exception 'challenge-auth-invalid-input'; end if;
  if (select count(*) from private.arcade_challenge_pilot_sessions where wallet=p_wallet and issued_at>t-interval '1 hour')>=10 then raise exception 'challenge-auth-rate-limit'; end if;
  update private.arcade_challenge_pilot_wallet_challenges set consumed_at=t where challenge_id=c.challenge_id;
  insert into private.arcade_challenge_pilot_sessions(token_sha256,wallet,origin,auth_challenge_id,issued_at,expires_at)
    values(p_token_sha256,p_wallet,p_origin,c.challenge_id,t,p_expires_at) returning * into s;
  return jsonb_build_object('wallet',s.wallet,'origin',s.origin,'expiresAt',private.arcade_challenge_pilot_utc_v1(s.expires_at),'revoked',false,'sessionScope','challenge-pilot');
exception when unique_violation then raise exception 'challenge-auth-invalid-input';
end $$;

create function public.arcade_challenge_pilot_read_session_v1(p_token_sha256 text,p_origin text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_challenge_pilot_session_context;
begin
  s:=private.arcade_challenge_pilot_require_session_v2(p_token_sha256,p_origin);
  return jsonb_build_object('wallet',s.wallet,'origin',s.origin,'expiresAt',private.arcade_challenge_pilot_utc_v1(s.expires_at),'revoked',false,'sessionScope',s.session_scope);
end $$;

create function public.arcade_challenge_pilot_auth_revoke_session_v1(p_token_sha256 text,p_origin text)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_challenge_pilot_sessions;
begin
  if coalesce(p_token_sha256,'') !~ '^[a-f0-9]{64}$' or p_origin is null or p_origin not in ('https://tree-token.xyz','https://www.tree-token.xyz') then raise exception 'challenge-auth-invalid-input'; end if;
  select * into s from private.arcade_challenge_pilot_sessions where token_sha256=p_token_sha256 and origin=p_origin for update;
  if not found then return false; end if;
  if s.revoked_at is null then update private.arcade_challenge_pilot_sessions set revoked_at=clock_timestamp() where token_sha256=p_token_sha256; end if;
  return true;
end $$;

alter table private.arcade_challenge_pilot_wallet_challenges enable row level security;
alter table private.arcade_challenge_pilot_sessions enable row level security;
alter table private.arcade_challenge_pilot_session_bindings enable row level security;
revoke all on private.arcade_challenge_pilot_wallet_challenges,private.arcade_challenge_pilot_sessions,private.arcade_challenge_pilot_session_bindings from public,anon,authenticated,service_role;
grant select,insert on private.arcade_challenge_pilot_wallet_challenges,private.arcade_challenge_pilot_sessions,private.arcade_challenge_pilot_session_bindings to service_role;
grant update(consumed_at) on private.arcade_challenge_pilot_wallet_challenges to service_role;
grant update(revoked_at) on private.arcade_challenge_pilot_sessions to service_role;
revoke all on type private.arcade_challenge_pilot_session_context from public,anon,authenticated;
grant usage on type private.arcade_challenge_pilot_session_context to service_role;

revoke all on function private.arcade_challenge_pilot_auth_challenge_guard_v1(),private.arcade_challenge_pilot_auth_session_guard_v1(),private.arcade_challenge_pilot_binding_guard_v1(),
  private.arcade_challenge_pilot_require_session_v2(text,text),
  public.arcade_challenge_pilot_auth_create_challenge_v1(uuid,text,text,text,timestamptz),public.arcade_challenge_pilot_auth_read_challenge_v1(uuid),
  public.arcade_challenge_pilot_auth_create_session_v1(uuid,text,text,text,timestamptz),public.arcade_challenge_pilot_read_session_v1(text,text),public.arcade_challenge_pilot_auth_revoke_session_v1(text,text)
  from public,anon,authenticated;
grant execute on function private.arcade_challenge_pilot_require_session_v2(text,text),
  public.arcade_challenge_pilot_auth_create_challenge_v1(uuid,text,text,text,timestamptz),public.arcade_challenge_pilot_auth_read_challenge_v1(uuid),
  public.arcade_challenge_pilot_auth_create_session_v1(uuid,text,text,text,timestamptz),public.arcade_challenge_pilot_read_session_v1(text,text),public.arcade_challenge_pilot_auth_revoke_session_v1(text,text)
  to service_role;

-- Only pilot RPC bodies change below. Their arguments, grants, attempt and
-- receipt semantics stay intact; the session context now accepts both scopes.

create or replace function public.arcade_challenge_pilot_load_config_v1(p_token_sha256 text,p_origin text,p_pilot_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.arcade_challenge_pilot_configs;
begin
  perform private.arcade_challenge_pilot_require_session_v2(p_token_sha256,p_origin);
  select * into c from private.arcade_challenge_pilot_configs where pilot_id=p_pilot_id;
  if not found then return null; end if;
  return jsonb_build_object('pilotId',c.pilot_id,'status',c.status,'enabled',c.status='enabled','rulesHash',c.rules_hash,
    'adapterId',c.adapter_id,'adapterVersion',c.adapter_version,'sourceHash',c.source_hash,'config',c.config,
    'startsAt',private.arcade_challenge_pilot_utc_v1(c.starts_at),'endsAt',private.arcade_challenge_pilot_utc_v1(c.ends_at),
    'maxAttemptSeconds',c.max_attempt_seconds,'serverNow',private.arcade_challenge_pilot_utc_v1(clock_timestamp()),
    'mode','nonpaying-pilot','identityScope','wallet-session-only','payable',false,'prizeEligible',false,'awardsEnabled',false);
end $$;

create or replace function public.arcade_challenge_pilot_start_v1(p_token_sha256 text,p_origin text,p_pilot_id text,p_rules_hash text,p_attempt_token_sha256 text,p_seed_hex text,p_challenge_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.arcade_challenge_pilot_session_context; c private.arcade_challenge_pilot_configs; a private.arcade_challenge_pilot_attempts; t timestamptz; x timestamptz;
begin
  s:=private.arcade_challenge_pilot_require_session_v2(p_token_sha256,p_origin);
  select * into c from private.arcade_challenge_pilot_configs where pilot_id=p_pilot_id for share;
  if not found or c.status<>'enabled' then raise exception 'challenge-not-open'; end if;
  if p_rules_hash is distinct from c.rules_hash then raise exception 'challenge-rules-conflict'; end if;
  if coalesce(p_attempt_token_sha256,'') !~ '^[a-f0-9]{64}$' or coalesce(p_seed_hex,'') !~ '^[a-f0-9]{64}$' or coalesce(p_challenge_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'challenge-invalid-start'; end if;
  perform pg_advisory_xact_lock(hashtextextended('challenge-pilot:'||s.wallet||':'||c.pilot_id,0));
  t:=clock_timestamp();
  if t<c.starts_at or t>=c.ends_at or s.expires_at<=t then raise exception 'challenge-not-open'; end if;
  if (select count(*) from private.arcade_challenge_pilot_attempts where wallet=s.wallet and pilot_id=c.pilot_id and status='active' and expires_at>t)>=20 then raise exception 'challenge-attempt-limit'; end if;
  x:=least(c.ends_at,t+make_interval(secs=>c.max_attempt_seconds),s.expires_at);
  insert into private.arcade_challenge_pilot_session_bindings(session_hash,arcade_session_hash,pilot_session_hash)
    values(p_token_sha256,case when s.session_scope='arcade' then p_token_sha256 else null end,
      case when s.session_scope='challenge-pilot' then p_token_sha256 else null end) on conflict(session_hash) do nothing;
  if not exists(select 1 from private.arcade_challenge_pilot_session_bindings where session_hash=p_token_sha256
    and arcade_session_hash is not distinct from (case when s.session_scope='arcade' then p_token_sha256 else null end)
    and pilot_session_hash is not distinct from (case when s.session_scope='challenge-pilot' then p_token_sha256 else null end)) then
    raise exception 'arcade-growth-invalid-session';
  end if;
  insert into private.arcade_challenge_pilot_attempts(attempt_token_sha256,pilot_id,rules_hash,adapter_id,adapter_version,source_hash,config,challenge_hash,seed_hex,wallet,origin,session_hash,started_at,expires_at)
    values(p_attempt_token_sha256,c.pilot_id,c.rules_hash,c.adapter_id,c.adapter_version,c.source_hash,c.config,p_challenge_hash,p_seed_hex,s.wallet,p_origin,p_token_sha256,t,x) returning * into a;
  return private.arcade_challenge_pilot_attempt_json_v1(a,clock_timestamp());
end $$;

create or replace function public.arcade_challenge_pilot_load_attempt_v1(p_token_sha256 text,p_origin text,p_attempt_token_sha256 text,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.arcade_challenge_pilot_session_context; a private.arcade_challenge_pilot_attempts; r private.arcade_challenge_pilot_requests; v jsonb;
begin
  s:=private.arcade_challenge_pilot_require_session_v2(p_token_sha256,p_origin);
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

create or replace function public.arcade_challenge_pilot_commit_move_v1(p_token_sha256 text,p_origin text,p_attempt_token_sha256 text,p_expected_version integer,p_request_id uuid,p_request_sha256 text,p_move_id integer,p_public_response jsonb,p_terminal boolean,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s private.arcade_challenge_pilot_session_context; a private.arcade_challenge_pilot_attempts; c private.arcade_challenge_pilot_configs; r private.arcade_challenge_pilot_requests;
  t timestamptz; v_response jsonb; v_result jsonb;
begin
  s:=private.arcade_challenge_pilot_require_session_v2(p_token_sha256,p_origin);
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

commit;
