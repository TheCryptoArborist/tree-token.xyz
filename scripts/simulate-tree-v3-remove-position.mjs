import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  SUI_COIN_TYPE, TREE_DECIMALS, SUI_DECIMALS, SUIDEX_V3_POOL, TREE_V3_TICK_SPACING,
  minimumAfterSlippage, buildRemoveTreeV3Position, extractRemoveLiquidityEvent, simulationSucceeded,
} from '../dapp/v3-transaction-core.js';

const owner = process.argv[2];
const positionId = process.argv[3];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '') || !/^0x[0-9a-f]{64}$/i.test(positionId || '')) {
  throw new Error('Usage: node scripts/simulate-tree-v3-remove-position.mjs <owner> <position-id>');
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
  || normalizeCoinType(pool.type_y) !== normalizeCoinType('0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE')
  || Number(pool.tick_spacing) !== TREE_V3_TICK_SPACING || Number(pool.swap_fee_rate) !== 2500) {
  throw new Error('Live V3 pool verification failed.');
}

const response = await fetch(`https://deploy-preview-16--tree-token.netlify.app/api/tree-v3-overview?owner=${encodeURIComponent(owner)}`);
const overview = await response.json();
const position = overview?.positions?.find((item) => item.objectId?.toLowerCase() === positionId.toLowerCase());
if (!position) throw new Error('Verified owner position was not found.');
const totalLiquidityRaw = BigInt(position.liquidityRaw);
const liquidityRaw = totalLiquidityRaw / 10n;
if (liquidityRaw <= 0n) throw new Error('Position liquidity is too small for the 10% review simulation.');

const preliminaryTx = buildRemoveTreeV3Position({ Transaction, owner, positionId, liquidityRaw });
const preliminarySimulation = await client.core.simulateTransaction({ transaction: preliminaryTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(preliminarySimulation)) throw new Error('Preliminary V3 removal simulation failed.');
const preliminary = extractRemoveLiquidityEvent(preliminarySimulation, positionId);
if (!preliminary || preliminary.liquidityRaw !== liquidityRaw) throw new Error('Preliminary V3 removal returned no exact verified event.');
const minSuiRaw = minimumAfterSlippage(preliminary.suiRaw, 50);
const minTreeRaw = minimumAfterSlippage(preliminary.treeRaw, 50);
const finalTx = buildRemoveTreeV3Position({ Transaction, owner, positionId, liquidityRaw, minSuiRaw, minTreeRaw });
const finalSimulation = await client.core.simulateTransaction({ transaction: finalTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
const protectedRemoval = extractRemoveLiquidityEvent(finalSimulation, positionId);
if (!simulationSucceeded(finalSimulation) || !protectedRemoval || protectedRemoval.liquidityRaw !== liquidityRaw) throw new Error('Protected V3 removal simulation failed.');

console.log(JSON.stringify({
  classification: 'TREE_V3_REMOVE_POSITION_SIMULATION_VALID', owner, positionId,
  percentage: 10, totalLiquidityRaw: totalLiquidityRaw.toString(), liquidityRemovedRaw: liquidityRaw.toString(),
  receivedSuiRaw: preliminary.suiRaw.toString(), receivedTreeRaw: preliminary.treeRaw.toString(),
  receivedSui: Number(preliminary.suiRaw) / 10 ** SUI_DECIMALS,
  receivedTree: Number(preliminary.treeRaw) / 10 ** TREE_DECIMALS,
  minSuiRaw: minSuiRaw.toString(), minTreeRaw: minTreeRaw.toString(), signed: false, submitted: false,
}, null, 2));
