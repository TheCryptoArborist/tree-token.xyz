-- Run after 20261101160314_arcade_growth_treeforce_required_passport.sql on the
-- isolated development DB. December 2026 must not already have a frozen row:
-- this fixture explicitly exercises its first caller. All inserts roll back.
-- The migration's preservation of preexisting production rows is separately
-- checked by comparing the release's before/after database inventory.
begin;
set local role service_role;
do $$
declare
  v_garden text[] := array['garden-bot','pvp','arborist-trials'];
  v_all text[] := array['garden-bot','pvp','arborist-trials','treeforce89'];
  v_october date := date '2026-10-01';
  v_november date := date '2026-11-01';
  v_december date := date '2026-12-01';
  v_garden_wallet text := '0x'||repeat('91',32);
  v_treeforce_wallet text := '0x'||repeat('92',32);
  v_awarded_wallet text := '0x'||repeat('93',32);
  v_garden_run text := 'grove-'||repeat('91',16);
  v_treeforce_run text := 'grove-'||repeat('92',16);
  v_at timestamptz := timestamptz '2026-11-01 00:00:00+00';
  v_october_before jsonb;
  v_november_before jsonb;
  v_badges_before jsonb;
  v_awarded_before jsonb;
  v_snapshot jsonb;
  v_earned_at timestamptz;
  v_rules text[];
  v_routine record;
  v_table record;
begin
  -- Replacements must preserve private storage and service-only RPC access.
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
  assert has_table_privilege('service_role','private.arcade_growth_monthly_badges','SELECT'), 'service role cannot read awards';
  assert has_table_privilege('service_role','private.arcade_growth_monthly_badges','INSERT'), 'service role cannot append awards';
  assert not has_table_privilege('service_role','private.arcade_growth_monthly_badges','UPDATE,DELETE'), 'service role can rewrite or revoke awards';
  assert not has_table_privilege('service_role','private.arcade_growth_month_rules','UPDATE,DELETE'), 'service role can rewrite frozen monthly rules';

  assert private.arcade_growth_valid_games_v1(v_all), 'four unique eligible games were rejected';
  assert not private.arcade_growth_valid_games_v1(array['treeforce89','treeforce89']), 'duplicate games were accepted';
  assert not private.arcade_growth_valid_games_v1(array['treeforce89',null]::text[]), 'null game was accepted';
  assert not private.arcade_growth_valid_games_v1(array['future-game']), 'unknown game was accepted';
  begin
    perform private.arcade_growth_month_games_v1(date '2026-11-02',v_garden,false);
    raise exception 'test expected non-month date rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-rules' then raise; end if;
  end;
  begin
    perform private.arcade_growth_month_games_v1(v_october,array['treeforce89'],false);
    raise exception 'test expected empty historical requirements rejection';
  exception when raise_exception then
    if sqlerrm <> 'arcade-growth-invalid-rules' then raise; end if;
  end;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.wallet,b.month_key,b.badge_id),'[]'::jsonb)
    into v_badges_before from private.arcade_growth_monthly_badges b;
  assert not exists(select 1 from private.arcade_growth_monthly_badges
    where wallet=any(array[v_garden_wallet,v_treeforce_wallet,v_awarded_wallet])), 'synthetic wallet fixture collided with saved awards';

  -- A four-game fallback may not retroactively change October. Passing it on
  -- the first call also exercises normalization when a branch has no Oct row.
  select to_jsonb(r) into v_october_before from private.arcade_growth_month_rules r where month_key=v_october;
  assert private.arcade_growth_month_games_v1(v_october,v_all,true)=v_garden, 'October no longer requires its original three games';
  if v_october_before is not null then
    assert (select to_jsonb(r) from private.arcade_growth_month_rules r where month_key=v_october)=v_october_before,
      'October frozen rule or timestamp changed';
  end if;
  select to_jsonb(r) into v_october_before from private.arcade_growth_month_rules r where month_key=v_october;

  assert private.arcade_growth_month_games_v1(v_november,v_garden,true)=v_all, 'November legacy fallback did not return four requirements';
  select to_jsonb(r) into v_november_before from private.arcade_growth_month_rules r where month_key=v_november;
  assert private.arcade_growth_month_games_v1(v_november,v_all,true)=v_all, 'repeated November freeze duplicated TREE FORCE';
  assert private.arcade_growth_month_games_v1(v_november,array['garden-bot'],false)=v_all, 'caller changed an existing frozen November set';
  assert (select to_jsonb(r) from private.arcade_growth_month_rules r where month_key=v_november)=v_november_before,
    'reading or refreezing November rewrote its row';

  assert not exists(select 1 from private.arcade_growth_month_rules where month_key=v_december),
    'December first-caller fixture requires an unfrozen month';
  assert private.arcade_growth_month_games_v1(v_december,v_garden,false)=v_all, 'unfrozen December public rules did not use four games';
  assert not exists(select 1 from private.arcade_growth_month_rules where month_key=v_december), 'read-only rules call froze December';
  v_rules := private.arcade_growth_month_games_v1(v_december,v_garden,true);
  assert v_rules=v_all, 'December first legacy caller froze only three games';
  assert (select enabled_games from private.arcade_growth_month_rules where month_key=v_december)=v_all, 'December four-game set was not saved';

  -- A previously awarded badge stays earned even if a later requirement set
  -- would be incomplete. Fixed timestamps detect accidental replacement.
  insert into private.arcade_growth_monthly_badges(wallet,month_key,badge_id,rule_version,earned_at) values
    (v_awarded_wallet,v_october,'arcade-passport','arcade-growth-v1',timestamptz '2026-10-31 23:00:00+00'),
    (v_awarded_wallet,v_november,'arcade-passport','arcade-growth-v1',timestamptz '2026-11-01 00:00:00+00');
  select jsonb_agg(to_jsonb(b) order by b.month_key,b.badge_id) into v_awarded_before
    from private.arcade_growth_monthly_badges b where wallet=v_awarded_wallet;
  perform private.arcade_growth_award_badges_v1(v_awarded_wallet,v_october,v_garden);
  perform private.arcade_growth_award_badges_v1(v_awarded_wallet,v_november,v_all);
  v_snapshot := private.arcade_growth_wallet_snapshot_v1(v_awarded_wallet,date '2026-11-01',v_garden);
  assert v_snapshot->'enabledGames'=to_jsonb(v_all), 'November snapshot did not use its four-game set';
  assert jsonb_array_length(v_snapshot->'badges')=2, 'earlier award disappeared from November history';
  assert v_snapshot->'gamesByDay'='[]'::jsonb, 'preserved awards fabricated new game credit';
  v_snapshot := private.arcade_growth_wallet_snapshot_v1(v_awarded_wallet,date '2026-10-31',v_all);
  assert v_snapshot->'enabledGames'=to_jsonb(v_garden), 'historical October snapshot changed requirements';
  assert jsonb_array_length(v_snapshot->'badges')=1, 'historical October snapshot included a later award';

  -- Three Garden results alone cannot earn the November four-game Passport.
  insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,proof_digest) values
    ('garden-battles','battle:passport-season:bot:'||v_garden_wallet,v_garden_wallet,'garden-bot',v_at,v_november,repeat('1',32)),
    ('garden-battles','battle:passport-season:pvp:'||v_garden_wallet,v_garden_wallet,'pvp',v_at,v_november,repeat('1',31)||'2'),
    ('garden-battles','trial:passport-season:trials:'||v_garden_wallet,v_garden_wallet,'arborist-trials',v_at,v_november,null);
  insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_garden_wallet,v_november,'verified-game');
  insert into private.arcade_growth_daily_quests(wallet,date_key,game_id,source,source_id)
    values(v_garden_wallet,v_november,'garden-bot','garden-battles','battle:passport-season:bot:'||v_garden_wallet);
  perform private.arcade_growth_award_badges_v1(v_garden_wallet,v_november,v_all);
  assert not exists(select 1 from private.arcade_growth_monthly_badges
    where wallet=v_garden_wallet and month_key=v_november and badge_id='arcade-passport'), 'three Garden results completed November';

  -- TREE FORCE alone is one required stamp, not a complete Passport.
  insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind)
    values('treeforce89','run:'||v_treeforce_run||':'||v_treeforce_wallet,v_treeforce_wallet,'treeforce89',v_at,v_november,'authenticated-run-start');
  insert into private.arcade_growth_checkins(wallet,date_key,source) values(v_treeforce_wallet,v_november,'game-participation');
  insert into private.arcade_growth_daily_quests(wallet,date_key,game_id,source,source_id)
    values(v_treeforce_wallet,v_november,'treeforce89','treeforce89','run:'||v_treeforce_run||':'||v_treeforce_wallet);
  perform private.arcade_growth_award_badges_v1(v_treeforce_wallet,v_november,v_all);
  assert not exists(select 1 from private.arcade_growth_monthly_badges
    where wallet=v_treeforce_wallet and month_key=v_november and badge_id='arcade-passport'), 'TREE FORCE alone completed November';
  v_snapshot := private.arcade_growth_wallet_snapshot_v1(v_treeforce_wallet,v_november,v_garden);
  assert v_snapshot->'enabledGames'=to_jsonb(v_all), 'TREE FORCE snapshot lost the required four-game set';
  assert v_snapshot->'gamesByDay'->0->'gameIds'='["treeforce89"]'::jsonb, 'existing TREE FORCE credit was lost';

  -- Adding the recorded first wave completes the set exactly once.
  insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind)
    values('treeforce89','run:'||v_garden_run||':'||v_garden_wallet,v_garden_wallet,'treeforce89',v_at,v_november,'authenticated-run-start');
  perform private.arcade_growth_award_badges_v1(v_garden_wallet,v_november,v_all);
  select earned_at into v_earned_at from private.arcade_growth_monthly_badges
    where wallet=v_garden_wallet and month_key=v_november and badge_id='arcade-passport';
  assert v_earned_at is not null, 'all four games did not award the Passport';
  perform private.arcade_growth_award_badges_v1(v_garden_wallet,v_november,v_all);
  perform private.arcade_growth_award_badges_v1(v_garden_wallet,v_november,v_all);
  assert (select count(*) from private.arcade_growth_monthly_badges
    where wallet=v_garden_wallet and month_key=v_november and badge_id='arcade-passport')=1, 'repeat completion duplicated the Passport';
  assert (select earned_at from private.arcade_growth_monthly_badges
    where wallet=v_garden_wallet and month_key=v_november and badge_id='arcade-passport')=v_earned_at, 'repeat completion changed its earned timestamp';
  v_snapshot := private.arcade_growth_wallet_snapshot_v1(v_garden_wallet,v_november,v_garden);
  assert jsonb_array_length(v_snapshot->'gamesByDay'->0->'gameIds')=4, 'completed four-game activity was lost';
  assert jsonb_array_length(v_snapshot->'quests')=1, 'four games duplicated the daily quest';

  assert (select jsonb_agg(to_jsonb(b) order by b.month_key,b.badge_id)
    from private.arcade_growth_monthly_badges b where wallet=v_awarded_wallet)=v_awarded_before,
    'an existing October or November award, rule version, or earned timestamp changed';
  assert not exists(select 1 from jsonb_array_elements(v_badges_before) as saved(badge)
    where not exists(select 1 from private.arcade_growth_monthly_badges b where to_jsonb(b)=saved.badge)),
    'a preexisting database award was modified or removed';
  assert (select to_jsonb(r) from private.arcade_growth_month_rules r where month_key=v_october)=v_october_before,
    'October row changed while processing later seasons';
end $$;
rollback;
select 'passed; October3, November4, December first freeze, award retention, and access controls; all fixtures rolled back'
  as treeforce_passport_database_checks;
