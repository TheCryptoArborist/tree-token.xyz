import type { ArboristTrialChallenge } from "@shared/arborist-trials";
import type { TrialEngine } from "@shared/trial-engine";
import type { ActionEntry } from "@/components/BattleLog";
import {
  PRACTICE_PLAYER_ADDRESS,
  createPracticeBattle,
  playPracticeRound,
  type PracticeBattle,
} from "./practiceBattle";
import { MOVE_META, type MoveType } from "./sui-config";

const FIFTH_MOVE_IDS = [31, 32, 33, 34, 35, 36, 37, 38, 39];
const DIAGNOSIS_TYPES: MoveType[] = ["attack", "growth", "hybrid"];
const DIAGNOSIS_COUNTER: Record<MoveType, MoveType> = {
  attack: "hybrid",
  growth: "attack",
  hybrid: "growth",
};

function getDiagnosisSchedule(seed: number): MoveType[] {
  const offset = seed % DIAGNOSIS_TYPES.length;
  return DIAGNOSIS_TYPES.map(
    (_, index) => DIAGNOSIS_TYPES[(index + offset) % DIAGNOSIS_TYPES.length],
  );
}

export function getDailyTrialFifthMoveId(challenge: ArboristTrialChallenge): number {
  return FIFTH_MOVE_IDS[challenge.seed % FIFTH_MOVE_IDS.length];
}

export function createArboristTrialBattle(
  challenge: ArboristTrialChallenge,
  fifthMoveUnlocked: boolean,
  engine: TrialEngine = challenge.simulationVersion === 2 ? "portable-v1" : "legacy-v8",
): PracticeBattle {
  return createPracticeBattle({
    trialEngine: engine,
    seed: challenge.seed,
    mode: "arborist-trial",
    challengeId: challenge.id,
    playerStartGrowth: challenge.playerStartGrowth,
    botStartGrowth: challenge.botStartGrowth,
    bonusMoveId: fifthMoveUnlocked ? getDailyTrialFifthMoveId(challenge) : null,
    botMoveTypeSchedule:
      challenge.rule === "canopy_diagnosis"
        ? getDiagnosisSchedule(challenge.seed)
        : undefined,
  });
}

export function applyArboristTrialFifthMove(
  battle: PracticeBattle,
  challenge: ArboristTrialChallenge,
  fifthMoveUnlocked: boolean,
): PracticeBattle {
  if (!fifthMoveUnlocked || battle.player1Moves.length >= 5) return battle;
  const fifthMoveId = getDailyTrialFifthMoveId(challenge);
  if (battle.player1Moves.includes(fifthMoveId)) return battle;
  return { ...battle, player1Moves: [...battle.player1Moves, fifthMoveId] };
}

export function getCanopyDiagnosisForecast(
  battle: PracticeBattle,
  challenge: ArboristTrialChallenge,
): MoveType | null {
  if (challenge.rule !== "canopy_diagnosis") return null;
  const schedule = battle.botMoveTypeSchedule ?? getDiagnosisSchedule(challenge.seed);
  return schedule[battle.allBotMoves.length % schedule.length];
}

export function getCanopyDiagnosisCounterType(botType: MoveType): MoveType {
  return DIAGNOSIS_COUNTER[botType];
}

export function getToolbeltLockedMoveIds(
  battle: PracticeBattle,
  challenge: ArboristTrialChallenge,
): Set<number> {
  if (challenge.rule !== "toolbelt_rotation") return new Set();
  const standardMoves = new Set(battle.player1Moves.slice(0, 4));
  const usedThisCycle = new Set<number>();
  for (const moveId of battle.allPlayerMoves) {
    if (!standardMoves.has(moveId)) continue;
    usedThisCycle.add(moveId);
    if (usedThisCycle.size === standardMoves.size) usedThisCycle.clear();
  }
  return usedThisCycle;
}

export function isArboristTrialMoveDisabled(
  battle: PracticeBattle,
  challenge: ArboristTrialChallenge,
  moveId: number,
): boolean {
  if (battle.playerMoveHistory.at(-1) === moveId) return true;
  return getToolbeltLockedMoveIds(battle, challenge).has(moveId);
}

export function playArboristTrialRound(
  battle: PracticeBattle,
  challenge: ArboristTrialChallenge,
  moveId: number,
): { battle: PracticeBattle; entries: ActionEntry[] } {
  if (isArboristTrialMoveDisabled(battle, challenge, moveId)) {
    throw new Error(
      challenge.rule === "toolbelt_rotation"
        ? "That tool is locked until the other standard cards have been used."
        : "Choose a different move. The same card cannot be played twice in a row.",
    );
  }

  const result = playPracticeRound(battle, moveId);
  if (
    challenge.rule !== "storm_response" ||
    result.battle.finished ||
    result.battle.totalTurns % 2 !== 0
  ) {
    return result;
  }

  const completedRound = result.battle.totalTurns / 2;
  if (completedRound % 3 !== 0) return result;

  const beforePlayer = result.battle.player1Growth;
  const beforeBot = result.battle.player2Growth;
  const nextBattle = {
    ...result.battle,
    player1Growth: Math.max(0, beforePlayer - 4),
    player2Growth: Math.max(0, beforeBot - 4),
  };
  const stormEntry: ActionEntry = {
    id: `${nextBattle.battleId}-storm-${completedRound}`,
    timestamp: Date.now(),
    actor: "round",
    moveId: 0,
    prevPlayerGrowth: beforePlayer,
    nextPlayerGrowth: nextBattle.player1Growth,
    prevOpponentGrowth: beforeBot,
    nextOpponentGrowth: nextBattle.player2Growth,
    label: "Storm Front",
    details: [
      `Round ${completedRound}: storm damage stripped ${beforePlayer - nextBattle.player1Growth} Growth from your tree.`,
      `Storm damage stripped ${beforeBot - nextBattle.player2Growth} Growth from Garden Bot.`,
    ],
  };
  return { battle: nextBattle, entries: [...result.entries, stormEntry] };
}

function getSpecialtyResult(battle: PracticeBattle, challenge: ArboristTrialChallenge) {
  const won = battle.winner === PRACTICE_PLAYER_ADDRESS;
  if (challenge.rule === "canopy_diagnosis") {
    const correctCounters = battle.allBotMoves.reduce((total, botMoveId, index) => {
      const botType = MOVE_META[botMoveId]?.type;
      const playerType = MOVE_META[battle.allPlayerMoves[index]]?.type;
      return total + (botType && playerType === DIAGNOSIS_COUNTER[botType] ? 1 : 0);
    }, 0);
    return {
      specialtyBonus: correctCounters * 300,
      specialtySummary: `${correctCounters} diagnosed threat${correctCounters === 1 ? "" : "s"} countered`,
    };
  }
  if (challenge.rule === "toolbelt_rotation") {
    const standardMoves = new Set(battle.player1Moves.slice(0, 4));
    const standardPlays = battle.allPlayerMoves.filter((moveId) => standardMoves.has(moveId)).length;
    const cycles = Math.floor(standardPlays / Math.max(1, standardMoves.size));
    return {
      specialtyBonus: cycles * 600,
      specialtySummary: `${cycles} complete Toolbelt cycle${cycles === 1 ? "" : "s"}`,
    };
  }
  if (challenge.rule === "storm_response") {
    const stormsWeathered = Math.floor(Math.max(1, Math.ceil(battle.totalTurns / 2)) / 3);
    return {
      specialtyBonus: won ? 1_000 : 0,
      specialtySummary: `${stormsWeathered} storm front${stormsWeathered === 1 ? "" : "s"} weathered`,
    };
  }
  if (challenge.rule === "integrated_pest_management") {
    const attackPlays = battle.allPlayerMoves.filter(
      (moveId) => MOVE_META[moveId]?.type === "attack",
    ).length;
    const specialtyBonus = won
      ? attackPlays <= 2
        ? 1_500
        : attackPlays === 3
          ? 1_000
          : attackPlays === 4
            ? 500
            : 0
      : 0;
    return {
      specialtyBonus,
      specialtySummary: `${attackPlays} Attack card${attackPlays === 1 ? "" : "s"} used`,
    };
  }
  return { specialtyBonus: 0, specialtySummary: null };
}

export function getArboristTrialResult(
  battle: PracticeBattle,
  challenge?: ArboristTrialChallenge,
) {
  const specialty = challenge
    ? getSpecialtyResult(battle, challenge)
    : { specialtyBonus: 0, specialtySummary: null };
  return {
    won: battle.winner === PRACTICE_PLAYER_ADDRESS,
    rounds: Math.max(1, Math.ceil(battle.totalTurns / 2)),
    playerGrowth: battle.player1Growth,
    botGrowth: battle.player2Growth,
    uniqueMoves: new Set(battle.allPlayerMoves).size,
    ...specialty,
  };
}
