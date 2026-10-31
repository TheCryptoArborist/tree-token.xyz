-- TREE FORCE participation begins when the authenticated game client reports
-- the first wave. It is not verified victory, score, payment or completion.
-- Only Daily Growth objects change; the isolated TREE FORCE database is read
-- by the server and its authentication/payment objects are not modified.

alter table private.arcade_growth_game_events
  add column evidence_kind text not null default 'completed-result';
alter table private.arcade_growth_game_events
  add constraint arcade_growth_game_events_evidence_kind_check
    check (evidence_kind in ('completed-result','authenticated-run-start'));
alter table private.arcade_growth_game_events
  drop constraint arcade_growth_game_events_source_check,
  add constraint arcade_growth_game_events_source_check check (source in ('garden-battles','treeforce89')),
  drop constraint arcade_growth_game_events_game_id_check,
  add constraint arcade_growth_game_events_game_id_check check (game_id in ('garden-bot','pvp','arborist-trials','treeforce89')),
  -- Keep arcade_growth_game_events_check: it binds date_key to completed_at
  -- in UTC. The separate check1 constraint is the legacy game/proof rule.
  drop constraint arcade_growth_game_events_check1,
  add constraint arcade_growth_game_events_check1 check (
    (source = 'garden-battles' and evidence_kind = 'completed-result' and (
      (game_id = 'arborist-trials' and source_id like 'trial:%' and proof_digest is null) or
      (game_id in ('garden-bot','pvp') and source_id like 'battle:%' and proof_digest is not null))) or
    (source = 'treeforce89' and game_id = 'treeforce89' and evidence_kind = 'authenticated-run-start'
      and source_id ~ '^run:grove-[a-f0-9]{32}:0x[a-f0-9]{64}$' and proof_digest is null)
  );
-- The public source identity includes its wallet, but an original server run
-- can belong to only one wallet. A conflicting wallet cannot reuse the run.
create unique index arcade_growth_treeforce_original_run_idx
  on private.arcade_growth_game_events ((split_part(source_id,':',2))) where source = 'treeforce89';
alter table private.arcade_growth_checkins
  drop constraint arcade_growth_checkins_source_check,
  add constraint arcade_growth_checkins_source_check check (source in ('manual','verified-game','game-participation'));
alter table private.arcade_growth_daily_quests
  drop constraint arcade_growth_daily_quests_game_id_check,
  add constraint arcade_growth_daily_quests_game_id_check check (game_id in ('garden-bot','pvp','arborist-trials','treeforce89'));

-- enabledGames remains the existing frozen Passport requirement. eligibleGames
-- permits optional participation without rewriting any past or current month.
create or replace function private.arcade_growth_wallet_snapshot_v1(p_wallet text, p_day date, p_games text[])
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_month date := date_trunc('month',p_day)::date; v_games text[]; v_result jsonb;
begin
  v_games := private.arcade_growth_month_games_v1(v_month,p_games,false);
  select jsonb_build_object(
    'wallet',p_wallet,'dateKey',to_char(p_day,'YYYY-MM-DD'),'monthKey',to_char(v_month,'YYYY-MM'),'enabledGames',to_jsonb(v_games),
    'eligibleGames',to_jsonb(array['garden-bot','pvp','arborist-trials','treeforce89']::text[]),
    'checkins',coalesce((select jsonb_agg(to_char(c.date_key,'YYYY-MM-DD') order by c.date_key)
      from private.arcade_growth_checkins c where c.wallet=p_wallet and c.date_key between v_month and p_day),'[]'::jsonb),
    'quests',coalesce((select jsonb_agg(jsonb_build_object('dateKey',to_char(q.date_key,'YYYY-MM-DD'),'gameId',q.game_id) order by q.date_key)
      from private.arcade_growth_daily_quests q where q.wallet=p_wallet and q.date_key between v_month and p_day),'[]'::jsonb),
    'gamesByDay',coalesce((select jsonb_agg(jsonb_build_object('dateKey',to_char(g.date_key,'YYYY-MM-DD'),'gameIds',g.ids) order by g.date_key)
      from (select e.date_key,jsonb_agg(distinct e.game_id order by e.game_id) as ids
        from private.arcade_growth_game_events e where e.wallet=p_wallet and e.date_key between v_month and p_day
          and e.game_id=any(array['garden-bot','pvp','arborist-trials','treeforce89']::text[]) group by e.date_key) g),'[]'::jsonb),
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.badge_id,'monthKey',to_char(b.month_key,'YYYY-MM'),'earnedAt',b.earned_at)
      order by b.month_key,b.earned_at,b.badge_id) from private.arcade_growth_monthly_badges b
      where b.wallet=p_wallet and b.month_key<=v_month),'[]'::jsonb)) into v_result;
  return v_result;
end $$;

-- The server authenticates the exact TREE FORCE bearer/run in its isolated
-- database, checks NFTree ownership, then rereads that credential immediately
-- before invoking this RPC. No raw token, client timestamp or client wallet
-- claim is accepted here. Only the service role may supply this checked context.
-- Expiry/freshness are checked again using Supabase time. Cross-database logout
-- cannot be made atomic by this read-only bridge; no such guarantee is claimed.
create function public.arcade_growth_record_treeforce_play_v1(
  p_wallet text,p_run_id text,p_session_expires_at timestamptz,p_verified_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_now timestamptz; v_day date; v_month date; v_games text[];
  v_source_id text; v_saved private.arcade_growth_game_events; v_prior boolean;
begin
  if p_wallet is null or p_wallet !~ '^0x[0-9a-f]{64}$' or p_wallet = '0x'||repeat('0',64)
    or p_run_id is null or p_run_id !~ '^grove-[a-f0-9]{32}$' then raise exception 'arcade-growth-invalid-game-session'; end if;
  v_source_id := 'run:'||p_run_id||':'||p_wallet;
  -- Original run first, independent of the current UTC day. Continues and
  -- retries never move an existing record to today or grant an extra day.
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:treeforce-run:'||p_run_id,0));
  select * into v_saved from private.arcade_growth_game_events
    where source='treeforce89' and split_part(source_id,':',2)=p_run_id;
  v_prior := found;
  if v_prior and (v_saved.wallet is distinct from p_wallet or v_saved.source_id is distinct from v_source_id) then
    raise exception 'arcade-growth-event-conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('arcade-growth:progress:'||p_wallet,0));
  v_now := clock_timestamp();
  if p_session_expires_at is null or not isfinite(p_session_expires_at) or p_session_expires_at <= v_now then
    raise exception 'arcade-growth-invalid-game-session';
  end if;
  if p_verified_at is null or not isfinite(p_verified_at) or p_verified_at < v_now-interval '15 seconds'
    or p_verified_at > v_now+interval '5 seconds' or p_verified_at >= p_session_expires_at then
    raise exception 'arcade-growth-stale-game-verification';
  end if;
  v_day := (v_now at time zone 'UTC')::date;
  v_month := date_trunc('month',v_day)::date;
  if not v_prior then
    -- This release keeps all monthly requirements at the original three games.
    v_games := private.arcade_growth_month_games_v1(v_month,array['garden-bot','pvp','arborist-trials']::text[],true);
    insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,proof_digest,recorded_at,evidence_kind)
      values('treeforce89',v_source_id,p_wallet,'treeforce89',v_now,v_day,null,v_now,'authenticated-run-start') returning * into v_saved;
    insert into private.arcade_growth_checkins(wallet,date_key,source)
      values(p_wallet,v_day,'game-participation') on conflict(wallet,date_key) do nothing;
    insert into private.arcade_growth_daily_quests(wallet,date_key,game_id,source,source_id)
      values(p_wallet,v_day,'treeforce89','treeforce89',v_source_id) on conflict(wallet,date_key) do nothing;
    perform private.arcade_growth_award_badges_v1(p_wallet,v_month,v_games);
  else
    v_games := private.arcade_growth_month_games_v1(v_month,array['garden-bot','pvp','arborist-trials']::text[],false);
  end if;
  return jsonb_build_object(
    'snapshot',private.arcade_growth_wallet_snapshot_v1(p_wallet,v_day,v_games),
    'participation',jsonb_build_object('saved',true,'runId',p_run_id,'sourceId',v_source_id,
      'dateKey',to_char(v_saved.date_key,'YYYY-MM-DD'),'recordedAt',v_saved.recorded_at,'alreadyRecorded',v_prior));
end $$;

-- Preserve table RLS and existing private grants. The replaced helper keeps its
-- old ACL; explicitly restate it and restrict the only new public RPC.
revoke all on function private.arcade_growth_wallet_snapshot_v1(text,date,text[]),
  public.arcade_growth_record_treeforce_play_v1(text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private.arcade_growth_wallet_snapshot_v1(text,date,text[]),
  public.arcade_growth_record_treeforce_play_v1(text,text,timestamptz,timestamptz) to service_role;
