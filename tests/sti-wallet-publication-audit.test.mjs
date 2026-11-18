import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SITE_ID, ACCOUNT_ID } from '../scripts/release-stats-market.mjs';
import { EXPECTED_DEPLOY, EXPECTED_BASELINE, EXPECTED_SOURCE, parseCandidateEvidence,
  auditApi, assertPublishedIdentity, assertInventoryDelta, validateAuditBrowser,
  verifyCanonicalDelivery } from '../scripts/audit-sti-wallet-publication.mjs';

const bytes = fs.readFileSync(new URL('../production/sti-wallet-recovery-candidate-20261118.json', import.meta.url));
const evidence = parseCandidateEvidence(bytes);
const original = JSON.parse(fs.readFileSync(new URL('../production/sti-purchase-release-20261118.json', import.meta.url))).files;

test('audit requires exact pinned candidate evidence and complete browser proof', () => {
  assert.equal(evidence.sourceCommit, EXPECTED_SOURCE); assert.equal(evidence.candidateId, EXPECTED_DEPLOY);
  assert.throws(() => parseCandidateEvidence(Buffer.concat([bytes, Buffer.from('\n')])), /bytes changed/);
  const report = structuredClone(evidence.candidateBrowserVerification.report);
  report.results[0].cases.pop();
  assert.throws(() => validateAuditBrowser(report, evidence.candidateBrowserVerification.origin), /coverage/);
});

test('audit API is GET-only and rejects publication, configuration and unrelated endpoints before requesting', async () => {
  const calls = [];
  const api = auditApi('test-token', { fetchImpl: async (url, options) => {
    calls.push({ url, options }); return Response.json({ ok: true });
  }, delay: async () => {} });
  await api(`sites/${SITE_ID}`); await api(`deploys/${EXPECTED_BASELINE}/files?per_page=100&page=1`);
  await api(`accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}&scope=functions`);
  assert(calls.every(call => call.options.method === 'GET' && call.options.body === undefined));
  for (const endpoint of [`deploys/${EXPECTED_DEPLOY}/lock`, `sites/${SITE_ID}/deploys`,
    `sites/${SITE_ID}/deploys/${EXPECTED_BASELINE}/restore`, 'deploys/' + 'a'.repeat(24),
    `accounts/${ACCOUNT_ID}/env?site_id=other`]) {
    await assert.rejects(api(endpoint), /Unapproved read-only/);
  }
  assert.equal(calls.length, 3);
});

test('audit fails if the publication, lock, identity or full static preservation changes', () => {
  const site = { id: SITE_ID, account_id: ACCOUNT_ID, published_deploy: { id: EXPECTED_DEPLOY, locked: true } };
  const deploy = { id: EXPECTED_DEPLOY, site_id: SITE_ID, state: 'ready', locked: true,
    published_at: '2026-11-18T17:57:21.131Z', title: `TREE STI wallet recovery ${EXPECTED_SOURCE.slice(0, 12)}; preserve 49 backend packages` };
  assertPublishedIdentity(site, deploy); assertInventoryDelta(evidence.files, original, evidence);
  assert.throws(() => assertPublishedIdentity({ ...site, published_deploy: { id: EXPECTED_BASELINE, locked: true } }, deploy));
  assert.throws(() => assertPublishedIdentity(site, { ...deploy, locked: false }));
  assert.throws(() => assertInventoryDelta({ ...evidence.files, '/scripts/wallet.js': 'a'.repeat(40) }, original, evidence), /inventory changed/);
  assert.throws(() => assertInventoryDelta(evidence.files, { ...original, '/dapp/app.js': 'a'.repeat(40) }, evidence), /two approved/);
});

test('canonical GET audit retries transport timeouts but never bypasses HTTP or content assertions', async () => {
  let calls = 0; const delays = [];
  await verifyCanonicalDelivery({}, { verify: async () => {
    if (++calls < 3) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  }, delay: async n => delays.push(n) });
  assert.equal(calls, 3); assert.deepEqual(delays, [500, 1000]);
  calls = 0;
  await assert.rejects(verifyCanonicalDelivery({}, { verify: async () => { calls++; assert.fail('HTTP or content mismatch'); }, delay: async () => {} }), /HTTP or content mismatch/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(verifyCanonicalDelivery({}, { verify: async () => {
    calls++; throw new DOMException('private transport details', 'TimeoutError');
  }, delay: async () => {} }), { message: 'Canonical delivery GET failed after 3 attempts; raw details withheld.' });
  assert.equal(calls, 3);
});
