-- Daily-only launch mode delegates all validation, streak accounting, replay
-- protection, and daily credits to the audited ledger RPC, then atomically
-- removes the weekly credit created by the original dual-cadence function.
-- A duplicate digest is never adjusted twice.
create or replace function public.record_tree_raffle_verified_buy_daily_only(
  p_tx_digest text,
  p_buyer text,
  p_tree_amount_raw text,
  p_qualifying_usd_cents bigint,
  p_route text,
  p_finalized_checkpoint bigint,
  p_finalized_at timestamptz,
  p_raffle_date date,
  p_daily_round_id text,
  p_weekly_round_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_result jsonb;
  v_main_tickets bigint;
  v_lucky_leaf_tickets bigint;
  v_buyer text := lower(p_buyer);
begin
  v_result := public.record_tree_raffle_verified_buy(
    p_tx_digest,
    p_buyer,
    p_tree_amount_raw,
    p_qualifying_usd_cents,
    p_route,
    p_finalized_checkpoint,
    p_finalized_at,
    p_raffle_date,
    p_daily_round_id,
    p_weekly_round_id
  );

  -- Every daily round created by the ledger inherits the approved 50,000 TREE
  -- prize. The weekly prize columns remain null while weekly launch is disabled.
  update private.tree_raffle_rounds
  set prize_symbol = 'TREE',
      prize_coin_type = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
      prize_amount_raw = 50000000000,
      prize_decimals = 6,
      opens_at = coalesce(
        opens_at,
        p_raffle_date::timestamp at time zone 'America/New_York'
      ),
      closes_at = coalesce(
        closes_at,
        (p_raffle_date + 1 + time '10:00') at time zone 'America/New_York'
      ),
      updated_at = now()
  where round_id = p_daily_round_id
    and kind = 'daily'
    and prize_amount_raw is null;

  if v_result->>'outcome' = 'recorded' and (v_result->>'qualifies')::boolean then
    v_main_tickets := (v_result->>'mainTickets')::bigint;
    v_lucky_leaf_tickets := (v_result->>'luckyLeafTickets')::bigint;

    update private.tree_raffle_rounds
    set total_main_tickets = greatest(0, total_main_tickets - v_main_tickets),
        total_lucky_leaf_tickets = greatest(0, total_lucky_leaf_tickets - v_lucky_leaf_tickets),
        qualifying_transactions = greatest(0, qualifying_transactions - 1),
        updated_at = now()
    where round_id = p_weekly_round_id and kind = 'weekly';

    update private.tree_raffle_round_wallets
    set main_tickets = greatest(0, main_tickets - v_main_tickets),
        lucky_leaf_tickets = greatest(0, lucky_leaf_tickets - v_lucky_leaf_tickets),
        qualifying_transactions = greatest(0, qualifying_transactions - 1),
        updated_at = now()
    where round_id = p_weekly_round_id and wallet = v_buyer;

    delete from private.tree_raffle_round_wallets
    where round_id = p_weekly_round_id
      and wallet = v_buyer
      and main_tickets = 0
      and lucky_leaf_tickets = 0
      and qualifying_transactions = 0;

    delete from private.tree_raffle_rounds
    where round_id = p_weekly_round_id
      and kind = 'weekly'
      and status = 'collecting'
      and total_main_tickets = 0
      and total_lucky_leaf_tickets = 0
      and qualifying_transactions = 0
      and prize_amount_raw is null
      and lucky_prize_amount_raw is null;

    update private.tree_raffle_verified_buys
    set lucky_leaf_tickets = 0
    where tx_digest = p_tx_digest;

    v_result := jsonb_set(v_result, '{luckyLeafTickets}', '0'::jsonb, true);
  end if;

  return v_result;
end;
$$;

revoke all on function public.record_tree_raffle_verified_buy_daily_only(
  text, text, text, bigint, text, bigint, timestamptz, date, text, text
) from public, anon, authenticated;

grant execute on function public.record_tree_raffle_verified_buy_daily_only(
  text, text, text, bigint, text, bigint, timestamptz, date, text, text
) to service_role;
