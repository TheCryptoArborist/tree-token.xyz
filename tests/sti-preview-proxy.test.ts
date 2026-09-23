import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../netlify/preview-functions/review-data.ts';

test('preview proxy rejects writes, unknown routes and non-status Knowledge Trial actions without fetching', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('Must not fetch'); };
  try {
    for (const [path, method, status] of [
      ['/api/tree-dashboard', 'POST', 405], ['/api/tree-knowledge-trial', 'POST', 405],
      ['/api/admin', 'GET', 404], ['/api/tree-knowledge-trial?action=start', 'GET', 403],
      ['/api/tree-exposure-preview', 'POST', 405], ['/api/tree-badges-preview', 'POST', 405],
      ['/api/tree-badges-refresh-background', 'GET', 404],
    ]) assert.equal((await handler(new Request(`https://preview.test${path}`, { method }))).status, status);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('Canopy preview aliases and local reads use only public production snapshots', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return Response.json({ status: 'ok', entries: [] });
  };
  try {
    for (const name of ['tree-exposure', 'tree-badges']) {
      for (const suffix of ['', '-preview']) {
        const response = await handler(new Request(`https://preview.test/api/${name}${suffix}?action=refresh&url=https://attacker.test`, {
          headers: { Cookie: 'private', Authorization: 'private' },
        }));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok', entries: [] });
        assert.equal(calls.at(-1), `https://tree-token.xyz/api/${name}`);
      }
    }
    assert.equal(calls.length, 4);
  } finally { globalThis.fetch = original; }
});

test('preview public reads use a fixed upstream and never forward credentials', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://tree-token.xyz/api/tree-volume?window=24h');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return Response.json({ status: 'ok' });
  };
  try {
    const response = await handler(new Request('https://preview.test/api/tree-volume?window=24h', { headers: { Cookie: 'private', Authorization: 'private' } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally { globalThis.fetch = original; }
});
