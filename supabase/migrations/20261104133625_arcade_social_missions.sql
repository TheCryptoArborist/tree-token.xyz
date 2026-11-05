-- Additive social stamps. Existing attendance, game stamps and badge rules are untouched.
begin;
create table private.arcade_social_entries (
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$'),
  week_key date not null,
  mission text not null check (mission in ('share-score','friend-challenge','community-vote')),
  proof text not null check (length(proof) between 1 and 1000),
  status text not null check (status in ('pending','completed','rejected')),
  submitted_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  review_note text,
  primary key(wallet,week_key,mission),
  check ((mission = 'community-vote' and status = 'completed') or mission <> 'community-vote')
);
-- A public post cannot be reused for another wallet, week or mission.
create unique index arcade_social_proof_unique on private.arcade_social_entries((substring(proof from '/status/([0-9]+)$'))) where mission <> 'community-vote';
alter table private.arcade_social_entries enable row level security;
revoke all on private.arcade_social_entries from public, anon, authenticated;
grant select, insert, update on private.arcade_social_entries to service_role;

create function public.arcade_social_v1(p_token_sha256 text, p_origin text, p_mission text default null, p_proof text default null)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare s private.arcade_growth_sessions; w date; next_reset timestamptz; result jsonb;
begin
  s := private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
  w := date_trunc('week',clock_timestamp() at time zone 'UTC')::date;
  next_reset := (w + 7)::timestamp at time zone 'UTC';
  if p_mission is not null then
    if p_mission not in ('share-score','friend-challenge','community-vote') or p_proof is null then
      raise exception 'arcade-social-invalid-proof';
    end if;
    if p_mission = 'community-vote' then
      if p_proof not in ('treeforce89','garden-bot','arborist-trials') then raise exception 'arcade-social-invalid-proof'; end if;
    elsif p_proof !~ '^https://(x[.]com|twitter[.]com)/[A-Za-z0-9_]{1,15}/status/[0-9]{1,25}$' then
      raise exception 'arcade-social-invalid-proof';
    end if;
    -- Serialize submissions per wallet; repeated calls return the original receipt.
    perform pg_advisory_xact_lock(hashtextextended('arcade-social:' || s.wallet,0));
    if s.expires_at <= clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
    insert into private.arcade_social_entries(wallet,week_key,mission,proof,status)
    values(s.wallet,w,p_mission,p_proof,case when p_mission='community-vote' then 'completed' else 'pending' end)
    on conflict(wallet,week_key,mission) do nothing;
  end if;
  select jsonb_build_object('wallet',s.wallet,'weekKey',w,'resetsAt',next_reset,
    'entries',coalesce((select jsonb_agg(jsonb_build_object('mission',mission,'status',status,'proof',proof,'reviewNote',review_note))
      from private.arcade_social_entries where wallet=s.wallet and week_key=w),'[]'::jsonb),
    'monthlyStamps',(select count(*) from private.arcade_social_entries where wallet=s.wallet and status='completed'
      and submitted_at >= date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC')) into result;
  return result;
end $$;
revoke all on function public.arcade_social_v1(text,text,text,text) from public, anon, authenticated;
grant execute on function public.arcade_social_v1(text,text,text,text) to service_role;
commit;
