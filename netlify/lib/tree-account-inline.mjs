import { randomBytes } from 'node:crypto';
import { createAccountService, COOKIE, FLOW_COOKIE, digest, equal, pkce } from './tree-account-core.mjs';

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
function secretCookie(response, name) {
  return response.headers.getSetCookie().find(c => c.startsWith(`${name}=`))?.split(';')[0].slice(name.length + 1) || '';
}
export async function readInlineBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw Object.assign(new Error('json-required'), { status: 415 });
  const reader = request.body?.getReader(); if (!reader) throw Object.assign(new Error('invalid-json'), { status: 400 });
  let size = 0; const parts = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); throw Object.assign(new Error('request-too-large'), { status: 413 }); } parts.push(value); }
  try { const body = JSON.parse(Buffer.concat(parts).toString('utf8')); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body; }
  catch { throw Object.assign(new Error('invalid-json'), { status: 400 }); }
}
/** Same central account service/store/aliases. Only the wallet-signing origin changes.
 * Secrets returned here are for the game SERVER, never for browser JavaScript.
 */
export function createInlineAccountHandler({ store, origin, gameOrigin, verifySignature, evmMessage, now = Date.now }) {
  const core = createAccountService({ store, origin: gameOrigin, gameOrigin, verifySignature, evmMessage, now });
  return async (request, { ip = 'unknown' } = {}) => {
    let newParent = '';
    async function call(action, fields = {}, cookies = '', browser = true) {
      const result = await core(new Request(`${gameOrigin}/api/tree-account`, { method: 'POST', headers: {
        'Content-Type': 'application/json', ...(browser ? { Origin: gameOrigin } : {}), ...(cookies ? { Cookie: cookies } : {}),
      }, body: JSON.stringify({ action, ...fields }) }), { ip });
      const body = await result.json(); if (!result.ok) throw Object.assign(new Error(body.error), { status: result.status });
      return { result, body };
    }
    try {
      if (new URL(request.url).origin !== origin) return json({ error: 'preview-only' }, 404);
      if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
      if (request.headers.has('origin') || request.headers.has('sec-fetch-site')) return json({ error: 'server-channel-required' }, 403);
      const b = await readInlineBody(request);
      if (b.clientOrigin !== gameOrigin) return json({ error: 'origin-mismatch' }, 403);
      const fields = { challenge: ['family', 'address', 'chainId'], verify: ['nonce', 'binding', 'signature'], cancel: ['nonce', 'binding'] };
      if (!Object.hasOwn(fields, b.action) || Object.keys(b).some(k => !['action', 'clientOrigin', ...fields[b.action]].includes(k))) return json({ error: 'invalid-command' }, 400);
      if (b.action === 'challenge') {
        const { result, body } = await call('challenge', { family: b.family, address: b.address, chainId: b.chainId });
        return json({ ...body, binding: secretCookie(result, FLOW_COOKIE) });
      }
      if (!hex(b.nonce) || !hex(b.binding)) return json({ error: 'invalid-proof' }, 400);
      const proofKey = `challenges/${digest(b.nonce)}`;
      const proof = await store.getWithMetadata(proofKey, { type: 'json' });
      if (!proof?.data || proof.data.origin !== gameOrigin || !equal(proof.data.binding, digest(b.binding))) return json({ error: 'browser-mismatch' }, 401);
      if (b.action === 'cancel') {
        if (!proof.data.used) await store.setJSON(proofKey, { ...proof.data, used: true }, { onlyIfMatch: proof.etag });
        return json({ status: 'ok' });
      }
      const verified = await call('verify', { nonce: b.nonce, signature: b.signature }, `${FLOW_COOKIE}=${b.binding}`);
      newParent = secretCookie(verified.result, COOKIE);
      if (!hex(newParent)) throw Error('invalid-parent-session');
      const verifier = randomBytes(32).toString('base64url');
      const grant = await call('authorize-game', { clientOrigin: gameOrigin, state: randomBytes(32).toString('hex'), codeChallenge: pkce(verifier) }, `${COOKIE}=${newParent}`);
      const code = new URL(grant.body.redirect).searchParams.get('code');
      const exchanged = await call('exchange', { code, verifier, clientOrigin: gameOrigin }, '', false);
      newParent = ''; // Child now uses the exact existing parent-session revocation checks.
      return json(exchanged.body);
    } catch (error) {
      if (newParent) await store.delete(`sessions/${digest(newParent)}`).catch(() => {});
      const safe = [400, 401, 403, 413, 415, 429].includes(error.status);
      return json({ error: safe ? error.message : 'authentication-unavailable' }, safe ? error.status : 503);
    }
  };
}
