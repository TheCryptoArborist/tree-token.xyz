import assert from 'node:assert/strict';
import { coinForAmount, VICTORY_TYPE } from '../dapp/earn-transactions-core.js';

// Set SUI_TRANSACTION_MODULE to also exercise the browser's pinned SDK version.
const { Transaction } = await import(process.env.SUI_TRANSACTION_MODULE || '@mysten/sui/transactions');
const owner = `0x${'1'.repeat(64)}`;
const amount = 600_000_000_000n;
const available = 616_934_117_238n;
for (const coinRaw of [0n, 597_457_783_698n]) {
  const client = { core: {
    getBalance: async () => ({ balance: {
      coinType: VICTORY_TYPE, balance: String(available),
      coinBalance: String(coinRaw), addressBalance: String(available - coinRaw),
    } }),
    listCoins: async () => ({
      objects: coinRaw ? [{ objectId: `0x${'2'.repeat(64)}`, balance: String(coinRaw), version: '1', digest: '11111111111111111111111111111111' }] : [],
      hasNextPage: false, cursor: null,
    }),
  } };
  const tx = new Transaction();
  tx.setSender(owner);
  const coin = await coinForAmount(tx, client, owner, VICTORY_TYPE, amount);
  tx.transferObjects([coin], owner);
  await tx.prepareForSerialization({ client });
  const data = tx.getData();
  assert.equal(data.commands.some((c) => c.$Intent), false);
  const withdrawals = data.inputs.filter((input) => input.FundsWithdrawal);
  assert.equal(withdrawals.length, 1);
  assert.equal(withdrawals[0].FundsWithdrawal.reservation.MaxAmountU64, String(amount - coinRaw));
  assert.equal(withdrawals[0].FundsWithdrawal.typeArg.Balance, VICTORY_TYPE);
  assert.equal(withdrawals[0].FundsWithdrawal.withdrawFrom.$kind, 'Sender');
  assert.ok(data.commands.some((c) => c.MoveCall?.module === 'coin' && c.MoveCall.function === 'redeem_funds'));
}
console.log('VICTORY address funding: SDK resolves exact raw funding from address-only and mixed balances.');
