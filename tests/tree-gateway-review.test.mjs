import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDraft, readDraft, readOnlyEvm, EVM_CHAINS, isEvmAddress, formatNative } from '../gateway/review-core.js';
import gasHandler from '../netlify/preview-functions/tree-gateway-gas.ts';
const draft = { chain: 'bsc', asset: 'BNB', amount: '0.1', destination: 'TREE', settlement: 'SUI' };

test('saved setups retain only valid choices and never restore wallets, quotes or execution state', () => {
  const saved = routeDraft({ ...draft, sourceAddress: 'secret', quote: { expiresAt: Infinity }, stage: 'completed', executionEnabled: true });
  assert.deepEqual(saved, { version: 1, ...draft });
  assert.deepEqual(readDraft(JSON.stringify(saved)), saved);
  for (const patch of [{ chain: '__proto__' }, { asset: 'USDC' }, { amount: '0' }, { destination: 'bad' }, { settlement: 'bad' }, { version: 2 }]) {
    assert.throws(() => readDraft(JSON.stringify({ ...saved, ...patch })));
  }
  assert.throws(() => readDraft('not json'));
});
test('source adapter only permits connection and reads plus an explicit network switch', async () => {
  const calls = [];
  const request = readOnlyEvm({ request: async args => { calls.push(args); return ['account']; } });
  await request('eth_requestAccounts');
  await request('eth_chainId');
  await request('wallet_switchEthereumChain', [{ chainId: EVM_CHAINS.robinhood }]);
  assert.equal(EVM_CHAINS.robinhood, '0x1237');
  for (const method of ['eth_sendTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData_v4', 'wallet_sendCalls', 'wallet_addEthereumChain']) await assert.rejects(request(method));
  assert.equal(calls.length, 3);
});
test('address and native balance formatting are exact and reject invalid addresses', () => {
  assert.equal(isEvmAddress('0x' + '1'.repeat(40)), true);
  for (const value of [null, '0x123', '0x' + '0'.repeat(40), '<script>']) assert.equal(isEvmAddress(value), false);
  assert.equal(formatNative('0x0'), '0.00000000');
  assert.equal(formatNative('1000000000000000001'), '1.00000000');
});
test('gas endpoint is fixed to Base balance reads and fails closed', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const address = '0x' + '1'.repeat(40);
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://mainnet.base.org');
    assert.deepEqual(JSON.parse(options.body), { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });
    return Response.json({ id: 1, result: '0x0' });
  };
  try {
    assert.equal((await gasHandler(new Request('https://preview/api/tree-gateway-gas', { method: 'POST' }))).status, 405);
    assert.equal((await gasHandler(new Request('https://preview/api/tree-gateway-gas?address=bad'))).status, 400);
    assert.equal(calls, 0);
    const r = await gasHandler(new Request(`https://preview/api/tree-gateway-gas?address=${address}&method=eth_sendTransaction&rpc=https://evil.invalid`));
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal((await r.json()).balance, '0x0');
    globalThis.fetch = async () => Response.json({ error: { message: 'rate limit' } });
    assert.equal((await gasHandler(new Request(`https://preview/api/tree-gateway-gas?address=${address}`))).status, 502);
  } finally { globalThis.fetch = original; }
});
