import test from 'node:test';
import assert from 'node:assert/strict';
import { suiReviewAddress, commandCenterHost } from '../gateway/review-core.js';
import { simulationInput, simulationTransaction, simulationSummary } from '../netlify/lib/gateway-simulation.ts';
import { SUI, TREE } from '../gateway/options.js';
import { TURBOS_SUI_TREE_POOL, TURBOS_SUI_TREE_FEE_TYPE } from '../netlify/lib/tree-swap-route.ts';
const address = '0x' + 'a'.repeat(64);
const route = { type: 'direct', venue: 'turbos', executionKind: 'turbos-direct', pairId: TURBOS_SUI_TREE_POOL, tokenIn: SUI, tokenOut: TREE, amountIn: '1000000000', amountOut: '100000000', minAmountOut: '99000000', coinAType: TREE, coinBType: SUI, feeType: TURBOS_SUI_TREE_FEE_TYPE, aToB: false, nextTickIndex: 1, priceImpactPercent: 1, feePercent: 1 };
test('Sui review requires an actual connected valid nonzero address, not cached state', () => {
  assert.equal(suiReviewAddress({ connected: true, address }), address);
  for (const input of [{ address }, { connected: false, address }, { connected: true, address: '0x1' }, { connected: true, address: '0x' + '0'.repeat(64) }]) assert.equal(suiReviewAddress(input), '');
});
test('embedded wallet access only uses the exact same-origin Command Center frame', () => {
  const frame = {};
  const parent = { location: { origin: 'https://preview', pathname: '/dapp/' }, document: { querySelector: () => frame } };
  const win = { parent, location: { origin: 'https://preview' }, frameElement: frame };
  assert.equal(commandCenterHost(win), parent);
  assert.equal(commandCenterHost({ ...win, frameElement: {} }), null);
  assert.equal(commandCenterHost({ ...win, location: { origin: 'https://elsewhere' } }), null);
  parent.document.querySelector = selector => selector === '#tree-gateway-bridge iframe' ? frame : null;
  assert.equal(commandCenterHost(win), parent);
  assert.equal(commandCenterHost({ ...win, frameElement: null }), null);
  parent.location.pathname = '/other';
  assert.equal(commandCenterHost(win), null);
  assert.equal(commandCenterHost({ get parent() { throw Error('Cross-origin'); } }), null);
});
test('simulation input cannot supply transaction bytes, recipients, RPCs or excessive amounts', () => {
  assert.equal(simulationInput({ address, amount: '1.000000001' }).raw, '1000000001');
  for (const extra of [{ transaction: 'bytes' }, { recipient: address }, { rpc: 'https://other' }]) assert.throws(() => simulationInput({ address, amount: '1', ...extra }));
  for (const amount of ['0', '1001', '1e2', '0.0000000001']) assert.throws(() => simulationInput({ address, amount }));
});
test('simulation transaction restricts pool and direction and never sets a signing gas configuration', () => {
  const tx = simulationTransaction(address, '1000000000', route).getData();
  assert.equal(tx.sender, address);
  assert.equal(tx.gasData.budget, null);
  assert.equal(tx.gasData.payment, null);
  assert.deepEqual(tx.commands.map(c => c.$kind), ['SplitCoins', 'MakeMoveVec', 'MoveCall']);
  assert.equal(tx.commands[2].MoveCall.function, 'swap_b_a');
  assert.equal(tx.commands[2].MoveCall.module, 'swap_router');
  for (const change of [{ pairId: '0xbad' }, { aToB: true }, { minAmountOut: '90000000' }, { tokenIn: TREE, tokenOut: SUI }]) assert.throws(() => simulationTransaction(address, '1000000000', { ...route, ...change }));
});
test('passing simulation requires success, minimum TREE at the selected address and gas effects', () => {
  const result = { $kind: 'Transaction', Transaction: { effects: { status: { success: true }, gasUsed: { computationCost: '1000000', storageCost: '300000', storageRebate: '100000' } }, balanceChanges: [{ address, coinType: TREE, amount: '100000000' }], digest: 'not-a-submitted-transaction' } };
  const summary = simulationSummary(result, address, '1', '99000000');
  assert.equal(summary.netGasSui, '0.001200000');
  assert.equal(summary.receivedTree, '100.000000');
  assert.equal(summary.signed, false); assert.equal(summary.submitted, false); assert.equal(summary.bridgeSimulated, false);
  assert.equal('digest' in summary, false);
  for (const mutate of [r => r.$kind = 'FailedTransaction', r => r.Transaction.effects.status.success = false, r => r.Transaction.balanceChanges[0].address = '0x1', r => r.Transaction.balanceChanges[0].amount = '1', r => delete r.Transaction.effects.gasUsed]) {
    const copy = structuredClone(result); mutate(copy); assert.throws(() => simulationSummary(copy, address, '1', '99000000'));
  }
});
import { createSimulationHandler } from '../netlify/preview-functions/tree-gateway-simulate.ts';
test('simulation endpoint requires real gas selection and rejects failed simulation without transaction payloads', async () => {
  let calls = 0;
  const handler = createSimulationHandler(async request => { assert.equal(request.amountIn, '1000000000'); assert.equal(request.tokenOut, TREE); return route; }, async options => {
    calls++;
    assert.equal(options.checksEnabled, true);
    assert.equal(options.doGasSelection, true);
    assert.equal(options.transaction.getData().sender, address);
    return { $kind: 'FailedTransaction', FailedTransaction: { status: { error: 'private details' } } };
  });
  const response = await handler(new Request('https://preview/api/tree-gateway-simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, amount: '1' }) }));
  const body = await response.json();
  assert.equal(response.status, 422); assert.equal(calls, 1);
  assert.equal(body.signed, false); assert.equal(body.submitted, false);
  assert.equal(JSON.stringify(body).includes('private details'), false);
});
test('simulation endpoint rejects unsupported methods and input before calling any provider', async () => {
  const handler = createSimulationHandler(async () => { throw Error('Must not call provider'); }, async () => { throw Error('Must not simulate'); });
  assert.equal((await handler(new Request('https://preview/api/tree-gateway-simulate'))).status, 405);
  assert.equal((await handler(new Request('https://preview/api/tree-gateway-simulate', { method:'POST', body:'text' }))).status, 415);
  const response = await handler(new Request('https://preview/api/tree-gateway-simulate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({address,amount:'1',recipient:'0x1'}) }));
  assert.equal(response.status, 400);
});
