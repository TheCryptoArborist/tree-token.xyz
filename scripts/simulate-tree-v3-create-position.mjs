import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { TREE_COIN_TYPE, SUI_COIN_TYPE, SUI_DECIMALS, TREE_DECIMALS, decimalToRaw, ticksFromDisplayedPrices, buildCreateTreeV3Position, extractAddLiquidityEvent, simulationSucceeded } from '../dapp/v3-transaction-core.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const exposureResponse = await fetch('https://tree-token.xyz/api/tree-exposure', { headers: { Accept: 'application/json' } });
if (!exposureResponse.ok) throw new Error(`Exposure endpoint returned ${exposureResponse.status}`);
const exposure = await exposureResponse.json();
const rows = exposure.entries || exposure.leaderboard || exposure.data?.entries || [];
if (!Array.isArray(rows) || !rows.length) throw new Error('No verified exposure rows were returned.');
const overviewResponse = await fetch('https://deploy-preview-13--tree-token.netlify.app/api/tree-v3-overview', { headers: { Accept: 'application/json' } });
if (!overviewResponse.ok) throw new Error(`V3 overview returned ${overviewResponse.status}`);
const overview = await overviewResponse.json();
if (overview?.pool?.verified !== true) throw new Error('V3 pool verification is unavailable.');
const price = Number(overview.pool.priceSuiPerTree); const currentTick = Number(overview.pool.currentTick);
if (!(price > 0) || !Number.isInteger(currentTick)) throw new Error('V3 price or tick is unavailable.');
const suiAmount = 0.01; const treeAmount = Math.ceil((suiAmount / price) * 1_000_000) / 1_000_000;
const suiRaw = decimalToRaw(String(suiAmount), SUI_DECIMALS); const treeRaw = decimalToRaw(String(treeAmount), TREE_DECIMALS);
const { lower: tickLower, upper: tickUpper } = ticksFromDisplayedPrices({ currentTick, currentPrice: price, minPrice: price * 0.9, maxPrice: price * 1.1, tickSpacing: 50, displayedPriceIncreasesWithTick: true });
const rowAddress = (row) => row.wallet || row.address || row.owner || row.walletAddress || null;
let owner = null;
for (const row of rows.slice(0, 50)) {
  const candidate = rowAddress(row); if (!/^0x[0-9a-f]{64}$/i.test(candidate || '')) continue;
  try {
    const [sui, tree] = await Promise.all([client.core.getBalance({ owner: candidate, coinType: SUI_COIN_TYPE }), client.core.getBalance({ owner: candidate, coinType: TREE_COIN_TYPE })]);
    if (BigInt(sui?.balance ?? sui?.totalBalance ?? 0) >= suiRaw + 100_000_000n && BigInt(tree?.balance ?? tree?.totalBalance ?? 0) >= treeRaw) { owner = candidate; break; }
  } catch { }
}
if (!owner) throw new Error('No public verification wallet had sufficient SUI and TREE for a non-signing simulation.');
const tx = await buildCreateTreeV3Position({ Transaction, client, owner, treeRaw, suiRaw, tickLower, tickUpper });
const simulation = await client.core.simulateTransaction({ transaction: tx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(simulation)) throw new Error(`V3 create-position simulation failed: ${JSON.stringify(simulation?.effects?.status ?? null)}`);
const event = extractAddLiquidityEvent(simulation);
if (!event || event.treeRaw <= 0n || event.suiRaw <= 0n || event.liquidityRaw <= 0n) throw new Error('Simulation returned no positive add-liquidity event.');
console.log(JSON.stringify({ classification: 'TREE_V3_CREATE_POSITION_SIMULATION_VALID', poolVerified: true, tokenOrder: ['TREE','SUI'], tickLower, tickUpper, requestedTreeRaw: treeRaw.toString(), requestedSuiRaw: suiRaw.toString(), depositedTreeRaw: event.treeRaw.toString(), depositedSuiRaw: event.suiRaw.toString(), liquidityRaw: event.liquidityRaw.toString(), signed: false, submitted: false }, null, 2));
