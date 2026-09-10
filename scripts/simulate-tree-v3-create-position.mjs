import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { TREE_COIN_TYPE, SUI_COIN_TYPE, SUIDEX_V3_POOL, SUI_DECIMALS, TREE_DECIMALS, TREE_V3_TICK_SPACING, decimalToRaw, ticksFromDisplayedPrices, buildCreateTreeV3Position, extractAddLiquidityEvent, simulationSucceeded } from '../dapp/v3-transaction-core.js';

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const normalizeCoinType = (value) => {
  const [address, module, name] = String(value || '').split('::');
  const compact = address?.toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{1,64}$/.test(compact || '') && module && name
    ? `0x${compact.padStart(64, '0')}::${module.toLowerCase()}::${name.toLowerCase()}`
    : null;
};
const exposureResponse = await fetch('https://tree-token.xyz/api/tree-exposure', { headers: { Accept: 'application/json' } });
if (!exposureResponse.ok) throw new Error(`Exposure endpoint returned ${exposureResponse.status}`);
const exposure = await exposureResponse.json();
const rows = exposure.entries || exposure.leaderboard || exposure.data?.entries || [];
if (!Array.isArray(rows) || !rows.length) throw new Error('No verified exposure rows were returned.');
const { object: poolObject } = await client.core.getObject({ objectId: SUIDEX_V3_POOL, include: { json: true } });
const pool = poolObject?.json;
if (!pool || Number(pool.tick_spacing) !== TREE_V3_TICK_SPACING || Number(pool.swap_fee_rate) !== 2500
  || normalizeCoinType(pool.type_x) !== normalizeCoinType(SUI_COIN_TYPE)
  || normalizeCoinType(pool.type_y) !== normalizeCoinType(TREE_COIN_TYPE)) throw new Error('Live V3 pool verification failed.');
const tickBits = Number(pool.tick_index?.bits ?? pool.tick_index);
const currentTick = tickBits > 0x7fff_ffff ? tickBits - 0x1_0000_0000 : tickBits;
const sqrtPrice = BigInt(pool.sqrt_price);
const priceScale = 10n ** 18n;
const price = Number(((1n << 128n) * 10n ** BigInt(TREE_DECIMALS) * priceScale)
  / (sqrtPrice * sqrtPrice * 10n ** BigInt(SUI_DECIMALS))) / 1e18;
if (!(price > 0) || !Number.isInteger(currentTick)) throw new Error('V3 price or tick is unavailable.');
const suiAmount = 0.01; const treeAmount = Math.ceil((suiAmount / price) * 1_000_000) / 1_000_000;
const suiRaw = decimalToRaw(String(suiAmount), SUI_DECIMALS); const treeRaw = decimalToRaw(String(treeAmount), TREE_DECIMALS);
const { lower: tickLower, upper: tickUpper } = ticksFromDisplayedPrices({ currentTick, currentPrice: price, minPrice: price * 0.9, maxPrice: price * 1.1, tickSpacing: TREE_V3_TICK_SPACING, displayedPriceIncreasesWithTick: false });
const rowAddress = (row) => row.wallet || row.address || row.owner || row.walletAddress || null;
let owner = null;
for (const row of rows.slice(0, 50)) {
  const candidate = rowAddress(row); if (!/^0x[0-9a-f]{64}$/i.test(candidate || '')) continue;
  try {
    const [sui, tree] = await Promise.all([client.core.getBalance({ owner: candidate, coinType: SUI_COIN_TYPE }), client.core.getBalance({ owner: candidate, coinType: TREE_COIN_TYPE })]);
    if (BigInt(sui?.balance?.balance ?? sui?.balance ?? sui?.totalBalance ?? 0) >= suiRaw + 100_000_000n && BigInt(tree?.balance?.balance ?? tree?.balance ?? tree?.totalBalance ?? 0) >= treeRaw) { owner = candidate; break; }
  } catch { }
}
if (!owner) throw new Error('No public verification wallet had sufficient SUI and TREE for a non-signing simulation.');
const tx = await buildCreateTreeV3Position({ Transaction, client, owner, treeRaw, suiRaw, tickLower, tickUpper });
const simulation = await client.core.simulateTransaction({ transaction: tx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(simulation)) throw new Error(`V3 create-position simulation failed: ${JSON.stringify(simulation?.effects?.status ?? null)}`);
const event = extractAddLiquidityEvent(simulation);
if (!event || event.treeRaw <= 0n || event.suiRaw <= 0n || event.liquidityRaw <= 0n) throw new Error('Simulation returned no positive add-liquidity event.');
console.log(JSON.stringify({ classification: 'TREE_V3_CREATE_POSITION_SIMULATION_VALID', poolVerified: true, tokenOrder: ['SUI','TREE'], tickSpacing: TREE_V3_TICK_SPACING, tickLower, tickUpper, requestedTreeRaw: treeRaw.toString(), requestedSuiRaw: suiRaw.toString(), depositedTreeRaw: event.treeRaw.toString(), depositedSuiRaw: event.suiRaw.toString(), liquidityRaw: event.liquidityRaw.toString(), signed: false, submitted: false }, null, 2));
