-- A wallet claim must be built against the exact public on-chain draw key.
-- Keep the rest of the read model private and service-mediated.
create or replace function public.read_tree_raffle_public_snapshot(p_wallet text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := case when p_wallet is null or btrim(p_wallet) = '' then null else lower(p_wallet) end;
  v_rounds jsonb;
  v_history jsonb;
  v_claims jsonb;
begin
  if v_wallet is not null and v_wallet !~ '^0x[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid normalized Sui wallet address.';
  end if;

  select coalesce(jsonb_object_agg(kind, payload), '{}'::jsonb)
  into v_rounds
  from (
    select distinct on (r.kind)
      r.kind,
      jsonb_build_object(
        'id', r.round_id,
        'kind', r.kind,
        'state', r.status,
        'opensAt', r.opens_at,
        'closesAt', r.closes_at,
        'totalMainTickets', r.total_main_tickets,
        'totalLuckyLeafTickets', r.total_lucky_leaf_tickets,
        'qualifyingTransactions', r.qualifying_transactions,
        'totalBuyers', (select count(*) from private.tree_raffle_round_wallets rw where rw.round_id = r.round_id),
        'prize', case when r.prize_amount_raw is null then null else jsonb_build_object(
          'symbol', r.prize_symbol,
          'coinType', r.prize_coin_type,
          'amountRaw', r.prize_amount_raw::text,
          'decimals', r.prize_decimals
        ) end,
        'luckyPrize', case when r.lucky_prize_amount_raw is null then null else jsonb_build_object(
          'symbol', r.lucky_prize_symbol,
          'coinType', r.lucky_prize_coin_type,
          'amountRaw', r.lucky_prize_amount_raw::text,
          'decimals', r.lucky_prize_decimals
        ) end,
        'wallet', case when v_wallet is null then null else (
          select jsonb_build_object(
            'mainTickets', rw.main_tickets,
            'luckyLeafTickets', rw.lucky_leaf_tickets,
            'qualifyingTransactions', rw.qualifying_transactions
          )
          from private.tree_raffle_round_wallets rw
          where rw.round_id = r.round_id and rw.wallet = v_wallet
        ) end
      ) as payload
    from private.tree_raffle_rounds r
    order by r.kind,
      case r.status when 'collecting' then 0 when 'locked' then 1 when 'drawing' then 2 else 3 end,
      r.updated_at desc,
      r.round_id desc
  ) latest;

  select coalesce(jsonb_agg(jsonb_build_object(
    'roundId', w.round_id,
    'kind', r.kind,
    'prizeClass', w.prize_class,
    'wallet', w.wallet,
    'token', w.token_symbol,
    'amountRaw', w.amount_raw::text,
    'decimals', w.token_decimals,
    'drawTxDigest', w.draw_tx_digest,
    'registerTxDigest', w.register_tx_digest,
    'claimed', w.claimed,
    'claimTxDigest', w.claim_tx_digest,
    'publishedAt', w.published_at
  ) order by w.published_at desc), '[]'::jsonb)
  into v_history
  from (
    select * from private.tree_raffle_winners order by published_at desc limit 20
  ) w
  join private.tree_raffle_rounds r on r.round_id = w.round_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'roundId', w.round_id,
    'prizeClass', w.prize_class,
    'onchainDrawId', w.onchain_draw_id,
    'token', w.token_symbol,
    'tokenType', w.token_type,
    'amountRaw', w.amount_raw::text,
    'decimals', w.token_decimals,
    'registerTxDigest', w.register_tx_digest
  ) order by w.published_at desc), '[]'::jsonb)
  into v_claims
  from private.tree_raffle_winners w
  where v_wallet is not null and w.wallet = v_wallet and w.claimed = false;

  return jsonb_build_object(
    'rounds', v_rounds,
    'history', v_history,
    'wallet', case when v_wallet is null then null else jsonb_build_object(
      'address', v_wallet,
      'streak', (select jsonb_build_object(
        'days', s.streak_days,
        'lastRaffleDate', s.last_raffle_date
      ) from private.tree_raffle_wallet_streaks s where s.wallet = v_wallet),
      'unclaimedPrizes', v_claims
    ) end
  );
end;
$$;

revoke all on function public.read_tree_raffle_public_snapshot(text)
  from public, anon, authenticated;
grant execute on function public.read_tree_raffle_public_snapshot(text)
  to service_role;
