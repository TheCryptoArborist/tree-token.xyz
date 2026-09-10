import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { buildCollectTreeV3Fees, simulationSucceeded } from '../dapp/v3-transaction-core.js';

const owner = process.argv[2];
const positionId = process.argv[3];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '') || !/^0x[0-9a-f]{64}$/i.test(positionId || '')) {
  throw new Error('Usage: node scripts/probe-tree-v3-collect-fees.mjs <owner> <position-id>');
}
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const transaction = buildCollectTreeV3Fees({ Transaction, owner, positionId });
const simulation = await client.core.simulateTransaction({ transaction, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } });
const result = simulation.Transaction || simulation.FailedTransaction || simulation;
console.log(JSON.stringify({
  success: simulationSucceeded(simulation),
  status: result.status,
  events: result.events,
  balanceChanges: result.balanceChanges,
  signed: false,
  submitted: false,
}, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
