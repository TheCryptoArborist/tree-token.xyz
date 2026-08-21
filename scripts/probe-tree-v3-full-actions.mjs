import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  buildClaimAllTreeV3Position,
  buildWithdrawAllAndCloseTreeV3Position,
  extractFeeCollectedEvent,
  extractRemoveLiquidityEvent,
  extractRewardCollectedEvents,
  positionDeleted,
  simulationSucceeded,
} from '../dapp/v3-transaction-core.js';

const owner = process.argv[2];
const positionId = process.argv[3];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '') || !/^0x[0-9a-f]{64}$/i.test(positionId || '')) {
  throw new Error('Usage: node scripts/probe-tree-v3-full-actions.mjs <owner> <position-id>');
}

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const objectResult = await client.core.getObject({ objectId: positionId, include: { json: true, owner: true } });
const position = objectResult.object;
const liquidityRaw = BigInt(position?.json?.liquidity ?? 0);
if (liquidityRaw <= 0n) throw new Error('The selected position has no removable liquidity.');

const include = { effects: true, events: true, balanceChanges: true, commandResults: true };
const claimTransaction = buildClaimAllTreeV3Position({ Transaction, owner, positionId });
const claimSimulation = await client.core.simulateTransaction({ transaction: claimTransaction, checksEnabled: true, include });
const exitTransaction = buildWithdrawAllAndCloseTreeV3Position({ Transaction, owner, positionId, liquidityRaw });
const exitSimulation = await client.core.simulateTransaction({ transaction: exitTransaction, checksEnabled: true, include });

console.log(JSON.stringify({
  owner,
  positionId,
  liquidityRaw,
  claimAll: {
    success: simulationSucceeded(claimSimulation),
    fees: extractFeeCollectedEvent(claimSimulation, positionId),
    rewards: extractRewardCollectedEvents(claimSimulation, positionId),
  },
  withdrawAllAndClose: {
    success: simulationSucceeded(exitSimulation),
    removal: extractRemoveLiquidityEvent(exitSimulation, positionId),
    fees: extractFeeCollectedEvent(exitSimulation, positionId),
    rewards: extractRewardCollectedEvents(exitSimulation, positionId),
    positionDeleted: positionDeleted(exitSimulation, positionId),
  },
  signed: false,
  submitted: false,
}, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
