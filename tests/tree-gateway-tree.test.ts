import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTree, estimateTree } from '../netlify/lib/gateway-tree-estimate.ts';
import handler from '../netlify/preview-functions/tree-gateway-quote.ts';
import { SUI, USDC, TREE, SOURCES } from '../gateway/options.js';
const now = Date.now();
function fixture(raw = '1234567891') {
  return { status: 'ok', tokenIn: SUI, tokenOut: TREE, amountIn: raw, decimalsIn: 9, decimalsOut: 6, slippageBps: 100,
    generatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 30_000).toISOString(),
    selectedRoute: { type: 'direct', venue: 'turbos', pairId: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee', tokenIn: SUI, tokenOut: TREE, amountIn: raw, amountOut: '9007199254740993', minAmountOut: '8907199254740993', priceImpactPercent: 1.2, feePercent: 1, transaction: 'never-return' } };
}
test('TREE amounts retain raw precision, expiry is bounded, transaction data is stripped', () => {
  const result = summarizeTree(fixture(), '1234567891', now + 15_000, now);
  assert.equal(result.expectedAmountOut, '9007199254.740993');
  assert.equal(result.inputAmount, '1.234567891');
  assert.equal(result.expiresAt, now + 15_000);
  assert.equal(JSON.stringify(result).includes('never-return'), false);
});
test('TREE rejects stale data, wrong pair/input/pool/decimals and invalid financial fields', () => {
  for (const change of [
    q => q.tokenOut = USDC, q => q.decimalsOut = 9, q => q.amountIn = '1',
    q => q.selectedRoute.tokenIn = USDC, q => q.selectedRoute.amountIn = '1',
    q => q.selectedRoute.pairId = 'bad', q => q.selectedRoute.venue = '__proto__',
    q => q.generatedAt = new Date(now - 40_000).toISOString(),
    q => q.expiresAt = new Date(now - 1).toISOString(),
    q => q.selectedRoute.minAmountOut = '9999999999999999',
    q => q.selectedRoute.amountOut = '1e9', q => q.selectedRoute.priceImpactPercent = NaN,
    q => q.selectedRoute.feePercent = -1,
  ]) { const q = fixture(); change(q); assert.throws(() => summarizeTree(q, '1234567891', now + 30_000, now)); }
});
test('unsupported settlement and failed TREE service do not masquerade as complete quotes', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('private upstream failure'); };
  try {
    assert.equal((await estimateTree(USDC, {})).status, 'unsupported');
    assert.equal(calls, 0);
    assert.equal((await estimateTree(SUI, { minAmountOut: '1', expiresAt: now + 30_000 })).status, 'unavailable');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test('Gateway feeds exact bridge minimum into fixed read-only TREE service', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    const parsed = new URL(String(url));
    if (calls === 1) return Response.json({ quotes: [{ fromChain: 'base', toChain: 'sui', fromToken: { contract: SOURCES.base.USDC[0] }, toToken: { contract: SUI, symbol: 'SUI' }, expectedAmountOut: '1.3', minAmountOut: '1.234567891', deadline64: String(Math.floor(now / 1000) + 600), referrerBps: 0, type: 'MCTP' }] });
    assert.equal(parsed.origin + parsed.pathname, 'https://tree-token.xyz/api/tree-swap-quote');
    assert.equal(parsed.searchParams.get('amountIn'), '1234567891');
    assert.equal(parsed.searchParams.get('tokenOut'), TREE);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    return Response.json(fixture());
  };
  try {
    const body = await (await handler(new Request('https://preview/api/tree-gateway-quote?chain=base&asset=USDC&amount=100'))).json();
    assert.equal(calls, 2);
    assert.equal(body.treeSwap.status, 'ok');
    assert.equal(body.indicativeOnly, true);
    assert.equal(body.executionEnabled, false);
    assert.equal(body.gatewayFeeIncluded, false);
  } finally { globalThis.fetch = original; }
});
