-- Forward-only, transactional notifications; never writes check-in or badge data.
create table private.arcade_streak_milestones (
 id text primary key check (id ~ '^[a-f0-9]{32}$'),
 wallet text not null,
 milestone integer not null check (milestone in (3,7,14) or milestone >= 30 and milestone % 30 = 0),
 date_key date not null,
 checkin_at timestamptz not null,
 confirmed_at timestamptz not null default clock_timestamp(),
 unique(wallet,milestone)
);
alter table private.arcade_streak_milestones enable row level security;
revoke all on private.arcade_streak_milestones from public, anon, authenticated;
grant select,insert on private.arcade_streak_milestones to service_role;
grant usage on schema private to service_role;

create function private.arcade_capture_streak_milestone_v1() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_days integer;
begin
 if new.source = 'paid-recovery' or new.date_key <> (clock_timestamp() at time zone 'UTC')::date then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('arcade-growth:progress:'||new.wallet,0));
 select count(*)::integer into v_days from (
  select date_key,row_number() over(order by date_key desc)::integer as rn
  from private.arcade_growth_checkins where wallet=new.wallet and source <> 'paid-recovery' and date_key<=new.date_key
 ) d where d.date_key=new.date_key-(d.rn-1);
 if v_days in (3,7,14) or v_days>=30 and v_days%30=0 then
  insert into private.arcade_streak_milestones(id,wallet,milestone,date_key,checkin_at)
   values(md5(new.wallet||':'||v_days::text),new.wallet,v_days,new.date_key,new.created_at)
   on conflict(wallet,milestone) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.arcade_capture_streak_milestone_v1() from public,anon,authenticated;
grant execute on function private.arcade_capture_streak_milestone_v1() to service_role;
create trigger arcade_checkin_streak_milestone after insert on private.arcade_growth_checkins
 for each row execute function private.arcade_capture_streak_milestone_v1();

-- Invoker function callable only by the existing server-side service role.
create function public.arcade_streak_milestones_v1(p_after bigint default 0,p_key text default '')
returns table(id text,at bigint,wallet text,days integer,date_key date,badges text[])
language sql stable security invoker set search_path='' as $$
 select m.id,floor(extract(epoch from m.confirmed_at)*1000)::bigint,m.wallet,m.milestone,m.date_key,
  array(select b.badge_id from private.arcade_growth_monthly_badges b where b.wallet=m.wallet
   and b.month_key=date_trunc('month',m.date_key)::date and b.earned_at=m.checkin_at order by b.badge_id)
 from private.arcade_streak_milestones m
 where (floor(extract(epoch from m.confirmed_at)*1000)::bigint,m.id)>(p_after,p_key)
 order by floor(extract(epoch from m.confirmed_at)*1000)::bigint,m.id limit 101
$$;
revoke all on function public.arcade_streak_milestones_v1(bigint,text) from public,anon,authenticated;
grant execute on function public.arcade_streak_milestones_v1(bigint,text) to service_role;
