import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadOnlyTransport } from './client.mjs';
for (const [service, name] of [['TransactionExecutionService', 'ExecuteTransaction'], ['TransactionExecutionService', 'SimulateTransaction'],
  ['StateService', 'GetBalance'], ['LedgerService', 'BatchGetTransactions']]) {
  test('transport rejects ' + name + ' before network', () => {
    const t = new ReadOnlyTransport();
    assert.throws(() => t.unary({ service: { typeName: 'sui.rpc.v2.' + service }, name }, {}, {}), /not-readonly/);
  });
}
test('all streaming surfaces are disabled', () => {
  const t = new ReadOnlyTransport();
  for (const method of ['serverStreaming', 'clientStreaming', 'duplex']) assert.throws(() => t[method](), /streaming-disabled/);
});
