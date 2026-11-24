-- Proposed source schema for disposable local validation ONLY. Not a migration.
-- No published handler calls this RPC. Shadow results never enter leaderboards.
begin;
create table private.arcade_bnb_shadow_runs (
 id text primary key references private.arcade_bnb_run_reviews(hash) on delete cascade,
 session_hash text not null references private.arcade_bnb_test_sessions(token_sha256),
 wallet text not null, generation text not null,
 rules text not null check(rules='bnb-shadow-v1'),
 started_at timestamptz not null, expires_at timestamptz not null,
 lease_until timestamptz not null,
 revision integer not null default 0 check(revision>=0),
 status text not null default 'active' check(status in ('active','closed','finished')),
 score integer check(score>=0), evidence_hash text unique check(evidence_hash ~ '^[a-f0-9]{64}$'),
 check(expires_at>started_at and expires_at<=started_at+interval '5 minutes'),
 check(lease_until>started_at and lease_until<=expires_at),
 check((status='finished')=(score is not null and evidence_hash is not null))
);
alter table private.arcade_bnb_shadow_runs enable row level security;
revoke all on private.arcade_bnb_shadow_runs from public,anon,authenticated,service_role;
grant select,insert,update on private.arcade_bnb_shadow_runs to service_role;
create function public.arcade_bnb_shadow_run_v1(p_action text,p_data jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_bnb_test_sessions; r private.arcade_bnb_run_reviews;
 v private.arcade_bnb_shadow_runs; t timestamptz; proof_at timestamptz;
begin
 if p_action is null or p_action not in ('read','start','renew','close','finish') or p_data is null
  or jsonb_typeof(p_data)<>'object' or coalesce(p_data->>'id','') !~ '^[a-f0-9]{64}$'
  or coalesce(p_data->>'sessionHash','') !~ '^[a-f0-9]{64}$'
  or p_data->>'rules' is distinct from 'bnb-shadow-v1' then return null; end if;
 -- All mutations serialize with logout, then ticket, then run; no reverse locks.
 select * into s from private.arcade_bnb_test_sessions where token_sha256=p_data->>'sessionHash' for update;
 t:=clock_timestamp();
 if not found or s.revoked_at is not null or s.issued_at>t or s.expires_at<=t or s.chain_id<>56
  or s.scope<>'eip155:56:treeforce89-test:v1' or s.origin<>'https://tree-token.xyz'
  or s.wallet is distinct from p_data->>'wallet' then return null; end if;
 select * into r from private.arcade_bnb_run_reviews where hash=p_data->>'id' for update;
 if not found or r.session_hash<>s.token_sha256 or r.wallet<>s.wallet
  or r.generation is distinct from p_data->>'generation' then return null; end if;
 select * into v from private.arcade_bnb_shadow_runs where id=r.hash for update;
 t:=clock_timestamp();
 if s.expires_at<=t then return null; end if;
 if p_action='close' then
  update private.arcade_bnb_shadow_runs set status='closed',revision=revision+1 where id=r.hash and status='active';
  return to_jsonb(found);
 end if;
 if p_action<>'read' then
  if coalesce(p_data->>'checkedAt','') !~ '^[0-9]{1,16}$' then return null; end if;
  proof_at:=to_timestamp((p_data->>'checkedAt')::numeric/1000);
  if proof_at>t or proof_at<t-interval '5 seconds' then return null; end if;
 end if;
 if p_action='start' and v.id is null then
  if r.consumed_at is not null or r.issued_at>t or r.expires_at<=t then return null; end if;
  insert into private.arcade_bnb_shadow_runs(id,session_hash,wallet,generation,rules,started_at,expires_at,lease_until)
   values(r.hash,s.token_sha256,s.wallet,r.generation,'bnb-shadow-v1',t,least(t+interval '5 minutes',s.expires_at),least(t+interval '15 seconds',s.expires_at)) returning * into v;
  update private.arcade_bnb_run_reviews set consumed_at=t where hash=r.hash;
 end if;
 if p_action='read' then
  if v.id is null then return null; end if;
 return jsonb_build_object('id',v.id,'sessionHash',v.session_hash,'wallet',v.wallet,'chainId',56,'generation',v.generation,'rules',v.rules,'revision',v.revision,'status',v.status,'score',v.score,
  'leaseUntil',floor(extract(epoch from v.lease_until)*1000),'expiresAt',floor(extract(epoch from v.expires_at)*1000));
 end if;
 -- Retry start returns the same unextended live run, including after ticket expiry.
 if v.id is null or v.status<>'active' or v.expires_at<=t or v.lease_until<=t then return null; end if;
 if p_action in ('renew','finish') then
  if coalesce(p_data->>'revision','') !~ '^[0-9]{1,9}$' or v.revision<>(p_data->>'revision')::integer then return null; end if;
  if p_action='renew' then
   update private.arcade_bnb_shadow_runs set lease_until=least(t+interval '15 seconds',expires_at,s.expires_at),revision=revision+1 where id=v.id returning * into v;
  else
   if coalesce(p_data->>'score','') !~ '^[0-9]{1,10}$' or (p_data->>'score')::numeric>2147483647
    or coalesce(p_data->>'evidenceHash','') !~ '^[a-f0-9]{64}$' then return null; end if;
   update private.arcade_bnb_shadow_runs set status='finished',revision=revision+1,score=(p_data->>'score')::integer,evidence_hash=p_data->>'evidenceHash' where id=v.id;
   return 'true'::jsonb;
  end if;
 end if;
 return jsonb_build_object('id',v.id,'sessionHash',v.session_hash,'wallet',v.wallet,'chainId',56,'generation',v.generation,'rules',v.rules,'revision',v.revision,'status',v.status,'score',v.score,
  'leaseUntil',floor(extract(epoch from v.lease_until)*1000),'expiresAt',floor(extract(epoch from v.expires_at)*1000));
end $$;
revoke all on function public.arcade_bnb_shadow_run_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.arcade_bnb_shadow_run_v1(text,jsonb) to service_role;
commit;
