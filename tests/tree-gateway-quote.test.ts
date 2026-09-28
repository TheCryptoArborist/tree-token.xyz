import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { summarizeQuote } from '../netlify/preview-functions/tree-gateway-quote.ts';
import { SOURCES, SUI, TREE, amountToRaw } from '../gateway/options.js';
const now = Date.now();
const quote = { fromChain: 'base', toChain: 'sui', fromToken: { contract: SOURCES.base.USDC[0] }, toToken: { contract: SUI, symbol: 'SUI' }, expectedAmountOut: 85, minAmountOut: 84, deadline64: String(Math.floor(now / 1000) + 600), referrerBps: 0, type: 'MCTP', clientEta: '20 min' };
test('amounts remain exact and reject excess precision, zero and overflow', () => {
  assert.equal(amountToRaw('0.123456789123456789', 18), '123456789123456789');
  for (const v of ['0', '-1', '1e4', '0.0000001', '10000000000']) assert.throws(() => amountToRaw(v, 6));
  assert.throws(() => amountToRaw('100', 18));
});
test('quotes reject wrong identities, stale deadlines, nonpositive output and undisclosed referral fees', () => {
  const valid = summarizeQuote(quote, 'base', SOURCES.base.USDC[0], SUI, now);
  assert.equal(valid.expiresAt, now + 30_000);
  for (const change of [{ toChain: 'ethereum' }, { fromChain: 'solana' }, { toToken: { contract: TREE } }, { fromToken: { contract: 'bad' } }, { deadline64: '0' }, { expectedAmountOut: 0 }, { minAmountOut: 86 }, { referrerBps: 25 }]) assert.equal(summarizeQuote({ ...quote, ...change }, 'base', SOURCES.base.USDC[0], SUI, now), null);
});
test('preview rejects writes and unsupported inputs without contacting Mayan', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('Unexpected fetch'); };
  try {
    assert.equal((await handler(new Request('https://preview/api/tree-gateway-quote', { method: 'POST' }))).status, 405);
    for (const chain of ['bsc', '__proto__', 'constructor']) assert.equal((await handler(new Request(`https://preview/api/tree-gateway-quote?chain=${chain}&asset=USDC&amount=100`))).status, 400);
  } finally { globalThis.fetch = original; }
});
test('TREE preview quotes only settlement and never returns signatures or transaction material', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    const params = new URL(String(url)).searchParams;
    assert.equal(params.get('amountIn64'), '100000000');
    assert.equal(params.get('toToken'), SUI);
    assert.equal(params.get('referrerBps'), '0');
    assert.equal(params.get('sdkVersion'), '15_2_2');
    return Response.json({ quotes: [{ ...quote, signature: 'not-for-client' }] });
  };
  try {
    const response = await handler(new Request(`https://preview/api/tree-gateway-quote?chain=base&asset=USDC&amount=100&destination=${encodeURIComponent(TREE)}`));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.requiresTreeSwap, true);
    assert.equal(body.executionEnabled, false);
    assert.equal(body.gatewayFeeIncluded, false);
    assert.equal(body.quotes.length, 1);
    assert.equal(body.quotes[0].signature, undefined);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { globalThis.fetch = original; }
});
