import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { buildCollectTreeV3Rewards, extractRewardCollectedEvents, simulationSucceeded } from '../dapp/v3-transaction-core.js';

const owner = process.argv[2];
const positionId = process.argv[3];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '') || !/^0x[0-9a-f]{64}$/i.test(positionId || '')) {
  throw new Error('Usage: node scripts/probe-tree-v3-collect-rewards.mjs <owner> <position-id>');
}
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const preliminaryTx = buildCollectTreeV3Rewards({ Transaction, owner, positionId });
const preliminarySimulation = await client.core.simulateTransaction({ transaction: preliminaryTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
if (!simulationSucceeded(preliminarySimulation)) throw new Error('Preliminary reward simulation failed.');
const preliminary = extractRewardCollectedEvents(preliminarySimulation, positionId);
const positiveRewards = preliminary.filter((reward) => reward.amountRaw > 0n);
if (!positiveRewards.length) throw new Error('No positive reward was available for optimized simulation.');
const rewardCoinTypes = positiveRewards.map((reward) => reward.coinType);
const finalTx = buildCollectTreeV3Rewards({ Transaction, owner, positionId, rewardCoinTypes });
const finalSimulation = await client.core.simulateTransaction({ transaction: finalTx, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
const verified = extractRewardCollectedEvents(finalSimulation, positionId);
if (!simulationSucceeded(finalSimulation) || verified.length !== rewardCoinTypes.length || verified.some((reward) => reward.amountRaw <= 0n)) throw new Error('Optimized reward simulation failed.');
console.log(JSON.stringify({
  classification: 'TREE_V3_REWARD_CLAIM_SIMULATION_VALID', owner, positionId,
  preliminaryRewards: preliminary, optimizedRewards: verified,
  moveCallCount: rewardCoinTypes.length, signed: false, submitted: false,
}, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
