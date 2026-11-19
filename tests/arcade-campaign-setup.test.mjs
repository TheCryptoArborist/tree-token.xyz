import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createSetup, loadSetupSource, validateSetup, reviewSetup, formatSetupReview, formatExactUnits } from '../scripts/arcade-campaigns/setup.mjs';
import { main } from '../scripts/arcade-campaigns/setup-cli.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const source = await loadSetupSource();
const actual = JSON.parse(await readFile(new URL('../data/arcade-weekly-campaign-setup.json', import.meta.url), 'utf8'));
const fresh = () => createSetup(source);
const complete = () => {
  const setup = fresh();
  setup.decisions = {
    challenge: { title: 'Synthetic practice proposal', rulesBasis: 'review-pinned-pilot', objectiveChoice: 'win-one-match', attemptPolicy: 'repeat-attempts-one-share' },
    schedule: { startsAt: '2020-01-01T00:00:00Z', endsAt: '2020-01-08T00:00:00Z' },
    pool: { network: 'fictional-test-network', assetId: 'nontransferable:TEST', symbol: 'TEST', decimals: 2, poolUnits: '1001' },
    playersAndReview: {
      identityMethod: 'Synthetic claimed identity method only.', identityReviewerId: 'fictional-reviewer',
      recipientReviewMethod: 'Synthetic claimed recipient check only.', reviewEndsAt: '2020-01-10T00:00:00Z',
      payoutTiming: 'Fictional example; no payment.', correctionPolicy: 'Synthetic correction process only.',
    },
    associatedEvent: { id: 'fictional-event', href: '/play/#events' },
    finalTerms: { residualPolicy: 'leave-unallocated', noQualifiersPolicy: 'leave-unallocated', cancellationPolicy: 'Fictional example; no funding exists.' },
  };
  return setup;
};

test('the actual setup pins source facts but leaves all 22 choices open in six useful groups', () => {
  assert.deepEqual(actual, fresh());
  const before = JSON.stringify(actual), result = validateSetup(actual, source), review = reviewSetup(actual, source);
  assert.equal(result.valid, true);
  assert.equal(result.decisionsComplete, false);
  assert.equal(result.missingDecisions.length, 6);
  assert.equal(result.missingDecisions.reduce((sum, group) => sum + group.fields.length, 0), 22);
  assert.ok(Object.values(actual.decisions).flatMap(group => Object.values(group)).every(value => value === null));
  assert.equal(actual.proposal.objective.classification, 'participation-practice');
  assert.equal(actual.proposal.objective.fundedSkillTargetEstablished, false);
  assert.equal(source.challengeDate, '2026-11-18');
  assert.equal(source.variant.id, 'standard');
  assert.equal(source.maxAttemptSeconds, 900);
  assert.equal(source.maxMoves, 100);
  assert.equal(source.dealRules.fifthCardEnabled, false);
  assert.equal(source.dealRules.equalHandStrengthGuaranteed, false);
  assert.equal(review.sharePreview, null);
  assert.equal(JSON.stringify(actual), before);
});

test('changes to every material source reference block review rather than silently refreshing it', () => {
  const changes = [
    s => { s.pilotRulesHash = '0'.repeat(64); }, s => { s.challengeDate = '2026-11-19'; },
    s => { s.game.version = 'another-version'; }, s => { s.game.sourceHash = '0'.repeat(64); },
    s => { s.game.ruleset = 'other-rules'; }, s => { s.adapter.version = '2.0.0'; },
    s => { s.variant.id = 'another-variant'; }, s => { s.variant.targetGrowth = 1; },
    s => { s.maxAttemptSeconds = 1200; }, s => { s.maxMoves = 200; },
    s => { s.dealRules.hands = 'identical-hands'; }, s => { s.dealRules.fifthCardEnabled = true; },
    s => { s.implementationHashes.adapterSha256 = 'f'.repeat(64); },
    s => { s.implementationHashes.pilotRulesSha256 = 'f'.repeat(64); },
  ];
  for (const change of changes) {
    const setup = fresh(); change(setup.sourceKnown);
    assert.ok(validateSetup(setup, source).issues.some(issue => issue.path === 'sourceKnown'));
    assert.throws(() => reviewSetup(setup, source), /source reference drifted/);
  }
});

test('loading pinned source rejects a changed rule hash and changed engine bytes', async () => {
  await assert.rejects(loadSetupSource(async url => {
    const bytes = await readFile(url);
    if (url.pathname.endsWith('/data/arcade-challenge-pilot-november-2026.json')) {
      const pilot = JSON.parse(String(bytes)); pilot.rulesHash = '0'.repeat(64); return JSON.stringify(pilot);
    }
    return bytes;
  }), /rule hash/);
  await assert.rejects(loadSetupSource(async url => {
    const bytes = await readFile(url);
    return url.pathname.endsWith('/runtime/practice-battle.mjs') ? Buffer.concat([bytes, Buffer.from('\n// Changed deal implementation\n')]) : bytes;
  }), /Pinned engine bytes changed/);
});

test('adapter byte drift is visible even when its declared game version stays unchanged', async () => {
  const changed = await loadSetupSource(async url => {
    const bytes = await readFile(url);
    return url.pathname.endsWith('/scripts/arcade-campaigns/trials-adapter.mjs') ? Buffer.concat([bytes, Buffer.from('\n// Changed adapter\n')]) : bytes;
  });
  assert.ok(validateSetup(actual, changed).issues.some(issue => issue.path === 'sourceKnown'));
});

test('unknown fields and unsafe authority claims are rejected at every setup level', () => {
  for (const change of [
    s => { s.publish = true; }, s => { s.payable = true; }, s => { s.launchReady = true; },
    s => { s.status = 'funded'; }, s => { s.sourceKnown.verifiedPeople = true; },
    s => { s.proposal.funded = true; }, s => { s.decisions.transaction = {}; },
    s => { s.decisions.pool.verified = true; }, s => { s.decisions.playersAndReview.authenticated = true; },
    s => { s.decisions.associatedEvent.campaignRequiredForEntry = true; },
    s => { delete s.decisions.schedule.startsAt; },
  ]) {
    const setup = fresh(); change(setup);
    assert.equal(validateSetup(setup, source).valid, false);
    assert.throws(() => reviewSetup(setup, source), /Invalid setup/);
  }
});

test('win-three and arbitrary start caps cannot be smuggled in as known objective/attempt choices', () => {
  for (const change of [
    s => { s.proposal.objective.targetUnits = '3'; },
    s => { s.decisions.challenge.objectiveChoice = 'win-three-matches'; },
    s => { s.decisions.challenge.targetUnits = '3'; },
    s => { s.decisions.challenge.attemptPolicy = 'twenty-starts-per-week'; },
    s => { s.proposal.attempts.weeklyStartLimit = 20; },
  ]) {
    const setup = fresh(); change(setup);
    assert.equal(validateSetup(setup, source).valid, false);
  }
  assert.match(formatSetupReview(reviewSetup(fresh(), source)), /concurrency limit, not a weekly allowance/);
});

test('asset examples require every valid pool field and never infer an asset from a ticker', () => {
  for (const key of Object.keys(complete().decisions.pool)) {
    const setup = complete(); setup.decisions.pool[key] = null;
    const review = reviewSetup(setup, source);
    assert.equal(review.sharePreview, null, key);
    assert.equal(review.decisionsComplete, false);
  }
  const setup = fresh(); setup.decisions.pool.symbol = 'SUI';
  assert.equal(reviewSetup(setup, source).sharePreview, null);
});

test('pool validation rejects numeric/decimal/exponent units and ambiguous metadata', () => {
  for (const [field, value] of [
    ['poolUnits', 1000], ['poolUnits', '1.5'], ['poolUnits', '1e9'], ['poolUnits', '01'], ['poolUnits', '0'],
    ['poolUnits', '-1'], ['decimals', '9'], ['decimals', 31], ['decimals', -1],
    ['assetId', ' 0xTOKEN'], ['network', 'Sui mainnet'], ['symbol', 'usdc'],
  ]) {
    const setup = complete(); setup.decisions.pool[field] = value;
    assert.ok(validateSetup(setup, source).issues.some(issue => issue.path === 'decisions.pool.' + field));
  }
});

test('share examples conserve huge exact-unit pools, show zero qualifiers and disclose remainders', () => {
  const setup = complete(); setup.decisions.pool.poolUnits = '900719925474099312345678901'; setup.decisions.pool.decimals = 9;
  const preview = reviewSetup(setup, source).sharePreview;
  assert.equal(preview.poolAmount, '900719925474099312.345678901');
  assert.equal(preview.inputClassification, 'operator-entered-not-verified');
  for (const row of preview.scenarios) {
    assert.equal(BigInt(row.allocatedUnits) + BigInt(row.unallocatedUnits), BigInt(setup.decisions.pool.poolUnits));
    assert.equal(BigInt(row.perPlayerUnits) * BigInt(row.qualifierCount), BigInt(row.allocatedUnits));
  }
  assert.equal(preview.scenarios[0].reason, 'no-qualifiers');
  assert.equal(preview.scenarios[0].unallocatedUnits, setup.decisions.pool.poolUnits);
  assert.ok(preview.scenarios.some(row => row.reason === 'whole-unit-remainder'));
  setup.decisions.pool.poolUnits = '1'; setup.decisions.pool.decimals = 0;
  assert.equal(reviewSetup(setup, source).sharePreview.scenarios.find(row => row.qualifierCount === 25).reason, 'pool-smaller-than-qualifier-count');
  assert.equal(formatExactUnits('1', 30), '0.000000000000000000000000000001');
});

test('all entered terms remain nonpayable, unauthenticated and outside production', () => {
  const setup = complete(), review = reviewSetup(setup, source);
  assert.equal(validateSetup(setup, source).decisionsComplete, true);
  assert.equal(review.decisionsComplete, true);
  assert.deepEqual(review.missingDecisions, []);
  assert.equal(review.payable, false);
  assert.equal(review.launchReady, false);
  assert.equal(review.operatorClaimsAuthenticated, false);
  assert.equal(review.productionIntegrationReady, false);
  assert.ok(review.sections.flatMap(section => section.fields).every(field => field.status === 'operator-entered-not-verified'));
  const markdown = formatSetupReview(review);
  assert.match(markdown, /offline, unverified proposal/);
  assert.match(markdown, /Existing no-prize pilot results remain ineligible/);
  assert.match(markdown, /not an established demanding skill threshold/);
});

test('UTC boundaries and review/correction chronology must be explicit and valid', () => {
  for (const change of [
    s => { s.decisions.schedule.startsAt = '2020-02-30T00:00:00Z'; },
    s => { s.decisions.schedule.startsAt = '2020-01-01T00:00:00-06:00'; },
    s => { s.decisions.schedule.endsAt = s.decisions.schedule.startsAt; },
    s => { s.decisions.schedule.endsAt = '2019-12-31T00:00:00Z'; },
    s => { s.decisions.playersAndReview.reviewEndsAt = s.decisions.schedule.endsAt; },
    s => { s.decisions.playersAndReview.reviewEndsAt = '2020-01-07T23:59:59Z'; },
  ]) {
    const setup = complete(); change(setup);
    assert.equal(validateSetup(setup, source).valid, false);
  }
});

test('Event paths stay within the Arcade and Markdown values cannot inject markup', () => {
  for (const href of ['https://example.com/', '//example.com/', '/play/../wallet/', '/play/#events?external=1']) {
    const setup = complete(); setup.decisions.associatedEvent.href = href;
    assert.equal(validateSetup(setup, source).valid, false);
  }
  const setup = complete(); setup.decisions.challenge.title = '<img src=x onerror=alert(1)> [click](https://example.com) | heading';
  const markdown = formatSetupReview(reviewSetup(setup, source));
  assert.ok(!markdown.includes('<img'));
  assert.ok(!markdown.includes('[click](https://example.com)'));
  assert.ok(markdown.includes('&lt;img'));
  assert.ok(markdown.includes('\\| heading'));
});

test('the CLI provides a six-section Markdown review and grouped JSON without changing files', async () => {
  const path = fileURLToPath(new URL('../data/arcade-weekly-campaign-setup.json', import.meta.url));
  const before = await readFile(path, 'utf8');
  let markdown = '';
  assert.equal(await main(['review', path], value => { markdown += value; }), 0);
  assert.match(markdown, /## 1\. Challenge/);
  assert.match(markdown, /## 6\. Final terms/);
  let output = '';
  assert.equal(await main(['check', path], value => { output += value; }), 2);
  assert.equal(JSON.parse(output).missingDecisions.length, 6);
  output = '';
  assert.equal(await main(['review', path, '--json'], value => { output += value; }), 0);
  assert.equal(JSON.parse(output).payable, false);
  assert.equal(await readFile(path, 'utf8'), before);
});

test('real CLI exit codes distinguish open choices, entered choices, invalid fields and parse errors', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'arcade-setup-test-'));
  const cli = fileURLToPath(new URL('../scripts/arcade-campaigns/setup-cli.mjs', import.meta.url));
  const path = join(folder, 'setup.json');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  try {
    await writeFile(path, JSON.stringify(fresh()));
    assert.equal(run('check', path).status, 2);
    assert.equal(run('review', path).status, 0);
    await writeFile(path, JSON.stringify(complete()));
    const entered = run('check', path);
    assert.equal(entered.status, 0);
    assert.equal(JSON.parse(entered.stdout).launchReady, false);
    const unsafe = complete(); unsafe.payable = true;
    await writeFile(path, JSON.stringify(unsafe));
    assert.equal(run('review', path).status, 2);
    await writeFile(path, '{broken JSON');
    assert.equal(run('review', path).status, 1);
    assert.equal(run('publish', path).status, 1);
    assert.equal(run('review', path, '--json', '--json').status, 1);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
