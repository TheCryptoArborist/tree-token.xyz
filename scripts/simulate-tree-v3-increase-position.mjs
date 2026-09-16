import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  TREE_COIN_TYPE, SUI_COIN_TYPE, TREE_DECIMALS, SUI_DECIMALS, SUIDEX_V3_POOL, TREE_V3_TICK_SPACING,
  decimalToRaw, minimumAfterSlippage,
  buildIncreaseTreeV3Position, extractAddLiquidityEvent, simulationSucceeded,
} from '../dapp/v3-transaction-core.js';

const owner = process.argv[2];
const positionId = process.argv[3];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '') || !/^0x[0-9a-f]{64}$/i.test(positionId || '')) {
  throw new Error('Usage: node scripts/simulate-tree-v3-increase-position.mjs <owner> <position-id>');
}

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const { object: poolObject } = await client.core.getObject({ objectId: SUIDEX_V3_POOL, include: { json: true } });
const pool = poolObject?.json;
const normalizeCoinType = (value) => {
  const [address, module, name] = String(value || '').toLowerCase().split('::');
  const compact = address?.replace(/^0x/, '').replace(/^0+/, '') || '0';
  return module && name ? `0x${compact}::${module}::${name}` : null;
};
if (!pool || normalizeCoinType(pool.type_x) !== normalizeCoinType(SUI_COIN_TYPE)
  || normalizeCoinType(pool.type_y) !== normalizeCoinType(TREE_COIN_TYPE)
  || Number(pool.tick_spacing) !== TREE_V3_TICK_SPACING || Number(pool.swap_fee_rate) !== 2500) {
  throw new Error('Live V3 pool verification failed.');
}
const sqrtPrice = BigInt(pool.sqrt_price);
const scale = 10n ** 18n;
const price = Number(((1n << 128n) * 10n ** BigInt(TREE_DECIMALS) * scale)
  / (sqrtPrice * sqrtPrice * 10n ** BigInt(SUI_DECIMALS))) / 1e18;
if (!(price > 0)) throw new Error('Live V3 price is unavailable.');

const suiRaw = decimalToRaw('0.001', SUI_DECIMALS);
const treeAmount = Math.ceil((0.001 / price) * 1_000_000) / 1_000_000;
const treeRaw = decimalToRaw(String(treeAmount), TREE_DECIMALS);
const preliminaryTx = await buildIncreaseTreeV3Position({ Transaction, client, owner, positionId, treeRaw, suiRaw });
const preliminarySimulation = await client.core.simulateTransaction({ transaction: preliminaryTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(preliminarySimulation)) throw new Error('Preliminary V3 increase simulation failed.');
const preliminary = extractAddLiquidityEvent(preliminarySimulation, positionId);
if (!preliminary) throw new Error('Preliminary V3 increase returned no verified add-liquidity event.');
const minSuiRaw = minimumAfterSlippage(preliminary.suiRaw, 50);
const minTreeRaw = minimumAfterSlippage(preliminary.treeRaw, 50);
const finalTx = await buildIncreaseTreeV3Position({ Transaction, client, owner, positionId, treeRaw, suiRaw, minSuiRaw, minTreeRaw });
const finalSimulation = await client.core.simulateTransaction({ transaction: finalTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(finalSimulation) || !extractAddLiquidityEvent(finalSimulation, positionId)) throw new Error('Protected V3 increase simulation failed.');

console.log(JSON.stringify({
  classification: 'TREE_V3_INCREASE_POSITION_SIMULATION_VALID',
  owner,
  positionId,
  requestedSuiRaw: suiRaw.toString(),
  requestedTreeRaw: treeRaw.toString(),
  depositedSuiRaw: preliminary.suiRaw.toString(),
  depositedTreeRaw: preliminary.treeRaw.toString(),
  liquidityAddedRaw: preliminary.liquidityRaw.toString(),
  minSuiRaw: minSuiRaw.toString(),
  minTreeRaw: minTreeRaw.toString(),
  signed: false,
  submitted: false,
}, null, 2));
