import {
  SUI_COIN_TYPE, TREE_COIN_TYPE, SUIDEX_V3_POOL, MIN_SUI_GAS_RESERVE_RAW,
  validateVerifiedPool, optimalV3ZapSwapRaw, minimumAfterSlippage,
  buildIncreaseTreeV3ZapPosition, simulationSucceeded, extractAddLiquidityEvent,
} from './v3-transaction-core.js?v=20260913-zap1';

export async function prepareExistingSuiZap({ Transaction, client, owner, positionId, amountIn, slippageBps = 50, fetcher = fetch }) {
  amountIn = BigInt(amountIn);
  if (amountIn < 2n) throw new Error('Enter a larger SUI amount.');
  minimumAfterSlippage(amountIn, slippageBps);
  const response = await fetcher(`/api/tree-v3-overview?owner=${encodeURIComponent(owner)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to verify the existing position.');
  const data = await response.json();
  validateVerifiedPool(data.pool);
  const position = data.positions?.find(item => item.objectId === positionId && item.poolId === SUIDEX_V3_POOL);
  if (String(data.owner).toLowerCase() !== owner.toLowerCase() || !position) throw new Error('This verified position is not owned by the connected wallet.');
  if (!position.inRange) throw new Error('This position is out of range. A two-token SUI zap is currently available only for in-range positions.');
  const balance = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });
  const available = BigInt(balance?.balance?.balance ?? balance?.balance ?? balance?.totalBalance ?? 0);
  if (available < amountIn + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the total zap amount.');
  const quote = async swapRaw => {
    const query = new URLSearchParams({ tokenIn: SUI_COIN_TYPE, tokenOut: TREE_COIN_TYPE, amountIn: String(swapRaw), slippageBps: String(slippageBps) });
    const response = await fetcher(`/api/tree-swap-quote?${query}`, { cache: 'no-store' });
    const payload = await response.json();
    const route = payload.routes?.find(item => item.executionKind === 'suidex-v3-direct');
    if (!response.ok || payload.status !== 'ok' || !route || String(route.pairId).toLowerCase() !== SUIDEX_V3_POOL
      || BigInt(route.amountIn) !== swapRaw || BigInt(route.amountOut) <= 0n) throw new Error('A matching SuiDex V3 swap quote is unavailable.');
    // Derive the minimum from the selected slippage instead of trusting a stale route minimum.
    return { amountOut: BigInt(route.amountOut), minAmountOut: minimumAfterSlippage(route.amountOut, slippageBps) };
  };
  const probeRaw = amountIn / 2n;
  const probe = await quote(probeRaw);
  const tickLower = Number(position.tickLower), tickUpper = Number(position.tickUpper);
  const swapRaw = optimalV3ZapSwapRaw({ amountIn, inputType: SUI_COIN_TYPE, tickLower, tickUpper,
    sqrtPriceRaw: data.pool.sqrtPriceRaw, probeAmountIn: probeRaw, probeAmountOut: probe.amountOut });
  const route = swapRaw === probeRaw ? probe : await quote(swapRaw);
  const base = { Transaction, client, owner, positionId, amountIn, swapRaw, minSwapOutRaw: route.minAmountOut, tickLower, tickUpper };
  const simulate = async transaction => {
    const result = await client.core.simulateTransaction({ transaction, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true } });
    const added = extractAddLiquidityEvent(result, positionId);
    if (!simulationSucceeded(result) || !added || added.suiRaw <= 0n || added.treeRaw <= 0n) throw new Error('The swap and position increase did not pass Sui Mainnet simulation. Refresh and try again.');
    return { result, added };
  };
  const preliminary = await simulate(await buildIncreaseTreeV3ZapPosition(base));
  const minSuiRaw = minimumAfterSlippage(preliminary.added.suiRaw, slippageBps);
  const minTreeRaw = minimumAfterSlippage(preliminary.added.treeRaw, slippageBps);
  const transaction = await buildIncreaseTreeV3ZapPosition({ ...base, minSuiRaw, minTreeRaw });
  const final = await simulate(transaction);
  return { transaction, amountIn, swapRaw, route, tickLower, tickUpper, minSuiRaw, minTreeRaw, preliminary, final };
}
