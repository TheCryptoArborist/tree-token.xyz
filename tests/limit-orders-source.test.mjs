import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dapp/index.html', import.meta.url), 'utf8');
const client = readFileSync(new URL('../dapp/limit-orders.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../netlify/functions/tree-limit-orders.ts', import.meta.url), 'utf8');

test('limit UI exposes create, active, past, and cancellation controls', () => {
  for (const id of ['limitCreate', 'limitRefresh', 'limitActiveTab', 'limitPastTab', 'limitOrders']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(client, /Cancel & Return Funds/);
  assert.match(html, /Aftermath Mainnet/);
});

test('client performs two fresh server builds and simulations before signing', () => {
  const createCalls = [...client.matchAll(/api\('create'/g)].length;
  const simulations = [...client.matchAll(/simulatePlan\(/g)].length;
  assert.ok(createCalls >= 2);
  assert.ok(simulations >= 3);
  assert.ok(client.indexOf('const first = await api') < client.indexOf('window.signAndExecuteTransactionBlock'));
  assert.ok(client.indexOf('const finalBuild = await api') < client.indexOf('window.signAndExecuteTransactionBlock'));
});

test('server has strict path, origin, proof, and no-integrator-fee controls', () => {
  assert.match(server, /path: '\/api\/tree-limit-orders'/);
  assert.match(server, /assertAllowedTreeLimitTransaction/);
  assert.match(server, /assertTreeLimitAccountProof/);
  assert.match(server, /assertTreeLimitCancelProof/);
  assert.match(server, /sdkPromise = null/);
  assert.match(server, /retrySafeAftermath/);
  assert.match(server, /getCoinsToPrice/);
  assert.match(server, /outputToInputStopLossExchangeRate: 0/);
  assert.doesNotMatch(server, /integratorFeeBps/);
});
