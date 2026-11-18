import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ADAPTER, MAX_MOVES, createChallenge, inspectReplay, replayChallenge, publicChallenge, TrialReplayError } from '../scripts/arcade-campaigns/trials-adapter.mjs';
import { canonicalJson } from '../scripts/arcade-campaigns/core.mjs';
import fixtures from '../vendor/arcade-trials-engine/fixtures.json' with { type: 'json' };
import provenance from '../vendor/arcade-trials-engine/provenance.json' with { type: 'json' };

const fixture = fixtures.fastWin;
const challenge = () => createChallenge(fixture.seedHex, fixture.dateKey);
const checkError = code => error => error instanceof TrialReplayError && error.code === code;
const pick = (result, expected) => Object.fromEntries(Object.keys(expected).map(key => [key, result[key]]));

test('pinned source and runtime bytes match the recorded provenance', () => {
  for (const file of [...provenance.sources, ...provenance.runtime]) {
    const bytes = readFileSync(new URL('../vendor/arcade-trials-engine/' + file.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
    if (file.gitBlobSha1) assert.equal(createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'), file.gitBlobSha1);
  }
  const { sourceHash, liveParityClaimed, ...pinned } = provenance;
  assert.equal(createHash('sha256').update(canonicalJson(pinned)).digest('hex'), sourceHash);
  assert.equal(ADAPTER.sourceHash, sourceHash);
  assert.equal(liveParityClaimed, false);
});

for (const [name, value] of Object.entries(fixtures)) {
  if (typeof value !== 'object') continue;
  test('replays the fixed ' + name + ' vector including its score and special-rule bonus', () => {
    const result = replayChallenge(createChallenge(value.seedHex, value.dateKey), value.moves);
    assert.deepEqual(pick(result, value.expected), value.expected);
    assert.deepEqual(result.view.legalMoveIds, []);
    assert.equal(result.view.phase, value.expected.won ? 'won' : 'lost');
  });
}

test('a legal prefix computes visible state and available actions without accepting a claimed score', () => {
  const c = challenge(), input = JSON.stringify(c);
  const before = inspectReplay(c, []), after = inspectReplay(c, [19]);
  assert.equal(before.rounds, 0);
  assert.equal(before.view.cards.length, 4);
  assert.equal(after.completed, false);
  assert.equal(after.moveCount, 1);
  assert.ok(!after.view.legalMoveIds.includes(19));
  assert.equal(JSON.stringify(c), input);
  assert.throws(() => inspectReplay(c, { moves: [19], score: 999999 }), checkError('invalid-moves'));
});

test('interleaved replays and different wall clocks do not change results or public logs', () => {
  const c = challenge(), expected = replayChallenge(c, fixture.moves);
  const original = Date.now;
  try {
    Date.now = () => 0;
    inspectReplay(createChallenge('a'.repeat(64), '2026-11-19'), []);
    assert.deepEqual(replayChallenge(JSON.parse(JSON.stringify(c)), [...fixture.moves]), expected);
    Date.now = () => 9000000000000;
    assert.deepEqual(replayChallenge(c, fixture.moves), expected);
  } finally { Date.now = original; }
});

test('rejects short, uppercase, nonhex and nonstring server entropy', () => {
  for (const seed of ['', '0'.repeat(63), 'A'.repeat(64), 'g'.repeat(64), null, 5]) {
    assert.throws(() => createChallenge(seed, fixture.dateKey), checkError('invalid-seed'));
  }
});

test('rejects rolled-over and pre-portable dates', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-09-02', '2026-11-18T00:00:00Z', null]) {
    assert.throws(() => createChallenge(fixture.seedHex, date), checkError('invalid-date'));
  }
});

test('rejects edits to private rules, seed, engine, source version and paid-card policy', () => {
  for (const mutate of [
    c => { c.trial.targetGrowth = 1; }, c => { c.seedHex = '0'.repeat(64); },
    c => { c.trial.playerStartGrowth = 49; }, c => { c.engine = 'legacy-v8'; },
    c => { c.sourceHash = '0'.repeat(64); }, c => { c.fifthMoveUnlocked = true; },
    c => { c.trial.rule = 'toolbelt_rotation'; }, c => { c.debug = false; },
  ]) {
    const changed = JSON.parse(JSON.stringify(challenge())); mutate(changed);
    assert.throws(() => inspectReplay(changed, []), checkError('invalid-challenge'));
  }
});

test('requires dense integer move arrays and rejects all fifth cards', () => {
  const sparse = new Array(1), extra = []; extra.score = 9999;
  for (const moves of [null, {}, [19.5], ['19'], [NaN], [0], [-1], [Infinity], sparse, extra, ...Array.from({ length: 9 }, (_, i) => [i + 31])]) {
    assert.throws(() => inspectReplay(challenge(), moves), checkError('invalid-moves'));
  }
});

test('rejects a standard card that was not dealt', () => {
  const c = challenge(), hand = inspectReplay(c, []).view.cards.map(card => card.id);
  const absent = Array.from({ length: 30 }, (_, i) => i + 1).find(id => !hand.includes(id));
  assert.throws(() => inspectReplay(c, [absent]), checkError('illegal-move'));
});

test('rejects a consecutive repeated card', () => {
  assert.throws(() => inspectReplay(challenge(), [19, 19]), checkError('illegal-move'));
});

test('Toolbelt enforces a complete four-card cycle before reuse', () => {
  const f = fixtures.toolbelt, c = createChallenge(f.seedHex, f.dateKey);
  assert.throws(() => inspectReplay(c, [16, 23, 16]), checkError('illegal-move'));
  const result = inspectReplay(c, [16, 23, 15, 8]);
  assert.ok(result.view.legalMoveIds.includes(16));
  assert.ok(!result.view.legalMoveIds.includes(8));
});

test('rejects incomplete and trailing sequences, including a loss followed by more moves', () => {
  assert.throws(() => replayChallenge(challenge(), []), checkError('incomplete-trial'));
  assert.throws(() => replayChallenge(challenge(), [19, 27]), checkError('incomplete-trial'));
  assert.throws(() => replayChallenge(challenge(), [...fixture.moves, 27]), checkError('moves-after-finish'));
  const f = fixtures.loss;
  assert.throws(() => replayChallenge(createChallenge(f.seedHex, f.dateKey), [...f.moves, 9]), checkError('moves-after-finish'));
});

test('caps work before replaying oversized histories', () => {
  assert.equal(MAX_MOVES, 100);
  assert.throws(() => inspectReplay(challenge(), Array(101).fill(19)), checkError('invalid-moves'));
});

test('public challenge and views omit entropy, hidden bot hand and random state', () => {
  const c = challenge(), publicData = publicChallenge(c);
  const result = inspectReplay(c, [19]);
  const inspect = object => {
    if (!object || typeof object !== 'object') return;
    for (const [key, value] of Object.entries(object)) {
      assert.ok(!['seed', 'seedHex', 'randomState', 'player2Moves', 'botMoveHistory', 'allBotMoves', 'battleId', 'lastMoveMs', 'timestamp'].includes(key), key);
      inspect(value);
    }
  };
  inspect(publicData); inspect(result);
  assert.ok(!JSON.stringify(publicData).includes(fixture.seedHex));
  assert.equal(publicData.fifthCardEnabled, false);
  assert.equal(publicData.view.forecast, null);
  const diagnosis = publicChallenge(createChallenge(fixtures.diagnosis.seedHex, fixtures.diagnosis.dateKey));
  assert.ok(['attack', 'growth', 'hybrid'].includes(diagnosis.view.forecast));
});

test('all exposed records are immutable and independent of caller move arrays', () => {
  const c = challenge(), moves = [...fixture.moves], result = replayChallenge(c, moves);
  moves[0] = 1;
  assert.equal(result.won, true);
  assert.ok(Object.isFrozen(c.trial));
  assert.ok(Object.isFrozen(result.view.cards[0]));
  assert.throws(() => { result.view.legalMoveIds.push(31); }, TypeError);
});
