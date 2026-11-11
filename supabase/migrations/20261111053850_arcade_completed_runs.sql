-- Additive completion receipts. Existing attendance, Passport, monthly awards,
-- wallet sessions, payment records and game source tables are unchanged.
create table private.arcade_completed_runs (
 game_id text not null check(game_id in ('treeforce89','canopy-breaker','garden-bot','pvp')),
 source_run_key text not null check(source_run_key ~ '^[a-f0-9]{64}$'),
 wallet text not null check(wallet ~ '^0x[0-9a-f]{64}$'),
 completed_at timestamptz not null,
 score bigint check(score between 0 and 1000000000),
 stage integer check(stage between 1 and 30),
 outcome text not null check(outcome in ('completed','won','gameover')),
 evidence_kind text not null check(evidence_kind in ('official-result','server-completed-run','saved-client-result')),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(game_id,source_run_key),
 check((game_id in ('garden-bot','pvp') and evidence_kind='official-result' and score is null and stage is null and outcome='completed') or
       (game_id='canopy-breaker' and evidence_kind='server-completed-run' and score is not null and stage is not null and outcome in ('won','gameover')) or
       (game_id='treeforce89' and evidence_kind='saved-client-result' and score is not null and stage between 1 and 10 and outcome in ('won','gameover')))
);
create index arcade_completed_runs_wallet_time on private.arcade_completed_runs(wallet,completed_at desc);
alter table private.arcade_completed_runs enable row level security;
revoke all on private.arcade_completed_runs from public,anon,authenticated;
grant select,insert,update on private.arcade_completed_runs to service_role;

create function public.arcade_completed_runs_sync_v1(p_token_sha256 text,p_origin text,p_events jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $function$
declare s private.arcade_growth_sessions; v jsonb; at_time timestamptz; saved_wallet text;
 current_day date := (clock_timestamp() at time zone 'UTC')::date;
begin
 s:=private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
 perform pg_advisory_xact_lock(hashtextextended('arcade-completed-runs:'||s.wallet,0));
 if s.expires_at<=clock_timestamp() then raise exception 'arcade-growth-invalid-session'; end if;
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>200 then raise exception 'arcade-completed-invalid-events'; end if;
 for v in select value from jsonb_array_elements(p_events) loop
  if jsonb_typeof(v)<>'object' or (v->>'gameId') is null or v->>'gameId' not in ('treeforce89','canopy-breaker')
   or (v->>'sourceRunKey') is null or (v->>'sourceRunKey') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(v->'score') is distinct from 'number' or jsonb_typeof(v->'stage') is distinct from 'number'
   or (v->>'outcome') is null or v->>'outcome' not in ('won','gameover')
   or (v->>'completedAt') is null
   or (v->>'evidenceKind') is distinct from (case when v->>'gameId'='treeforce89' then 'saved-client-result' else 'server-completed-run' end)
   then raise exception 'arcade-completed-invalid-events'; end if;
  at_time:=(v->>'completedAt')::timestamptz;
  if not isfinite(at_time) or at_time>clock_timestamp() or at_time<clock_timestamp()-interval '48 hours' then raise exception 'arcade-completed-invalid-time'; end if;
  insert into private.arcade_completed_runs(game_id,source_run_key,wallet,completed_at,score,stage,outcome,evidence_kind)
   values(v->>'gameId',v->>'sourceRunKey',s.wallet,at_time,(v->>'score')::bigint,(v->>'stage')::integer,v->>'outcome',v->>'evidenceKind')
   on conflict(game_id,source_run_key) do update set
    score=greatest(private.arcade_completed_runs.score,excluded.score),
    stage=greatest(private.arcade_completed_runs.stage,excluded.stage),
    outcome=case when private.arcade_completed_runs.outcome='won' then 'won' else excluded.outcome end
    where private.arcade_completed_runs.wallet=excluded.wallet;
  select wallet into saved_wallet from private.arcade_completed_runs where game_id=v->>'gameId' and source_run_key=v->>'sourceRunKey';
  if saved_wallet is distinct from s.wallet then raise exception 'arcade-completed-wallet-conflict'; end if;
 end loop;
 -- Official Garden/PvP results are already verified by the existing ingestion
 -- service. First-wave Tree Force events and practice results are never imported.
 insert into private.arcade_completed_runs(game_id,source_run_key,wallet,completed_at,score,stage,outcome,evidence_kind)
 select e.game_id,encode(sha256(convert_to(e.source||':'||e.source_id,'UTF8')),'hex'),s.wallet,e.completed_at,null,null,'completed','official-result'
 from private.arcade_growth_game_events e where e.wallet=s.wallet and e.source='garden-battles'
  and e.game_id in ('garden-bot','pvp') and e.evidence_kind='completed-result'
  and e.completed_at>=clock_timestamp()-interval '48 hours' and e.completed_at<=clock_timestamp()
 on conflict(game_id,source_run_key) do nothing;
 return jsonb_build_object('wallet',s.wallet,'dateKey',to_char(current_day,'YYYY-MM-DD'),
  'runs',coalesce((select jsonb_agg(jsonb_build_object(
   'id',encode(sha256(convert_to(r.game_id||':'||r.source_run_key,'UTF8')),'hex'),
   'gameId',r.game_id,'completedAt',to_char(r.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'score',r.score,'stage',r.stage,'outcome',r.outcome,'evidenceKind',r.evidence_kind)
   order by r.completed_at desc,r.game_id,r.source_run_key)
   from (select * from private.arcade_completed_runs where wallet=s.wallet
    and completed_at>=(current_day::timestamp at time zone 'UTC')
    and completed_at<((current_day+1)::timestamp at time zone 'UTC') order by completed_at desc,game_id,source_run_key limit 400) r),'[]'::jsonb));
end $function$;
revoke all on function public.arcade_completed_runs_sync_v1(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.arcade_completed_runs_sync_v1(text,text,jsonb) to service_role;
