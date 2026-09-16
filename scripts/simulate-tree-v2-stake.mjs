import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  buildV2StakeTransaction,
  getV2FarmPosition,
  getV2LpBalance,
} from '../dapp/earn-transactions-core.js';

const owner = process.argv[2];
if (!/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Usage: node scripts/simulate-tree-v2-stake.mjs <owner>');

const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const [amount, existingPosition] = await Promise.all([
  getV2LpBalance(client, owner),
  getV2FarmPosition(client, owner),
]);
if (amount <= 0n) throw new Error('No unstaked SUI/TREE V2 LP is available in this wallet.');

const transaction = await buildV2StakeTransaction({ Transaction, client, owner, amount });
const bytes = await transaction.build({ client });
for (let pass = 1; pass <= 2; pass += 1) {
  const result = await client.core.simulateTransaction({
    transaction: bytes,
    checksEnabled: true,
    include: { effects: true, balanceChanges: true, events: true },
  });
  const core = result?.$kind === 'Transaction' ? result.Transaction : result?.Transaction;
  if (core?.effects?.status?.success !== true) {
    const error = result?.FailedTransaction?.status?.error?.message
      || result?.FailedTransaction?.status?.error
      || core?.effects?.status?.error?.message
      || core?.effects?.status?.error
      || `Simulation ${pass} failed.`;
    throw new Error(String(error));
  }
}

console.log(JSON.stringify({
  classification: existingPosition ? 'TREE_V2_ADD_TO_POSITION_SIMULATION_VALID' : 'TREE_V2_NEW_STAKE_SIMULATION_VALID',
  owner,
  amountRaw: amount.toString(),
  existingPosition,
  simulations: 2,
  signed: false,
  submitted: false,
}, null, 2));
