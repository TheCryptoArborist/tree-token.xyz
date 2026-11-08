import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalProductionRequest} from '../server/canonical-production.mjs';
import {createAccessHandler} from '../server/access.mjs';

function handler() {
  const records = new Map();
  return createAccessHandler({store: {
    async get(key) { return records.get(key) ?? null; },
    async setJSON(key, value) { records.set(key, value); return {modified: true}; },
    async delete(key) { records.delete(key); },
  }});
}

test('proxied wallet challenge binds the canonical arcade origin', async () => {
  const request = canonicalProductionRequest(new Request('https://canopy-breaker.netlify.app/play/canopy-breaker/api/access', {
    method: 'POST',
    headers: {Origin: 'https://tree-token.xyz', 'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'challenge', address: '0x' + '1'.repeat(64)}),
  }));
  const response = await handler()(request);
  assert.equal(response.status, 200);
  const challenge = await response.json();
  assert.equal(challenge.origin, 'https://tree-token.xyz');
  assert.match(challenge.message, /Origin: https:\/\/tree-token\.xyz\n/);
});

test('canonical proxy keeps cross-site rejection and protected-source gating', async () => {
  const access = handler();
  const request = canonicalProductionRequest(new Request('https://canopy-breaker.netlify.app/play/canopy-breaker/api/access', {
    method: 'POST',
    headers: {Origin: 'https://other.example', 'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'challenge', address: '0x' + '1'.repeat(64)}),
  }));
  assert.equal((await access(request)).status, 403);
  const source = canonicalProductionRequest(new Request('https://canopy-breaker.netlify.app/play/canopy-breaker/src/app.js'));
  assert.equal((await access(source)).status, 401);
  assert.equal(canonicalProductionRequest(new Request('https://canopy-breaker.netlify.app/server/access.mjs')), null);
});
