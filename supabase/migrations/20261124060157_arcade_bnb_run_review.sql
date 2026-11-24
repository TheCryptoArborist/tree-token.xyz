-- SOURCE ONLY. Private review tickets; no game runs, payments or identity edits.
begin;
create table private.arcade_bnb_run_reviews (
 hash text primary key check(hash ~ '^[a-f0-9]{64}$'),
 session_hash text not null references private.arcade_bnb_test_sessions(token_sha256),
 wallet text not null check(wallet ~ '^0x[0-9a-f]{40}$'),
 generation text not null check(generation ~ '^[1-9][0-9]*$' and generation::numeric<=18446744073709551615),
 issued_at timestamptz not null, expires_at timestamptz not null, consumed_at timestamptz,
 check(isfinite(issued_at) and isfinite(expires_at) and expires_at>issued_at and expires_at<=issued_at+interval '1 minute'),
 check(consumed_at is null or (isfinite(consumed_at) and consumed_at>=issued_at and consumed_at<expires_at))
);
create index arcade_bnb_run_reviews_session_time on private.arcade_bnb_run_reviews(session_hash,issued_at);
alter table private.arcade_bnb_run_reviews enable row level security;
revoke all on private.arcade_bnb_run_reviews from public,anon,authenticated;
grant select,insert,update on private.arcade_bnb_run_reviews to service_role;
create function public.arcade_bnb_run_review_v1(p_action text,p_data jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s private.arcade_bnb_test_sessions; r private.arcade_bnb_run_reviews;
 t timestamptz; issued timestamptz; expiry timestamptz;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or coalesce(p_data->>'hash','') !~ '^[a-f0-9]{64}$' then return 'false'::jsonb; end if;
 if p_action='read' then
  select * into r from private.arcade_bnb_run_reviews where hash=p_data->>'hash';
  if not found then return null; end if;
  return jsonb_build_object('hash',r.hash,'sessionHash',r.session_hash,'wallet',r.wallet,'chainId',56,'scope','treeforce89-generation-review:v1','generation',r.generation,'issuedAt',extract(epoch from r.issued_at)*1000,'expiresAt',extract(epoch from r.expires_at)*1000,'consumed',r.consumed_at is not null);
 end if;
 if p_action is null or p_action not in ('insert','consume') or coalesce(p_data->>'sessionHash','') !~ '^[a-f0-9]{64}$' then return 'false'::jsonb; end if;
 -- Same session row is used by existing revocation. Clock read AFTER lock wait.
 select * into s from private.arcade_bnb_test_sessions where token_sha256=p_data->>'sessionHash' for update;
 t:=clock_timestamp();
 if not found or s.revoked_at is not null or s.issued_at>t or s.expires_at<=t or s.chain_id<>56
  or s.scope<>'eip155:56:treeforce89-test:v1' or s.origin<>'https://tree-token.xyz'
  or s.wallet is distinct from p_data->>'wallet' then return 'false'::jsonb; end if;
 if p_action='insert' then
  if p_data->>'chainId' is distinct from '56' or p_data->>'scope' is distinct from 'treeforce89-generation-review:v1'
   or p_data->>'consumed' is distinct from 'false' or coalesce(p_data->>'generation','') !~ '^[1-9][0-9]{0,19}$'
   or (p_data->>'generation')::numeric>18446744073709551615
   or coalesce(p_data->>'issuedAt','') !~ '^[0-9]{1,16}$' or coalesce(p_data->>'expiresAt','') !~ '^[0-9]{1,16}$' then return 'false'::jsonb; end if;
  issued:=to_timestamp((p_data->>'issuedAt')::numeric/1000);expiry:=to_timestamp((p_data->>'expiresAt')::numeric/1000);
  if issued>t or issued<t-interval '30 seconds' or expiry<=t or expiry>issued+interval '1 minute' or expiry>s.expires_at then return 'false'::jsonb; end if;
  -- Session lock serializes the per-session admission limit across workers.
  if (select count(*) from private.arcade_bnb_run_reviews where session_hash=s.token_sha256 and issued_at>=t-interval '1 minute')>=5 then return 'false'::jsonb; end if;
  insert into private.arcade_bnb_run_reviews(hash,session_hash,wallet,generation,issued_at,expires_at)
   values(p_data->>'hash',s.token_sha256,s.wallet,p_data->>'generation',issued,expiry) on conflict do nothing;
  return to_jsonb(found);
 end if;
 select * into r from private.arcade_bnb_run_reviews where hash=p_data->>'hash' for update;
 t:=clock_timestamp();
 if not found or r.session_hash<>s.token_sha256 or r.wallet<>s.wallet or r.generation is distinct from p_data->>'generation'
  or r.consumed_at is not null or r.issued_at>t or r.expires_at<=t or s.expires_at<=t then return 'false'::jsonb; end if;
 update private.arcade_bnb_run_reviews set consumed_at=t where hash=r.hash;
 return 'true'::jsonb;
end $$;
revoke all on function public.arcade_bnb_run_review_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.arcade_bnb_run_review_v1(text,jsonb) to service_role;
commit;
