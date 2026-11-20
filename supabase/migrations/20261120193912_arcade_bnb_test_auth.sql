-- Isolated BNB test sign-in ONLY. Does not touch existing Arcade RPCs,
-- sessions, payments, access rules, schedules, or any NFT/backing contract.
begin;

create table private.arcade_bnb_test_challenges (
 nonce text primary key check (nonce ~ '^[a-f0-9]{64}$'),
 wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$' and wallet <> '0x'||repeat('0',40)),
 address text not null check (address ~ '^0x[0-9a-fA-F]{40}$' and lower(address)=wallet),
 origin text not null default 'https://tree-token.xyz' check (origin='https://tree-token.xyz'),
 uri text not null default 'https://tree-token.xyz/play/multichaintest/game/bnb/'
   check(uri='https://tree-token.xyz/play/multichaintest/game/bnb/'),
 chain_id integer not null default 56 check(chain_id=56),
 scope text not null default 'eip155:56:treeforce89-test:v1'
   check(scope='eip155:56:treeforce89-test:v1'),
 message_hash text not null check (message_hash ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check(isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at
   and expires_at<=issued_at+interval '5 minutes'),
 check(consumed_at is null or (isfinite(consumed_at) and consumed_at>=issued_at
   and consumed_at<expires_at))
);
create index arcade_bnb_test_challenges_wallet_time
  on private.arcade_bnb_test_challenges(wallet,issued_at desc);

create table private.arcade_bnb_test_sessions (
 token_sha256 text primary key check(token_sha256 ~ '^[a-f0-9]{64}$'),
 challenge_nonce text not null unique references private.arcade_bnb_test_challenges(nonce),
 wallet text not null check(wallet ~ '^0x[0-9a-f]{40}$'),
 origin text not null default 'https://tree-token.xyz' check(origin='https://tree-token.xyz'),
 chain_id integer not null default 56 check(chain_id=56),
 scope text not null default 'eip155:56:treeforce89-test:v1'
   check(scope='eip155:56:treeforce89-test:v1'),
 issued_at timestamptz not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at
   and expires_at<=issued_at+interval '1 hour'),
 check(revoked_at is null or (isfinite(revoked_at) and revoked_at>=issued_at))
);
create index arcade_bnb_test_sessions_wallet_time
  on private.arcade_bnb_test_sessions(wallet,issued_at desc);

alter table private.arcade_bnb_test_challenges enable row level security;
alter table private.arcade_bnb_test_sessions enable row level security;
revoke all on private.arcade_bnb_test_challenges from public, anon, authenticated;
revoke all on private.arcade_bnb_test_sessions from public, anon, authenticated;
grant usage on schema private to service_role;
grant select,insert,update on private.arcade_bnb_test_challenges to service_role;
grant select,insert,update on private.arcade_bnb_test_sessions to service_role;

create function private.arcade_bnb_test_challenge_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'bnb-auth-record-immutable'; end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-'consumed_at')<>(to_jsonb(old)-'consumed_at')
   or old.consumed_at is not null or new.consumed_at is null
   or new.consumed_at>clock_timestamp()) then
   raise exception 'bnb-auth-record-immutable';
 end if;
 return new;
end $$;
create trigger arcade_bnb_test_challenge_guard before update or delete
on private.arcade_bnb_test_challenges
for each row execute function private.arcade_bnb_test_challenge_guard_v1();

create function private.arcade_bnb_test_session_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c private.arcade_bnb_test_challenges;
begin
 if tg_op='DELETE' then raise exception 'bnb-auth-record-immutable'; end if;
 if tg_op='INSERT' then
   select * into c from private.arcade_bnb_test_challenges
     where nonce=new.challenge_nonce for share;
   if not found or c.wallet<>new.wallet or c.consumed_at is null
     or new.issued_at<>c.consumed_at then raise exception 'bnb-auth-invalid-session'; end if;
 elsif (to_jsonb(new)-'revoked_at')<>(to_jsonb(old)-'revoked_at')
   or old.revoked_at is not null or new.revoked_at is null
   or new.revoked_at>clock_timestamp() then
   raise exception 'bnb-auth-record-immutable';
 end if;
 return new;
end $$;
create trigger arcade_bnb_test_session_guard before insert or update or delete
on private.arcade_bnb_test_sessions
for each row execute function private.arcade_bnb_test_session_guard_v1();

create function public.arcade_bnb_test_create_challenge_v1(
 p_nonce text,p_wallet text,p_address text,p_issued_at timestamptz,
 p_expires_at timestamptz,p_message_hash text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare t timestamptz; c private.arcade_bnb_test_challenges;
begin
 if coalesce(p_nonce,'') !~ '^[a-f0-9]{64}$'
   or coalesce(p_wallet,'') !~ '^0x[0-9a-f]{40}$'
   or p_wallet='0x'||repeat('0',40)
   or coalesce(p_address,'') !~ '^0x[0-9a-fA-F]{40}$'
   or lower(p_address)<>p_wallet
   or coalesce(p_message_hash,'') !~ '^[a-f0-9]{64}$'
   or p_issued_at is null or p_expires_at is null
   or not isfinite(p_issued_at) or not isfinite(p_expires_at)
   then raise exception 'bnb-auth-invalid-input'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bnb-test-wallet:'||p_wallet,0));
 t:=clock_timestamp();
 if p_issued_at<t-interval '30 seconds' or p_issued_at>t+interval '30 seconds'
   or p_expires_at<=t or p_expires_at<=p_issued_at
   or p_expires_at>p_issued_at+interval '5 minutes' then
   raise exception 'bnb-auth-invalid-time'; end if;
 if (select count(*) from private.arcade_bnb_test_challenges
     where wallet=p_wallet and issued_at>t-interval '5 minutes')>=3
   or (select count(*) from private.arcade_bnb_test_challenges
     where wallet=p_wallet and issued_at>t-interval '1 hour')>=12 then
   raise exception 'bnb-auth-rate-limit'; end if;
 insert into private.arcade_bnb_test_challenges
   (nonce,wallet,address,message_hash,issued_at,expires_at)
 values(p_nonce,p_wallet,p_address,p_message_hash,p_issued_at,p_expires_at)
 returning * into c;
 return jsonb_build_object('nonce',c.nonce,'wallet',c.wallet,'address',c.address,
   'issuedAt',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'expiresAt',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'messageHash',c.message_hash);
end $$;

create function public.arcade_bnb_test_read_challenge_v1(p_nonce text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare c private.arcade_bnb_test_challenges;
begin
 if coalesce(p_nonce,'') !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into c from private.arcade_bnb_test_challenges
   where nonce=p_nonce and consumed_at is null and expires_at>clock_timestamp();
 if not found then return null; end if;
 return jsonb_build_object('nonce',c.nonce,'wallet',c.wallet,'address',c.address,
   'origin',c.origin,'uri',c.uri,'chainId',c.chain_id,'scope',c.scope,
   'messageHash',c.message_hash,
   'issuedAt',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'expiresAt',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.arcade_bnb_test_consume_session_v1(
 p_nonce text,p_wallet text,p_message_hash text,p_token_sha256 text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare c private.arcade_bnb_test_challenges; s private.arcade_bnb_test_sessions; t timestamptz;
begin
 if coalesce(p_nonce,'') !~ '^[a-f0-9]{64}$'
   or coalesce(p_wallet,'') !~ '^0x[0-9a-f]{40}$'
   or coalesce(p_message_hash,'') !~ '^[a-f0-9]{64}$'
   or coalesce(p_token_sha256,'') !~ '^[a-f0-9]{64}$'
   or p_expires_at is null or not isfinite(p_expires_at) then return null; end if;
 select * into c from private.arcade_bnb_test_challenges
   where nonce=p_nonce for update;
 t:=clock_timestamp();
 if not found or c.consumed_at is not null or c.expires_at<=t
   or c.wallet<>p_wallet or c.message_hash<>p_message_hash
   or p_expires_at<=t or p_expires_at>t+interval '1 hour' then return null; end if;
 update private.arcade_bnb_test_challenges set consumed_at=t where nonce=c.nonce;
 insert into private.arcade_bnb_test_sessions
   (token_sha256,challenge_nonce,wallet,issued_at,expires_at)
   values(p_token_sha256,p_nonce,p_wallet,t,p_expires_at) returning * into s;
 return jsonb_build_object('wallet',s.wallet,'origin',s.origin,'chainId',s.chain_id,
   'scope',s.scope,'authenticated',true,'revoked',false,
   'expiresAt',to_char(s.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.arcade_bnb_test_read_session_v1(p_token_sha256 text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_bnb_test_sessions;
begin
 if coalesce(p_token_sha256,'') !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into s from private.arcade_bnb_test_sessions
   where token_sha256=p_token_sha256 and revoked_at is null
     and expires_at>clock_timestamp() for share;
 if not found then return null; end if;
 return jsonb_build_object('wallet',s.wallet,'origin',s.origin,'chainId',s.chain_id,
   'scope',s.scope,'authenticated',true,'revoked',false,
   'expiresAt',to_char(s.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.arcade_bnb_test_revoke_session_v1(p_token_sha256 text)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare affected bigint;
begin
 if coalesce(p_token_sha256,'') !~ '^[a-f0-9]{64}$' then return false; end if;
 update private.arcade_bnb_test_sessions set revoked_at=clock_timestamp()
   where token_sha256=p_token_sha256 and revoked_at is null;
 get diagnostics affected = row_count;
 return affected>0;
end $$;

-- Public schema is an API surface: functions are callable by service_role only.
revoke all on function public.arcade_bnb_test_create_challenge_v1(
 text,text,text,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.arcade_bnb_test_read_challenge_v1(text) from public,anon,authenticated;
revoke all on function public.arcade_bnb_test_consume_session_v1(
 text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.arcade_bnb_test_read_session_v1(text) from public,anon,authenticated;
revoke all on function public.arcade_bnb_test_revoke_session_v1(text) from public,anon,authenticated;
grant execute on function public.arcade_bnb_test_create_challenge_v1(
 text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.arcade_bnb_test_read_challenge_v1(text) to service_role;
grant execute on function public.arcade_bnb_test_consume_session_v1(
 text,text,text,text,timestamptz) to service_role;
grant execute on function public.arcade_bnb_test_read_session_v1(text) to service_role;
grant execute on function public.arcade_bnb_test_revoke_session_v1(text) to service_role;
revoke all on function private.arcade_bnb_test_challenge_guard_v1() from public,anon,authenticated;
revoke all on function private.arcade_bnb_test_session_guard_v1() from public,anon,authenticated;
commit;
