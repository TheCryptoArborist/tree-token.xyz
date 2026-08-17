import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const wallet = await readFile('scripts/wallet.js', 'utf8');
const swap = await readFile('dapp/swap-router.js', 'utf8');
for (const source of [wallet, swap]) {
  assert.equal(source.includes('@mysten/sui@1.43.0'), false);
  assert.equal(source.includes('dryRunTransactionBlock'), false);
  assert.equal(source.includes('waitForTransactionBlock'), false);
}
assert.equal(wallet.includes('SuiGrpcClient'), true);
assert.equal(wallet.includes('walletSignAndExecuteTransaction'), true);
assert.equal(wallet.includes('.core.getBalance'), true);
assert.equal(swap.includes('SuiGrpcClient'), true);
assert.equal(swap.includes('.core.getBalance'), true);
assert.equal(swap.includes('.core.listCoins'), true);
assert.equal(swap.includes('.core.simulateTransaction'), true);
assert.equal(swap.includes('.core.waitForTransaction'), true);
assert.equal(swap.includes('result?.FailedTransaction'), true);
console.log('Sui gRPC client migration: PASS');
