-- TREE FORCE joins the monthly Passport from November 2026 onward.
-- Deploy the compatible arcade-growth handler before applying this migration:
-- older handlers validate only three required game IDs. Existing recorded runs
-- count immediately; no activity, authentication, game, or award rows are edited.

create or replace function private.arcade_growth_valid_games_v1(p_games text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select coalesce(cardinality(p_games) between 1 and 4
    and p_games <@ array['garden-bot','pvp','arborist-trials','treeforce89']::text[]
    and array_position(p_games, null) is null
    and cardinality(p_games) = (select count(distinct g) from unnest(p_games) as g), false)
$$;

alter table private.arcade_growth_month_rules
  drop constraint arcade_growth_month_rules_enabled_games_check,
  add constraint arcade_growth_month_rules_enabled_games_check
    check (private.arcade_growth_valid_games_v1(enabled_games));

create or replace function private.arcade_growth_month_games_v1(p_month date, p_games text[], p_freeze boolean)
returns text[] language plpgsql volatile security invoker set search_path = '' as $$
declare v_games text[]; v_requested text[] := p_games;
begin
  if p_month is null or not isfinite(p_month) or extract(day from p_month) <> 1
    or not private.arcade_growth_valid_games_v1(p_games) then
    raise exception 'arcade-growth-invalid-rules';
  end if;
  -- Both the Daily Growth handler and the existing TREE FORCE ingestion RPC
  -- supply the original Garden fallback. The season is selected here so that
  -- either caller freezes four requirements when it starts a new month.
  if p_month >= date '2026-11-01' then
    if not ('treeforce89' = any(v_requested)) then
      v_requested := array_append(v_requested, 'treeforce89');
    end if;
  else
    v_requested := array_remove(v_requested, 'treeforce89');
  end if;
  if not private.arcade_growth_valid_games_v1(v_requested) then
    raise exception 'arcade-growth-invalid-rules';
  end if;
  if p_freeze then
    insert into private.arcade_growth_month_rules(month_key,enabled_games) values(p_month,v_requested)
      on conflict(month_key) do nothing;
  end if;
  select enabled_games into v_games from private.arcade_growth_month_rules where month_key = p_month;
  return coalesce(v_games,v_requested);
end $$;

-- November was already frozen under the earlier three-game default. Extend
-- that season and any later saved seasons once; preserve every earlier row,
-- its created_at timestamp, and all previously earned badge rows unchanged.
update private.arcade_growth_month_rules
  set enabled_games = array_append(enabled_games, 'treeforce89')
  where month_key >= date '2026-11-01' and not ('treeforce89' = any(enabled_games));

-- CREATE OR REPLACE preserves the ACL; restate the service-only boundary.
revoke all on function private.arcade_growth_valid_games_v1(text[]),
  private.arcade_growth_month_games_v1(date,text[],boolean) from public, anon, authenticated;
grant execute on function private.arcade_growth_valid_games_v1(text[]),
  private.arcade_growth_month_games_v1(date,text[],boolean) to service_role;
