-- Add a distinct USDC draft policy without changing existing SUI rows or history.
-- No payment, scoring, payout, award or organizer activation is introduced.
create function private.arcade_event_terms_v2()
returns jsonb language sql immutable security invoker set search_path='' as $$
  select '{"version":2,"currency":"USDC","network":"sui-mainnet","decimals":6,"coinType":"0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC","entryFeeUnits":"5000000","minimumPrizeUnits":"25000000","prizeShareBps":8000,"organizerShareBps":2000,"payoutTiers":[{"id":"winner-only","minEntrants":1,"maxEntrants":24,"paidPlaces":1,"splitBps":[10000,0,0]},{"id":"top-two","minEntrants":25,"maxEntrants":49,"paidPlaces":2,"splitBps":[7500,2500,0]},{"id":"top-three","minEntrants":50,"maxEntrants":null,"paidPlaces":3,"splitBps":[6000,2500,1500]}],"lives":3,"paidContinues":false,"attempts":"unlimited","payout":"manual-after-review","access":"nftree-holder-only"}'::jsonb;
$$;
revoke execute on function private.arcade_event_terms_v2() from public,anon,authenticated;
grant execute on function private.arcade_event_terms_v2() to service_role;

alter table private.arcade_event_drafts
  add column terms_version integer not null default 1,
  add column currency text not null default 'SUI',
  add column coin_type text not null default '0x2::sui::SUI',
  add column token_decimals integer not null default 9,
  add column entry_fee_units bigint,
  add column minimum_prize_units bigint,
  add column organizer_share_bps integer,
  add column terms jsonb,
  alter column entry_fee_mist drop not null,
  alter column minimum_prize_mist drop not null;

-- Null-safe checks prevent missing values from bypassing either fixed policy.
-- The old Mist fields retain their original defaults/checks for v1 inserts;
-- v2 explicitly writes NULL to them rather than mislabelling USDC as SUI Mist.
alter table private.arcade_event_drafts add constraint arcade_event_drafts_policy_check check (
  (terms_version=1 and currency='SUI' and coin_type='0x2::sui::SUI' and token_decimals=9
    and entry_fee_mist is not distinct from 5000000000::bigint
    and minimum_prize_mist is not distinct from 25000000000::bigint
    and entry_fee_units is null and minimum_prize_units is null
    and organizer_share_bps is null and terms is null)
  or
  (terms_version=2 and currency='USDC'
    and coin_type='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC'
    and token_decimals=6 and entry_fee_mist is null and minimum_prize_mist is null
    and entry_fee_units is not distinct from 5000000::bigint
    and minimum_prize_units is not distinct from 25000000::bigint
    and organizer_share_bps is not distinct from 2000
    and terms is not distinct from private.arcade_event_terms_v2())
);

-- Legacy callers may continue working with legacy drafts, but cannot edit or
-- reinterpret a v2 USDC event. All existing ACLs and historical snapshots remain.
create or replace function public.arcade_event_load_draft_v1(p_token_sha256 text,p_origin text,p_event_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; e private.arcade_event_drafts;
begin
  s := public.arcade_growth_read_session_v1(p_token_sha256,p_origin);
  if not exists(select 1 from private.arcade_event_organizers where wallet=s->>'wallet' and enabled) then raise exception 'event-admin-required'; end if;
  select * into e from private.arcade_event_drafts where event_id=p_event_id;
  if not found then return null; end if;
  if e.terms_version<>1 then raise exception 'event-policy-conflict'; end if;
  return to_jsonb(e);
end $$;
revoke execute on function public.arcade_event_load_draft_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.arcade_event_load_draft_v1(text,text,text) to service_role;

create or replace function public.arcade_event_save_draft_v1(p_token_sha256 text,p_origin text,p_draft jsonb,p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; e private.arcade_event_drafts; v_id text; v_start timestamptz; v_end timestamptz;
begin
  s := public.arcade_growth_read_session_v1(p_token_sha256,p_origin);
  if not exists(select 1 from private.arcade_event_organizers where wallet=s->>'wallet' and enabled) then raise exception 'event-admin-required'; end if;
  if p_draft is null or jsonb_typeof(p_draft)<>'object' or p_expected_version is null or p_expected_version<0 then raise exception 'event-invalid-draft'; end if;
  v_id := p_draft->>'id';
  if v_id is null or v_id !~ '^[a-z0-9-]{6,90}$' or coalesce(p_draft->>'title','')='' or coalesce(p_draft->>'gameId','') not in ('treeforce89','canopy-breaker','canopy-defense') or coalesce(p_draft->>'timeZone','') not in ('America/Chicago','UTC') then raise exception 'event-invalid-draft'; end if;
  -- Serialize creations and edits for one event, including the first insert.
  perform pg_advisory_xact_lock(hashtextextended(v_id,0));
  select * into e from private.arcade_event_drafts where event_id=v_id for update;
  if found then
    if e.terms_version<>1 then raise exception 'event-policy-conflict'; end if;
    if e.status<>'draft' then raise exception 'event-locked'; end if;
    if e.version<>p_expected_version then raise exception 'event-version-conflict'; end if;
  elsif p_expected_version<>0 then raise exception 'event-version-conflict'; end if;
  begin v_start := (p_draft->>'startsAt')::timestamptz; v_end := (p_draft->>'endsAt')::timestamptz;
  exception when others then raise exception 'event-invalid-draft'; end;
  insert into private.arcade_event_drafts(event_id,version,title,game_id,time_zone,starts_at,ends_at,updated_by)
  values(v_id,p_expected_version+1,btrim(p_draft->>'title'),p_draft->>'gameId',p_draft->>'timeZone',v_start,v_end,s->>'wallet')
  on conflict(event_id) do update set version=excluded.version,title=excluded.title,game_id=excluded.game_id,time_zone=excluded.time_zone,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_by=excluded.updated_by,updated_at=clock_timestamp()
  returning * into e;
  insert into private.arcade_event_draft_history(event_id,version,snapshot) values(e.event_id,e.version,to_jsonb(e));
  return to_jsonb(e);
end $$;
revoke execute on function public.arcade_event_save_draft_v1(text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.arcade_event_save_draft_v1(text,text,jsonb,integer) to service_role;

create function public.arcade_event_load_draft_v2(p_token_sha256 text,p_origin text,p_event_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; e private.arcade_event_drafts;
begin
  s := public.arcade_growth_read_session_v1(p_token_sha256,p_origin);
  if not exists(select 1 from private.arcade_event_organizers where wallet=s->>'wallet' and enabled) then raise exception 'event-admin-required'; end if;
  select * into e from private.arcade_event_drafts where event_id=p_event_id;
  if not found then return null; end if;
  if e.terms_version<>2 then raise exception 'event-policy-conflict'; end if;
  return to_jsonb(e);
end $$;
revoke execute on function public.arcade_event_load_draft_v2(text,text,text) from public,anon,authenticated;
grant execute on function public.arcade_event_load_draft_v2(text,text,text) to service_role;

create function public.arcade_event_save_draft_v2(p_token_sha256 text,p_origin text,p_draft jsonb,p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; e private.arcade_event_drafts; v_id text; v_start timestamptz; v_end timestamptz;
begin
  s := public.arcade_growth_read_session_v1(p_token_sha256,p_origin);
  if not exists(select 1 from private.arcade_event_organizers where wallet=s->>'wallet' and enabled) then raise exception 'event-admin-required'; end if;
  if p_draft is null or jsonb_typeof(p_draft)<>'object' or p_expected_version is null or p_expected_version<0 or p_expected_version>2147483646 then raise exception 'event-invalid-draft'; end if;
  if p_draft->'version' is distinct from '2'::jsonb
    or p_draft->>'status' is distinct from 'draft'
    or p_draft->'paymentEnabled' is distinct from 'false'::jsonb
    or p_draft->'terms' is distinct from private.arcade_event_terms_v2()
    or exists(select 1 from jsonb_object_keys(p_draft) as k where k not in ('version','id','title','gameId','timeZone','startLocal','endLocal','startsAt','endsAt','status','terms','cosmetics','paymentEnabled'))
    then raise exception 'event-invalid-draft'; end if;
  v_id := p_draft->>'id';
  if jsonb_typeof(p_draft->'id') is distinct from 'string' or v_id !~ '^[a-z0-9-]{6,90}$'
    or jsonb_typeof(p_draft->'title') is distinct from 'string' or length(btrim(p_draft->>'title')) not between 1 and 80
    or coalesce(p_draft->>'gameId','') not in ('treeforce89','canopy-breaker','canopy-defense')
    or coalesce(p_draft->>'timeZone','') not in ('America/Chicago','UTC') then raise exception 'event-invalid-draft'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id,0));
  select * into e from private.arcade_event_drafts where event_id=v_id for update;
  if found then
    if e.terms_version<>2 then raise exception 'event-policy-conflict'; end if;
    if e.status<>'draft' then raise exception 'event-locked'; end if;
    if e.version<>p_expected_version then raise exception 'event-version-conflict'; end if;
  elsif p_expected_version<>0 then raise exception 'event-version-conflict'; end if;
  begin v_start := (p_draft->>'startsAt')::timestamptz; v_end := (p_draft->>'endsAt')::timestamptz;
  exception when others then raise exception 'event-invalid-draft'; end;
  insert into private.arcade_event_drafts(event_id,version,title,game_id,time_zone,starts_at,ends_at,updated_by,terms_version,currency,coin_type,token_decimals,entry_fee_mist,minimum_prize_mist,entry_fee_units,minimum_prize_units,organizer_share_bps,terms)
  values(v_id,p_expected_version+1,btrim(p_draft->>'title'),p_draft->>'gameId',p_draft->>'timeZone',v_start,v_end,s->>'wallet',2,'USDC','0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',6,null,null,5000000,25000000,2000,private.arcade_event_terms_v2())
  on conflict(event_id) do update set version=excluded.version,title=excluded.title,game_id=excluded.game_id,time_zone=excluded.time_zone,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_by=excluded.updated_by,updated_at=clock_timestamp()
  returning * into e;
  insert into private.arcade_event_draft_history(event_id,version,snapshot) values(e.event_id,e.version,to_jsonb(e));
  return to_jsonb(e);
end $$;
revoke execute on function public.arcade_event_save_draft_v2(text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.arcade_event_save_draft_v2(text,text,jsonb,integer) to service_role;
