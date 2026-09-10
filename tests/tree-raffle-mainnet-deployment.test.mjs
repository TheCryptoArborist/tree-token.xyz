import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deployment = JSON.parse(readFileSync(new URL('../raffle-contract/deployments/mainnet.json', import.meta.url), 'utf8'));
const published = readFileSync(new URL('../raffle-contract/Published.toml', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

test('recorded Mainnet raffle deployment has distinct permanent object identities', () => {
  const ids = [deployment.packageId, deployment.prizePoolId, deployment.operatorCapId, deployment.adminCapId, deployment.upgradeCapId];
  ids.forEach((id) => assert.match(id, /^0x[0-9a-f]{64}$/));
  assert.equal(new Set(ids).size, ids.length);
  assert.match(deployment.publishTransactionDigest, /^[1-9A-HJ-NP-Za-km-z]{40,64}$/);
  assert.match(published, new RegExp(`published-at = "${deployment.packageId}"`));
  assert.match(published, new RegExp(`upgrade-capability = "${deployment.upgradeCapId}"`));
});

test('server configuration uses only OperatorCap and never AdminCap', () => {
  assert.match(envExample, /TREE_RAFFLE_OPERATOR_CAP_ID=/);
  assert.doesNotMatch(envExample, /^TREE_RAFFLE_ADMIN_CAP_ID=/m);
});
