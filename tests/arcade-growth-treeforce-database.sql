-- Run after all Daily Growth migrations, including the November Passport rules,
-- on the existing development DB.
-- These synthetic participation records are always rolled back. No TREE FORCE
-- database, payment object, wallet credential or real gameplay is touched.
begin;
set local role service_role;
do $$
declare
  v_wallet text := '0x'||repeat('c',64);
  v_other text := '0x'||repeat('d',64);
  v_prior_wallet text := '0x'||repeat('e',64);
  v_invalid_wallet text := '0x'||repeat('f',64);
  v_games text[] := array['garden-bot','pvp','arborist-trials'];
  v_required_before text[];
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_month date := date_trunc('month',clock_timestamp() at time zone 'UTC')::date;
  v_prior_day date := (clock_timestamp() at time zone 'UTC')::date-1;
  v_run text := 'grove-'||repeat('a',32);
  v_second_run text := 'grove-'||repeat('b',32);
  v_prior_run text := 'grove-'||repeat('c',32);
  v_invalid_run text := 'grove-'||repeat('d',32);
  v_source_id text;
  v_result jsonb; v_duplicate jsonb; v_snapshot jsonb; v_events jsonb;
  v_challenge uuid := gen_random_uuid();
  v_token text := repeat('7',64);
  v_count integer; v_routine record; v_table record;
begin
  for v_routine in select p.oid,p.prosecdef,p.proconfig from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','public') and p.proname like 'arcade_growth_%'
  loop
    assert not has_function_privilege('anon',v_routine.oid,'EXECUTE'), 'anon can call a growth function';
    assert not has_function_privilege('authenticated',v_routine.oid,'EXECUTE'), 'browser role can call a growth function';
    assert has_function_privilege('service_role',v_routine.oid,'EXECUTE'), 'service role cannot call a growth function';
    assert not v_routine.prosecdef, 'unexpected SECURITY DEFINER';
    assert v_routine.proconfig @> array['search_path=""'], 'function has an unsafe search_path';
  end loop;
  for v_table in select c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relkind='r' and c.relname like 'arcade_growth_%'
  loop
    assert v_table.relrowsecurity, 'growth table lacks RLS';
    assert not has_table_privilege('anon',v_table.oid,'SELECT,INSERT,UPDATE,DELETE'), 'anon table access';
    assert not has_table_privilege('authenticated',v_table.oid,'SELECT,INSERT,UPDATE,DELETE'), 'authenticated table access';
  end loop;

  -- The new evidence rule must preserve the original UTC date invariant.
  begin
    insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind)
      values('treeforce89','run:grove-'||repeat('e',32)||':'||v_invalid_wallet,v_invalid_wallet,
        'treeforce89',clock_timestamp(),v_day-1,'authenticated-run-start');
    raise exception 'test expected mismatched UTC day rejection';
  exception when check_violation then
    assert sqlerrm like '%arcade_growth_game_events_check%', 'wrong constraint rejected the mismatched UTC day';
  end;

  v_required_before := private.arcade_growth_month_games_v1(v_month,v_games,true);
  assert v_required_before=(case when v_month >= date '2026-11-01'
    then array_append(v_games,'treeforce89') else v_games end), 'wrong seasonal Passport requirements';
  v_result := public.arcade_growth_record_treeforce_play_v1(v_wallet,v_run,clock_timestamp()+interval '1 hour',clock_timestamp());
  assert v_result->'participation'->>'saved'='true';
  assert v_result->'participation'->>'alreadyRecorded'='false';
  assert v_result->'participation'->>'runId'=v_run;
  assert v_result->'participation'->>'dateKey'=to_char(v_day,'YYYY-MM-DD'), 'first record did not use DB UTC day';
  v_source_id := 'run:'||v_run||':'||v_wallet;
  assert v_result->'participation'->>'sourceId'=v_source_id;
  v_snapshot := v_result->'snapshot';
  assert v_snapshot->'enabledGames'=to_jsonb(v_required_before), 'TF changed frozen Passport requirements';
  assert v_snapshot->'eligibleGames'=to_jsonb(array['garden-bot','pvp','arborist-trials','treeforce89']::text[]);
  assert jsonb_array_length(v_snapshot->'checkins')=1, 'first wave did not save attendance';
  assert jsonb_array_length(v_snapshot->'quests')=1, 'first wave did not save a daily quest';
  assert v_snapshot->'quests'->0->>'gameId'='treeforce89';
  assert v_snapshot->'gamesByDay'->0->'gameIds'='["treeforce89"]'::jsonb, 'TREE FORCE participation was not exposed';
  assert not exists(select 1 from private.arcade_growth_monthly_badges where wallet=v_wallet and badge_id='arcade-passport'),
    'TF alone completed the required Passport';
  assert (select evidence_kind from private.arcade_growth_game_events where source='treeforce89' and source_id=v_source_id)='authenticated-run-start';

  v_duplicate := public.arcade_growth_record_treeforce_play_v1(v_wallet,v_run,clock_timestamp()+interval '1 hour',clock_timestamp());
  assert v_duplicate->'participation'->>'alreadyRecorded'='true';
  assert v_duplicate->'participation'->>'recordedAt'=v_result->'participation'->>'recordedAt', 'retry changed the original participation time';
  assert v_duplicate->'participation'->>'dateKey'=v_result->'participation'->>'dateKey';
  assert v_duplicate->'snapshot'=v_snapshot, 'same-run retry or continuation changed progress';
  begin
    perform public.arcade_growth_record_treeforce_play_v1(v_other,v_run,clock_timestamp()+interval '1 hour',clock_timestamp());
    raise exception 'test expected a cross-wallet original-run conflict';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-event-conflict' then raise; end if;
  end;
  -- The original-run uniqueness rule is enforced independently of RPC locks.
  begin
    insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind)
      values('treeforce89','run:'||v_run||':'||v_other,v_other,'treeforce89',clock_timestamp(),v_day,'authenticated-run-start');
    raise exception 'test expected the original-run unique index';
  exception when unique_violation then null;
  end;
  v_duplicate := public.arcade_growth_record_treeforce_play_v1(v_wallet,v_second_run,clock_timestamp()+interval '1 hour',clock_timestamp());
  assert jsonb_array_length(v_duplicate->'snapshot'->'checkins')=1;
  assert jsonb_array_length(v_duplicate->'snapshot'->'quests')=1, 'multiple new runs earned more than one daily quest';
  assert v_duplicate->'snapshot'->'gamesByDay'->0->'gameIds'='["treeforce89"]'::jsonb;
  select count(*) into v_count from private.arcade_growth_game_events where wallet=v_wallet and source='treeforce89';
  assert v_count=2, 'different original runs lost their distinct source identities';

  -- A revoked credential is represented by its authoritative expired lease.
  -- Revocation itself is verified in the handler's isolated-DB read; it cannot
  -- be made atomic across the two separate databases by this RPC.
  begin
    perform public.arcade_growth_record_treeforce_play_v1(v_invalid_wallet,v_invalid_run,clock_timestamp()-interval '1 second',clock_timestamp());
    raise exception 'test expected expired or revoked credential rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-game-session' then raise; end if;
  end;
  begin
    perform public.arcade_growth_record_treeforce_play_v1(v_invalid_wallet,v_invalid_run,'infinity',clock_timestamp());
    raise exception 'test expected invalid credential lifetime rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-game-session' then raise; end if;
  end;
  begin
    perform public.arcade_growth_record_treeforce_play_v1(v_invalid_wallet,v_invalid_run,clock_timestamp()+interval '1 hour',clock_timestamp()-interval '20 seconds');
    raise exception 'test expected stale credential check rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-stale-game-verification' then raise; end if;
  end;
  begin
    perform public.arcade_growth_record_treeforce_play_v1(v_invalid_wallet,v_invalid_run,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '10 seconds');
    raise exception 'test expected future credential check rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-stale-game-verification' then raise; end if;
  end;
  assert not exists(select 1 from private.arcade_growth_game_events where wallet=v_invalid_wallet), 'invalid credential saved an event';
  assert not exists(select 1 from private.arcade_growth_checkins where wallet=v_invalid_wallet), 'invalid credential saved attendance';

  -- Simulate a previously accepted run before UTC midnight. Retry must return
  -- the old receipt and must not award today's check-in/quest or move its stamp.
  v_source_id := 'run:'||v_prior_run||':'||v_prior_wallet;
  insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,recorded_at,evidence_kind)
    values('treeforce89',v_source_id,v_prior_wallet,'treeforce89',v_prior_day::timestamp at time zone 'UTC',v_prior_day,
      v_prior_day::timestamp at time zone 'UTC','authenticated-run-start');
  insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_prior_wallet,v_prior_day,'game-participation');
  insert into private.arcade_growth_daily_quests(wallet,date_key,game_id,source,source_id)
    values(v_prior_wallet,v_prior_day,'treeforce89','treeforce89',v_source_id);
  v_duplicate := public.arcade_growth_record_treeforce_play_v1(v_prior_wallet,v_prior_run,clock_timestamp()+interval '1 hour',clock_timestamp());
  assert v_duplicate->'participation'->>'alreadyRecorded'='true';
  assert v_duplicate->'participation'->>'dateKey'=to_char(v_prior_day,'YYYY-MM-DD'), 'midnight retry re-dated the old run';
  assert not exists(select 1 from private.arcade_growth_checkins where wallet=v_prior_wallet and date_key=v_day), 'midnight retry granted attendance again';
  assert not exists(select 1 from private.arcade_growth_daily_quests where wallet=v_prior_wallet and date_key=v_day), 'midnight retry granted a quest again';

  -- Existing Garden result ingestion still requires a Daily Growth session,
  -- accepts only official Garden sources, and never accepts TF browser claims.
  perform public.arcade_growth_create_challenge_v1(v_challenge,v_wallet,'https://tree-token.xyz',v_day,repeat('3',64),
    repeat('Synthetic Daily Growth test message. ',6),clock_timestamp()+interval '5 minutes',repeat('4',64));
  perform public.arcade_growth_create_session_v1(v_challenge,v_wallet,'https://tree-token.xyz',v_token,clock_timestamp()+interval '1 hour');
  begin
    perform public.arcade_growth_record_events_v1(v_token,'https://tree-token.xyz',v_games,v_day,
      jsonb_build_array(jsonb_build_object('source','treeforce89','sourceId','run:'||v_run||':'||v_wallet,
        'wallet',v_wallet,'gameId','treeforce89','completedAt',clock_timestamp())));
    raise exception 'test expected TF claims to be rejected by Garden result ingestion';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-event-conflict' then raise; end if;
  end;
  v_events := jsonb_build_array(
    jsonb_build_object('source','garden-battles','sourceId','battle:tf-test-bot:'||v_wallet,'wallet',v_wallet,'gameId','garden-bot','completedAt',clock_timestamp(),'proofDigest',repeat('1',32)),
    jsonb_build_object('source','garden-battles','sourceId','battle:tf-test-pvp:'||v_wallet,'wallet',v_wallet,'gameId','pvp','completedAt',clock_timestamp(),'proofDigest',repeat('1',31)||'2'),
    jsonb_build_object('source','garden-battles','sourceId','trial:tf-test-trials:'||v_wallet,'wallet',v_wallet,'gameId','arborist-trials','completedAt',clock_timestamp()));
  v_snapshot := public.arcade_growth_record_events_v1(v_token,'https://tree-token.xyz',v_games,v_day,v_events);
  assert jsonb_array_length(v_snapshot->'quests')=1, 'Garden results duplicated a TF daily quest';
  assert jsonb_array_length(v_snapshot->'gamesByDay'->0->'gameIds')=4, 'Garden and TREE FORCE activity were not preserved together';
  assert v_snapshot->'enabledGames'=to_jsonb(v_required_before), 'required monthly games changed';
  select count(*) into v_count from private.arcade_growth_monthly_badges where wallet=v_wallet and month_key=v_month and badge_id='arcade-passport';
  assert v_count=1, 'all four eligible games did not award exactly one Passport badge';
  v_snapshot := private.arcade_growth_wallet_snapshot_v1(v_wallet,(v_month+interval '1 month')::date,v_games);
  assert v_snapshot->'gamesByDay'='[]'::jsonb, 'monthly participation did not reset next month';
  assert v_snapshot->'checkins'='[]'::jsonb and v_snapshot->'quests'='[]'::jsonb;
  assert jsonb_array_length(v_snapshot->'badges')=1, 'previously earned required Passport badge was lost';
end $$;
rollback;
select 'passed; TREE FORCE participation fixtures rolled back' as arcade_growth_treeforce_checks;
