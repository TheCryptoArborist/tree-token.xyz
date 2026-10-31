-- Daily Growth owns only these new arcade_growth_* objects. No existing game,
-- raffle, payment, reward, environment, trigger, or schedule is altered.
-- All callers use the server's service-role key. Wallet authentication is
-- verified by the Netlify handler; no browser role may call these RPCs directly.
create schema if not exists private;

create table private.arcade_growth_wallet_challenges (
  challenge_id uuid primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet <> '0x' || repeat('0', 64)),
  origin text not null check (origin in ('https://tree-token.xyz', 'https://www.tree-token.xyz')),
  date_key date not null,
  nonce_sha256 text not null unique check (nonce_sha256 ~ '^[0-9a-f]{64}$'),
  message text not null check (length(message) between 100 and 2048),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes 5 seconds')
);
create index arcade_growth_challenges_wallet_time on private.arcade_growth_wallet_challenges (wallet, issued_at desc);
create index arcade_growth_challenges_fingerprint_time on private.arcade_growth_wallet_challenges (request_fingerprint, issued_at desc);

create table private.arcade_growth_sessions (
  token_sha256 text primary key check (token_sha256 ~ '^[0-9a-f]{64}$'),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet <> '0x' || repeat('0', 64)),
  origin text not null check (origin in ('https://tree-token.xyz', 'https://www.tree-token.xyz')),
  auth_challenge_id uuid not null unique references private.arcade_growth_wallet_challenges(challenge_id),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > issued_at and expires_at <= issued_at + interval '1 hour 5 seconds')
);

create table private.arcade_growth_month_rules (
  month_key date primary key check (extract(day from month_key) = 1),
  rule_version text not null default 'arcade-growth-v1' check (rule_version = 'arcade-growth-v1'),
  enabled_games text[] not null check (cardinality(enabled_games) between 1 and 3 and
    enabled_games <@ array['garden-bot','pvp','arborist-trials']::text[] and array_position(enabled_games, null) is null),
  created_at timestamptz not null default clock_timestamp()
);

create table private.arcade_growth_checkins (
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet <> '0x' || repeat('0', 64)),
  date_key date not null,
  source text not null check (source in ('manual','verified-game')),
  created_at timestamptz not null default clock_timestamp(),
  primary key(wallet, date_key)
);

create table private.arcade_growth_game_events (
  source text not null check (source = 'garden-battles'),
  source_id text not null check (length(source_id) between 3 and 200 and source_id ~ '^[a-zA-Z0-9:_-]+$'),
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet <> '0x' || repeat('0', 64)),
  game_id text not null check (game_id in ('garden-bot','pvp','arborist-trials')),
  completed_at timestamptz not null,
  date_key date not null check (date_key = (completed_at at time zone 'UTC')::date),
  proof_digest text check (proof_digest ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key(source, source_id),
  check ((game_id = 'arborist-trials' and source_id like 'trial:%' and proof_digest is null) or
         (game_id in ('garden-bot','pvp') and source_id like 'battle:%' and proof_digest is not null)),
  check (right(source_id, 67) = ':' || wallet)
);
create index arcade_growth_events_wallet_date_game on private.arcade_growth_game_events (wallet, date_key, game_id);

create table private.arcade_growth_daily_quests (
  wallet text not null,
  date_key date not null,
  game_id text not null check (game_id in ('garden-bot','pvp','arborist-trials')),
  source text not null,
  source_id text not null,
  credited_at timestamptz not null default clock_timestamp(),
  primary key(wallet,date_key),
  foreign key(wallet,date_key) references private.arcade_growth_checkins(wallet,date_key),
  foreign key(source,source_id) references private.arcade_growth_game_events(source,source_id)
);

create table private.arcade_growth_monthly_badges (
  wallet text not null check (wallet ~ '^0x[0-9a-f]{64}$' and wallet <> '0x' || repeat('0', 64)),
  month_key date not null references private.arcade_growth_month_rules(month_key),
  badge_id text not null check (badge_id in ('seedling','sapling','deep-roots','full-canopy','arcade-passport')),
  earned_at timestamptz not null default clock_timestamp(),
  rule_version text not null check (rule_version = 'arcade-growth-v1'),
  primary key(wallet,month_key,badge_id)
);

alter table private.arcade_growth_wallet_challenges enable row level security;
alter table private.arcade_growth_sessions enable row level security;
alter table private.arcade_growth_month_rules enable row level security;
alter table private.arcade_growth_checkins enable row level security;
alter table private.arcade_growth_game_events enable row level security;
alter table private.arcade_growth_daily_quests enable row level security;
alter table private.arcade_growth_monthly_badges enable row level security;
revoke all on private.arcade_growth_wallet_challenges, private.arcade_growth_sessions,
  private.arcade_growth_month_rules, private.arcade_growth_checkins, private.arcade_growth_game_events,
  private.arcade_growth_daily_quests, private.arcade_growth_monthly_badges from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on private.arcade_growth_wallet_challenges, private.arcade_growth_sessions to service_role;
grant select, insert on private.arcade_growth_month_rules, private.arcade_growth_checkins,
  private.arcade_growth_game_events, private.arcade_growth_daily_quests, private.arcade_growth_monthly_badges to service_role;

create function private.arcade_growth_valid_games_v1(p_games text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select coalesce(cardinality(p_games) between 1 and 3
    and p_games <@ array['garden-bot','pvp','arborist-trials']::text[]
    and array_position(p_games, null) is null
    and cardinality(p_games) = (select count(distinct g) from unnest(p_games) as g), false)
$$;

create function private.arcade_growth_require_session_v1(p_token_sha256 text, p_origin text)
returns private.arcade_growth_sessions language plpgsql volatile security invoker set search_path = '' as $$
declare v_session private.arcade_growth_sessions;
begin
  select * into v_session from private.arcade_growth_sessions
    where token_sha256 = p_token_sha256 and origin = p_origin and revoked_at is null
      and expires_at > clock_timestamp() for share;
  if not found or v_session.expires_at <= clock_timestamp() then raise exception 'arcade-growth-invalid-session' using errcode = 'P0001'; end if;
  return v_session;
end $$;

create function private.arcade_growth_month_games_v1(p_month date, p_games text[], p_freeze boolean)
returns text[] language plpgsql volatile security invoker set search_path = '' as $$
declare v_games text[];
begin
  if not private.arcade_growth_valid_games_v1(p_games) then raise exception 'arcade-growth-invalid-rules'; end if;
  if p_freeze then
    insert into private.arcade_growth_month_rules(month_key,enabled_games) values(p_month,p_games)
      on conflict(month_key) do nothing;
  end if;
  select enabled_games into v_games from private.arcade_growth_month_rules where month_key = p_month;
  return coalesce(v_games,p_games);
end $$;

create function private.arcade_growth_award_badges_v1(p_wallet text, p_month date, p_games text[])
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare v_days integer;
begin
  select count(*) into v_days from private.arcade_growth_checkins
    where wallet = p_wallet and date_key >= p_month and date_key < (p_month + interval '1 month')::date;
  insert into private.arcade_growth_monthly_badges(wallet,month_key,badge_id,rule_version)
    select p_wallet,p_month,m.id,'arcade-growth-v1'
    from (values('seedling',3),('sapling',7),('deep-roots',14),('full-canopy',21)) as m(id,target)
    where v_days >= m.target on conflict(wallet,month_key,badge_id) do nothing;
  if not exists(select 1 from unnest(p_games) as needed(game_id) where not exists(
    select 1 from private.arcade_growth_game_events e where e.wallet = p_wallet and e.game_id = needed.game_id
      and e.date_key >= p_month and e.date_key < (p_month + interval '1 month')::date)) then
    insert into private.arcade_growth_monthly_badges(wallet,month_key,badge_id,rule_version)
      values(p_wallet,p_month,'arcade-passport','arcade-growth-v1') on conflict(wallet,month_key,badge_id) do nothing;
  end if;
end $$;

create function private.arcade_growth_wallet_snapshot_v1(p_wallet text, p_day date, p_games text[])
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_month date := date_trunc('month',p_day)::date; v_games text[]; v_result jsonb;
begin
  v_games := private.arcade_growth_month_games_v1(v_month,p_games,false);
  select jsonb_build_object(
    'wallet',p_wallet,'dateKey',to_char(p_day,'YYYY-MM-DD'),'monthKey',to_char(v_month,'YYYY-MM'),'enabledGames',to_jsonb(v_games),
    'checkins',coalesce((select jsonb_agg(to_char(c.date_key,'YYYY-MM-DD') order by c.date_key)
      from private.arcade_growth_checkins c where c.wallet=p_wallet and c.date_key between v_month and p_day),'[]'::jsonb),
    'quests',coalesce((select jsonb_agg(jsonb_build_object('dateKey',to_char(q.date_key,'YYYY-MM-DD'),'gameId',q.game_id) order by q.date_key)
      from private.arcade_growth_daily_quests q where q.wallet=p_wallet and q.date_key between v_month and p_day),'[]'::jsonb),
    'gamesByDay',coalesce((select jsonb_agg(jsonb_build_object('dateKey',to_char(g.date_key,'YYYY-MM-DD'),'gameIds',g.ids) order by g.date_key)
      from (select e.date_key,jsonb_agg(distinct e.game_id order by e.game_id) as ids
        from private.arcade_growth_game_events e where e.wallet=p_wallet and e.date_key between v_month and p_day
          and e.game_id=any(v_games) group by e.date_key) g),'[]'::jsonb),
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.badge_id,'monthKey',to_char(b.month_key,'YYYY-MM'),'earnedAt',b.earned_at)
      order by b.month_key,b.earned_at,b.badge_id) from private.arcade_growth_monthly_badges b
      where b.wallet=p_wallet and b.month_key<=v_month),'[]'::jsonb)) into v_result;
  return v_result;
end $$;

create function public.arcade_growth_public_rules_v1(p_enabled_games text[]) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
begin
  return to_jsonb(private.arcade_growth_month_games_v1(date_trunc('month',clock_timestamp() at time zone 'UTC')::date,p_enabled_games,false));
end $$;

create function public.arcade_growth_create_challenge_v1(p_challenge_id uuid,p_wallet text,p_origin text,p_date_key date,
  p_nonce_sha256 text,p_message text,p_expires_at timestamptz,p_request_fingerprint text)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_date_key <> (v_now at time zone 'UTC')::date or p_date_key is null then raise exception 'arcade-growth-day-changed'; end if;
  if p_expires_at <= v_now or p_expires_at > v_now + interval '5 minutes 5 seconds' then raise exception 'arcade-growth-invalid-challenge'; end if;
  -- Serialize the two rate counters; store only a domain-separated keyed IP hash.
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:challenge:fingerprint:' || p_request_fingerprint,0));
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:challenge:wallet:' || p_wallet,0));
  if (select count(*) from private.arcade_growth_wallet_challenges where wallet=p_wallet and issued_at>v_now-interval '10 minutes') >= 6
    or (select count(*) from private.arcade_growth_wallet_challenges where request_fingerprint=p_request_fingerprint and issued_at>v_now-interval '10 minutes') >= 40 then
    raise exception 'arcade-growth-rate-limited';
  end if;
  insert into private.arcade_growth_wallet_challenges(challenge_id,wallet,origin,date_key,nonce_sha256,message,request_fingerprint,issued_at,expires_at)
    values(p_challenge_id,p_wallet,p_origin,p_date_key,p_nonce_sha256,p_message,p_request_fingerprint,v_now,p_expires_at);
  return jsonb_build_object('challengeId',p_challenge_id,'wallet',p_wallet,'origin',p_origin,'dateKey',to_char(p_date_key,'YYYY-MM-DD'),
    'message',p_message,'expiresAt',p_expires_at,'consumed',false);
end $$;

create function public.arcade_growth_read_challenge_v1(p_challenge_id uuid) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare v_challenge private.arcade_growth_wallet_challenges;
begin
  select * into v_challenge from private.arcade_growth_wallet_challenges where challenge_id=p_challenge_id;
  if not found then raise exception 'arcade-growth-invalid-challenge'; end if;
  return jsonb_build_object('challengeId',v_challenge.challenge_id,'wallet',v_challenge.wallet,'origin',v_challenge.origin,
    'dateKey',to_char(v_challenge.date_key,'YYYY-MM-DD'),'message',v_challenge.message,'expiresAt',v_challenge.expires_at,
    'consumed',v_challenge.consumed_at is not null);
end $$;

create function public.arcade_growth_create_session_v1(p_challenge_id uuid,p_wallet text,p_origin text,p_token_sha256 text,p_expires_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_id uuid;
begin
  if p_expires_at <= v_now or p_expires_at > v_now + interval '1 hour 5 seconds' then raise exception 'arcade-growth-invalid-session'; end if;
  -- Atomic consume and insert: competing replays cannot create another session.
  update private.arcade_growth_wallet_challenges set consumed_at=v_now
    where challenge_id=p_challenge_id and wallet=p_wallet and origin=p_origin and consumed_at is null
      and expires_at>v_now and date_key=(v_now at time zone 'UTC')::date returning challenge_id into v_id;
  if v_id is null then raise exception 'arcade-growth-invalid-challenge'; end if;
  insert into private.arcade_growth_sessions(token_sha256,wallet,origin,auth_challenge_id,issued_at,expires_at)
    values(p_token_sha256,p_wallet,p_origin,p_challenge_id,v_now,p_expires_at);
  return jsonb_build_object('wallet',p_wallet,'origin',p_origin,'expiresAt',p_expires_at,'revoked',false);
end $$;

create function public.arcade_growth_read_session_v1(p_token_sha256 text,p_origin text) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare v_session private.arcade_growth_sessions;
begin
  v_session := private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
  return jsonb_build_object('wallet',v_session.wallet,'origin',v_session.origin,'expiresAt',v_session.expires_at,'revoked',false);
end $$;

create function public.arcade_growth_revoke_session_v1(p_token_sha256 text,p_origin text) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
begin
  update private.arcade_growth_sessions set revoked_at=coalesce(revoked_at,clock_timestamp()) where token_sha256=p_token_sha256 and origin=p_origin;
  return jsonb_build_object('revoked',true);
end $$;

create function public.arcade_growth_snapshot_v1(p_token_sha256 text,p_origin text,p_enabled_games text[]) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare v_session private.arcade_growth_sessions;
begin
  v_session := private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
  return private.arcade_growth_wallet_snapshot_v1(v_session.wallet,(clock_timestamp() at time zone 'UTC')::date,p_enabled_games);
end $$;

create function public.arcade_growth_check_in_v1(p_token_sha256 text,p_origin text,p_enabled_games text[]) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare v_session private.arcade_growth_sessions; v_day date; v_month date; v_games text[];
begin
  v_session := private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:progress:' || v_session.wallet,0));
  if v_session.expires_at <= clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
  v_day := (clock_timestamp() at time zone 'UTC')::date; v_month := date_trunc('month',v_day)::date;
  v_games := private.arcade_growth_month_games_v1(v_month,p_enabled_games,true);
  insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_session.wallet,v_day,'manual') on conflict(wallet,date_key) do nothing;
  perform private.arcade_growth_award_badges_v1(v_session.wallet,v_month,v_games);
  return private.arcade_growth_wallet_snapshot_v1(v_session.wallet,v_day,v_games);
end $$;

create function public.arcade_growth_record_events_v1(p_token_sha256 text,p_origin text,p_enabled_games text[],p_date_key date,p_events jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_session private.arcade_growth_sessions; v_day date; v_month date; v_games text[];
  v_event jsonb; v_at timestamptz; v_saved private.arcade_growth_game_events;
begin
  v_session := private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:progress:' || v_session.wallet,0));
  if v_session.expires_at <= clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
  v_day := (clock_timestamp() at time zone 'UTC')::date; v_month := date_trunc('month',v_day)::date;
  if p_date_key is null or p_date_key <> v_day then raise exception 'arcade-growth-day-changed'; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events)>100 then raise exception 'arcade-growth-event-conflict'; end if;
  v_games := private.arcade_growth_month_games_v1(v_month,p_enabled_games,true);
  for v_event in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_event) <> 'object' or (v_event->>'wallet') is distinct from v_session.wallet
      or (v_event->>'source') is distinct from 'garden-battles'
      or (v_event->>'gameId') is null or not ((v_event->>'gameId')=any(v_games))
      or (v_event->>'sourceId') is null or (v_event->>'completedAt') is null then raise exception 'arcade-growth-event-conflict'; end if;
    v_at := (v_event->>'completedAt')::timestamptz;
    if not isfinite(v_at) or (v_at at time zone 'UTC')::date <> v_day or v_at>clock_timestamp() then raise exception 'arcade-growth-event-conflict'; end if;
    insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,proof_digest)
      values(v_event->>'source',v_event->>'sourceId',v_session.wallet,v_event->>'gameId',v_at,v_day,v_event->>'proofDigest')
      on conflict(source,source_id) do nothing;
    select * into v_saved from private.arcade_growth_game_events where source=v_event->>'source' and source_id=v_event->>'sourceId';
    if v_saved.wallet is distinct from v_session.wallet or v_saved.game_id is distinct from v_event->>'gameId'
      or v_saved.completed_at is distinct from v_at or v_saved.proof_digest is distinct from v_event->>'proofDigest' then
      raise exception 'arcade-growth-event-conflict';
    end if;
    insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_session.wallet,v_day,'verified-game') on conflict(wallet,date_key) do nothing;
    insert into private.arcade_growth_daily_quests(wallet,date_key,game_id,source,source_id)
      values(v_session.wallet,v_day,v_saved.game_id,v_saved.source,v_saved.source_id) on conflict(wallet,date_key) do nothing;
  end loop;
  perform private.arcade_growth_award_badges_v1(v_session.wallet,v_month,v_games);
  return private.arcade_growth_wallet_snapshot_v1(v_session.wallet,v_day,v_games);
end $$;

-- Postgres grants new functions to PUBLIC by default. Override on every exact
-- new signature; never change privileges of an existing function or table.
revoke all on function private.arcade_growth_valid_games_v1(text[]), private.arcade_growth_require_session_v1(text,text),
  private.arcade_growth_month_games_v1(date,text[],boolean), private.arcade_growth_award_badges_v1(text,date,text[]),
  private.arcade_growth_wallet_snapshot_v1(text,date,text[]), public.arcade_growth_public_rules_v1(text[]),
  public.arcade_growth_create_challenge_v1(uuid,text,text,date,text,text,timestamptz,text), public.arcade_growth_read_challenge_v1(uuid),
  public.arcade_growth_create_session_v1(uuid,text,text,text,timestamptz), public.arcade_growth_read_session_v1(text,text),
  public.arcade_growth_revoke_session_v1(text,text), public.arcade_growth_snapshot_v1(text,text,text[]),
  public.arcade_growth_check_in_v1(text,text,text[]), public.arcade_growth_record_events_v1(text,text,text[],date,jsonb)
  from public, anon, authenticated;
grant execute on function private.arcade_growth_valid_games_v1(text[]), private.arcade_growth_require_session_v1(text,text),
  private.arcade_growth_month_games_v1(date,text[],boolean), private.arcade_growth_award_badges_v1(text,date,text[]),
  private.arcade_growth_wallet_snapshot_v1(text,date,text[]), public.arcade_growth_public_rules_v1(text[]),
  public.arcade_growth_create_challenge_v1(uuid,text,text,date,text,text,timestamptz,text), public.arcade_growth_read_challenge_v1(uuid),
  public.arcade_growth_create_session_v1(uuid,text,text,text,timestamptz), public.arcade_growth_read_session_v1(text,text),
  public.arcade_growth_revoke_session_v1(text,text), public.arcade_growth_snapshot_v1(text,text,text[]),
  public.arcade_growth_check_in_v1(text,text,text[]), public.arcade_growth_record_events_v1(text,text,text[],date,jsonb)
  to service_role;
