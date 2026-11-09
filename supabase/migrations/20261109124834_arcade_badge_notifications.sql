-- New saved awards only. No badge granting, backfill, attendance or wallet changes.
-- clock_timestamp() differs between rows in one transaction; use an internal
-- transaction key, never timestamps or names, to associate those saved awards.
alter table private.arcade_streak_milestones add column notification_transaction text not null default pg_current_xact_id()::text;
create table private.arcade_badge_notifications(
 id text primary key check(id ~ '^[a-f0-9]{32}$'),wallet text not null,
 month_key date not null,badge_id text not null,earned_at timestamptz not null,
 captured_at timestamptz not null default clock_timestamp(),notification_transaction text not null default pg_current_xact_id()::text,unique(wallet,month_key,badge_id)
);
alter table private.arcade_badge_notifications enable row level security;
revoke all on private.arcade_badge_notifications from public,anon,authenticated;
grant select,insert on private.arcade_badge_notifications to service_role;
create function private.arcade_capture_badge_notification_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.badge_id in ('seedling','sapling','deep-roots','full-canopy','arcade-passport') then
 insert into private.arcade_badge_notifications(id,wallet,month_key,badge_id,earned_at)
 values(md5(new.wallet||':'||new.month_key::text||':'||new.badge_id),new.wallet,new.month_key,new.badge_id,new.earned_at)
 on conflict(wallet,month_key,badge_id) do nothing;
 end if;return new;
end $$;
revoke all on function private.arcade_capture_badge_notification_v1() from public,anon,authenticated;
grant execute on function private.arcade_capture_badge_notification_v1() to service_role;
create trigger arcade_badge_notification after insert on private.arcade_growth_monthly_badges
for each row execute function private.arcade_capture_badge_notification_v1();
create function public.arcade_badge_notifications_v1(p_after bigint default 0,p_key text default '')
returns table(id text,at bigint,wallet text,badge_id text,month_key date,streak_id text)
language sql stable security invoker set search_path='' as $$
 select b.id,floor(extract(epoch from b.captured_at)*1000)::bigint,b.wallet,b.badge_id,b.month_key,
 (select m.id from private.arcade_streak_milestones m where m.wallet=b.wallet and m.notification_transaction=b.notification_transaction
   and date_trunc('month',m.date_key)::date=b.month_key order by m.milestone desc limit 1)
 from private.arcade_badge_notifications b
 where (floor(extract(epoch from b.captured_at)*1000)::bigint,b.id)>(p_after,p_key)
 order by floor(extract(epoch from b.captured_at)*1000)::bigint,b.id limit 101
$$;
revoke all on function public.arcade_badge_notifications_v1(bigint,text) from public,anon,authenticated;
grant execute on function public.arcade_badge_notifications_v1(bigint,text) to service_role;

-- Backward-compatible streak feed now includes exact saved badges from the same
-- commit, even though their individual earned/created timestamps differ.
create or replace function public.arcade_streak_milestones_v1(p_after bigint default 0,p_key text default '')
returns table(id text,at bigint,wallet text,days integer,date_key date,badges text[])
language sql stable security invoker set search_path='' as $$
 select m.id,floor(extract(epoch from m.confirmed_at)*1000)::bigint,m.wallet,m.milestone,m.date_key,
 array(select b.badge_id from private.arcade_badge_notifications b where b.wallet=m.wallet
  and b.month_key=date_trunc('month',m.date_key)::date and b.notification_transaction=m.notification_transaction order by b.badge_id)
 from private.arcade_streak_milestones m
 where (floor(extract(epoch from m.confirmed_at)*1000)::bigint,m.id)>(p_after,p_key)
 order by floor(extract(epoch from m.confirmed_at)*1000)::bigint,m.id limit 101
$$;
revoke all on function public.arcade_streak_milestones_v1(bigint,text) from public,anon,authenticated;
grant execute on function public.arcade_streak_milestones_v1(bigint,text) to service_role;
