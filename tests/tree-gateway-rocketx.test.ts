import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { summarizeRocketX } from '../netlify/preview-functions/tree-gateway-rocketx.ts';

function fixture() { return {
  fromTokenInfo: { chainId: '0x38', token_symbol: 'BNB', is_native_token: 1 },
  toTokenInfo: { chainId: 'sui-mainnet', token_symbol: 'SUI', is_native_token: 1, contract_address: '0x' + '2'.padStart(64, '0') },
  fromAmount: '0.1', toAmount: '60', isTxnAllowed: true,
  exchangeInfo: { title: 'Example', exchange_type: 'CEX', walletLess: true },
  platformFeeUsd: 0.3, platformFeeInPercent: 0.4, gasFeeUsd: 0.08, estTimeInSeconds: { avg: 120 },
  transaction: { data: 'must-not-return' }, rateId: 'must-not-return',
}; }
test('quote validates native assets and discards executable fields', () => {
  const q = summarizeRocketX(fixture(), 'bsc', '0.1');
  assert.equal(q?.expectedAmountOut, '60'); assert.equal(q?.minAmountOut, null);
  assert.equal(q?.walletless, true); assert(!JSON.stringify(q).includes('must-not-return'));
  for (const mutate of [q => q.toTokenInfo.chainId = '0x38', q => q.toTokenInfo.contract_address = '0x3', q => q.fromAmount = '0.2', q => q.toAmount = '-1', q => q.isTxnAllowed = false, q => q.fromTokenInfo.is_native_token = 0]) {
    const q = fixture(); mutate(q); assert.equal(summarizeRocketX(q, 'bsc', '0.1'), null);
  }
});
test('endpoint is GET-only, validates inputs, strips secrets and distinguishes authentication errors', async () => {
  const originalFetch = globalThis.fetch; const originalNetlify = globalThis.Netlify;
  try {
    globalThis.Netlify = { env: { get: () => 'test-secret-never-return' } };
    globalThis.fetch = async () => { throw Error('unexpected fetch'); };
    assert.equal((await handler(new Request('https://preview/api?chain=bsc&amount=0.1', { method: 'POST' }))).status, 405);
    assert.equal((await handler(new Request('https://preview/api?chain=bad&amount=0.1'))).status, 400);
    assert.equal((await handler(new Request('https://preview/api?chain=bsc&amount=0'))).status, 400);
    globalThis.fetch = async (url, options) => {
      const u = new URL(url); assert.equal(u.origin, 'https://api.rocketx.exchange'); assert.equal(u.pathname, '/v1/quotation');
      assert.equal(u.searchParams.get('fromNetwork'), 'binance'); assert.equal(u.searchParams.get('toNetwork'), 'Sui Mainnet');
      assert.equal(options.headers['x-api-key'], 'test-secret-never-return'); assert.equal(options.redirect, 'error');
      return Response.json({ quotes: [fixture()], secret: 'test-secret-never-return' });
    };
    const result = await handler(new Request('https://preview/api?chain=bsc&amount=0.1'));
    const body = await result.json(); assert.equal(body.status, 'ok'); assert.equal(body.executionEnabled, false);
    assert(!JSON.stringify(body).includes('test-secret-never-return'));
    globalThis.fetch = async () => Response.json({ err: 'test-secret-never-return', code: 401 });
    const failed = await handler(new Request('https://preview/api?chain=bsc&amount=0.1'));
    assert.equal(failed.status, 502); assert(!(await failed.text()).includes('test-secret-never-return'));
    globalThis.Netlify.env.get = () => undefined;
    assert.equal((await handler(new Request('https://preview/api?chain=bsc&amount=0.1'))).status, 503);
  } finally { globalThis.fetch = originalFetch; globalThis.Netlify = originalNetlify; }
});
