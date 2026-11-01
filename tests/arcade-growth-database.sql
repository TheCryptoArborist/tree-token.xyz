-- Run after all Daily Growth migrations, including the November Passport rules,
-- on an isolated Supabase development branch.
-- All test records are synthetic and rolled back; only arcade_growth_* is used.
begin;
set local role service_role;
do $$
declare
  v_wallet text := '0x' || repeat('a', 64);
  v_other text := '0x' || repeat('b', 64);
  v_origin text := 'https://tree-token.xyz';
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_month date := date_trunc('month',clock_timestamp() at time zone 'UTC')::date;
  v_previous date := (date_trunc('month',clock_timestamp() at time zone 'UTC') - interval '1 month')::date;
  v_id uuid := gen_random_uuid();
  v_token text := repeat('c',64);
  v_games text[] := array['garden-bot','pvp','arborist-trials'];
  v_required text[] := case when v_month >= date '2026-11-01'
    then array_append(v_games,'treeforce89') else v_games end;
  v_run text := 'grove-' || repeat('8',32);
  v_snapshot jsonb;
  v_treeforce jsonb;
  v_passport_earned_at timestamptz;
  v_event jsonb;
  v_events jsonb;
  v_at timestamptz := clock_timestamp() - interval '1 second';
  v_routine record;
  v_table record;
  v_count integer;
  i integer;
begin
  for v_routine in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','public') and p.proname like 'arcade_growth_%'
  loop
    assert not has_function_privilege('anon',v_routine.oid,'EXECUTE'), 'anon can execute a growth RPC';
    assert not has_function_privilege('authenticated',v_routine.oid,'EXECUTE'), 'authenticated can execute a growth RPC';
    assert has_function_privilege('service_role',v_routine.oid,'EXECUTE'), 'service role lacks growth RPC';
    assert not v_routine.prosecdef, 'unexpected security definer';
    assert v_routine.proconfig @> array['search_path=""'], 'search_path is not empty';
  end loop;
  for v_table in select c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relkind='r' and c.relname like 'arcade_growth_%'
  loop
    assert v_table.relrowsecurity, 'growth table lacks RLS';
    assert not has_table_privilege('anon',v_table.oid,'SELECT,INSERT,UPDATE,DELETE'), 'anon growth table access';
    assert not has_table_privilege('authenticated',v_table.oid,'SELECT,INSERT,UPDATE,DELETE'), 'authenticated growth table access';
  end loop;

  perform public.arcade_growth_create_challenge_v1(v_id,v_wallet,v_origin,v_day,repeat('d',64),
    repeat('Test-only signed message. ',10),clock_timestamp()+interval '5 minutes',repeat('e',64));
  assert (public.arcade_growth_read_challenge_v1(v_id)->>'consumed')::boolean = false;
  begin
    perform public.arcade_growth_create_session_v1(v_id,v_other,v_origin,v_token,clock_timestamp()+interval '1 hour');
    raise exception 'test expected a wallet-bound challenge rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-challenge' then raise; end if;
  end;
  perform public.arcade_growth_create_session_v1(v_id,v_wallet,v_origin,v_token,clock_timestamp()+interval '1 hour');
  assert (public.arcade_growth_read_challenge_v1(v_id)->>'consumed')::boolean = true;
  begin
    perform public.arcade_growth_create_session_v1(v_id,v_wallet,v_origin,repeat('f',64),clock_timestamp()+interval '1 hour');
    raise exception 'test expected replay rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-challenge' then raise; end if;
  end;
  begin
    perform public.arcade_growth_read_session_v1(v_token,'https://www.tree-token.xyz');
    raise exception 'test expected origin-bound session rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-session' then raise; end if;
  end;

  v_snapshot := public.arcade_growth_check_in_v1(v_token,v_origin,v_games);
  v_snapshot := public.arcade_growth_check_in_v1(v_token,v_origin,v_games);
  assert jsonb_array_length(v_snapshot->'checkins')=1, 'duplicate manual check-in';
  assert jsonb_array_length(v_snapshot->'quests')=0, 'check-in granted a quest';
  assert jsonb_array_length(v_snapshot->'gamesByDay')=0, 'check-in granted a passport stamp';
  assert v_snapshot->'enabledGames'=to_jsonb(v_required), 'wrong seasonal Passport requirements';
  assert (public.arcade_growth_public_rules_v1(array['garden-bot','arborist-trials']))=to_jsonb(v_required), 'frozen monthly rules changed';

  v_event := jsonb_build_object('source','garden-battles','sourceId','battle:fixture-bot:'||v_wallet,
    'wallet',v_wallet,'gameId','garden-bot','completedAt',v_at,'proofDigest',repeat('1',32));
  v_snapshot := public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day,jsonb_build_array(v_event));
  v_snapshot := public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day,jsonb_build_array(v_event));
  assert jsonb_array_length(v_snapshot->'checkins')=1;
  assert jsonb_array_length(v_snapshot->'quests')=1, 'duplicate daily quest';
  select count(*) into v_count from private.arcade_growth_game_events where wallet=v_wallet;
  assert v_count=1, 'duplicate source event';
  begin
    perform public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day-1,jsonb_build_array(v_event));
    raise exception 'test expected previous-day rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-day-changed' then raise; end if;
  end;
  begin
    perform public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day,
      jsonb_build_array(v_event || jsonb_build_object('wallet',v_other)));
    raise exception 'test expected cross-wallet result rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-event-conflict' then raise; end if;
  end;
  begin
    perform public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day,
      jsonb_build_array(v_event || jsonb_build_object('completedAt',v_at-interval '1 second')));
    raise exception 'test expected altered-result rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-event-conflict' then raise; end if;
  end;
  v_events := jsonb_build_array(v_event,
    jsonb_build_object('source','garden-battles','sourceId','battle:fixture-pvp:'||v_wallet,
      'wallet',v_wallet,'gameId','pvp','completedAt',v_at,'proofDigest',repeat('1',31)||'2'),
    jsonb_build_object('source','garden-battles','sourceId','trial:fixture-trials:'||v_wallet,
      'wallet',v_wallet,'gameId','arborist-trials','completedAt',v_at));
  v_snapshot := public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day,v_events);
  assert jsonb_array_length(v_snapshot->'quests')=1, 'multiple games granted extra daily quests';
  assert jsonb_array_length(v_snapshot->'gamesByDay'->0->'gameIds')=3, 'missing distinct game stamps';
  select count(*) into v_count from private.arcade_growth_monthly_badges
    where wallet=v_wallet and month_key=v_month and badge_id='arcade-passport';
  if v_month >= date '2026-11-01' then
    assert v_count=0, 'three Garden results incorrectly completed the four-game Passport';
    v_treeforce := public.arcade_growth_record_treeforce_play_v1(v_wallet,v_run,clock_timestamp()+interval '1 hour',clock_timestamp());
    v_snapshot := v_treeforce->'snapshot';
    assert jsonb_array_length(v_snapshot->'quests')=1, 'TREE FORCE duplicated the Garden daily quest';
    assert jsonb_array_length(v_snapshot->'gamesByDay'->0->'gameIds')=4, 'four required game stamps were not retained';
    select count(*) into v_count from private.arcade_growth_monthly_badges
      where wallet=v_wallet and month_key=v_month and badge_id='arcade-passport';
  end if;
  assert v_count=1, 'passport completion did not save its badge';
  select earned_at into v_passport_earned_at from private.arcade_growth_monthly_badges
    where wallet=v_wallet and month_key=v_month and badge_id='arcade-passport';
  perform public.arcade_growth_record_events_v1(v_token,v_origin,v_games,v_day,v_events);
  assert (select count(*) from private.arcade_growth_monthly_badges
    where wallet=v_wallet and month_key=v_month and badge_id='arcade-passport')=1, 'repeat completion duplicated the Passport badge';
  assert (select earned_at from private.arcade_growth_monthly_badges
    where wallet=v_wallet and month_key=v_month and badge_id='arcade-passport')=v_passport_earned_at, 'repeat completion changed the award time';

  perform private.arcade_growth_month_games_v1(v_previous,v_games,true);
  for i in 0..20 loop
    insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_wallet,v_previous+i,'manual');
  end loop;
  perform private.arcade_growth_award_badges_v1(v_wallet,v_previous,v_games);
  perform private.arcade_growth_award_badges_v1(v_wallet,v_previous,v_games);
  select count(*) into v_count from private.arcade_growth_monthly_badges where wallet=v_wallet and month_key=v_previous;
  assert v_count=4, 'attendance milestones missing or duplicated';
  v_snapshot := private.arcade_growth_wallet_snapshot_v1(v_wallet,(v_month+interval '1 month')::date,v_games);
  assert jsonb_array_length(v_snapshot->'checkins')=0, 'attendance did not reset in a new month';
  assert jsonb_array_length(v_snapshot->'quests')=0, 'quests did not reset in a new month';
  assert jsonb_array_length(v_snapshot->'gamesByDay')=0, 'passport did not reset in a new month';
  assert jsonb_array_length(v_snapshot->'badges')=5, 'earned badges were lost at month rollover';

  for i in 1..5 loop
    perform public.arcade_growth_create_challenge_v1(gen_random_uuid(),v_wallet,v_origin,v_day,
      lpad(to_hex(i),64,'0'),repeat('Test-only signed message. ',10),clock_timestamp()+interval '5 minutes',repeat('e',64));
  end loop;
  begin
    perform public.arcade_growth_create_challenge_v1(gen_random_uuid(),v_wallet,v_origin,v_day,repeat('f',64),
      repeat('Test-only signed message. ',10),clock_timestamp()+interval '5 minutes',repeat('e',64));
    raise exception 'test expected wallet challenge rate limit';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-rate-limited' then raise; end if;
  end;
  -- A different requester can still sign in to the same wallet after the first
  -- requester uses its six-challenge budget; the IP-wide forty cap still holds.
  perform public.arcade_growth_create_challenge_v1(gen_random_uuid(),v_wallet,v_origin,v_day,repeat('9',64),
    repeat('Test-only signed message. ',10),clock_timestamp()+interval '5 minutes',repeat('8',64));
  for i in 1..34 loop
    perform public.arcade_growth_create_challenge_v1(gen_random_uuid(),'0x'||lpad(to_hex(100+i),64,'0'),v_origin,v_day,
      lpad(to_hex(1000+i),64,'0'),repeat('Test-only signed message. ',10),clock_timestamp()+interval '5 minutes',repeat('e',64));
  end loop;
  begin
    perform public.arcade_growth_create_challenge_v1(gen_random_uuid(),'0x'||lpad(to_hex(999),64,'0'),v_origin,v_day,
      lpad(to_hex(1999),64,'0'),repeat('Test-only signed message. ',10),clock_timestamp()+interval '5 minutes',repeat('e',64));
    raise exception 'test expected requester challenge rate limit';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-rate-limited' then raise; end if;
  end;
  perform public.arcade_growth_revoke_session_v1(v_token,v_origin);
  begin
    perform public.arcade_growth_check_in_v1(v_token,v_origin,v_games);
    raise exception 'test expected revoked-session write rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-session' then raise; end if;
  end;
end $$;
rollback;
select 'passed; all synthetic records rolled back' as arcade_growth_database_checks;
