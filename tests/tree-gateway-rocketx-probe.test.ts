import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { authorizeProbe, runUnfundedProbe } from '../netlify/lib/gateway-rocketx-probe.ts';
const input = { deployId: 'test-deploy', chain: 'bsc', amount: '0.1', sourceAddress: '0x' + '1'.repeat(40), destinationAddress: '0x' + '2'.repeat(64), expiresAt: 2000 };
function memoryStore() {
  const data = new Map();
  return { data, async setJSON(key, value, opts = {}) { if (opts.onlyIfNew && data.has(key)) return { modified: false }; data.set(key, structuredClone(value)); return { modified: true }; }, async get(key) { return data.get(key) || null; } };
}
test('probe requires an intact operator signature bound to a non-production deploy and deadline', async () => {
  const pair = generateKeyPairSync('ed25519');
  const pub = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const data = JSON.stringify(input), signature = sign(null, Buffer.from(data), pair.privateKey).toString('base64');
  const deploy = { context: 'deploy-preview', published: false, id: 'test-deploy' };
  assert.equal(authorizeProbe(data, signature, pub, deploy, 1000).sourceAddress, input.sourceAddress);
  for (const d of [{ ...deploy, published: true }, { ...deploy, context: 'production' }, { ...deploy, id: 'other' }]) assert.throws(() => authorizeProbe(data, signature, pub, d, 1000));
  assert.throws(() => authorizeProbe(data, signature, pub, deploy, 3000));
  assert.throws(() => authorizeProbe(data.replace('0.1', '0.2'), signature, pub, deploy, 1000));
});

test('probe creates once, persists intent before POST, catches fee changes, and returns no deposit instructions', async () => {
  for (const mode of ['ok', 'fee-change', 'provider-type-change', 'timeout']) {
    const store = memoryStore(), calls = [];
    const info = { exchangeInfo: { id: 1, walletLess: true, exchange_type: 'CEX', isRefundAddressRequired: true, memoRequired: false }, fromTokenInfo: { id: 2, chainId: '0x38', token_decimals: 18, token_symbol: 'BNB', contract_address: '0x' + 'e'.repeat(40) }, toTokenInfo: { id: 3, chainId: 'sui-mainnet', token_decimals: 9, token_symbol: 'SUI', contract_address: '0x2' } };
    const order = { ...info, requestId: '11111111-1111-4111-8111-111111111111', swap: { fromAmount: 0.1, partnerFee: mode === 'fee-change' ? 0.6 : 0.4, depositAddress: '0x' + '3'.repeat(40), tx: { from: input.sourceAddress, to: '0x' + '3'.repeat(40), data: null, memo: null, value: '0x16345785d8a0000' } } };
    const fetcher = async (url, opts) => {
      calls.push(url);
      assert.equal(new URL(url).origin, 'https://api.rocketx.exchange');
      if (url.includes('/quotation?')) return Response.json({ quotes: [{ ...info, fromAmount: 0.1, toAmount: 60, platformFeeInPercent: 0.4, isTxnAllowed: true }] });
      if (url.endsWith('/swap')) {
        assert.ok(store.data.has('intent'));
        assert.equal(store.data.get('attempt').phase, 'creation-started');
        assert.equal(opts.method, 'POST');
        assert.equal(JSON.parse(opts.body).fee, 0.4);
        if (mode === 'timeout') throw Error('timeout');
        if (mode === 'provider-type-change') order.exchangeInfo = { ...order.exchangeInfo, exchange_type: 'DEX' };
        return Response.json(order);
      }
      if (url.includes('/status?')) return Response.json({ ...info, requestId: order.requestId, status: 'pending', subState: 'pending', destinationAddress: input.destinationAddress, depositAddress: order.swap.depositAddress, originTokenAmount: 0.1 });
      throw Error('Unexpected request');
    };
    const [report] = await Promise.all([runUnfundedProbe(input, store, 'secret', fetcher), runUnfundedProbe(input, store, 'secret', fetcher)]);
    await runUnfundedProbe(input, store, 'secret', fetcher);
    assert.equal(calls.filter(url => url.endsWith('/swap')).length, 1);
    assert.equal(report.executionEnabled, false);
    assert.equal(report.checksPassed, mode === 'ok' ? true : mode === 'timeout' ? undefined : false);
    if (mode === 'provider-type-change') assert.match(report.message, /Provider changed/);
    if (mode === 'timeout') assert.equal(report.phase, 'needs-reconciliation');
    const publicReport = JSON.stringify(report);
    for (const privateValue of ['secret', order.swap.depositAddress, input.sourceAddress, input.destinationAddress]) assert.ok(!publicReport.includes(privateValue));
  }
});
