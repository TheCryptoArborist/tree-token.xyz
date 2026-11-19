// OFFLINE ONLY. No network, wallet, environment secrets, database or live seeds.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pilot from '../../data/arcade-challenge-pilot-november-2026.json' with { type: 'json' };
import provenance from '../../vendor/arcade-trials-engine/provenance.json' with { type: 'json' };
import { ADAPTER, MAX_MOVES, createChallenge, inspectReplay, publicChallenge } from './trials-adapter.mjs';
import { canonicalJson } from './core.mjs';
import { verifyPilotRules } from './pilot-rules.mjs';
import { POLICY_IDS, POLICY_DESCRIPTIONS, choosePolicyMove } from './difficulty-policies.mjs';

export const DATASET_ID = 'tree-arcade:offline-root-rush-difficulty:v1';
export const DEFAULT_COHORTS = 256;
export const ATTEMPTS_PER_COHORT = 10;
export const CHALLENGE_DATE = '2026-11-18';
export const PILOT_RULES_HASH = 'ef07c5212301565b10faffc1e8fb97347fad522c6dc3e3f15bdf58d12b3c9b2d';
const PINNED_SOURCE_HASH = '9623279e03ddab211d51e26f89040afc0b8aee4ff86fc19af53243096215ca00';
const sha = value => createHash('sha256').update(value).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const fraction = (count, total) => ({ count, total, fraction: total ? round(count / total) : null });
const assertIndex = (value, upper, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value >= upper) throw Error('Invalid synthetic ' + label + '.');
};

// These seed values are public reproducible fixtures, never production entropy.
export function syntheticSeedHex(cohortIndex, attemptIndex) {
  assertIndex(cohortIndex, 512, 'cohort index');
  assertIndex(attemptIndex, ATTEMPTS_PER_COHORT, 'attempt index');
  return sha(`${DATASET_ID}\ngame\n${cohortIndex}\n${attemptIndex}`);
}

/** Independent counter-hash stream; rejection sampling avoids modulo bias. */
export function syntheticUniformIndex(cohortIndex, attemptIndex) {
  assertIndex(cohortIndex, 512, 'cohort index');
  assertIndex(attemptIndex, ATTEMPTS_PER_COHORT, 'attempt index');
  let draw = 0;
  return size => {
    if (!Number.isSafeInteger(size) || size < 1 || size > 30) throw Error('Invalid choice size.');
    const limit = 2 ** 32 - ((2 ** 32) % size);
    let value;
    do {
      value = Number.parseInt(sha(`${DATASET_ID}\npolicy-choice\n${cohortIndex}\n${attemptIndex}\n${draw++}`).slice(0, 8), 16);
    } while (value >= limit);
    return value % size;
  };
}

/** All policy calls receive exactly inspectReplay(...).view, never the challenge. */
export function simulateSyntheticAttempt({ cohortIndex, attemptIndex, policyId, observeDecision }) {
  if (!POLICY_IDS.includes(policyId)) throw Error('Unknown offline policy.');
  if (observeDecision !== undefined && typeof observeDecision !== 'function') throw Error('Invalid decision observer.');
  const challenge = createChallenge(syntheticSeedHex(cohortIndex, attemptIndex), CHALLENGE_DATE);
  const choice = syntheticUniformIndex(cohortIndex, attemptIndex);
  let replay = inspectReplay(challenge, []);
  const initialCards = replay.view.cards.map(({ id, type }) => ({ id, type }));
  const moves = [], transcript = createHash('sha256');
  while (replay.view.phase === 'playing') {
    const view = replay.view;
    const moveId = choosePolicyMove(policyId, view, choice);
    if (!view.legalMoveIds.includes(moveId)) throw Error('Policy selected an illegal card.');
    transcript.update(canonicalJson({ view, moveId }) + '\n');
    observeDecision?.({ view, moveId });
    moves.push(moveId);
    replay = inspectReplay(challenge, moves);
  }
  return {
    cohortIndex, attemptIndex, policyId, initialCards, moves,
    decisionTranscriptSha256: transcript.digest('hex'),
    result: { phase: replay.view.phase, completed: replay.completed, won: replay.won, moveCount: replay.moveCount, score: replay.score, playerGrowth: replay.playerGrowth, botGrowth: replay.botGrowth },
  };
}

function distribution(values) {
  if (!values.length) return { count: 0, mean: null, median: null, p90: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { count: n, mean: round(sorted.reduce((a, b) => a + b, 0) / n), median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2, p90: sorted[Math.ceil(n * 0.9) - 1], min: sorted[0], max: sorted[n - 1] };
}

export function qualificationTable(cohorts) {
  if (!Array.isArray(cohorts) || !cohorts.length || cohorts.some(attempts => !Array.isArray(attempts) || attempts.length !== ATTEMPTS_PER_COHORT || attempts.some(won => typeof won !== 'boolean'))) {
    throw Error('Use complete ten-attempt synthetic cohorts.');
  }
  return [1, 3, 5, 10].map(attemptBudget => ({
    attemptBudget,
    targets: [1, 2, 3].map(requiredWins => ({
      requiredWins,
      ...fraction(cohorts.filter(attempts => attempts.slice(0, attemptBudget).filter(Boolean).length >= requiredWins).length, cohorts.length),
    })),
  }));
}

function summarize(records, cohortCount) {
  const wins = records.filter(record => record.result.won);
  const cohorts = Array.from({ length: cohortCount }, (_, index) => records.filter(record => record.cohortIndex === index).map(record => record.result.won));
  const compositions = {};
  for (const record of records) {
    const key = ['attack', 'growth', 'hybrid'].map(type => type + ':' + record.initialCards.filter(card => card.type === type).length).join(',');
    compositions[key] ??= { attempts: 0, wins: 0 };
    compositions[key].attempts++;
    compositions[key].wins += Number(record.result.won);
  }
  return {
    attempts: records.length,
    wins: fraction(wins.length, records.length),
    losses: fraction(records.filter(record => record.result.phase === 'lost').length, records.length),
    moveLimit: fraction(records.filter(record => record.result.phase === 'move-limit').length, records.length),
    movesAllAttempts: distribution(records.map(record => record.result.moveCount)),
    movesWinningAttempts: distribution(wins.map(record => record.result.moveCount)),
    qualification: qualificationTable(cohorts),
    handComposition: Object.fromEntries(Object.entries(compositions).sort().map(([key, counts]) => [key, { ...counts, winFraction: round(counts.wins / counts.attempts) }])),
  };
}

export function evaluateDifficulty({ cohortCount = DEFAULT_COHORTS } = {}) {
  if (!Number.isSafeInteger(cohortCount) || cohortCount < 1 || cohortCount > 512) throw Error('Use 1–512 synthetic cohorts.');
  const binding = verifyPilotRules(pilot.rules);
  if (binding.rulesHash !== pilot.rulesHash || pilot.rulesHash !== PILOT_RULES_HASH || pilot.rules.challengeDate !== CHALLENGE_DATE) throw Error('The frozen pilot binding has changed; review the experiment before rerunning it.');
  if (ADAPTER.sourceHash !== PINNED_SOURCE_HASH || provenance.sourceHash !== PINNED_SOURCE_HASH) throw Error('The pinned engine provenance has changed.');
  for (const file of provenance.runtime) {
    if (sha(readFileSync(new URL('../../vendor/arcade-trials-engine/' + file.path, import.meta.url))) !== file.sha256) throw Error('Pinned engine bytes changed: ' + file.path);
  }
  const preparation = publicChallenge(createChallenge(syntheticSeedHex(0, 0), CHALLENGE_DATE));
  if (preparation.title !== 'Root Rush' || preparation.rule !== 'standard' || preparation.targetGrowth !== 50) throw Error('Expected the fixed Root Rush rules.');
  const records = Object.fromEntries(POLICY_IDS.map(id => [id, []]));
  const digest = createHash('sha256'), seeds = createHash('sha256');
  const paired = { bothWon: 0, uniformOnlyWon: 0, growthFirstOnlyWon: 0, neitherWon: 0 };
  for (let cohortIndex = 0; cohortIndex < cohortCount; cohortIndex++) {
    for (let attemptIndex = 0; attemptIndex < ATTEMPTS_PER_COHORT; attemptIndex++) {
      seeds.update(syntheticSeedHex(cohortIndex, attemptIndex) + '\n');
      const pair = POLICY_IDS.map(policyId => {
        const record = simulateSyntheticAttempt({ cohortIndex, attemptIndex, policyId });
        records[policyId].push(record);
        digest.update(canonicalJson(record) + '\n');
        return record;
      });
      if (canonicalJson(pair[0].initialCards) !== canonicalJson(pair[1].initialCards)) throw Error('Paired starting hands differ.');
      const [a, b] = pair.map(record => record.result.won);
      paired[a && b ? 'bothWon' : a ? 'uniformOnlyWon' : b ? 'growthFirstOnlyWon' : 'neitherWon']++;
    }
  }
  const files = ['scripts/arcade-campaigns/difficulty-evaluation.mjs', 'scripts/arcade-campaigns/difficulty-policies.mjs', 'scripts/arcade-campaigns/trials-adapter.mjs'];
  return {
    schemaVersion: 1, kind: 'offline-synthetic-arborist-trials-difficulty', datasetId: DATASET_ID,
    classification: 'scripted-play-evidence-not-human-difficulty', humanDifficultyMeasured: false,
    payable: false, prizeEligible: false, awardsEnabled: false, launchReady: false,
    experiment: {
      cohortCount, attemptsPerCohort: ATTEMPTS_PER_COHORT, policies: [...POLICY_IDS], totalMatches: cohortCount * ATTEMPTS_PER_COHORT * POLICY_IDS.length,
      challengeDate: CHALLENGE_DATE, title: preparation.title, rule: preparation.rule, targetGrowth: preparation.targetGrowth,
      maxMoves: MAX_MOVES, fourStandardCards: true, paidAdvantages: false, timeLimitModeled: false,
      seedDerivation: 'SHA256(datasetId + LF + game + LF + zero-based cohort + LF + zero-based attempt)',
      choiceDerivation: 'SHA256(datasetId + LF + policy-choice + LF + zero-based cohort + LF + zero-based attempt + LF + zero-based draw); first uint32 with rejection sampling',
      aggregation: 'Actual grouped synthetic outcomes; no binomial extrapolation. Each independent fresh hand is completed or reaches the move limit; no restarts or seed selection.',
      pairedStarts: 'Both policies use each starting seed. Their later RNG consumption and opponent actions can differ after different choices.',
    },
    provenance: {
      adapter: { ...ADAPTER }, upstreamRepository: provenance.repository, upstreamCommit: provenance.commit,
      pilotRulesHash: pilot.rulesHash,
      evaluationFiles: Object.fromEntries(files.map(file => [file, sha(readFileSync(new URL('../../' + file, import.meta.url)))])),
      seedSequenceSha256: seeds.digest('hex'), orderedRunRecordsSha256: digest.digest('hex'),
    },
    policyDescriptions: { ...POLICY_DESCRIPTIONS },
    policyInputBoundary: 'Only the adapter public view enters choosePolicyMove. Uniform choice receives its own domain-separated stream. No game seed, RNG state, hidden opponent hand, future action, production record or wallet is an input.',
    results: Object.fromEntries(POLICY_IDS.map(id => [id, summarize(records[id], cohortCount)])),
    pairedOutcomes: { starts: cohortCount * ATTEMPTS_PER_COHORT, ...paired },
    auditExamples: POLICY_IDS.flatMap(id => records[id].slice(0, 2)),
    limitations: [
      'These rates describe these two scripts on this fixed synthetic suite; they are not human win rates, causal skill estimates or an optimal-play bound.',
      'Only the frozen November 18 Root Rush rules are tested. The other daily variants and current deployed Garden Battles game are outside scope.',
      'The growth-first script uses printed expected own gains and current public conditions. It ignores natural-growth thresholds, gain clipping, attacks, defense value, enemy donations and future states, so its scores are intentionally approximate.',
      'The fifteen-minute deadline, session expiry, network latency, human deliberation, accessibility, device behavior, abandonment and multi-account behavior are not simulated.',
      'Synthetic cohorts are groups of independent attempts, not unique people; attempt counts exclude disconnects and abandoned starts. This does not establish an identity or enforce a retry rule.',
      'Every starting hand contains Attack, Growth and Hybrid cards, but balanced card types do not establish equal hand strength. Selective hand abandonment and repeated rerolling are not modeled.',
      'The pinned engine includes variable hands and chance effects and reduces entropy to a 32-bit PRNG; this evaluation makes no cryptographic randomness or anti-bot claim.',
      'A win or repeated win does not prove human play. No funded qualification, payment, campaign activation or change to pilot rules results from this evidence.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) throw Error('No CLI arguments accepted; the default is the declared fixed offline suite.');
  console.log(JSON.stringify(evaluateDifficulty(), null, 2));
}
