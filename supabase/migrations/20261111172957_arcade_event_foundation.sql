-- Service-only event drafts. Nothing in this migration can open entry or grant rewards.
create table private.arcade_event_organizers (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{64}$'),
  enabled boolean not null default true,
  added_at timestamptz not null default clock_timestamp()
);
alter table private.arcade_event_organizers enable row level security;
revoke all on private.arcade_event_organizers from public,anon,authenticated;
grant select on private.arcade_event_organizers to service_role;

create table private.arcade_event_drafts (
  event_id text primary key check (event_id ~ '^[a-z0-9-]{6,90}$'),
  version integer not null check (version > 0),
  title text not null check (length(btrim(title)) between 1 and 80),
  game_id text not null check (game_id in ('treeforce89','canopy-breaker','canopy-defense')),
  time_zone text not null check (time_zone in ('America/Chicago','UTC')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','locked')),
  access_requirement text not null default 'nftree-holder-only' check (access_requirement = 'nftree-holder-only'),
  entry_fee_mist bigint not null default 5000000000 check (entry_fee_mist = 5000000000),
  minimum_prize_mist bigint not null default 25000000000 check (minimum_prize_mist = 25000000000),
  prize_share_bps integer not null default 8000 check (prize_share_bps = 8000),
  payment_enabled boolean not null default false check (payment_enabled = false),
  updated_by text not null references private.arcade_event_organizers(wallet),
  updated_at timestamptz not null default clock_timestamp(),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at))
);
alter table private.arcade_event_drafts enable row level security;
revoke all on private.arcade_event_drafts from public,anon,authenticated;
grant select,insert,update on private.arcade_event_drafts to service_role;

create table private.arcade_event_draft_history (
  event_id text not null references private.arcade_event_drafts(event_id),
  version integer not null,
  snapshot jsonb not null,
  saved_at timestamptz not null default clock_timestamp(),
  primary key (event_id,version)
);
alter table private.arcade_event_draft_history enable row level security;
revoke all on private.arcade_event_draft_history from public,anon,authenticated;
grant select,insert on private.arcade_event_draft_history to service_role;

create function public.arcade_event_load_draft_v1(p_token_sha256 text,p_origin text,p_event_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; e private.arcade_event_drafts;
begin
  s := public.arcade_growth_read_session_v1(p_token_sha256,p_origin);
  if not exists(select 1 from private.arcade_event_organizers where wallet=s->>'wallet' and enabled) then raise exception 'event-admin-required'; end if;
  select * into e from private.arcade_event_drafts where event_id=p_event_id;
  if not found then return null; end if;
  return to_jsonb(e);
end $$;
revoke execute on function public.arcade_event_load_draft_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.arcade_event_load_draft_v1(text,text,text) to service_role;

create function public.arcade_event_save_draft_v1(p_token_sha256 text,p_origin text,p_draft jsonb,p_expected_version integer)
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
