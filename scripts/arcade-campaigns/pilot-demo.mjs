// Local in-memory rehearsal: real HTTP handler, SQL and engine; fictional session.
// This script reads no secrets, opens no port and makes no network/chain calls.
import assert from 'node:assert/strict';
import { createServiceFixture, WIN_MOVES, requestId } from '../../tests/fixtures/arcade-challenge-pilot/service-fixture.mjs';

const fixture = await createServiceFixture();
try {
  const initial = await fixture.start();
  assert.equal(initial.status, 200, JSON.stringify(initial.body));
  const attemptToken = initial.body.attemptToken, moves = [], ids = WIN_MOVES.map(() => requestId());
  const forged = await fixture.call('move', { attemptToken, expectedVersion: 0, requestId: requestId(), moveId: 19, score: 999999, completed: true });
  assert.equal(forged.status, 400);
  for (const [version, move] of WIN_MOVES.entries()) {
    const response = await fixture.move(attemptToken, version, move, ids[version]);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    moves.push(response.body);
  }
  const retry = await fixture.move(attemptToken, 2, 19, ids[2]);
  assert.deepEqual(retry.body, moves[2]);
  const alteredRetry = await fixture.move(attemptToken, 2, 27, ids[2]);
  assert.equal(alteredRetry.status, 409);
  const final = moves[2];
  assert.deepEqual([final.result.won, final.result.score, final.result.rounds], [true, 16375, 3]);
  assert.equal(await fixture.count('requests'), 3);
  console.log(JSON.stringify({
    kind: 'local-arborist-challenge-rehearsal', storage: 'in-memory PGlite; no hosted changes',
    game: final.gameId, gameVersion: final.gameVersion,
    moves: WIN_MOVES,
    progress: moves.map(state => ({ round: state.version, playerGrowth: state.view.playerGrowth, botGrowth: state.view.botGrowth, phase: state.view.phase })),
    computedResult: { won: final.result.won, score: final.result.score, rounds: final.result.rounds, ruleTargetMet: final.result.ruleTargetMet },
    checks: { forgedScoreRejected: forged.status === 400, identicalRetryPreserved: retry.status === 200, changedRetryRejected: alteredRetry.status === 409, recordedMoves: await fixture.count('requests') },
    mode: final.mode, identityScope: final.identityScope, payable: final.payable, prizeEligible: final.prizeEligible, awardsEnabled: final.awardsEnabled,
    limits: ['Synthetic wallet session; no human identity proof.', 'Pinned isolated pilot ruleset; no claim of full live-game parity.', 'Single-connection PGlite does not reproduce distributed PostgreSQL worker scheduling.'],
  }, null, 2));
} finally { await fixture.close(); }
