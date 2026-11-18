import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalJson, equalShares, freezeDraft, planAllocation, utcMillis, validateDraft, verifyFrozenRules } from '../scripts/arcade-campaigns/core.mjs';
import { syntheticDemo } from '../scripts/arcade-campaigns/synthetic-demo.mjs';

const cli = fileURLToPath(new URL('../scripts/arcade-campaigns/dry-run.mjs', import.meta.url));
const runCli = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });
const plan = fixture => planAllocation(fixture.frozen, fixture.manifest, fixture.asOf);
function oneRun(change = {}, identityChange = {}) {
  const fixture = syntheticDemo();
  fixture.manifest.runs = [{ ...fixture.manifest.runs[0], ...change }];
  fixture.manifest.identities = [{ ...fixture.manifest.identities[0], ...identityChange }];
  return fixture;
}

test('real operator draft keeps funding, target, schedule and verification decisions unset', async () => {
  const draft = JSON.parse(await readFile(new URL('../data/arcade-campaigns-draft.json', import.meta.url)));
  const result = validateDraft(draft);
  assert.equal(result.valid, false);
  for (const field of ['reward.poolUnits', 'reward.network', 'reward.assetId', 'window.startsAt', 'objective.targetUnits', 'verification.runAdapterId', 'allocation.residualPolicy']) assert.ok(result.issues.some(issue => issue.path === field), field);
  assert.throws(() => freezeDraft(draft), /incomplete/);
});

test('canonical rule identity ignores JSON key order but rejects unsafe numeric quantities', () => {
  assert.equal(canonicalJson({ b: { y: 2, x: 1 }, a: '3' }), canonicalJson({ a: '3', b: { x: 1, y: 2 } }));
  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, 1n, undefined, NaN]) assert.throws(() => canonicalJson(value), /plain JSON/);
});

test('frozen draft is deeply immutable and independent of the source draft', () => {
  const fixture = syntheticDemo(), originalHash = fixture.frozen.rulesHash;
  fixture.draft.reward.poolUnits = '999';
  assert.equal(fixture.frozen.rules.reward.poolUnits, '10');
  assert.throws(() => { fixture.frozen.rules.reward.poolUnits = '999'; }, TypeError);
  assert.equal(verifyFrozenRules(JSON.parse(JSON.stringify(fixture.frozen))).rulesHash, originalHash);
});

test('editing a serialized frozen term invalidates its rule identity', () => {
  const fixture = syntheticDemo(), changed = structuredClone(fixture.frozen);
  changed.rules.reward.poolUnits = '11';
  assert.throws(() => planAllocation(changed, fixture.manifest, fixture.asOf), /hash no longer matches/);
});

test('rule identity binds target, asset, version and Event association', () => {
  const { draft, frozen } = syntheticDemo();
  for (const [group, field, value] of [['reward', 'assetId', 'DIFFERENT-ASSET'], ['objective', 'targetUnits', '101'], ['game', 'version', 'fixture-v2'], ['associatedEvent', 'id', 'another-event']]) {
    const changed = structuredClone(draft); changed[group][field] = value;
    assert.notEqual(freezeDraft(changed).rulesHash, frozen.rulesHash);
  }
});

test('unknown terms, paid entry and an unsupported paid-advantage policy cannot freeze', () => {
  const { draft } = syntheticDemo();
  for (const change of [d => { d.paymentEnabled = true; }, d => { d.eligibility.entry = 'paid'; }, d => { d.eligibility.purchaseRequired = true; }, d => { d.eligibility.paidAdvantages = 'allowed'; }]) {
    const changed = structuredClone(draft); change(changed); assert.throws(() => freezeDraft(changed), /incomplete or invalid/);
  }
});

test('UTC validation rejects offsets, impossible dates, and empty or reversed windows', () => {
  for (const value of ['2000-02-30T00:00:00Z', '2000-01-01T00:00:00+00:00', '2000-01-01', '2000-01-01T24:00:00Z']) assert.ok(Number.isNaN(utcMillis(value)), value);
  assert.equal(utcMillis('2000-01-01T00:00:00Z'), utcMillis('2000-01-01T00:00:00.000Z'));
  const { draft } = syntheticDemo(); draft.window.endsAt = draft.window.startsAt;
  assert.throws(() => freezeDraft(draft), /window.endsAt/);
});

test('token units stay exact well beyond JavaScript safe integer limits', () => {
  const pool = '999999999999999999999999999999999999999999999999999999999999';
  const result = equalShares(pool, 7);
  assert.equal(BigInt(result.allocatedUnits) + BigInt(result.unallocatedUnits), BigInt(pool));
  assert.equal(BigInt(result.perPlayerUnits), BigInt(pool) / 7n);
  for (const bad of [1, 1n, '1.0', '1e6', '-1', '01', '0']) assert.throws(() => equalShares(bad, 3));
});

test('no qualifiers leave the complete pool explicitly unallocated', () => {
  const fixture = syntheticDemo(); fixture.manifest.runs = [];
  const result = plan(fixture);
  assert.deepEqual(result.accounting, { poolUnits: '10', qualifierCount: 0, perPlayerUnits: '0', allocatedUnits: '0', unallocatedUnits: '10', reason: 'no-qualifiers' });
  assert.deepEqual(result.roster, []);
});

test('a pool smaller than the roster never rounds up or invents funding', () => {
  assert.deepEqual(equalShares('2', 3), { poolUnits: '2', qualifierCount: 3, perPlayerUnits: '0', allocatedUnits: '0', unallocatedUnits: '2', reason: 'pool-smaller-than-qualifier-count' });
  assert.equal(equalShares('12', 3).reason, 'exact-division');
});

test('three achievers split a fixed pool equally; repeated attempts do not add shares', () => {
  const result = plan(syntheticDemo());
  assert.equal(result.roster.length, 3);
  assert.deepEqual(result.roster.map(row => row.units), ['3', '3', '3']);
  assert.equal(result.roster[0].qualifyingAttemptCount, 2);
  assert.equal(result.accounting.unallocatedUnits, '1');
  assert.equal(result.accounting.allocatedUnits, '9');
});

test('input ordering cannot change shares or chosen supporting evidence', () => {
  const fixture = syntheticDemo(), expected = plan(fixture);
  fixture.manifest.runs.reverse(); fixture.manifest.identities.reverse();
  const actual = plan(fixture);
  assert.deepEqual(actual.roster, expected.roster);
  assert.deepEqual(actual.accounting, expected.accounting);
});

test('duplicate identities and identity evidence block the entire ambiguous manifest', () => {
  for (const field of ['playerId', 'identityEvidenceId']) {
    const fixture = syntheticDemo(); fixture.manifest.identities[1][field] = fixture.manifest.identities[0][field];
    assert.throws(() => plan(fixture), /Duplicate player identity/);
  }
});

test('duplicate run references or original evidence hashes cannot be reused', () => {
  for (const field of ['evidenceId', 'evidenceSha256']) {
    const fixture = syntheticDemo(); fixture.manifest.runs[1][field] = fixture.manifest.runs[0][field];
    assert.throws(() => plan(fixture), /Duplicate run evidence/);
  }
});

test('browser-submitted and unreviewed evidence cannot qualify', () => {
  for (const change of [{ source: 'browser' }, { source: 'client', reviewStatus: 'verified' }, { reviewStatus: 'pending' }, { reviewStatus: 'rejected' }]) {
    const result = plan(oneRun(change)); assert.equal(result.roster.length, 0); assert.equal(result.rejected[0].reason, 'not-server-reviewed');
  }
  assert.equal(plan(oneRun({ verified: true })).rejected[0].reason, 'unsupported-evidence-shape');
});

test('only a separately reviewed canonical player identity can qualify', () => {
  for (const change of [{ status: 'pending' }, { source: 'browser' }, { reviewerId: 'different-reviewer' }, { reviewedAt: '2000-01-10T00:00:00Z' }]) assert.equal(plan(oneRun({}, change)).rejected[0].reason, 'identity-not-reviewed');
  assert.equal(plan(oneRun({ playerId: 'unknown-player' })).rejected[0].reason, 'identity-not-reviewed');
});

test('evidence is bound to the campaign and full immutable rules hash', () => {
  for (const change of [{ campaignId: 'another-campaign' }, { rulesHash: 'a'.repeat(64) }]) assert.equal(plan(oneRun(change)).rejected[0].reason, 'wrong-campaign-or-rules');
});

test('a different game, game version or gameplay ruleset does not qualify', () => {
  for (const field of ['gameId', 'gameVersion', 'gameRuleset']) assert.equal(plan(oneRun({ [field]: 'different-value' })).rejected[0].reason, 'wrong-game-version-or-ruleset');
});

test('a different verification adapter or adapter version does not qualify', () => {
  for (const field of ['adapterId', 'adapterVersion']) assert.equal(plan(oneRun({ [field]: 'different-value' })).rejected[0].reason, 'wrong-verification-adapter');
});

test('the start is inclusive and completion at the exact UTC deadline is excluded', () => {
  const fixture = oneRun(); fixture.manifest.runs[0].startedAt = fixture.draft.window.startsAt;
  assert.equal(plan(fixture).roster.length, 1);
  for (const change of [{ startedAt: '1999-12-31T23:59:59.999Z' }, { completedAt: '2000-01-08T00:00:00.000Z' }, { startedAt: '2000-01-03T00:06:00.000Z' }, { completedAt: '2000-01-09T00:00:00.000Z' }]) assert.equal(plan(oneRun(change)).rejected[0].reason, 'outside-utc-window');
});

test('review timestamps cannot precede completion or follow the fixed as-of time', () => {
  for (const reviewedAt of ['2000-01-01T00:00:00Z', '2000-01-10T00:00:00Z', 'invalid']) assert.equal(plan(oneRun({ reviewedAt })).rejected[0].reason, 'invalid-review-time');
});

test('incomplete play, paid gameplay advantages and debug runs are excluded', () => {
  for (const change of [{ completed: false }, { paidAdvantagesUsed: true }, { debugUsed: true }, { paidAdvantagesUsed: null }]) assert.equal(plan(oneRun(change)).rejected[0].reason, 'ineligible-gameplay');
});

test('score claims must use the selected metric and exact integer target comparison', () => {
  assert.equal(plan(oneRun({ metricUnits: '99' })).rejected[0].reason, 'target-not-reached');
  for (const change of [{ metric: 'other-score' }, { metricUnits: 100 }, { metricUnits: '100.5' }]) assert.equal(plan(oneRun(change)).rejected[0].reason, 'invalid-objective-evidence');
  for (const operator of ['lte', 'eq']) {
    const fixture = oneRun({ metricUnits: '100' }); fixture.draft.objective.operator = operator;
    fixture.frozen = freezeDraft(fixture.draft); fixture.manifest.rulesHash = fixture.frozen.rulesHash; fixture.manifest.runs[0].rulesHash = fixture.frozen.rulesHash;
    assert.equal(plan(fixture).roster.length, 1);
    fixture.manifest.runs[0].metricUnits = '101'; assert.equal(plan(fixture).roster.length, 0);
  }
});

test('a roster requires a closed window and an explicitly bound offline manifest', () => {
  const fixture = syntheticDemo();
  for (const asOf of ['2000-01-07T23:59:59.999Z', undefined, '2000-01-09']) assert.throws(() => planAllocation(fixture.frozen, fixture.manifest, asOf), /as-of/);
  for (const change of [{ purpose: 'payment' }, { campaignId: 'different-campaign' }, { rulesHash: 'a'.repeat(64) }, { classification: 'authenticated' }]) assert.throws(() => planAllocation(fixture.frozen, { ...fixture.manifest, ...change }, fixture.asOf), /offline review manifest/);
});

test('even a complete operator export produces no payment authorization or launch readiness', () => {
  const fixture = syntheticDemo(); fixture.manifest.classification = 'operator-supplied';
  const result = plan(fixture);
  assert.equal(result.payable, false); assert.equal(result.launchReady, false);
  assert.match(result.verificationNotice, /not authenticated/);
  assert.doesNotThrow(() => canonicalJson(result));
  assert.ok(Object.isFrozen(result.roster[0]));
});

test('CLI reports actual unresolved terms and exits distinctly from execution errors', () => {
  const result = runCli(['check']); assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout); assert.equal(report.valid, false); assert.equal(report.launchReady, false);
  assert.equal(runCli(['publish']).status, 1);
});

test('CLI demo is clearly synthetic and accounts for all ten fictional units', () => {
  const result = runCli(['demo']); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.classification, 'synthetic-fixture'); assert.equal(report.asset.network, 'offline:synthetic');
  assert.equal(report.accounting.allocatedUnits, '9'); assert.equal(report.accounting.unallocatedUnits, '1'); assert.equal(report.payable, false);
});

test('CLI freezes a local fixture and plans its roster without mutating its input files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arcade-campaign-test-'));
  try {
    const fixture = syntheticDemo(), draftPath = join(directory, 'draft.json'), frozenPath = join(directory, 'frozen.json'), evidencePath = join(directory, 'evidence.json');
    const draftText = JSON.stringify(fixture.draft), evidenceText = JSON.stringify(fixture.manifest);
    await Promise.all([writeFile(draftPath, draftText), writeFile(evidencePath, evidenceText)]);
    const frozen = runCli(['freeze', draftPath]); assert.equal(frozen.status, 0, frozen.stderr);
    await writeFile(frozenPath, frozen.stdout);
    const planned = runCli(['plan', frozenPath, evidencePath, fixture.asOf]); assert.equal(planned.status, 0, planned.stderr);
    assert.deepEqual(JSON.parse(planned.stdout).roster, plan(fixture).roster);
    assert.equal(await readFile(draftPath, 'utf8'), draftText); assert.equal(await readFile(evidencePath, 'utf8'), evidenceText);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
