import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const TTL = Object.freeze({ challenge: 300_000, session: 1_800_000, grant: 60_000 });
export const COOKIE = '__Host-tree-account-preview';
export const FLOW_COOKIE = '__Host-tree-account-proof';
const hex = n => randomBytes(n).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const pkce = value => createHash('sha256').update(value).digest('base64url');
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class AuthError extends Error { constructor(code, status = 400) { super(code); this.status = status; } }
const requireThat = (condition, code, status = 400) => { if (!condition) throw new AuthError(code, status); };
export function cookieValue(request, name) {
  return (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
export const setCookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, seconds)}`;
export function normalizeWallet(input) {
  if (input.family === 'sui') {
    requireThat(typeof input.address === 'string' && /^0x[0-9a-f]{1,64}$/i.test(input.address), 'invalid-wallet');
    requireThat(input.chainId === 'sui:mainnet', 'unsupported-network');
    return { family: 'sui', address: `0x${input.address.slice(2).toLowerCase().padStart(64, '0')}`, chainId: 'sui:mainnet' };
  }
  requireThat(input.family === 'evm' && typeof input.address === 'string' && /^0x[0-9a-f]{40}$/i.test(input.address), 'invalid-wallet');
  requireThat([97, 46630].includes(input.chainId), 'unsupported-network');
  return { family: 'evm', address: input.address.toLowerCase(), chainId: input.chainId };
}
export function validateOrigin(value) {
  const url = new URL(value);
  requireThat(url.protocol === 'https:' && url.origin === value && !url.username && !url.password, 'invalid-origin');
  return value;
}
async function bodyOf(request) {
  requireThat(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'json-required', 415);
  requireThat(Number(request.headers.get('content-length') || 0) <= 16000, 'request-too-large', 413);
  const reader = request.body?.getReader(); requireThat(reader, 'json-required');
  let size = 0; const parts = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); throw new AuthError('request-too-large', 413); } parts.push(value); }
  try { const body = JSON.parse(Buffer.concat(parts).toString('utf8')); requireThat(body && !Array.isArray(body) && typeof body === 'object', 'invalid-json'); return body; }
  catch { throw new AuthError('invalid-json'); }
}
const response = (body, status = 200, cookies = []) => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  cookies.forEach(c => headers.append('Set-Cookie', c)); return new Response(JSON.stringify(body), { status, headers });
};

/** Preview-only central identity service. Store must provide strong reads and conditional writes.
 * No localStorage identity import, NFT entitlement, wallet merging or monetary ledger is provided.
 */
export function createAccountService({ store, origin, gameOrigin, verifySignature, evmMessage, now = Date.now }) {
  validateOrigin(origin); validateOrigin(gameOrigin);
  async function get(key) { return store.get(key, { type: 'json' }); }
  async function rate(ip, group, maximum) {
    const bucket = Math.floor(now() / TTL.challenge), key = `limits/${digest(`${ip}|${group}|${bucket}`)}`;
    for (let i = 0; i < 8; i++) {
      const previous = await store.getWithMetadata(key, { type: 'json' });
      const count = previous?.data?.count || 0;
      requireThat(count < maximum, 'too-many-attempts', 429);
      const result = await store.setJSON(key, { count: count + 1, expiresAt: (bucket + 1) * TTL.challenge }, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
      if (result.modified) return;
    }
    throw new AuthError('try-again', 429);
  }
  async function consume(key, inspect) {
    const item = await store.getWithMetadata(key, { type: 'json' });
    requireThat(item?.data && !item.data.used && item.data.expiresAt > now(), 'expired-or-used-proof', 401);
    await inspect(item.data);
    const result = await store.setJSON(key, { ...item.data, used: true }, { onlyIfMatch: item.etag });
    requireThat(result.modified, 'expired-or-used-proof', 401); return item.data;
  }
  async function accountFor(wallet, proofKind) {
    // EOAs retain their identity across EVM chains. Contract wallets are chain-scoped.
    const alias = wallet.family === 'sui' ? `sui:${wallet.address}` : proofKind === 'eoa' ? `evm:eoa:${wallet.address}` : `evm:${wallet.chainId}:${wallet.address}`;
    const key = `aliases/${digest(alias)}`;
    let account = await get(key);
    if (!account) {
      const candidate = { id: randomUUID(), alias, createdAt: now(), kind: proofKind };
      const result = await store.setJSON(key, candidate, { onlyIfNew: true });
      account = result.modified ? candidate : await get(key);
    }
    requireThat(account?.id, 'account-unavailable', 503); return account;
  }
  async function parentSession(token) {
    requireThat(/^[a-f0-9]{64}$/.test(token), 'sign-in-required', 401);
    const key = `sessions/${digest(token)}`, session = await get(key);
    requireThat(session && session.expiresAt > now(), 'sign-in-required', 401);
    return { key, session };
  }
  const identity = s => ({ accountId: s.accountId, wallet: s.wallet, expiresAt: s.expiresAt, environment: 'preview', authenticated: true, entitlement: 'not-checked' });
  async function childSession(token) {
    requireThat(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token), 'sign-in-required', 401);
    const key = `game-sessions/${digest(token)}`, child = await get(key);
    requireThat(child && child.expiresAt > now() && child.audience === gameOrigin, 'sign-in-required', 401);
    const parent = await get(child.parentKey);
    requireThat(parent && parent.expiresAt > now() && parent.accountId === child.accountId, 'sign-in-required', 401);
    return { key, session: child };
  }
  return async function handle(request, { ip = 'unknown' } = {}) {
    try {
      requireThat(new URL(request.url).origin === origin, 'preview-only', 404);
      if (request.method === 'GET') {
        try { const { session } = await parentSession(cookieValue(request, COOKIE)); return response({ status: 'ok', identity: identity(session) }); }
        catch (error) { if (error.status === 401) return response({ status: 'ok', identity: null }, 200, [setCookie(COOKIE, '', 0)]); throw error; }
      }
      requireThat(request.method === 'POST', 'method-not-allowed', 405);
      const body = await bodyOf(request);
      const serverAction = ['exchange', 'game-session', 'game-logout'].includes(body.action);
      if (serverAction) {
        // Exchanges happen server-to-server, never as a cross-origin browser API.
        requireThat(!request.headers.has('origin') && !request.headers.has('sec-fetch-site'), 'server-channel-required', 403);
      } else requireThat(request.headers.get('origin') === origin, 'origin-mismatch', 403);
      if (body.action === 'challenge') {
        await rate(ip, 'challenge', 15);
        const wallet = normalizeWallet(body), nonce = hex(32), binding = hex(32), issuedAt = now(), expiresAt = issuedAt + TTL.challenge;
        const message = wallet.family === 'evm' ? evmMessage({ wallet, nonce, issuedAt, expiresAt, origin }) : [
          'TREE Arcade — Sign in to your preview account', `Domain: ${new URL(origin).host}`, `URI: ${origin}/play/account/`,
          `Address: ${wallet.address}`, 'Chain: sui:mainnet', `Nonce: ${nonce}`, `Issued At: ${new Date(issuedAt).toISOString()}`,
          `Expiration Time: ${new Date(expiresAt).toISOString()}`, 'Purpose: Sign-in only. No transaction, approval, NFT entitlement or credit purchase.',
        ].join('\n');
        await store.setJSON(`challenges/${digest(nonce)}`, { wallet, message, origin, binding: digest(binding), nonce, issuedAt, expiresAt, used: false });
        return response({ status: 'ok', nonce, message, expiresAt }, 200, [setCookie(FLOW_COOKIE, binding, 300)]);
      }
      if (body.action === 'verify') {
        await rate(ip, 'verify', 30);
        requireThat(typeof body.nonce === 'string' && /^[a-f0-9]{64}$/.test(body.nonce) && typeof body.signature === 'string' && body.signature.length <= 14000, 'invalid-proof');
        const proof = await consume(`challenges/${digest(body.nonce)}`, p => requireThat(equal(p.binding, digest(cookieValue(request, FLOW_COOKIE))), 'browser-mismatch', 401));
        // Claim the nonce before signature verification; invalid proofs cannot be retried.
        const proofKind = await verifySignature(proof, body.signature);
        requireThat(['sui', 'eoa', 'contract'].includes(proofKind), 'invalid-signature', 401);
        const account = await accountFor(proof.wallet, proofKind), token = hex(32);
        const session = { accountId: account.id, wallet: { ...proof.wallet, kind: proofKind }, expiresAt: now() + TTL.session };
        await store.setJSON(`sessions/${digest(token)}`, session);
        const old = cookieValue(request, COOKIE); if (/^[a-f0-9]{64}$/.test(old)) await store.delete(`sessions/${digest(old)}`);
        return response({ status: 'ok', identity: identity(session) }, 200, [setCookie(COOKIE, token, 1800), setCookie(FLOW_COOKIE, '', 0)]);
      }
      if (body.action === 'logout') {
        const token = cookieValue(request, COOKIE); if (/^[a-f0-9]{64}$/.test(token)) await store.delete(`sessions/${digest(token)}`);
        return response({ status: 'ok', identity: null }, 200, [setCookie(COOKIE, '', 0), setCookie(FLOW_COOKIE, '', 0)]);
      }
      if (body.action === 'authorize-game') {
        const { key, session } = await parentSession(cookieValue(request, COOKIE));
        requireThat(body.clientOrigin === gameOrigin && /^[a-f0-9]{64}$/.test(body.state || '') && /^[A-Za-z0-9_-]{43}$/.test(body.codeChallenge || ''), 'invalid-game-request');
        const code = hex(32);
        await store.setJSON(`grants/${digest(code)}`, { parentKey: key, accountId: session.accountId, audience: gameOrigin, codeChallenge: body.codeChallenge, expiresAt: now() + TTL.grant, used: false });
        const callback = new URL('/api/tree-account/callback', gameOrigin); callback.searchParams.set('code', code); callback.searchParams.set('state', body.state);
        return response({ status: 'ok', redirect: callback.href });
      }
      if (body.action === 'exchange') {
        await rate(ip, 'exchange', 120);
        requireThat(body.clientOrigin === gameOrigin && /^[a-f0-9]{64}$/.test(body.code || '') && /^[A-Za-z0-9_-]{43,128}$/.test(body.verifier || ''), 'invalid-exchange');
        const grant = await consume(`grants/${digest(body.code)}`, g => requireThat(g.audience === gameOrigin && equal(g.codeChallenge, pkce(body.verifier)), 'invalid-exchange', 401));
        const parent = await get(grant.parentKey); requireThat(parent && parent.expiresAt > now() && parent.accountId === grant.accountId, 'sign-in-required', 401);
        const accessToken = hex(32), session = { ...parent, parentKey: grant.parentKey, audience: gameOrigin };
        await store.setJSON(`game-sessions/${digest(accessToken)}`, session);
        return response({ status: 'ok', accessToken, identity: identity(session) });
      }
      if (body.action === 'game-session') { const { session } = await childSession(body.token); return response({ status: 'ok', identity: identity(session) }); }
      if (body.action === 'game-logout') {
        if (typeof body.token === 'string' && /^[a-f0-9]{64}$/.test(body.token)) await store.delete(`game-sessions/${digest(body.token)}`);
        return response({ status: 'ok', identity: null });
      }
      throw new AuthError('unsupported-action');
    } catch (error) { return response({ status: 'error', error: error instanceof AuthError ? error.message : 'authentication-unavailable' }, error instanceof AuthError ? error.status : 503); }
  };
}
