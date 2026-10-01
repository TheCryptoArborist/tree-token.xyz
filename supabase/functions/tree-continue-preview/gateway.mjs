/** Hosted preview: authenticated purchase lookup and network diagnostics only.
 * There is intentionally no quote signer, receipt writer, or delivery mutator.
 */
export const AUTH_ORIGIN = 'https://deploy-preview-48--tree-token.netlify.app';
export const MODE = 'hosted-checkout-disabled';
const PROTOCOL = 'tree-paid-delivery.v1';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const wallet = v => typeof v === 'string' && /^0x[a-f0-9]{64}$/.test(v) && !/^0x0+$/.test(v);
const check = (ok, code, status = 400) => { if (!ok) throw Object.assign(Error(code), { code, status }); };
const json = (body, status = 200) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
}});
export async function boundedJson(response, limit) {
  const reader = response.body?.getReader(); check(reader, 'invalid-json');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); check(false, 'request-too-large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { check(false, 'invalid-json'); }
}
export function createHostedPreview({ fetcher = fetch, lookup, probe, now = Date.now }) {
  check(typeof lookup === 'function' && typeof probe === 'function', 'invalid-preview-setup');
  return async request => {
    const flags = { mode: MODE, enabled: false, paymentsEnabled: false, restoreAuthorized: false, requiresPayment: false, deliveryProtocol: PROTOCOL };
    try {
      check(request.method === 'POST', 'method-not-allowed', 405);
      check(!request.headers.has('origin') && !request.headers.has('sec-fetch-site'), 'server-channel-required', 403);
      check(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'json-required', 415);
      const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      check(token, 'sui-sign-in-required', 401);
      const command = await boundedJson(request, 4096);
      check(command && typeof command === 'object' && !Array.isArray(command), 'invalid-command');
      const fields = { status: ['action'], list_purchases: ['action', 'afterOrderId'], recover_purchase: ['action', 'runId'] };
      const blocked = new Set(['order', 'reconcile', 'cancel', 'deliver', 'delivery_status', 'prepare_delivery', 'activate_delivery']);
      check(!Object.keys(command).some(k => ['accountId', 'payer', 'token', 'actor', 'evidence', 'verified', 'restoreAuthorized', 'serviceUrl', 'paymentsEnabled'].includes(k)), 'invalid-command');
      check(Object.hasOwn(fields, command.action) || blocked.has(command.action), 'invalid-command');
      if (Object.hasOwn(fields, command.action)) {
        check(Object.keys(command).every(k => fields[command.action].includes(k)), 'invalid-command');
        if (command.action === 'recover_purchase') check(uuid(command.runId), 'invalid-command');
        if (Object.hasOwn(command, 'afterOrderId')) check(uuid(command.afterOrderId), 'invalid-command');
      }
      const auth = await fetcher(AUTH_ORIGIN + '/api/tree-account', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'game-session', token }),
      });
      if (auth.status === 401 || auth.status === 403) check(false, 'sui-sign-in-required', 401);
      check(auth.ok, 'authentication-unavailable', 503);
      let result;
      try { result = await boundedJson(auth, 16384); } catch { check(false, 'authentication-unavailable', 503); }
      const i = result?.identity;
      check(result?.status === 'ok' && i?.authenticated === true && i.environment === 'preview' &&
        uuid(i.accountId) && i.wallet?.family === 'sui' && wallet(i.wallet.address) &&
        Number.isSafeInteger(i.expiresAt) && i.expiresAt > now(), 'sui-sign-in-required', 401);
      if (blocked.has(command.action)) return json({ ...flags, error: 'checkout-not-enabled' }, 503);
      // The server supplies identity. This RPC has no payment/delivery write path.
      const record = await lookup({ p_account: i.accountId, p_payer: i.wallet.address,
        p_action: command.action, p_run: command.runId || null, p_after: command.afterOrderId || null });
      check(record && record.allowed === true, 'preview-rate-limit', 429);
      const common = { ...flags, accountId: i.accountId };
      if (command.action === 'status') {
        let chain;
        try { chain = await probe(); } catch { chain = { ready: false, error: 'mainnet-read-unavailable' }; }
        return json({ ...common, chain, checkoutConfigured: false });
      }
      if (command.action === 'list_purchases') {
        const value = record.result;
        check(Array.isArray(value?.rows) && value.rows.length <= 25 && typeof value.hasMore === 'boolean', 'invalid-storage-response', 503);
        for (const row of value.rows) check(uuid(row.orderId) && uuid(row.runId) &&
          ['ordered', 'cancelled', 'verified', 'delivered'].includes(row.state) &&
          Number.isInteger(row.wave) && row.wave >= 1 && row.wave <= 10 && Number.isSafeInteger(row.score) && row.score >= 0, 'invalid-storage-response', 503);
        return json({ ...common, purchases: value.rows, afterOrderId: value.hasMore ? value.rows.at(-1)?.orderId : null });
      }
      check(record.result && Object.hasOwn(record.result, 'record'), 'invalid-storage-response', 503);
      if (record.result.record === null) return json({ ...common, status: 'not-found', order: null, authorization: null });
      // Existing records are not re-verified or consumed by a read-only preview.
      // Do not fabricate a receipt or report an unresolved order as unpaid.
      return json({ ...common, error: 'checkout-not-enabled', purchaseFound: true, authorization: null }, 503);
    } catch (error) {
      const safe = new Set(['method-not-allowed', 'server-channel-required', 'json-required', 'sui-sign-in-required',
        'request-too-large', 'invalid-json', 'invalid-command', 'authentication-unavailable', 'preview-rate-limit']);
      const known = safe.has(error?.code);
      return json({ ...flags, error: known ? error.code : 'delivery-unavailable' }, known ? error.status : 503);
    }
  };
}
