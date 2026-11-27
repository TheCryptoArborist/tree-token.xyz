begin;

-- Grove Chess participates in daily tasks without adding a Passport requirement.
alter table private.arcade_growth_game_events
  drop constraint arcade_growth_game_events_game_id_check,
  add constraint arcade_growth_game_events_game_id_check CHECK ((game_id = ANY (ARRAY['garden-bot'::text, 'pvp'::text, 'arborist-trials'::text, 'treeforce89'::text, 'grove-chess'::text]))),
  drop constraint arcade_growth_game_events_source_check,
  add constraint arcade_growth_game_events_source_check CHECK ((source = ANY (ARRAY['garden-battles'::text, 'treeforce89'::text, 'grove-chess'::text]))),
  drop constraint arcade_growth_game_events_check1,
  add constraint arcade_growth_game_events_check1 CHECK ((((source = 'garden-battles'::text) AND (evidence_kind = 'completed-result'::text) AND (((game_id = 'arborist-trials'::text) AND (source_id ~~ 'trial:%'::text) AND (proof_digest IS NULL)) OR ((game_id = ANY (ARRAY['garden-bot'::text, 'pvp'::text])) AND (source_id ~~ 'battle:%'::text) AND (proof_digest IS NOT NULL)))) OR ((source = 'treeforce89'::text) AND (game_id = 'treeforce89'::text) AND (evidence_kind = 'authenticated-run-start'::text) AND (source_id ~ '^run:grove-[a-f0-9]{32}:0x[a-f0-9]{64}$'::text) AND (proof_digest IS NULL))) OR (source = 'grove-chess' AND game_id = 'grove-chess' AND evidence_kind = 'completed-result' AND source_id ~ '^chess:[0-9a-f-]{36}:0x[a-f0-9]{64}$' AND proof_digest IS NULL));
create function private.arcade_growth_record_grove_chess_v1()
returns trigger language plpgsql security invoker set search_path='' as $body$
declare
  room private.grove_chess_rooms;
  player_wallet text;
  completed_day date;
begin
  if new.facts->>'eligible' is distinct from 'true' then return new; end if;
  select * into room from private.grove_chess_rooms where id=new.room_id;
  if room.status is distinct from 'finished' or room.black_id is null
     or room.revision is distinct from new.revision
     or (room.white_wallet is not null and room.white_wallet = room.black_wallet)
     or room.updated_at < new.recorded_at - interval '24 hours' then
    return new;
  end if;

  completed_day := (room.updated_at at time zone 'UTC')::date;
  for player_wallet in
    select wallet from unnest(array[room.white_wallet,room.black_wallet]) as seat(wallet)
    where wallet ~ '^0x[a-f0-9]{64}$' and wallet <> '0x' || repeat('0', 64)
    order by wallet
  loop
    perform pg_advisory_xact_lock(hashtextextended('arcade-growth:progress:' || player_wallet,0));
    insert into private.arcade_growth_game_events(source,source_id,wallet,game_id,completed_at,date_key,evidence_kind)
    values('grove-chess','chess:' || room.id || ':' || player_wallet,player_wallet,'grove-chess',room.updated_at,completed_day,'completed-result')
    on conflict (source,source_id) do nothing;
    insert into private.arcade_growth_checkins(wallet,date_key,source)
    values(player_wallet,completed_day,'verified-game')
    on conflict (wallet,date_key) do nothing;
  end loop;
  return new;
end;
$body$;
revoke all on function private.arcade_growth_record_grove_chess_v1() from public,anon,authenticated;
grant execute on function private.arcade_growth_record_grove_chess_v1() to service_role;
create trigger arcade_growth_grove_chess_completion
after insert on private.grove_chess_records
for each row execute function private.arcade_growth_record_grove_chess_v1();

create function private.arcade_growth_wallet_chess_snapshot_v1(p_wallet text,p_day date,p_games text[])
returns jsonb language plpgsql security invoker set search_path='' as $body$
declare v_month date := date_trunc('month',p_day)::date; v_games text[]; v_result jsonb;
begin
  v_games := private.arcade_growth_month_games_v1(v_month,p_games,false);
  select jsonb_build_object(
    'wallet',p_wallet,'dateKey',to_char(p_day,'YYYY-MM-DD'),'monthKey',to_char(v_month,'YYYY-MM'),'enabledGames',to_jsonb(v_games),
    'eligibleGames',to_jsonb(array['garden-bot','pvp','arborist-trials','treeforce89','grove-chess']::text[]),
    'checkins',coalesce((select jsonb_agg(to_char(c.date_key,'YYYY-MM-DD') order by c.date_key)
      from private.arcade_growth_checkins c where c.wallet=p_wallet and c.date_key between v_month and p_day),'[]'::jsonb),
    'quests',coalesce((select jsonb_agg(jsonb_build_object('dateKey',to_char(q.date_key,'YYYY-MM-DD'),'gameId',q.game_id) order by q.date_key)
      from (
        select saved.date_key, saved.game_id from private.arcade_growth_daily_quests saved
        where saved.wallet=p_wallet and saved.date_key between v_month and p_day
        union all
        select distinct e.date_key, e.game_id from private.arcade_growth_game_events e
        where e.wallet=p_wallet and e.game_id='grove-chess' and e.date_key between v_month and p_day
          and not exists(select 1 from private.arcade_growth_daily_quests saved
                         where saved.wallet=p_wallet and saved.date_key=e.date_key)
      ) q),'[]'::jsonb),
    'gamesByDay',coalesce((select jsonb_agg(jsonb_build_object('dateKey',to_char(g.date_key,'YYYY-MM-DD'),'gameIds',g.ids) order by g.date_key)
      from (select e.date_key,jsonb_agg(distinct e.game_id order by e.game_id) as ids
        from private.arcade_growth_game_events e where e.wallet=p_wallet and e.date_key between v_month and p_day
          and e.game_id=any(array['garden-bot','pvp','arborist-trials','treeforce89','grove-chess']::text[]) group by e.date_key) g),'[]'::jsonb),
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.badge_id,'monthKey',to_char(b.month_key,'YYYY-MM'),'earnedAt',b.earned_at)
      order by b.month_key,b.earned_at,b.badge_id) from private.arcade_growth_monthly_badges b
      where b.wallet=p_wallet and b.month_key<=v_month),'[]'::jsonb)) into v_result;
  return v_result;
end ;
$body$;
revoke all on function private.arcade_growth_wallet_chess_snapshot_v1(text,date,text[]) from public,anon,authenticated;
grant execute on function private.arcade_growth_wallet_chess_snapshot_v1(text,date,text[]) to service_role;

-- Use an opt-in RPC so the previous handler and other callers can still read
-- their original snapshot shape during deployment or rollback.
create function public.arcade_growth_grove_chess_snapshot_v1(p_token_sha256 text,p_origin text,p_enabled_games text[])
returns jsonb language plpgsql security invoker set search_path='' as $body$
declare v_session private.arcade_growth_sessions;
begin
  v_session := private.arcade_growth_require_session_v1(p_token_sha256,p_origin);
  return private.arcade_growth_wallet_chess_snapshot_v1(v_session.wallet,
    (clock_timestamp() at time zone 'UTC')::date,p_enabled_games);
end;
$body$;

revoke all on function public.arcade_growth_grove_chess_snapshot_v1(text,text,text[]) from public,anon,authenticated;
grant execute on function public.arcade_growth_grove_chess_snapshot_v1(text,text,text[]) to service_role;
commit;
