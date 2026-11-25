begin;
create table private.grove_chess_players (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 used integer not null default 0 check(used between 0 and 2),
 last_created timestamptz
);
create table private.grove_chess_rooms (
 id uuid primary key,
 white_id text not null references private.grove_chess_players(id),
 black_id text references private.grove_chess_players(id),
 white_wallet text, black_wallet text,
 pgn text not null default '', revision integer not null default 0,
 status text not null default 'waiting' check(status in ('waiting','playing','finished','cancelled')),
 result text, announced boolean not null default false,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes',
 updated_at timestamptz not null default now(),
 check(white_id is distinct from black_id)
);
create index grove_chess_room_invitations on private.grove_chess_rooms(created_at) where announced and status='waiting';
alter table private.grove_chess_players enable row level security;
alter table private.grove_chess_rooms enable row level security;
revoke all on private.grove_chess_players,private.grove_chess_rooms from public,anon,authenticated;
grant select,insert,update on private.grove_chess_players,private.grove_chess_rooms to service_role;
-- Only the isolated server handler may call this RPC. Move legality is checked
-- by chess.js on the server, followed by revision comparison in this transaction.
create function public.grove_chess_v1(p_action text,p_actor text default null,p_room uuid default null,p_used integer default 0,p_wallet text default null,p_revision integer default null,p_pgn text default null,p_result text default null,p_announce boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r private.grove_chess_rooms; player private.grove_chess_players; other private.grove_chess_players; t timestamptz:=clock_timestamp(); side text;
begin
 if p_action='invitations' then
  return jsonb_build_object('entries',coalesce((select jsonb_agg(x) from (select id,status, (extract(epoch from created_at)*1000)::bigint as "createdAt",(extract(epoch from expires_at)*1000)::bigint as "expiresAt" from private.grove_chess_rooms where status='waiting' and announced and expires_at>t order by created_at desc limit 100)x),'[]'::jsonb));
 end if;
 if p_actor is null or p_actor!~'^[a-f0-9]{64}$' or p_used not between 0 and 2 or (p_wallet is not null and p_wallet!~'^0x[a-f0-9]{64}$') then raise exception 'invalid-request'; end if;
 -- Consistent lock order serializes room/allowance transitions, including
 -- simultaneous joins and two rooms spending the last trial at once.
 perform pg_advisory_xact_lock(74123891);
 insert into private.grove_chess_players(id,used) values(p_actor,p_used) on conflict(id) do update set used=greatest(private.grove_chess_players.used,excluded.used);
 select * into player from private.grove_chess_players where id=p_actor for update;
 if p_action='create' then
  if p_wallet is null and player.used>=2 then raise exception 'nftree-required'; end if;
  if player.last_created>t-interval '60 seconds' then raise exception 'wait-before-inviting'; end if;
  if exists(select 1 from private.grove_chess_rooms where (white_id=p_actor or black_id=p_actor) and ((status='waiting' and expires_at>t) or (status='playing' and updated_at>t-interval '24 hours'))) then raise exception 'resume-existing-room'; end if;
  insert into private.grove_chess_rooms(id,white_id,white_wallet,announced) values(p_room,p_actor,p_wallet,p_announce) returning * into r;
  update private.grove_chess_players set last_created=t where id=p_actor;
 else
  select * into r from private.grove_chess_rooms where id=p_room for update;
  if not found then raise exception 'room-not-found'; end if;
  if p_action='join' and r.black_id is null and r.white_id<>p_actor then
   if r.status<>'waiting' or r.expires_at<=t then raise exception 'invitation-expired'; end if;
   select * into other from private.grove_chess_players where id=r.white_id for update;
   if (p_wallet is null and player.used>=2) or (r.white_wallet is null and other.used>=2) then raise exception 'nftree-required'; end if;
   if exists(select 1 from private.grove_chess_rooms where id<>r.id and (white_id=p_actor or black_id=p_actor) and status='playing' and updated_at>t-interval '24 hours') then raise exception 'resume-existing-room'; end if;
   update private.grove_chess_players set used=used+1 where (id=p_actor and p_wallet is null) or (id=r.white_id and r.white_wallet is null);
   update private.grove_chess_rooms set black_id=p_actor,black_wallet=p_wallet,status='playing',revision=revision+1,updated_at=t where id=r.id returning * into r;
  elsif p_action not in ('read','inspect','join','move','resign','cancel') then raise exception 'invalid-request';
  end if;
  side:=case when r.white_id=p_actor then 'w' when r.black_id=p_actor then 'b' else null end;
  if p_action in ('move','resign','cancel') then
   if side is null then raise exception 'not-your-seat'; end if;
   if (side='w' and r.white_wallet is not null and r.white_wallet is distinct from p_wallet) or (side='b' and r.black_wallet is not null and r.black_wallet is distinct from p_wallet) then raise exception 'nftree-required'; end if;
   if r.revision is distinct from p_revision then raise exception 'revision-conflict'; end if;
   if p_action='cancel' then
    if r.status<>'waiting' then raise exception 'room-already-started'; end if;
    update private.grove_chess_rooms set status='cancelled',revision=revision+1,updated_at=t where id=r.id returning * into r;
   else
    if r.status<>'playing' or r.updated_at<t-interval '24 hours' then raise exception 'game-ended'; end if;
    if p_action='move' and (p_pgn is null or length(p_pgn)>60000) then raise exception 'invalid-request'; end if;
    update private.grove_chess_rooms set pgn=case when p_action='move' then p_pgn else pgn end,status=case when p_result is null then 'playing' else 'finished' end,result=p_result,revision=revision+1,updated_at=t where id=r.id returning * into r;
   end if;
  end if;
 end if;
 select * into player from private.grove_chess_players where id=p_actor;
 return to_jsonb(r)||jsonb_build_object('seat',case when r.white_id=p_actor then 'w' when r.black_id=p_actor then 'b' else null end,'used',player.used);
end $$;
revoke all on function public.grove_chess_v1(text,text,uuid,integer,text,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.grove_chess_v1(text,text,uuid,integer,text,integer,text,text,boolean) to service_role;
commit;
