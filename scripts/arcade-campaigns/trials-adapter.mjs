// Isolated no-prize Arborist Trials replay. Existing live games are untouched.
import { createHash } from 'node:crypto';
import provenance from '../../vendor/arcade-trials-engine/provenance.json' with { type: 'json' };
import { canonicalJson } from './core.mjs';
import { getArboristTrialChallenge, calculateArboristTrialScore } from '../../vendor/arcade-trials-engine/runtime/challenge-rules.mjs';
import { createArboristTrialBattle, playArboristTrialRound, getArboristTrialResult, isArboristTrialMoveDisabled, getCanopyDiagnosisForecast } from '../../vendor/arcade-trials-engine/runtime/trial-game.mjs';
import { MOVE_LABELS, MOVE_META } from '../../vendor/arcade-trials-engine/runtime/card-catalog.mjs';

export const ADAPTER = Object.freeze({
  id: 'arborist-trials-portable-four-card', version: '1.0.0',
  gameId: 'arborist-trials', gameVersion: 'campaign-pilot-4a27b3ac-v1',
  gameRuleset: 'portable-v1-four-card', sourceHash: provenance.sourceHash,
});
export const MAX_MOVES = 100;
const ENGINE = 'portable-v1';
const sha = text => createHash('sha256').update(text).digest('hex');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export class TrialReplayError extends Error {
  constructor(code, message) { super(message); this.name = 'TrialReplayError'; this.code = code; }
}
const fail = (code, message) => { throw new TrialReplayError(code, message); };

/** The caller supplies server entropy; callers must not accept seedHex from a browser. */
export function createChallenge(seedHex, dateKey) {
  if (typeof seedHex !== 'string' || !/^[a-f0-9]{64}$/.test(seedHex)) fail('invalid-seed', 'Use 32 bytes of server entropy encoded as lowercase hex.');
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) fail('invalid-date', 'Use a valid UTC calendar date.');
  const date = new Date(dateKey + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey || dateKey < '2026-09-03') fail('invalid-date', 'This pilot supports portable trial dates from September 3, 2026.');
  const seedDigest = sha('tree-arcade:arborist-trials:four-card:v1\n' + seedHex + '\n' + dateKey);
  const trial = getArboristTrialChallenge(date);
  return freeze({
    schemaVersion: 1, kind: 'nonpaying-arborist-trial-challenge',
    adapterId: ADAPTER.id, adapterVersion: ADAPTER.version, sourceHash: ADAPTER.sourceHash,
    seedHex, dateKey, engine: ENGINE, fifthMoveUnlocked: false, maxMoves: MAX_MOVES,
    trial: { ...trial, id: 'campaign-trial-' + dateKey + '-' + seedDigest.slice(0, 24), seed: Number.parseInt(seedDigest.slice(0, 8), 16), simulationVersion: 2 },
  });
}

function verifiedChallenge(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('invalid-challenge', 'Use a server-issued pilot challenge.');
  let expected;
  try {
    expected = createChallenge(input.seedHex, input.dateKey);
    if (canonicalJson(input) !== canonicalJson(expected)) fail('invalid-challenge', 'The challenge does not match the pinned engine and fixed rules.');
  } catch (error) {
    if (error instanceof TrialReplayError && error.code === 'invalid-challenge') throw error;
    fail('invalid-challenge', 'The challenge does not match the pinned engine and fixed rules.');
  }
  return expected;
}

function visibleStatus(status) {
  return {
    blockTurns: status.blockTurns, poisonTicks: status.poisonTicks, poisonGrowthPerTurn: status.poisonDpt,
    delayedGrowthLoss: status.nextTurnPenalty, reflectedGrowth: status.reflectDamage,
    armorHalvesNextHit: status.armorHalf, nextAttackCap: status.attackCap,
  };
}

/** Recompute a complete or partial action history. No browser score/state is accepted. */
export function inspectReplay(challengeInput, moves) {
  const challenge = verifiedChallenge(challengeInput);
  if (!Array.isArray(moves) || moves.length > MAX_MOVES || Object.keys(moves).length !== moves.length || moves.some(move => !Number.isSafeInteger(move) || move < 1 || move > 30)) fail('invalid-moves', 'Use a dense list of at most 100 integer standard-card IDs.');
  let battle = createArboristTrialBattle(challenge.trial, false, ENGINE);
  let entries = [];
  for (const move of moves) {
    if (battle.finished) fail('moves-after-finish', 'A finished game cannot accept additional moves.');
    try {
      const round = playArboristTrialRound(battle, challenge.trial, move);
      battle = round.battle; entries = round.entries;
    } catch {
      fail('illegal-move', 'The move is outside the dealt hand, repeats the previous card or violates the current trial rule.');
    }
  }
  const result = getArboristTrialResult(battle, challenge.trial);
  const atLimit = moves.length === MAX_MOVES && !battle.finished;
  const legalMoveIds = battle.finished || atLimit ? [] : battle.player1Moves.filter(id => !isArboristTrialMoveDisabled(battle, challenge.trial, id));
  const cards = battle.player1Moves.map(id => ({
    id, name: MOVE_LABELS[id], type: MOVE_META[id].type, description: MOVE_META[id].effect,
    playable: legalMoveIds.includes(id),
  }));
  const rounds = moves.length ? result.rounds : 0;
  return freeze({
    completed: battle.finished, won: result.won, score: calculateArboristTrialScore(result),
    rounds, turns: battle.totalTurns, playerGrowth: result.playerGrowth, botGrowth: result.botGrowth,
    uniqueMoves: result.uniqueMoves, specialtyBonus: result.specialtyBonus, moveCount: moves.length,
    view: {
      phase: battle.finished ? result.won ? 'won' : 'lost' : atLimit ? 'move-limit' : 'playing',
      round: battle.finished || atLimit ? rounds : rounds + 1,
      playerGrowth: result.playerGrowth, botGrowth: result.botGrowth, targetGrowth: challenge.trial.targetGrowth,
      moveCount: moves.length, maxMoves: MAX_MOVES, remainingMoves: MAX_MOVES - moves.length,
      cards, legalMoveIds, playerStatus: visibleStatus(battle.playerStatus), botStatus: visibleStatus(battle.botStatus),
      forecast: battle.finished || atLimit ? null : getCanopyDiagnosisForecast(battle, challenge.trial),
      lastRound: entries.map(({ actor, moveId, prevPlayerGrowth, nextPlayerGrowth, prevOpponentGrowth, nextOpponentGrowth, details, label }) => ({
        actor, moveId, prevPlayerGrowth, nextPlayerGrowth, prevOpponentGrowth, nextOpponentGrowth,
        details: [...details], label: label ?? null,
      })),
    },
  });
}

export function replayChallenge(challenge, moves) {
  const result = inspectReplay(challenge, moves);
  if (!result.completed) fail('incomplete-trial', 'The action sequence does not complete this trial.');
  return result;
}

/** Public preparation and the initial view omit entropy and hidden engine state. */
export function publicChallenge(input) {
  const challenge = verifiedChallenge(input);
  return freeze({
    schemaVersion: 1, kind: 'arborist-trial-no-prize-pilot',
    adapter: { ...ADAPTER }, dateKey: challenge.dateKey,
    title: challenge.trial.title, subtitle: challenge.trial.subtitle, description: challenge.trial.description,
    rule: challenge.trial.rule, ruleDescription: challenge.trial.ruleDescription,
    targetGrowth: challenge.trial.targetGrowth, fifthCardEnabled: false, maxMoves: MAX_MOVES,
    view: inspectReplay(challenge, []).view,
  });
}
