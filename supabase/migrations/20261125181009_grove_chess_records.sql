begin;
create table private.grove_chess_records (
 room_id uuid primary key references private.grove_chess_rooms(id),
 revision integer not null,
 facts jsonb not null check(jsonb_typeof(facts)='object'),
 recorded_at timestamptz not null default now()
);
alter table private.grove_chess_records enable row level security;
revoke all on private.grove_chess_records from public,anon,authenticated;
grant select,insert on private.grove_chess_records to service_role;
create function public.grove_chess_records_v1(p_action text,p_actor text default null,p_wallet text default null,p_room uuid default null,p_revision integer default null,p_pgn text default null,p_facts jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare record_room private.grove_chess_rooms; answer jsonb; who text;
begin
 if p_action='pending' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select r.id,r.pgn,r.result,r.revision from private.grove_chess_rooms r where r.status='finished' and r.black_id is not null and not exists(select 1 from private.grove_chess_records s where s.room_id=r.id) order by r.updated_at limit 50)x),'[]'::jsonb);
 elsif p_action='record' then
  select * into record_room from private.grove_chess_rooms where id=p_room;
  if not found or record_room.status<>'finished' or record_room.black_id is null or record_room.revision is distinct from p_revision or record_room.pgn is distinct from p_pgn then raise exception 'invalid-record'; end if;
  if p_facts is null or jsonb_typeof(p_facts)<>'object' or length(p_facts::text)>4096 or jsonb_typeof(p_facts->'eligible')<>'boolean' then raise exception 'invalid-record'; end if;
  insert into private.grove_chess_records(room_id,revision,facts) values(record_room.id,record_room.revision,p_facts) on conflict(room_id) do nothing;
  return jsonb_build_object('recorded',true);
 elsif p_action<>'read' then raise exception 'invalid-request'; end if;
 if p_actor is null or p_actor!~'^[a-f0-9]{64}$' or (p_wallet is not null and p_wallet!~'^0x[a-f0-9]{64}$') then raise exception 'invalid-request'; end if;
 who:=encode(sha256(convert_to(coalesce(p_wallet,'guest:'||p_actor),'UTF8')),'hex');
 with seats as (
  select encode(sha256(convert_to(coalesce(s.wallet,'guest:'||s.actor),'UTF8')),'hex') as player,s.side,g.facts->s.side as f
  from private.grove_chess_records g join private.grove_chess_rooms r on r.id=g.room_id
  cross join lateral (values ('w',r.white_id,r.white_wallet),('b',r.black_id,r.black_wallet)) s(side,actor,wallet)
  where g.facts->>'eligible'='true' and (r.white_wallet is null or r.black_wallet is null or r.white_wallet<>r.black_wallet)
 ), totals as (
  select player,count(*)::int as games,count(*) filter(where f->>'win'='true')::int as wins,count(*) filter(where f->>'draw'='true')::int as draws,
   count(*) filter(where side='w' and f->>'win'='true')::int as white_wins,count(*) filter(where side='b' and f->>'win'='true')::int as black_wins,
   count(*) filter(where f->>'mate'='true')::int as mates,count(*) filter(where f->>'castleWin'='true')::int as castle_wins,
   count(*) filter(where f->>'promotion'='true')::int as promotions,count(*) filter(where f->>'underpromotion'='true')::int as underpromotions,count(*) filter(where f->>'enPassant'='true')::int as en_passants
  from seats group by player
 ), ranked as (select *,rank() over(order by wins desc,draws desc) as rank from totals), public_rows as (
  select player,rank,jsonb_build_object('alias','Oak-'||upper(substr(player,1,10)),'rank',rank,'games',games,'wins',wins,'draws',draws,'losses',games-wins-draws,'whiteWins',white_wins,'blackWins',black_wins,'mates',mates,'castleWins',castle_wins,'promotions',promotions,'underpromotions',underpromotions,'enPassants',en_passants) as stats from ranked
 ) select jsonb_build_object('leaderboard',coalesce((select jsonb_agg(stats order by rank,player) from (select * from public_rows order by rank,player limit 50)top),'[]'::jsonb),'me',(select stats from public_rows where player=who),'alias','Oak-'||upper(substr(who,1,10))) into answer;
 return answer;
end $$;
revoke all on function public.grove_chess_records_v1(text,text,text,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.grove_chess_records_v1(text,text,text,uuid,integer,text,jsonb) to service_role;
commit;
