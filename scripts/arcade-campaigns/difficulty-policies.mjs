// OFFLINE synthetic baselines. These are deliberately simple scripts, not people.
// Only this public card catalog is imported; no battle, seed or bot-state API.
import { MOVE_META } from '../../vendor/arcade-trials-engine/runtime/card-catalog.mjs';

export const POLICY_IDS = Object.freeze(['uniform-legal-v1', 'growth-first-v1']);
export const POLICY_DESCRIPTIONS = Object.freeze({
  'uniform-legal-v1': 'Choose uniformly among currently legal cards using an independent synthetic choice stream.',
  'growth-first-v1': 'Choose the largest printed expected immediate own-Growth gain, including visible immediate cleansing; break ties by lowest card ID.',
});

function requirePlayable(view) {
  if (view.phase !== 'playing' || !Array.isArray(view.legalMoveIds) || !view.legalMoveIds.length) {
    throw Error('A policy needs a playing public view with legal cards.');
  }
}

function lastType(view, actor) {
  const entry = view.lastRound.findLast(item => item.actor === actor);
  return entry ? MOVE_META[entry.moveId]?.type : undefined;
}

/**
 * Transparent heuristic, not a game-state predictor or optimal policy:
 * - printed own gains only; it ignores attack/defense value and enemy donations;
 * - 19: 0.6*20 - 0.4*4 = 10.4, 21: mean(8..14) = 11,
 *   25: 0.75*15 + 0.25*3 = 12;
 * - current public values select conditional printed gains (before natural growth);
 * - cleansing also values the immediate visible damage it prevents;
 * - no inferred future card, hidden bot hand, RNG reconstruction or lookahead.
 */
export function printedGrowthScore(cardId, view) {
  const status = view.playerStatus;
  const poison = status.poisonTicks > 0 ? status.poisonGrowthPerTurn : 0;
  const delayed = status.delayedGrowthLoss;
  switch (cardId) {
    case 8: return 6;
    case 9: return 4;
    case 14: return (poison + delayed > 0 ? 14 : 10) + poison + delayed;
    case 15: return view.playerGrowth < view.botGrowth ? 12 : 8;
    case 16: return -4;
    case 17: return status.blockTurns > 0 ? 10 : 7;
    case 18: return 5;
    case 19: return 10.4;
    case 20: return 10 + delayed;
    case 21: return 11;
    case 22: return lastType(view, 'opponent') === 'attack' ? 14 : 10;
    case 23: return view.botStatus.blockTurns > 0 ? 15 : 10;
    case 24: return 14;
    case 25: return 12;
    case 26: return lastType(view, 'you') === 'attack' ? 13 : 11;
    case 27: return 7;
    case 28: return view.playerGrowth <= 10 ? 13 : 10;
    case 29: return 8;
    case 30: return 8;
    default:
      if (Number.isSafeInteger(cardId) && cardId >= 1 && cardId <= 30) return 0;
      throw Error('Only the printed standard-card catalog is supported.');
  }
}

export function choosePolicyMove(policyId, view, uniformIndex) {
  requirePlayable(view);
  if (policyId === 'uniform-legal-v1') {
    const index = uniformIndex(view.legalMoveIds.length);
    if (!Number.isSafeInteger(index) || index < 0 || index >= view.legalMoveIds.length) {
      throw Error('Uniform choice must return an in-range integer.');
    }
    return view.legalMoveIds[index];
  }
  if (policyId === 'growth-first-v1') {
    return [...view.legalMoveIds].sort((a, b) => printedGrowthScore(b, view) - printedGrowthScore(a, view) || a - b)[0];
  }
  throw Error('Unknown offline policy.');
}
