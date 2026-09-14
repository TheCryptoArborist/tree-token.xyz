import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { VICTORY_SUI_POOL, quoteVictoryToSui } from '../dapp/earn-transactions-core.js';
import {
  SUIDEX_V3_POOL, SUI_COIN_TYPE, TREE_COIN_TYPE,
  extractAddLiquidityEvent, minimumAfterSlippage, optimalV3ZapSwapRaw, ticksFromDisplayedPrices, validateVerifiedPool,
} from '../dapp/v3-transaction-core.js';
import { extractVictoryLockEvent, extractVictoryLocked } from '../dapp/victory-transaction-core.js';
import { buildVictoryV3ReinvestTransaction } from '../dapp/victory-v3-reinvest-core.js';

const owner = process.argv[2];
const mode = process.argv[3] === 'sustainable' ? 'sustainable' : 'complete';
const targetArg = process.argv[4] || 'new';
const reinvestRaw = BigInt(process.argv[5] || '100000000');
if (!/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Pass a public Sui owner address as the first argument.');
const totalRaw = mode === 'sustainable' ? reinvestRaw * 2n : reinvestRaw;
const lockRaw = totalRaw - reinvestRaw;
const lockDays = mode === 'sustainable' ? 90 : null;
const slippageBps = 100;
const apiBase = 'https://tree-token.xyz';
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const objectJson = (result) => result?.object?.json ?? result?.json ?? null;
const transactionResult = (result) => result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction || result;
const succeeded = (result) => transactionResult(result)?.effects?.status?.success === true || transactionResult(result)?.status?.success === true;
const failure = (result) => transactionResult(result)?.effects?.status?.error?.message || transactionResult(result)?.status?.error?.message || 'Mainnet simulation failed.';
const simulate = async (transaction) => {
  const result = await client.core.simulateTransaction({ transaction, checksEnabled: true, include: { effects: true, balanceChanges: true, events: true } });
  if (!succeeded(result)) throw new Error(failure(result));
  return result;
};
const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } }); const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with ${response.status}.`); return payload;
};
const fetchV3Route = async (amountIn) => {
  const query = new URLSearchParams({ tokenIn: SUI_COIN_TYPE, tokenOut: TREE_COIN_TYPE, amountIn: amountIn.toString(), slippageBps: String(slippageBps) });
  const payload = await fetchJson(`${apiBase}/api/tree-swap-quote?${query}`);
  const route = Array.isArray(payload.routes) ? payload.routes.find((candidate) => candidate.executionKind === 'suidex-v3-direct') : null;
  if (payload.status !== 'ok' || !route || String(route.pairId).toLowerCase() !== SUIDEX_V3_POOL || BigInt(route.amountIn) !== amountIn || BigInt(route.amountOut) <= 0n || BigInt(route.minAmountOut) <= 0n) throw new Error('A matching verified V3 route was not returned.');
  return route;
};

const [victoryPoolResult, overview] = await Promise.all([
  client.core.getObject({ objectId: VICTORY_SUI_POOL, include: { json: true } }),
  fetchJson(`${apiBase}/api/tree-v3-overview?owner=${encodeURIComponent(owner)}`),
]);
validateVerifiedPool(overview.pool);
let position = null;
if (targetArg !== 'new') {
  position = targetArg === 'existing'
    ? (overview.positions || []).find((candidate) => candidate.inRange)
    : (overview.positions || []).find((candidate) => candidate.inRange && candidate.objectId === targetArg);
  if (!position) throw new Error('No matching verified in-range V3 position was found.');
}
const ticks = position
  ? { lower: Number(position.tickLower), upper: Number(position.tickUpper) }
  : ticksFromDisplayedPrices({ currentTick: Number(overview.pool.currentTick), currentPrice: Number(overview.pool.priceSuiPerTree), minPrice: Number(overview.pool.priceSuiPerTree) * 0.8, maxPrice: Number(overview.pool.priceSuiPerTree) * 1.2, tickSpacing: Number(overview.pool.tickSpacing), displayedPriceIncreasesWithTick: false });
const victoryToSui = quoteVictoryToSui({ victorySuiPoolJson: objectJson(victoryPoolResult), amountIn: reinvestRaw, slippageBps });
const availableSuiRaw = BigInt(victoryToSui.minAmountOut); const probeRaw = availableSuiRaw / 2n;
const probe = await fetchV3Route(probeRaw);
const v3SwapRaw = optimalV3ZapSwapRaw({ amountIn: availableSuiRaw, inputType: SUI_COIN_TYPE, tickLower: ticks.lower, tickUpper: ticks.upper, sqrtPriceRaw: overview.pool.sqrtPriceRaw, probeAmountIn: probeRaw, probeAmountOut: BigInt(probe.amountOut) });
const v3Route = v3SwapRaw === probeRaw ? probe : await fetchV3Route(v3SwapRaw);
const quote = Object.freeze({ amountIn: reinvestRaw, slippageBps, victoryToSui, v3SwapRaw, minSwapOutRaw: BigInt(v3Route.minAmountOut), v3PriceImpactBps: BigInt(v3Route.priceImpactBps || 0), tickLower: ticks.lower, tickUpper: ticks.upper, positionId: position?.objectId || null, generatedAt: Date.now() });
const base = { Transaction, client, owner, totalAmount: totalRaw, reinvestAmount: reinvestRaw, lockAmount: lockRaw, lockDays, quote, slippageBps };
const preliminary = await buildVictoryV3ReinvestTransaction(base); const preliminarySimulation = await simulate(preliminary.transaction);
const preliminaryAdded = extractAddLiquidityEvent(preliminarySimulation, quote.positionId || null);
if (!preliminaryAdded) throw new Error('The preliminary simulation returned no verified add-liquidity event.');
const finalBuilt = await buildVictoryV3ReinvestTransaction({ ...base, minSuiRaw: minimumAfterSlippage(preliminaryAdded.suiRaw, slippageBps), minTreeRaw: minimumAfterSlippage(preliminaryAdded.treeRaw, slippageBps) });
let finalSimulation;
for (let pass = 0; pass < 2; pass += 1) finalSimulation = await simulate(finalBuilt.transaction);
const added = extractAddLiquidityEvent(finalSimulation, quote.positionId || null);
const lock = mode === 'sustainable' ? extractVictoryLockEvent(finalSimulation, owner, { amountRaw: lockRaw, lockDays }) : null;
if (!added || extractVictoryLocked(finalSimulation, owner) !== totalRaw || (mode === 'sustainable' && !lock)) throw new Error('The final simulations did not reconcile the VICTORY allocation, V3 deposit, and optional lock.');
console.log(JSON.stringify({
  submitted: false, success: true, simulations: { preliminary: 1, final: 2 }, mode,
  owner, totalVictoryRaw: totalRaw.toString(), reinvestVictoryRaw: reinvestRaw.toString(), lockedVictoryRaw: lockRaw.toString(),
  destination: position ? { kind: 'existing', positionId: position.objectId } : { kind: 'new', range: '±20%' },
  ticks, route: { victorySuiPool: VICTORY_SUI_POOL, suiTreeV3Pool: SUIDEX_V3_POOL, minimumSuiRaw: victoryToSui.minAmountOut.toString(), v3SwapSuiRaw: v3SwapRaw.toString(), minimumTreeRaw: v3Route.minAmountOut.toString() },
  added: { suiRaw: added.suiRaw.toString(), treeRaw: added.treeRaw.toString(), liquidityRaw: added.liquidityRaw.toString() },
  lock: lock ? { id: lock.lockId.toString(), amountRaw: lock.amountRaw.toString(), days: lock.lockDays, end: lock.lockEnd.toString() } : null,
}, null, 2));
