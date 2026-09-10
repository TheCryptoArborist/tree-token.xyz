import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService, COOKIE, FLOW_COOKIE, digest, pkce, normalizeWallet } from '../netlify/lib/tree-account-core.mjs';
import { randomBytes } from 'node:crypto';
const origin = 'https://accounts.example.test', gameOrigin = 'https://game.example.test';
const wallet = { family: 'sui', address: '0x1', chainId: 'sui:mainnet' };
function memory() {
  const items = new Map(); let serial = 0;
  return {
    async get(k) { return structuredClone(items.get(k)?.data || null); },
    async getWithMetadata(k) { return structuredClone(items.get(k) || null); },
    async setJSON(k, data, options = {}) {
      const old = items.get(k);
      if (options.onlyIfNew && old || options.onlyIfMatch && old?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = `${++serial}`; items.set(k, { data: structuredClone(data), etag, metadata: {} }); return { modified: true, etag };
    },
    async delete(k) { items.delete(k); }, items,
  };
}
function fixture() {
  const store = memory(); let clock = 2000000000000;
  const verifyCalls = [];
  const service = createAccountService({ store, origin, gameOrigin, now: () => clock,
    verifySignature: async (p, signature) => { verifyCalls.push(p); return signature === 'valid' ? p.wallet.family === 'sui' ? 'sui' : 'eoa' : signature === 'contract' ? 'contract' : null; },
    evmMessage: p => JSON.stringify(p),
  });
  async function post(body, cookie = '', extra = {}) {
    return service(new Request(`${origin}/api/tree-account`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie, ...extra }, body: JSON.stringify(body) }), { ip: 'test' });
  }
  async function server(body) { return service(new Request(`${origin}/api/tree-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { ip: 'server' }); }
  const cookies = response => response.headers.getSetCookie().map(x => x.split(';')[0]).filter(x => !x.endsWith('=')).join('; ');
  async function login(w = wallet, signature = 'valid') {
    const challenge = await post({ action: 'challenge', ...w }); assert.equal(challenge.status, 200);
    const proof = await challenge.json(), binding = cookies(challenge);
    const result = await post({ action: 'verify', nonce: proof.nonce, signature }, binding);
    return { result, proof, binding, cookie: cookies(result) };
  }
  async function grant(login, overrides = {}) {
    const verifier = randomBytes(32).toString('base64url'), state = 'a'.repeat(64);
    const r = await post({ action: 'authorize-game', clientOrigin: gameOrigin, codeChallenge: pkce(verifier), state, ...overrides }, login.cookie);
    const p = await r.json(); return { response: r, ...p, code: p.redirect ? new URL(p.redirect).searchParams.get('code') : null, verifier };
  }
  return { service, store, post, server, login, grant, cookies, verifyCalls, advance: ms => { clock += ms; } };
}
test('Sui-only sign-in works without EVM or NFT ownership and sets secure cookie', async () => {
  const f = fixture(), { result } = await f.login(); assert.equal(result.status, 200);
  const p = await result.json(); assert.equal(p.identity.entitlement, 'not-checked'); assert.equal(p.identity.wallet.family, 'sui');
  assert.match(result.headers.getSetCookie()[0], /HttpOnly; Secure; SameSite=Lax/); assert.match(p.identity.accountId, /^[a-f0-9-]{36}$/);
  assert.equal(p.accessToken, undefined); assert.equal(f.verifyCalls.length, 1);
});
test('EVM-only authentication on both preview networks needs no Sui wallet', async () => {
  const f = fixture(), evm = { family: 'evm', address: '0x' + 'a'.repeat(40), chainId: 97 };
  const a = await f.login(evm), b = await f.login({ ...evm, chainId: 46630 });
  assert.equal(a.result.status, 200); assert.equal((await a.result.json()).identity.accountId, (await b.result.json()).identity.accountId);
});
test('contract wallet aliases are chain-scoped', async () => {
  const f = fixture(), evm = { family: 'evm', address: '0x' + 'b'.repeat(40), chainId: 97 };
  const a = await f.login(evm, 'contract'), b = await f.login({ ...evm, chainId: 46630 }, 'contract');
  assert.notEqual((await a.result.json()).identity.accountId, (await b.result.json()).identity.accountId);
});
test('same Sui wallet on a second device resolves the same random account UUID', async () => {
  const f = fixture(), a = await f.login(), b = await f.login(); assert.equal((await a.result.json()).identity.accountId, (await b.result.json()).identity.accountId);
});
test('different wallets never auto-merge', async () => {
  const f = fixture(), a = await f.login(), b = await f.login({ ...wallet, address: '0x2' }); assert.notEqual((await a.result.json()).identity.accountId, (await b.result.json()).identity.accountId);
});
test('signature rejected; the challenge is consumed', async () => {
  const f = fixture(), a = await f.login(wallet, 'wrong'); assert.equal(a.result.status, 401);
  assert.equal((await f.post({ action: 'verify', nonce: a.proof.nonce, signature: 'valid' }, a.binding)).status, 401);
});
test('challenge cannot be used in another browser', async () => {
  const f = fixture(), r = await f.post({ action: 'challenge', ...wallet }), p = await r.json();
  assert.equal((await f.post({ action: 'verify', nonce: p.nonce, signature: 'valid' })).status, 401); assert.equal(f.verifyCalls.length, 0);
});
test('challenge expires after five minutes', async () => {
  const f = fixture(), r = await f.post({ action: 'challenge', ...wallet }), p = await r.json(); f.advance(300001);
  assert.equal((await f.post({ action: 'verify', nonce: p.nonce, signature: 'valid' }, f.cookies(r))).status, 401);
});
test('racing duplicate signatures have only one winner', async () => {
  const f = fixture(), r = await f.post({ action: 'challenge', ...wallet }), p = await r.json();
  const results = await Promise.all([1,2].map(() => f.post({ action: 'verify', nonce: p.nonce, signature: 'valid' }, f.cookies(r))));
  assert.deepEqual(results.map(x => x.status).sort(), [200, 401]); assert.equal(f.verifyCalls.length, 1);
});
test('race on first sign-in preserves a single alias UUID', async () => {
  const f = fixture(), results = await Promise.all([f.login(), f.login()]);
  assert.equal((await results[0].result.json()).identity.accountId, (await results[1].result.json()).identity.accountId);
});
test('foreign origin and requests without Origin cannot start wallet sign-in', async () => {
  const f = fixture(); assert.equal((await f.post({ action: 'challenge', ...wallet }, '', { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.server({ action: 'challenge', ...wallet })).status, 403);
});
test('unsupported networks and malformed addresses are rejected', async () => {
  const f = fixture(); for (const w of [{...wallet,chainId:'sui:testnet'},{family:'evm',address:'0x1',chainId:97},{family:'evm',address:'0x'+'1'.repeat(40),chainId:56}]) assert.equal((await f.post({ action: 'challenge', ...w })).status, 400);
});
test('nonce, wallet and message are read from server, not injected client fields', async () => {
  const f = fixture(), r = await f.post({ action: 'challenge', ...wallet }), p = await r.json();
  await f.post({action:'verify',nonce:p.nonce,signature:'valid',message:'attacker',address:'0x2',accountId:'forged'},f.cookies(r));
  assert.notEqual(f.verifyCalls[0].message,'attacker');assert.equal(f.verifyCalls[0].wallet.address,normalizeWallet(wallet).address);
});
test('a signed central session creates one-use PKCE-bound game handoff', async () => {
  const f = fixture(), l = await f.login(), g = await f.grant(l);
  const a = await f.server({action:'exchange',clientOrigin:gameOrigin,code:g.code,verifier:g.verifier});assert.equal(a.status,200);
  const p = await a.json(); assert.equal(p.identity.accountId,(await l.result.json()).identity.accountId);
  const b = await f.server({action:'exchange',clientOrigin:gameOrigin,code:g.code,verifier:g.verifier});assert.equal(b.status,401);
});
test('wrong PKCE verifier, audience, expiry and unauthorized grants fail', async () => {
  const f = fixture(), l = await f.login(), g = await f.grant(l);
  assert.equal((await f.server({action:'exchange',clientOrigin:gameOrigin,code:g.code,verifier:'z'.repeat(43)})).status,401);
  assert.equal((await f.grant(l,{clientOrigin:'https://evil.test'})).response.status,400);
  f.advance(60001);assert.equal((await f.server({action:'exchange',clientOrigin:gameOrigin,code:g.code,verifier:g.verifier})).status,401);
});
test('browser cannot exchange codes through the server-only channel', async () => {
  const f = fixture(); assert.equal((await f.post({action:'exchange'})).status,403);
});
test('logout revokes child session and never changes NFT or credit state', async () => {
  const f = fixture(),l=await f.login(),g=await f.grant(l);
  const p=await(await f.server({action:'exchange',clientOrigin:gameOrigin,code:g.code,verifier:g.verifier})).json();
  assert.equal((await f.server({action:'game-session',token:p.accessToken})).status,200);
  await f.post({action:'logout'},l.cookie);
  assert.equal((await f.server({action:'game-session',token:p.accessToken})).status,401);
  assert.equal([...f.store.items.keys()].some(k=>/nft|credits|balance/.test(k)),false);
});
test('game logout revokes only that child token', async () => {
  const f=fixture(),l=await f.login(),g=await f.grant(l),p=await(await f.server({action:'exchange',clientOrigin:gameOrigin,code:g.code,verifier:g.verifier})).json();
  await f.server({action:'game-logout',token:p.accessToken});assert.equal((await f.server({action:'game-session',token:p.accessToken})).status,401);
  assert.equal((await f.grant(l)).response.status,200);
});
test('expired parent prevents handoff and signed identity reads',async()=>{
 const f=fixture(),l=await f.login();f.advance(1800001);assert.equal((await f.grant(l)).response.status,401);
 const r=await f.service(new Request(`${origin}/api/tree-account`,{headers:{Cookie:l.cookie}}));assert.equal((await r.json()).identity,null);
});
test('rate limit rejects excess login challenges',async()=>{
 const f=fixture();for(let i=0;i<15;i++)assert.equal((await f.post({action:'challenge',...wallet})).status,200);
 assert.equal((await f.post({action:'challenge',...wallet})).status,429);
});
test('secrets stored hashed; responses are not cacheable',async()=>{
 const f=fixture(),l=await f.login();assert.match(l.result.headers.get('cache-control'),/no-store/);
 const token=l.cookie.split(';')[0].split('=')[1];assert.ok(f.store.items.has(`sessions/${digest(token)}`));
 assert.equal(JSON.stringify([...f.store.items.values()]).includes('"signature"'),false);
});
test('wrong host fails closed',async()=>{
 const f=fixture(),r=await f.service(new Request('https://production.test/api/tree-account'));assert.equal(r.status,404);
});
