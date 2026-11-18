// Complete evidence for an already-published release. Every remote request in
// this audit is read-only; there is no deployment or publication operation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { apiClient } from './release-sti-purchase.mjs';
import { SITE_ID, ACCOUNT_ID, fileInventory, compareBackend,
  validateBrowserReport, assertBrowserVerification } from './release-stats-market.mjs';
import { canonical, fingerprint, readToken, environmentFor, runtimeFor } from './release-preserved-production.mjs';
import { DELIVERY_SOURCES, verifyDelivery } from './sti-purchase-delivery.mjs';

export const EXPECTED_DEPLOY = '6afde69b28000c929ce7a0a4';
export const EXPECTED_BASELINE = '6afddc74d6c8647c67efdbad';
export const EXPECTED_SOURCE = '0a354794c782d4f6c83e17b49e13b7e2577df929';
export const EVIDENCE_SHA256 = '860c4458092976dc747c126e00e2f8afaa1c458f12d3b6f1420ffc0d156b8b51';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ORIGIN = 'https://tree-token.xyz';
const EVIDENCE_FILE = 'production/sti-wallet-recovery-candidate-20261118.json';
const SOURCE_PATHS = ['production/sti-purchase-static', 'production/sti-purchase-release-20261118.json',
  'scripts/release-sti-purchase.mjs', 'scripts/sti-purchase-delivery.mjs',
  'scripts/check-sti-purchase-page.mjs', 'scripts/release-stats-market.mjs',
  'scripts/stats-market-delivery.mjs', 'scripts/release-preserved-production.mjs',
  'tests/fixtures/sti-badge.json', 'tests/fixtures/sti-price.json'];
const eq = (actual, expected, label) => assert(canonical(actual) === canonical(expected), label + ' changed; stop.');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function parseCandidateEvidence(bytes) {
  assert.equal(sha256(bytes), EVIDENCE_SHA256, 'Candidate evidence bytes changed.');
  const report = JSON.parse(bytes.toString('utf8'));
  assert.equal(report.mode, 'verify'); assert.equal(report.result, 'passed');
  assert.equal(report.candidateId, EXPECTED_DEPLOY); assert.equal(report.baselineId, EXPECTED_BASELINE);
  assert.equal(report.sourceCommit, EXPECTED_SOURCE); assert.equal(report.sourceBranch, 'main');
  assert.equal(report.backendAndInventoryVerified, true);
  assert.equal(report.staticFiles, 616); assert.equal(report.baselineStaticFiles, 615);
  assert.equal(report.preservedStaticFiles, 613);
  assert.equal(report.functionsPreserved, 49); assert.equal(report.schedulesPreserved, 5);
  const files = fileInventory(Object.entries(report.files).map(([path, sha]) => ({ path, sha })));
  assert.equal(Object.keys(files).length, 616);
  assertBrowserVerification(report.candidateBrowserVerification,
    { id: EXPECTED_DEPLOY }, { sourceCommit: EXPECTED_SOURCE },
    { links: { permalink: `https://${EXPECTED_DEPLOY}--tree-token.netlify.app` } });
  validateAuditBrowser(report.candidateBrowserVerification.report, `https://${EXPECTED_DEPLOY}--tree-token.netlify.app`);
  return report;
}

export function validateAuditBrowser(report, origin) {
  validateBrowserReport(report, origin, EXPECTED_SOURCE, EXPECTED_DEPLOY);
  assert.equal(report.passed, true); assert.equal(report.testOnly, true);
  assert(report.results.every(result => result.cases?.length === 12 &&
    result.pageErrors?.length === 0 && result.unexpectedMutations?.length === 0),
  'Complete wallet recovery/browser safety coverage is required.');
}

export function auditApi(token, options) {
  const request = apiClient(token, options);
  const allowed = new Set([`sites/${SITE_ID}`, `sites/${SITE_ID}/snippets`,
    `deploys/${EXPECTED_DEPLOY}`, `deploys/${EXPECTED_BASELINE}`,
    `accounts/${ACCOUNT_ID}/env`, `accounts/${ACCOUNT_ID}/env?scope=functions`,
    `accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}`,
    `accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}&scope=functions`]);
  const pages = new RegExp(`^deploys/(?:${EXPECTED_DEPLOY}|${EXPECTED_BASELINE})/files\\?per_page=100&page=([1-9][0-9]?)$`);
  return async endpoint => {
    assert(allowed.has(endpoint) || pages.test(endpoint), 'Unapproved read-only audit endpoint.');
    return request(endpoint, 'GET');
  };
}

async function inventory(api, id) {
  const rows = [];
  for (let page = 1; page < 100; page++) {
    const batch = await api(`deploys/${id}/files?per_page=100&page=${page}`);
    assert(Array.isArray(batch), 'Invalid inventory response.'); rows.push(...batch);
    if (batch.length < 100) return fileInventory(rows);
  }
  throw Error('Static inventory exceeded the bounded audit reader.');
}

async function protectedEnvironment(api, site) {
  const base = `accounts/${ACCOUNT_ID}/env`, query = `?site_id=${SITE_ID}`;
  const [allSite, siteFunctions, shared, sharedFunctions] = await Promise.all([
    api(base + query), api(base + query + '&scope=functions'), api(base), api(base + '?scope=functions'),
  ]);
  const configuration = environmentFor({ site: allSite, siteFunctions, shared, sharedFunctions, buildSettings: site.build_settings });
  const snippets = await api(`sites/${SITE_ID}/snippets`);
  assert(Array.isArray(snippets), 'Site snippet configuration unavailable.');
  return { ...configuration, snippetsSha256: fingerprint(snippets) };
}

export function assertPublishedIdentity(site, deploy) {
  assert.equal(site.id, SITE_ID); assert.equal(site.account_id, ACCOUNT_ID);
  assert.equal(site.published_deploy?.id, EXPECTED_DEPLOY, 'Current publication changed.');
  assert.equal(site.published_deploy.locked, true, 'Current publication lock changed.');
  assert.equal(deploy.id, EXPECTED_DEPLOY); assert.equal(deploy.site_id, SITE_ID);
  assert.equal(deploy.state, 'ready'); assert.equal(deploy.locked, true);
  assert(Number.isFinite(Date.parse(deploy.published_at)), 'Published deployment timestamp is missing.');
  assert.equal(deploy.title, `TREE STI wallet recovery ${EXPECTED_SOURCE.slice(0, 12)}; preserve 49 backend packages`);
}

export function assertInventoryDelta(files, baselineFiles, evidence) {
  eq(files, evidence.files, 'Complete published static inventory');
  assert.equal(Object.keys(baselineFiles).length, 615);
  assert(Object.keys(baselineFiles).every(p => Object.hasOwn(files, p)), 'An existing path was removed.');
  eq(Object.keys(baselineFiles).filter(p => files[p] !== baselineFiles[p]).sort(),
    ['/dapp/index.html', '/dapp/sti-widget.js'], 'Only the two approved files differ');
  eq(Object.keys(files).filter(p => !Object.hasOwn(baselineFiles, p)),
    ['/dapp/sti-wallet-recovery.js'], 'Only the approved recovery script was added');
  for (const [pathname, hashes] of Object.entries(evidence.changedFileHashes)) {
    assert.equal(baselineFiles[pathname] ?? null, hashes.before, 'Recorded original bytes changed.');
    assert.equal(files[pathname], hashes.after, 'Recorded replacement bytes changed.');
  }
}

async function verifyPublishedState(api, evidence) {
  const site = await api(`sites/${SITE_ID}`);
  const [deploy, baseline, files, baselineFiles, environment] = await Promise.all([
    api(`deploys/${EXPECTED_DEPLOY}`), api(`deploys/${EXPECTED_BASELINE}`),
    inventory(api, EXPECTED_DEPLOY), inventory(api, EXPECTED_BASELINE), protectedEnvironment(api, site),
  ]);
  assertPublishedIdentity(site, deploy);
  assert.equal(baseline.id, EXPECTED_BASELINE); assert.equal(baseline.state, 'ready');
  compareBackend(deploy, baseline);
  assert.equal(fingerprint(baseline.available_functions), evidence.completeFunctionRecordsSHA256, 'Baseline function evidence changed.');
  assert.equal(fingerprint(baseline.function_schedules), evidence.schedulesSHA256, 'Baseline schedule evidence changed.');
  assert.equal(fingerprint(runtimeFor(deploy)), evidence.runtimeSHA256, 'Published runtime evidence changed.');
  assert.equal(fingerprint(environment), evidence.protectedConfigurationSHA256, 'Protected environment/configuration changed.');
  assertInventoryDelta(files, baselineFiles, evidence);
  return deploy;
}

export async function verifyCanonicalDelivery(plan, { verify = verifyDelivery, delay = wait } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await verify(ORIGIN, plan, ROOT); return; }
    catch (error) {
      const transport = ['AbortError', 'TimeoutError'].includes(error?.name) ||
        (error instanceof TypeError && /fetch|network|load/i.test(error.message));
      if (!transport) throw error;
      if (attempt === 2) throw Error('Canonical delivery GET failed after 3 attempts; raw details withheld.');
      await delay(500 * (attempt + 1));
    }
  }
}

async function canonicalBrowser() {
  assert(process.env.STI_PURCHASE_BROWSER_MODULE, 'The isolated browser checker module is required.');
  const reportPath = path.join(ROOT, '.netlify/sti-purchase-browser-checks.json');
  fs.rmSync(reportPath, { force: true });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/check-sti-purchase-page.mjs'], {
      cwd: ROOT, stdio: 'inherit', timeout: 300000,
      env: { ...process.env, STI_PURCHASE_TEST_BASE: ORIGIN,
        STI_PURCHASE_SOURCE_COMMIT: EXPECTED_SOURCE, STI_PURCHASE_CANDIDATE_ID: EXPECTED_DEPLOY },
    });
    child.once('error', () => reject(Error('Canonical browser checker could not start.')));
    child.once('close', code => code === 0 ? resolve() : reject(Error('Canonical browser verification failed.')));
  });
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  validateAuditBrowser(report, ORIGIN);
  return { candidateId: EXPECTED_DEPLOY, sourceCommit: EXPECTED_SOURCE, origin: ORIGIN,
    checkedAt: new Date().toISOString(), reportSha256: fingerprint(report), report };
}

export async function main() {
  assert.equal(process.argv.length, 2, 'This read-only audit accepts no mutation modes or deployment overrides.');
  git('merge-base', '--is-ancestor', EXPECTED_SOURCE, 'HEAD');
  assert.equal(git('diff', '--name-only', EXPECTED_SOURCE, '--', ...SOURCE_PATHS), '', 'Published frontend or verification sources changed.');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHS), '', 'Unexpected source files.');
  const evidence = parseCandidateEvidence(fs.readFileSync(path.join(ROOT, EVIDENCE_FILE)));
  const api = auditApi(readToken());
  const first = await verifyPublishedState(api, evidence);
  const plan = { sources: { ...DELIVERY_SOURCES }, files: evidence.files };
  await verifyCanonicalDelivery(plan);
  const canonicalBrowserVerification = await canonicalBrowser();
  const final = await verifyPublishedState(api, evidence);
  assert.equal(final.published_at, first.published_at, 'Publication changed during the audit.');
  const report = { ...evidence, mode: 'post-publication-audit', result: 'passed',
    checkedAt: new Date().toISOString(), publishedAt: final.published_at,
    publicationConfirmed: true, productionChanged: false, remoteMutations: 0,
    productionLocked: true, backendAndInventoryVerified: true, canonicalDeliveryVerified: true,
    canonicalBrowserVerification, candidateEvidenceSHA256: EVIDENCE_SHA256,
    auditSourceCommit: git('rev-parse', 'HEAD'), auditScript: 'scripts/audit-sti-wallet-publication.mjs' };
  const filename = path.join(ROOT, '.netlify/sti-wallet-publication-audit.json');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  fs.writeFileSync(filename + '.sha256', fingerprint(report) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ result: report.result, mode: report.mode, candidateId: EXPECTED_DEPLOY,
    sourceCommit: EXPECTED_SOURCE, staticFiles: 616, preservedStaticFiles: 613,
    functionsPreserved: 49, schedulesPreserved: 5, canonicalDeliveryVerified: true,
    canonicalBrowserVerification: canonicalBrowserVerification.reportSha256, remoteMutations: 0 }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
