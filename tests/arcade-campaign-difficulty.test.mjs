import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createChallenge, inspectReplay } from '../scripts/arcade-campaigns/trials-adapter.mjs';
import { POLICY_IDS, choosePolicyMove, printedGrowthScore } from '../scripts/arcade-campaigns/difficulty-policies.mjs';
import { CHALLENGE_DATE, PILOT_RULES_HASH, syntheticSeedHex, syntheticUniformIndex, simulateSyntheticAttempt, evaluateDifficulty, qualificationTable } from '../scripts/arcade-campaigns/difficulty-evaluation.mjs';

const baseView = () => structuredClone(inspectReplay(createChallenge(syntheticSeedHex(0, 0), CHALLENGE_DATE), []).view);
const privateKeys = new Set(['seed', 'seedHex', 'randomState', 'player2Moves', 'botMoveHistory', 'allBotMoves', 'battleId', 'lastMoveMs', 'timestamp', 'challenge']);
function assertPublic(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!privateKeys.has(key), key);
    assertPublic(item);
  }
}

test('the full declared offline evidence reproduces exactly with verified pinned engine bytes', () => {
  const evidence = JSON.parse(readFileSync(new URL('../docs/arcade-campaign-difficulty-evidence.json', import.meta.url)));
  const actual = evaluateDifficulty();
  assert.deepEqual(actual, evidence);
  assert.equal(actual.experiment.totalMatches, 5120);
  assert.equal(actual.experiment.title, 'Root Rush');
  assert.equal(actual.experiment.challengeDate, CHALLENGE_DATE);
  assert.equal(actual.provenance.pilotRulesHash, PILOT_RULES_HASH);
  assert.equal(actual.pairedOutcomes.starts, 2560);
  assert.equal(Object.entries(actual.pairedOutcomes).filter(([key]) => key !== 'starts').reduce((sum, [, value]) => sum + value, 0), 2560);
  for (const summary of Object.values(actual.results)) {
    assert.equal(summary.wins.count + summary.losses.count + summary.moveLimit.count, 2560);
    assert.equal(Object.values(summary.handComposition).reduce((sum, entry) => sum + entry.attempts, 0), 2560);
  }
  for (const field of ['payable', 'prizeEligible', 'awardsEnabled', 'launchReady', 'humanDifficultyMeasured']) assert.equal(actual[field], false);
});

test('seeds and independent choice streams are reproducible without wall-clock or global randomness', () => {
  const originalNow = Date.now, originalRandom = Math.random;
  try {
    Date.now = () => 0;
    Math.random = () => { throw Error('Unseeded randomness is forbidden.'); };
    const before = evaluateDifficulty({ cohortCount: 2 });
    Date.now = () => 9000000000000;
    assert.deepEqual(evaluateDifficulty({ cohortCount: 2 }), before);
  } finally { Date.now = originalNow; Math.random = originalRandom; }
  const a = syntheticUniformIndex(0, 0), b = syntheticUniformIndex(0, 0);
  assert.deepEqual(Array.from({ length: 30 }, () => a(3)), Array.from({ length: 30 }, () => b(3)));
  assert.match(syntheticSeedHex(0, 0), /^[a-f0-9]{64}$/);
  assert.notEqual(syntheticSeedHex(0, 0), syntheticSeedHex(0, 1));
  assert.notEqual(syntheticSeedHex(0, 1), syntheticSeedHex(1, 0));
});

test('every observed policy decision uses immutable public data and a legal card', () => {
  let decisions = 0;
  for (const policyId of POLICY_IDS) {
    for (let attemptIndex = 0; attemptIndex < 10; attemptIndex++) {
      const record = simulateSyntheticAttempt({ cohortIndex: 1, attemptIndex, policyId, observeDecision({ view, moveId }) {
        decisions++;
        assertPublic(view);
        assert.equal(Object.isFrozen(view), true);
        assert.equal(Object.isFrozen(view.cards[0]), true);
        assert.ok(view.legalMoveIds.includes(moveId));
        assert.ok(!JSON.stringify(view).includes(syntheticSeedHex(1, attemptIndex)));
      } });
      const replay = inspectReplay(createChallenge(syntheticSeedHex(1, attemptIndex), CHALLENGE_DATE), record.moves);
      assert.equal(record.result.won, replay.won);
      assert.equal(record.result.score, replay.score);
      assert.equal(record.result.moveCount, replay.moveCount);
      assertPublic(record);
    }
  }
  assert.ok(decisions > 20);
});

test('growth-first chooses only from legal cards and uses declared approximate printed expectations', () => {
  const view = baseView();
  view.legalMoveIds = [21, 25, 24];
  assert.equal(choosePolicyMove('growth-first-v1', view), 24);
  assert.equal(printedGrowthScore(19, view), 10.4);
  assert.equal(printedGrowthScore(21, view), 11);
  assert.equal(printedGrowthScore(25, view), 12);
  view.legalMoveIds = [30, 29];
  assert.equal(choosePolicyMove('growth-first-v1', view), 29);
  view.legalMoveIds = [14, 24];
  view.playerStatus.delayedGrowthLoss = 4;
  assert.equal(choosePolicyMove('growth-first-v1', view), 14);
  assert.equal(printedGrowthScore(14, view), 18);
  assert.equal(printedGrowthScore(20, view), 14);
  view.lastRound = [{ actor: 'you', moveId: 1 }, { actor: 'opponent', moveId: 4 }];
  assert.equal(printedGrowthScore(22, view), 14);
  assert.equal(printedGrowthScore(26, view), 13);
  assert.throws(() => printedGrowthScore(31, view));
});

test('policies cannot inspect hidden fields and reject finished or invalid choices', () => {
  const view = baseView();
  for (const key of privateKeys) Object.defineProperty(view, key, { get() { throw Error('Hidden field accessed: ' + key); } });
  for (const policyId of POLICY_IDS) assert.ok(view.legalMoveIds.includes(choosePolicyMove(policyId, view, () => 0)));
  assert.throws(() => choosePolicyMove('uniform-legal-v1', view, () => -1));
  assert.throws(() => choosePolicyMove('uniform-legal-v1', view, () => view.legalMoveIds.length));
  assert.throws(() => choosePolicyMove('uniform-legal-v1', view, () => 0.5));
  assert.throws(() => choosePolicyMove('unknown', view));
  view.phase = 'won';
  assert.throws(() => choosePolicyMove('growth-first-v1', view));
});

test('repeat targets use actual grouped attempts, include losses, and do not select only winning starts', () => {
  const group = winningIndexes => Array.from({ length: 10 }, (_, index) => winningIndexes.includes(index));
  const rows = qualificationTable([group([0, 1, 2]), group([9]), group([]), group([0, 2])]);
  assert.deepEqual(rows.map(row => [row.attemptBudget, ...row.targets.map(target => target.count)]), [[1, 2, 0, 0], [3, 2, 2, 1], [5, 2, 2, 1], [10, 3, 2, 1]]);
  assert.equal(rows.at(-1).targets[0].fraction, 0.75);
  for (const input of [[], [[true]], [Array(10).fill(1)]]) assert.throws(() => qualificationTable(input));
});

test('the bounded harness rejects invalid indexes and cannot replace its synthetic seeds', () => {
  for (const value of [-1, 512, 0.5, '0', NaN]) assert.throws(() => syntheticSeedHex(value, 0));
  for (const value of [-1, 10, 0.5, '0', NaN]) assert.throws(() => syntheticSeedHex(0, value));
  for (const value of [0, -1, 513, 1.5, '2']) assert.throws(() => evaluateDifficulty({ cohortCount: value }));
  for (const value of [0, 31, 1.5]) assert.throws(() => syntheticUniformIndex(0, 0)(value));
  const args = { cohortIndex: 0, attemptIndex: 0, policyId: POLICY_IDS[0] };
  assert.deepEqual(simulateSyntheticAttempt({ ...args, seedHex: 'f'.repeat(64) }), simulateSyntheticAttempt(args));
});

test('provenance hashes identify the actual evaluator, policy and adapter source', () => {
  const report = evaluateDifficulty({ cohortCount: 1 });
  for (const [file, expected] of Object.entries(report.provenance.evaluationFiles)) {
    const actual = createHash('sha256').update(readFileSync(new URL('../' + file, import.meta.url))).digest('hex');
    assert.equal(actual, expected, file);
  }
  assert.equal(report.experiment.timeLimitModeled, false);
  assert.ok(report.policyInputBoundary.includes('public view'));
});
