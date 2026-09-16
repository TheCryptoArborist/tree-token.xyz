import { Transaction } from '@mysten/sui/transactions';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { V2_POOL, VICTORY_SUI_POOL, extractPositiveV2Lp, quoteVictoryV2Reinvest } from '../dapp/earn-transactions-core.js';
import { buildVictoryV2SustainableReinvestTransaction, extractVictoryLockEvent, extractVictoryLocked } from '../dapp/victory-transaction-core.js';

const owner = process.argv[2]; const totalAmount = BigInt(process.argv[3] || '100000000');
if (!/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Pass a public Sui owner address as the first argument.');
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const objectJson = (result) => result?.object?.json ?? result?.json ?? null;
const [victoryPool, treePool] = await Promise.all([
  client.core.getObject({ objectId: VICTORY_SUI_POOL, include: { json: true } }),
  client.core.getObject({ objectId: V2_POOL, include: { json: true } }),
]);
const reinvestRaw = totalAmount / 2n;
const quote = quoteVictoryV2Reinvest({ victorySuiPoolJson: objectJson(victoryPool), suiTreePoolJson: objectJson(treePool), amountIn: reinvestRaw, slippageBps: 100 });
const built = await buildVictoryV2SustainableReinvestTransaction({ Transaction, client, owner, totalAmount, reinvestBps: 5_000, lockDays: 90, quote, slippageBps: 100 });
const simulation = await client.core.simulateTransaction({ transaction: built.transaction, checksEnabled: true, include: { effects: true, balanceChanges: true, events: true } });
const result = simulation?.$kind === 'Transaction' ? simulation.Transaction : simulation?.Transaction || simulation;
if (result?.effects?.status?.success !== true && result?.status?.success !== true) throw new Error(result?.effects?.status?.error?.message || result?.status?.error?.message || 'Mainnet simulation failed.');
const lock = extractVictoryLockEvent(simulation, owner, { amountRaw: built.lockRaw, lockDays: built.lockDays });
const summary = {
  submitted: false, success: true, totalVictoryRaw: built.totalRaw.toString(), reinvestVictoryRaw: built.reinvestRaw.toString(), lockedVictoryRaw: built.lockRaw.toString(),
  verifiedVictorySpendRaw: extractVictoryLocked(simulation, owner).toString(), positiveLpRaw: extractPositiveV2Lp(simulation, owner).toString(),
  lock: lock ? { id: lock.lockId.toString(), amountRaw: lock.amountRaw.toString(), days: lock.lockDays, end: lock.lockEnd.toString() } : null,
};
if (summary.verifiedVictorySpendRaw !== summary.totalVictoryRaw || summary.positiveLpRaw === '0' || !summary.lock) throw new Error('Simulation completed without the required split, lock, or LP evidence.');
console.log(JSON.stringify(summary, null, 2));
