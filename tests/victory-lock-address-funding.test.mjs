import assert from 'node:assert/strict';
import { VICTORY_TYPE, quoteVictoryV2Reinvest } from '../dapp/earn-transactions-core.js';
import { buildVictoryLockTransaction, buildVictoryV2SustainableReinvestTransaction } from '../dapp/victory-transaction-core.js';
const { Transaction } = await import(process.env.SUI_TRANSACTION_MODULE || '@mysten/sui/transactions');
const owner = `0x${'1'.repeat(64)}`;
const total = 312_508_861_869n;
function clientFor(coinRaw, available = total) {
  return { core: {
    getBalance: async () => ({ balance: { coinType: VICTORY_TYPE, balance: String(available), coinBalance: String(coinRaw), addressBalance: String(available - coinRaw) } }),
    listCoins: async () => ({ objects: coinRaw ? [{ objectId: `0x${'2'.repeat(64)}`, balance: String(coinRaw), version: '1', digest: '11111111111111111111111111111111' }] : [], hasNextPage: false, cursor: null }),
  } };
}
for (const coinRaw of [0n, 286_390_861_534n, total]) {
  const client = clientFor(coinRaw);
  const built = await buildVictoryLockTransaction({ Transaction, client, owner, amount: total, lockDays: 7 });
  assert.equal(built.amountRaw, total);
  assert.equal(built.lockDays, 7);
  const calls = built.transaction.getData().commands.filter(c => c.MoveCall).map(c => c.MoveCall.function);
  assert.deepEqual(calls, ['lock_tokens']);
  // Address funding must resolve exactly the missing raw amount, before building/signing.
  if (coinRaw < total) {
    await built.transaction.prepareForSerialization({ client });
    const withdrawals = built.transaction.getData().inputs.filter(i => i.FundsWithdrawal);
    assert.equal(withdrawals.length, 1);
    assert.equal(withdrawals[0].FundsWithdrawal.reservation.MaxAmountU64, String(total - coinRaw));
    assert.equal(withdrawals[0].FundsWithdrawal.typeArg.Balance, VICTORY_TYPE);
  }
}
await assert.rejects(() => buildVictoryLockTransaction({ Transaction, client: clientFor(286_390_861_534n, total - 1n), owner, amount: total, lockDays: 7 }), /Insufficient VICTORY/);
const reinvestRaw = total * 7500n / 10000n;
const quote = quoteVictoryV2Reinvest({
  victorySuiPoolJson: { reserve0: '4000000000000', reserve1: '17000000000000' },
  suiTreePoolJson: { reserve0: '2000000000000', reserve1: '80000000000000000' }, amountIn: reinvestRaw, slippageBps: 100,
});
const sustainable = await buildVictoryV2SustainableReinvestTransaction({ Transaction, client: clientFor(286_390_861_534n), owner, totalAmount: total, reinvestBps: 7500, lockDays: 7, quote });
assert.equal(sustainable.reinvestRaw, reinvestRaw);
assert.equal(sustainable.lockRaw, total - reinvestRaw);
assert.deepEqual(sustainable.transaction.getData().commands.filter(c => c.MoveCall).map(c => c.MoveCall.function), ['lock_tokens', 'swap_exact_tokens1_for_tokens0_composable', 'swap_exact_tokens0_for_tokens1_composable', 'add_liquidity']);
console.log('VICTORY lock funding: screenshot MAX balance, seven-day term, mixed/address/coin balances, insufficiency and V2 sustainable split pass.');
