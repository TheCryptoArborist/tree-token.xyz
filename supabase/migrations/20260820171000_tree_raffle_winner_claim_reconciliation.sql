create or replace function public.record_tree_raffle_winner(
  p_round_id text,
  p_prize_class text,
  p_onchain_draw_id text,
  p_ledger_commitment text,
  p_winning_ticket text,
  p_wallet text,
  p_draw_tx_digest text,
  p_register_tx_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := lower(p_wallet);
  v_winning_ticket bigint;
  v_snapshot private.tree_raffle_draw_snapshots%rowtype;
  v_round private.tree_raffle_rounds%rowtype;
  v_existing private.tree_raffle_winners%rowtype;
  v_expected_wallet text;
  v_token_symbol text;
  v_token_type text;
  v_amount_raw numeric(78, 0);
  v_token_decimals integer;
  v_required_winners integer;
  v_recorded_winners integer;
  v_inserted_rows integer;
  v_outcome text := 'recorded';
begin
  if p_round_id is null or p_round_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$'
     or p_prize_class is null or p_prize_class not in ('main', 'lucky') then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle winner identity.';
  end if;
  if p_onchain_draw_id is null or p_onchain_draw_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$'
     or p_ledger_commitment is null or p_ledger_commitment !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle draw audit values.';
  end if;
  if p_winning_ticket is null or p_winning_ticket !~ '^(0|[1-9][0-9]*)$'
     or p_winning_ticket::numeric > 9223372036854775807 then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle winning ticket.';
  end if;
  v_winning_ticket := p_winning_ticket::bigint;
  if v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle winner wallet.';
  end if;
  if p_draw_tx_digest is null or p_draw_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$'
     or p_register_tx_digest is null or p_register_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$' then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle draw transaction digest.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-raffle-winner:' || p_round_id || ':' || p_prize_class, 0)
  );

  select * into v_snapshot
  from private.tree_raffle_draw_snapshots
  where round_id = p_round_id and prize_class = p_prize_class
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TREE raffle locked draw snapshot was not found.';
  end if;

  select * into v_round
  from private.tree_raffle_rounds
  where round_id = p_round_id
  for update;
  if v_round.status not in ('locked', 'drawing', 'winner-published') then
    raise exception using errcode = '55000', message = 'TREE raffle round cannot accept a winner.';
  end if;
  if v_snapshot.onchain_draw_id <> p_onchain_draw_id
     or v_snapshot.ledger_commitment <> p_ledger_commitment
     or v_winning_ticket >= v_snapshot.total_tickets then
    raise exception using errcode = '22023', message = 'TREE raffle winner does not match the locked draw snapshot.';
  end if;

  select range_row->>'wallet' into v_expected_wallet
  from pg_catalog.jsonb_array_elements(v_snapshot.ticket_ranges) as range_row
  where v_winning_ticket >= (range_row->>'start')::bigint
    and v_winning_ticket < (range_row->>'endExclusive')::bigint;

  if v_expected_wallet is null or v_expected_wallet <> v_wallet then
    raise exception using errcode = '22023', message = 'TREE raffle winner wallet does not own the winning ticket.';
  end if;

  if p_prize_class = 'main' then
    v_token_symbol := v_round.prize_symbol;
    v_token_type := v_round.prize_coin_type;
    v_amount_raw := v_round.prize_amount_raw;
    v_token_decimals := v_round.prize_decimals;
  else
    if v_round.kind <> 'weekly' then
      raise exception using errcode = '22023', message = 'Lucky Leaf winners are only valid for weekly rounds.';
    end if;
    v_token_symbol := v_round.lucky_prize_symbol;
    v_token_type := v_round.lucky_prize_coin_type;
    v_amount_raw := v_round.lucky_prize_amount_raw;
    v_token_decimals := v_round.lucky_prize_decimals;
  end if;
  if v_amount_raw is null then
    raise exception using errcode = '55000', message = 'TREE raffle prize is not configured.';
  end if;

  insert into private.tree_raffle_winners (
    round_id, prize_class, wallet, winning_ticket, total_tickets,
    token_symbol, token_type, amount_raw, token_decimals,
    draw_tx_digest, register_tx_digest, onchain_draw_id,
    ledger_commitment, selection_scheme
  ) values (
    p_round_id, p_prize_class, v_wallet, v_winning_ticket, v_snapshot.total_tickets,
    v_token_symbol, v_token_type, v_amount_raw, v_token_decimals,
    p_draw_tx_digest, p_register_tx_digest, p_onchain_draw_id,
    p_ledger_commitment, v_snapshot.selection_scheme
  ) on conflict (round_id, prize_class) do nothing;
  get diagnostics v_inserted_rows = row_count;

  select * into v_existing
  from private.tree_raffle_winners
  where round_id = p_round_id and prize_class = p_prize_class;

  if v_existing.wallet <> v_wallet
     or v_existing.winning_ticket <> v_winning_ticket
     or v_existing.total_tickets <> v_snapshot.total_tickets
     or v_existing.onchain_draw_id <> p_onchain_draw_id
     or v_existing.ledger_commitment <> p_ledger_commitment
     or v_existing.draw_tx_digest <> p_draw_tx_digest
     or v_existing.register_tx_digest <> p_register_tx_digest then
    raise exception using errcode = '23505', message = 'TREE raffle winner conflicts with the recorded draw.';
  end if;
  if v_inserted_rows = 0 then v_outcome := 'duplicate'; end if;

  v_required_winners := 1 + case
    when v_round.kind = 'weekly' and v_round.lucky_prize_amount_raw is not null then 1
    else 0
  end;
  select count(*) into v_recorded_winners
  from private.tree_raffle_winners
  where round_id = p_round_id;

  update private.tree_raffle_rounds
  set
    status = case when v_recorded_winners = v_required_winners then 'winner-published' else 'drawing' end,
    drawing_started_at = coalesce(drawing_started_at, now()),
    updated_at = now()
  where round_id = p_round_id;

  return jsonb_build_object(
    'outcome', v_outcome,
    'roundId', v_existing.round_id,
    'prizeClass', v_existing.prize_class,
    'onchainDrawId', v_existing.onchain_draw_id,
    'ledgerCommitment', v_existing.ledger_commitment,
    'winningTicket', v_existing.winning_ticket::text,
    'totalTickets', v_existing.total_tickets::text,
    'wallet', v_existing.wallet,
    'token', v_existing.token_symbol,
    'tokenType', v_existing.token_type,
    'amountRaw', v_existing.amount_raw::text,
    'decimals', v_existing.token_decimals,
    'drawTxDigest', v_existing.draw_tx_digest,
    'registerTxDigest', v_existing.register_tx_digest
  );
end;
$$;

create or replace function public.record_tree_raffle_claim(
  p_round_id text,
  p_prize_class text,
  p_wallet text,
  p_claim_tx_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_wallet text := lower(p_wallet);
  v_winner private.tree_raffle_winners%rowtype;
  v_round private.tree_raffle_rounds%rowtype;
  v_required_winners integer;
  v_recorded_winners integer;
  v_unclaimed_winners integer;
  v_outcome text := 'recorded';
begin
  if p_round_id is null or p_round_id !~ '^[a-z0-9][a-z0-9:_-]{2,95}$'
     or p_prize_class is null or p_prize_class not in ('main', 'lucky')
     or v_wallet is null or v_wallet !~ '^0x[0-9a-f]{64}$'
     or p_claim_tx_digest is null or p_claim_tx_digest !~ '^[1-9A-HJ-NP-Za-km-z]{40,64}$' then
    raise exception using errcode = '22023', message = 'Invalid TREE raffle claim record.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tree-raffle-claim:' || p_round_id || ':' || p_prize_class, 0)
  );

  select * into v_winner
  from private.tree_raffle_winners
  where round_id = p_round_id and prize_class = p_prize_class
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TREE raffle winner was not found.';
  end if;
  if v_winner.wallet <> v_wallet then
    raise exception using errcode = '22023', message = 'TREE raffle claim wallet does not match the winner.';
  end if;

  if v_winner.claimed then
    if v_winner.claim_tx_digest <> p_claim_tx_digest then
      raise exception using errcode = '23505', message = 'TREE raffle claim conflicts with the recorded transaction.';
    end if;
    v_outcome := 'duplicate';
  else
    update private.tree_raffle_winners
    set claimed = true, claim_tx_digest = p_claim_tx_digest, claimed_at = now()
    where round_id = p_round_id and prize_class = p_prize_class
    returning * into v_winner;
  end if;

  select * into v_round
  from private.tree_raffle_rounds
  where round_id = p_round_id
  for update;
  v_required_winners := 1 + case
    when v_round.kind = 'weekly' and v_round.lucky_prize_amount_raw is not null then 1
    else 0
  end;
  select count(*), count(*) filter (where claimed = false)
  into v_recorded_winners, v_unclaimed_winners
  from private.tree_raffle_winners
  where round_id = p_round_id;

  if v_recorded_winners = v_required_winners and v_unclaimed_winners = 0 then
    update private.tree_raffle_rounds
    set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where round_id = p_round_id and status = 'winner-published';
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'roundId', v_winner.round_id,
    'prizeClass', v_winner.prize_class,
    'wallet', v_winner.wallet,
    'claimTxDigest', v_winner.claim_tx_digest,
    'claimedAt', v_winner.claimed_at
  );
end;
$$;

revoke all on function public.record_tree_raffle_winner(
  text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.record_tree_raffle_claim(text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.record_tree_raffle_winner(
  text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.record_tree_raffle_claim(text, text, text, text)
  to service_role;
