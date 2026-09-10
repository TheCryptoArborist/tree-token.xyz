import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  SUI_COIN_TYPE, TREE_COIN_TYPE, TREE_V3_TICK_SPACING, buildCreateTreeV3ZapPosition,
  extractAddLiquidityEvent, minimumAfterSlippage, optimalV3ZapSwapRaw, simulationSucceeded, ticksFromDisplayedPrices, validateVerifiedPool,
} from '../dapp/v3-transaction-core.js';

const owner = process.argv[2];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Usage: node scripts/simulate-tree-v3-zap.mjs <owner>');
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const amountIn = 3_000_000_000n; const probeRaw = amountIn / 2n; const slippageBps = 100;
const api = 'https://6a83369ee3a2321dd5236183--tree-token.netlify.app';
const [overviewResponse, quoteResponse] = await Promise.all([
  fetch(`${api}/api/tree-v3-overview`, { headers: { Accept: 'application/json' } }),
  fetch(`${api}/api/tree-swap-quote?tokenIn=${encodeURIComponent(SUI_COIN_TYPE)}&tokenOut=${encodeURIComponent(TREE_COIN_TYPE)}&amountIn=${probeRaw}&slippageBps=${slippageBps}`, { headers: { Accept: 'application/json' } }),
]);
if (!overviewResponse.ok || !quoteResponse.ok) throw new Error('The live V3 overview or quote endpoint was unavailable.');
const overview = await overviewResponse.json(); const quotePayload = await quoteResponse.json(); validateVerifiedPool(overview.pool);
const probe = quotePayload.routes?.find((route) => route.executionKind === 'suidex-v3-direct');
if (!probe || BigInt(probe.amountIn) !== probeRaw || BigInt(probe.minAmountOut) <= 0n) throw new Error('No verified direct V3 probe quote was returned.');
const currentPrice = Number(overview.pool.priceSuiPerTree);
const { lower: tickLower, upper: tickUpper } = ticksFromDisplayedPrices({ currentTick: Number(overview.pool.currentTick), currentPrice, minPrice: currentPrice * 0.8, maxPrice: currentPrice * 1.2, tickSpacing: TREE_V3_TICK_SPACING, displayedPriceIncreasesWithTick: false });
const swapRaw = optimalV3ZapSwapRaw({ amountIn, inputType: SUI_COIN_TYPE, tickLower, tickUpper, sqrtPriceRaw: overview.pool.sqrtPriceRaw, probeAmountIn: probeRaw, probeAmountOut: BigInt(probe.amountOut) });
const optimizedResponse = await fetch(`${api}/api/tree-swap-quote?tokenIn=${encodeURIComponent(SUI_COIN_TYPE)}&tokenOut=${encodeURIComponent(TREE_COIN_TYPE)}&amountIn=${swapRaw}&slippageBps=${slippageBps}`, { headers: { Accept: 'application/json' } });
if (!optimizedResponse.ok) throw new Error('The optimized V3 quote endpoint was unavailable.');
const optimizedPayload = await optimizedResponse.json(); const quote = optimizedPayload.routes?.find((route) => route.executionKind === 'suidex-v3-direct');
if (!quote || BigInt(quote.amountIn) !== swapRaw || BigInt(quote.minAmountOut) <= 0n) throw new Error('No verified optimized V3 quote was returned.');
const base = { Transaction, client, owner, inputType: SUI_COIN_TYPE, amountIn, swapRaw, minSwapOutRaw: BigInt(quote.minAmountOut), tickLower, tickUpper };
const preliminaryTx = await buildCreateTreeV3ZapPosition(base);
const preliminarySimulation = await client.core.simulateTransaction({ transaction: preliminaryTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(preliminarySimulation)) throw new Error(`Preliminary V3 zap simulation failed: ${JSON.stringify(preliminarySimulation?.effects?.status ?? preliminarySimulation?.Transaction?.effects?.status ?? null)}`);
const preliminary = extractAddLiquidityEvent(preliminarySimulation);
if (!preliminary || preliminary.suiRaw <= 0n || preliminary.treeRaw <= 0n) throw new Error('Preliminary V3 zap returned no positive add-liquidity event.');
const finalTx = await buildCreateTreeV3ZapPosition({ ...base, minSuiRaw: minimumAfterSlippage(preliminary.suiRaw, slippageBps), minTreeRaw: minimumAfterSlippage(preliminary.treeRaw, slippageBps) });
for (let pass = 1; pass <= 2; pass += 1) {
  const simulation = await client.core.simulateTransaction({ transaction: finalTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
  const added = extractAddLiquidityEvent(simulation);
  if (!simulationSucceeded(simulation) || !added || added.suiRaw <= 0n || added.treeRaw <= 0n) throw new Error(`Final V3 zap simulation ${pass} failed.`);
}
const unusedSuiRaw = amountIn - swapRaw - preliminary.suiRaw; const unusedTreeRaw = BigInt(quote.amountOut) - preliminary.treeRaw;
console.log(JSON.stringify({ classification: 'TREE_V3_ZAP_SIMULATION_VALID', owner, inputRaw: amountIn, swapRaw, swapPercent: Number(swapRaw * 10_000n / amountIn) / 100, tickLower, tickUpper, preliminary, unusedSuiRaw, unusedTreeRaw, finalSimulations: 2, signed: false, submitted: false }, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
