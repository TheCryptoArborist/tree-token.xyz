import type { ActionEntry } from "@/components/BattleLog";
import type { BattleState } from "@/hooks/useSuiWallet";
import { MOVE_LABELS, MOVE_META, type MoveType } from "@/lib/sui-config";
import { shuffleTrialHand, type TrialEngine } from "@shared/trial-engine";

export const PRACTICE_PLAYER_ADDRESS = "practice-player";
export const PRACTICE_BOT_ADDRESS = "practice-garden-bot";
export const PRACTICE_TARGET_GROWTH = 50;

const ATTACK_MOVES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 16];
const GROWTH_MOVES = [15, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30];
const HYBRID_MOVES = [8, 9, 14, 17, 18, 27, 29];
const ALL_MOVES = [...ATTACK_MOVES, ...GROWTH_MOVES, ...HYBRID_MOVES];

type PracticeStatus = {
  blockTurns: number;
  poisonTicks: number;
  poisonDpt: number;
  nextTurnPenalty: number;
  reflectDamage: number;
  armorHalf: boolean;
  attackCap: number | null;
};

export type PracticeBattle = BattleState & {
  mode: "practice" | "arborist-trial";
  botMoveHistory: number[];
  allBotMoves: number[];
  playerMoveHistory: number[];
  allPlayerMoves: number[];
  totalTurns: number;
  playerStatus: PracticeStatus;
  botStatus: PracticeStatus;
  randomState?: number;
  trialEngine?: TrialEngine;
  challengeId?: string;
  botMoveTypeSchedule?: MoveType[];
};

export type CreatePracticeBattleOptions = {
  trialEngine?: TrialEngine;
  seed?: number;
  mode?: PracticeBattle["mode"];
  challengeId?: string;
  playerStartGrowth?: number;
  botStartGrowth?: number;
  bonusMoveId?: number | null;
  botMoveTypeSchedule?: MoveType[];
};

type MoveOutcome = {
  selfGrowthDelta: number;
  opponentGrowthDelta: number;
  notes: string[];
};

type MoveResolution = {
  selfGrowth: number;
  opponentGrowth: number;
  selfStatus: PracticeStatus;
  opponentStatus: PracticeStatus;
  outcome: MoveOutcome;
};

type PracticeRoundResult = {
  battle: PracticeBattle;
  entries: ActionEntry[];
};

function emptyStatus(): PracticeStatus {
  return {
    blockTurns: 0,
    poisonTicks: 0,
    poisonDpt: 0,
    nextTurnPenalty: 0,
    reflectDamage: 0,
    armorHalf: false,
    attackCap: null,
  };
}

function clampGrowth(value: number) {
  return Math.max(0, Math.min(PRACTICE_TARGET_GROWTH, Math.round(value)));
}

let seededRandomState: number | null = null;

function practiceRandom(): number {
  if (seededRandomState === null) return Math.random();
  seededRandomState = (Math.imul(seededRandomState, 1664525) + 1013904223) >>> 0;
  return seededRandomState / 4294967296;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(practiceRandom() * items.length)];
}

function drawUnique(pool: number[], count: number, excluded = new Set<number>()) {
  const available = pool.filter((moveId) => !excluded.has(moveId));
  const picked: number[] = [];
  while (picked.length < count && available.length > 0) {
    const index = Math.floor(practiceRandom() * available.length);
    picked.push(available.splice(index, 1)[0]);
  }
  return picked;
}

function createPracticeBattleInternal(options: CreatePracticeBattleOptions): PracticeBattle {
  const drawBalancedHand = () => {
    const cards = [
      ...drawUnique(ATTACK_MOVES, 1),
      ...drawUnique(GROWTH_MOVES, 1),
      ...drawUnique(HYBRID_MOVES, 1),
    ];
    cards.push(...drawUnique(ALL_MOVES, 1, new Set(cards)));
    return shuffleTrialHand(cards, practiceRandom, options.trialEngine ?? "portable-v1");
  };
  const playerMoves = drawBalancedHand();
  const botMoves = drawBalancedHand();
  if (options.bonusMoveId && !playerMoves.includes(options.bonusMoveId)) {
    playerMoves.push(options.bonusMoveId);
  }

  return {
    battleId: `${options.mode ?? "practice"}-${options.challengeId ?? Date.now()}-${Math.floor(practiceRandom() * 1e9).toString(16)}`,
    player1: PRACTICE_PLAYER_ADDRESS,
    player2: PRACTICE_BOT_ADDRESS,
    player1Moves: playerMoves,
    player2Moves: botMoves,
    player1Growth: options.playerStartGrowth ?? 0,
    player2Growth: options.botStartGrowth ?? 0,
    turn: 0,
    winner: null,
    finished: false,
    isBotBattle: true,
    lastMoveMs: Date.now(),
    mode: options.mode ?? "practice",
    botMoveHistory: [],
    allBotMoves: [],
    playerMoveHistory: [],
    allPlayerMoves: [],
    totalTurns: 0,
    playerStatus: emptyStatus(),
    botStatus: emptyStatus(),
    challengeId: options.challengeId,
    botMoveTypeSchedule: options.botMoveTypeSchedule,
    trialEngine: options.trialEngine,
  };
}

export function createPracticeBattle(
  options: CreatePracticeBattleOptions = {},
): PracticeBattle {
  if (options.seed === undefined) return createPracticeBattleInternal(options);
  const previousState = seededRandomState;
  seededRandomState = options.seed >>> 0;
  try {
    const battle = createPracticeBattleInternal(options);
    battle.randomState = seededRandomState;
    return battle;
  } finally {
    seededRandomState = previousState;
  }
}

function applyStartOfTurnStatus(
  growth: number,
  status: PracticeStatus,
  actorLabel: string,
  totalTurn: number,
): { growth: number; status: PracticeStatus; notes: string[] } {
  const nextStatus = { ...status };
  const notes: string[] = [];
  const naturalGrowth = totalTurn >= 25 ? 3 : totalTurn >= 15 ? 2 : 1;
  let nextGrowth = clampGrowth(growth + naturalGrowth);
  notes.push(`${actorLabel} gained +${nextGrowth - growth} natural growth.`);

  if (nextStatus.nextTurnPenalty > 0) {
    const before = nextGrowth;
    nextGrowth = clampGrowth(nextGrowth - nextStatus.nextTurnPenalty);
    notes.push(`${actorLabel} lost ${before - nextGrowth} delayed growth.`);
    nextStatus.nextTurnPenalty = 0;
  }

  if (nextStatus.poisonTicks > 0) {
    const before = nextGrowth;
    nextGrowth = clampGrowth(nextGrowth - nextStatus.poisonDpt);
    notes.push(`${actorLabel} lost ${before - nextGrowth} poison growth.`);
    nextStatus.poisonTicks -= 1;
    if (nextStatus.poisonTicks === 0) nextStatus.poisonDpt = 0;
  }

  return { growth: nextGrowth, status: nextStatus, notes };
}

function applyDamage(
  damage: number,
  opponentGrowth: number,
  opponentStatus: PracticeStatus,
  targetLabel: string,
  piercing = false,
): { growth: number; status: PracticeStatus; notes: string[]; applied: number; reflected: number } {
  const nextStatus = { ...opponentStatus };
  if (!piercing && nextStatus.blockTurns > 0) {
    nextStatus.blockTurns -= 1;
    const reflected = nextStatus.reflectDamage;
    nextStatus.reflectDamage = 0;
    return {
      growth: opponentGrowth,
      status: nextStatus,
      notes: [`${targetLabel} blocked the hit.`, ...(reflected > 0 ? [`The shield reflected ${reflected} Growth.`] : [])],
      applied: 0,
      reflected,
    };
  }

  let resolvedDamage = damage;
  if (nextStatus.attackCap !== null) {
    resolvedDamage = Math.min(resolvedDamage, nextStatus.attackCap);
    nextStatus.attackCap = null;
  }
  if (nextStatus.armorHalf) {
    resolvedDamage = Math.ceil(resolvedDamage / 2);
    nextStatus.armorHalf = false;
  }
  const nextGrowth = clampGrowth(opponentGrowth - resolvedDamage);
  const applied = opponentGrowth - nextGrowth;
  return {
    growth: nextGrowth,
    status: nextStatus,
    notes: applied > 0 ? [`${targetLabel} growth was reduced by ${applied}.`] : [`${targetLabel} had no growth to reduce.`],
    applied,
    reflected: 0,
  };
}

function growSelf(amount: number, selfGrowth: number, actorLabel: string) {
  const nextGrowth = clampGrowth(selfGrowth + amount);
  const applied = nextGrowth - selfGrowth;
  return {
    growth: nextGrowth,
    notes: applied > 0 ? [`${actorLabel} gained +${applied} growth.`] : [`${actorLabel} could not gain more growth.`],
    applied,
  };
}

function resolveMove(
  moveId: number,
  selfGrowth: number,
  opponentGrowth: number,
  selfStatus: PracticeStatus,
  opponentStatus: PracticeStatus,
  actorLabel: string,
  opponentLabel: string,
  selfLastMove: number | undefined,
  opponentLastMove: number | undefined,
  totalTurn: number,
): MoveResolution {
  const hadPendingDamage = selfStatus.poisonTicks > 0 || selfStatus.nextTurnPenalty > 0;
  const statusBeforeTurn = { ...selfStatus };
  if (moveId === 14) {
    statusBeforeTurn.poisonTicks = 0;
    statusBeforeTurn.poisonDpt = 0;
    statusBeforeTurn.nextTurnPenalty = 0;
  } else if (moveId === 20) {
    statusBeforeTurn.nextTurnPenalty = 0;
  }
  const started = applyStartOfTurnStatus(selfGrowth, statusBeforeTurn, actorLabel, totalTurn);
  let nextSelfGrowth = started.growth;
  let nextOpponentGrowth = opponentGrowth;
  let nextSelfStatus = started.status;
  let nextOpponentStatus = { ...opponentStatus };
  const notes = [...started.notes];

  const addGrow = (amount: number) => {
    const result = growSelf(amount, nextSelfGrowth, actorLabel);
    nextSelfGrowth = result.growth;
    notes.push(...result.notes);
  };
  const addDamage = (amount: number, piercing = false) => {
    const result = applyDamage(amount, nextOpponentGrowth, nextOpponentStatus, opponentLabel, piercing);
    nextOpponentGrowth = result.growth;
    nextOpponentStatus = result.status;
    if (result.reflected > 0) nextSelfGrowth = clampGrowth(nextSelfGrowth - result.reflected);
    notes.push(...result.notes);
  };
  const addBlock = () => {
    nextSelfStatus = { ...nextSelfStatus, blockTurns: Math.max(nextSelfStatus.blockTurns, 1) };
    notes.push(`${actorLabel} prepared a block.`);
  };

  const opponentLastType = opponentLastMove ? MOVE_META[opponentLastMove]?.type : undefined;
  const selfLastType = selfLastMove ? MOVE_META[selfLastMove]?.type : undefined;
  if (ATTACK_MOVES.includes(moveId) && nextOpponentGrowth === 0) {
    addGrow(4);
    notes.push(`${actorLabel} earned the +4 Mulch Bonus.`);
  }

  switch (moveId) {
    case 1:
      if (nextOpponentStatus.blockTurns > 0) {
        nextOpponentStatus.blockTurns -= 1;
        nextOpponentStatus.reflectDamage = 0;
        addDamage(7, true);
      } else addDamage(11);
      break;
    case 2: addDamage(nextOpponentGrowth >= 40 ? 12 : 8); break;
    case 3: if (practiceRandom() < 0.75) addDamage(16); else notes.push(`${actorLabel}'s cyclone missed.`); break;
    case 4: addDamage(11, true); break;
    case 5: addDamage(opponentLastType === "growth" ? 12 : 8); break;
    case 6: addDamage(6); addDamage(6); break;
    case 7: addDamage(nextSelfGrowth < nextOpponentGrowth ? 13 : 10); break;
    case 8:
      addGrow(6);
      if (nextSelfStatus.blockTurns === 0) {
        addBlock();
        nextSelfStatus.reflectDamage = 4;
      }
      break;
    case 9: addDamage(6); addGrow(4); break;
    case 10:
      if (nextOpponentStatus.poisonTicks === 0) {
        nextOpponentStatus = { ...nextOpponentStatus, poisonTicks: 2, poisonDpt: 4 };
        notes.push(`${opponentLabel} was poisoned for two turns.`);
      } else notes.push(`${opponentLabel} is already poisoned.`);
      break;
    case 11:
      if (practiceRandom() < 0.75) addDamage(17); else notes.push(`${actorLabel}'s lightning missed.`);
      break;
    case 12:
      if (nextOpponentStatus.blockTurns > 0) nextOpponentStatus.blockTurns -= 1;
      nextOpponentStatus.reflectDamage = 0;
      addDamage(10, true);
      break;
    case 13:
      addDamage(7);
      nextOpponentStatus = { ...nextOpponentStatus, nextTurnPenalty: nextOpponentStatus.nextTurnPenalty + 4 };
      notes.push(`${opponentLabel} will lose 4 growth next turn.`);
      break;
    case 14:
      addGrow(hadPendingDamage ? 14 : 10);
      if (hadPendingDamage) notes.push(`${actorLabel} cleansed lingering damage before it resolved.`);
      break;
    case 15: addGrow(nextSelfGrowth < nextOpponentGrowth ? 12 : 8); break;
    case 16:
      if (nextSelfGrowth >= 4) {
        nextSelfGrowth = clampGrowth(nextSelfGrowth - 4);
        notes.push(`${actorLabel} spent 4 growth.`);
        addDamage(16);
      } else {
        notes.push(`${actorLabel} needs at least 4 growth to use Pruning Fury.`);
      }
      break;
    case 17:
      if (nextSelfStatus.blockTurns > 0) addGrow(10);
      else { addGrow(7); addBlock(); }
      break;
    case 18: addGrow(5); addDamage(5); break;
    case 19:
      if (practiceRandom() < 0.6) addGrow(20);
      else {
        const lost = Math.min(4, nextSelfGrowth);
        nextSelfGrowth = clampGrowth(nextSelfGrowth - 4);
        notes.push(`${actorLabel} lost ${lost} growth to overgrowth.`);
      }
      break;
    case 20: addGrow(10); break;
    case 21: addGrow(8 + Math.floor(practiceRandom() * 7)); break;
    case 22: addGrow(opponentLastType === "attack" ? 14 : 10); break;
    case 23: addGrow(nextOpponentStatus.blockTurns > 0 ? 15 : 10); break;
    case 24: addGrow(14); nextOpponentGrowth = clampGrowth(nextOpponentGrowth + 3); break;
    case 25: addGrow(practiceRandom() < 0.75 ? 15 : 3); break;
    case 26: addGrow(selfLastType === "attack" ? 13 : 11); break;
    case 27: addGrow(7); nextSelfStatus.armorHalf = true; break;
    case 28: addGrow(nextSelfGrowth <= 10 ? 13 : 10); break;
    case 29:
      addGrow(8);
      if (practiceRandom() < 0.5 && nextSelfStatus.blockTurns === 0) addBlock();
      break;
    case 30: addGrow(8); nextSelfStatus.attackCap = 8; break;
    default:
      notes.push(`${actorLabel} used an unknown move.`);
      break;
  }

  return {
    selfGrowth: nextSelfGrowth,
    opponentGrowth: nextOpponentGrowth,
    selfStatus: nextSelfStatus,
    opponentStatus: nextOpponentStatus,
    outcome: {
      selfGrowthDelta: nextSelfGrowth - selfGrowth,
      opponentGrowthDelta: nextOpponentGrowth - opponentGrowth,
      notes,
    },
  };
}

function expectedGrowth(moveId: number) {
  if (moveId === 9) return 4;
  if (moveId === 14) return 10;
  if (moveId === 15) return 10;
  if (moveId === 17) return 7;
  if (moveId === 18) return 5;
  if (moveId === 19 || moveId === 20 || moveId === 22 || moveId === 23) return 10;
  if (moveId === 21 || moveId === 29 || moveId === 30) return 8;
  if (moveId === 24) return 14;
  if (moveId === 25) return 12;
  if (moveId === 26) return 11;
  if (moveId === 27) return 7;
  if (moveId === 28) return 10;
  return 0;
}

function expectedDamage(moveId: number) {
  if (moveId === 1) return 11;
  if (moveId === 2) return 8;
  if (moveId === 3) return 12;
  if (moveId === 4) return 11;
  if (moveId === 5) return 8;
  if (moveId === 6) return 12;
  if (moveId === 7) return 10;
  if (moveId === 9) return 6;
  if (moveId === 11) return 13;
  if (moveId === 12) return 10;
  if (moveId === 13) return 7;
  if (moveId === 16) return 16;
  if (moveId === 18) return 5;
  return 0;
}

function addsBlock(moveId: number) {
  return moveId === 8 || moveId === 17 || moveId === 29;
}

function scoreBotMove(moveId: number, battle: PracticeBattle) {
  let score = 0;
  const botBehind = battle.player2Growth < battle.player1Growth;
  const playerNearTarget = battle.player1Growth >= 35;
  const growth = expectedGrowth(moveId);
  const damage = expectedDamage(moveId);

  if (growth > 0 && battle.player2Growth < PRACTICE_TARGET_GROWTH) {
    const usefulGrowth = Math.min(growth, PRACTICE_TARGET_GROWTH - battle.player2Growth);
    score += (botBehind ? 120 : 80) + usefulGrowth;
  }

  if (damage > 0 && battle.player1Growth > 0) {
    const usefulDamage = Math.min(damage, battle.player1Growth);
    score += (playerNearTarget ? 95 : 45) + usefulDamage;
  }

  if (addsBlock(moveId)) {
    score += battle.botStatus.blockTurns > 0 ? 3 : playerNearTarget ? 26 : 12;
  }

  if (moveId === 10 && battle.player1Growth > 0 && battle.playerStatus.poisonTicks === 0) {
    score += playerNearTarget ? 55 : 35;
  }

  const history = battle.botMoveHistory.slice(-4);
  const lastMove = history[history.length - 1];
  const usesInLastFour = history.filter((id) => id === moveId).length;
  if (moveId === lastMove) score -= 90;
  if (usesInLastFour >= 2) score -= 60;

  return Math.max(1, score);
}

function choosePracticeBotMove(battle: PracticeBattle) {
  const scheduledType = battle.botMoveTypeSchedule?.length
    ? battle.botMoveTypeSchedule[
        (battle.trialEngine === "portable-v1" ? battle.allBotMoves.length : battle.botMoveHistory.length) % battle.botMoveTypeSchedule.length
      ]
    : null;
  const scheduledMoves = scheduledType
    ? battle.player2Moves.filter((moveId) => MOVE_META[moveId]?.type === scheduledType)
    : battle.player2Moves;
  const availableMoves = scheduledMoves.length > 0 ? scheduledMoves : battle.player2Moves;
  const scored = availableMoves.map((moveId) => ({
    moveId,
    score: scoreBotMove(moveId, battle),
  }));
  const maxScore = Math.max(...scored.map((item) => item.score));
  let candidates = scored.filter((item) => item.score >= Math.max(1, maxScore - 25));

  if (candidates.length > 1) {
    const lastMove = battle.botMoveHistory[battle.botMoveHistory.length - 1];
    const withoutRepeat = candidates.filter((item) => item.moveId !== lastMove);
    if (withoutRepeat.length > 0) candidates = withoutRepeat;
  }

  if (candidates.length > 1) {
    const recent = battle.botMoveHistory.slice(-4);
    const underLimit = candidates.filter(
      (item) => recent.filter((moveId) => moveId === item.moveId).length < 2,
    );
    if (underLimit.length > 0) candidates = underLimit;
  }

  return randomItem(candidates).moveId;
}

function formatActorMove(moveId: number, actorLabel: string) {
  const effect = MOVE_META[moveId]?.effect;
  if (!effect) return `${actorLabel} used ${MOVE_LABELS[moveId] ?? `Move ${moveId}`}.`;
  return effect
    .replace(/\bYOUR\b/g, actorLabel === "You" ? "your" : "Garden Bot's")
    .replace(/opponent/gi, actorLabel === "You" ? "Garden Bot" : "your tree");
}

function makeEntry(
  actor: ActionEntry["actor"],
  moveId: number,
  prevPlayerGrowth: number,
  nextPlayerGrowth: number,
  prevOpponentGrowth: number,
  nextOpponentGrowth: number,
  details: string[],
  label?: string,
): ActionEntry {
  return {
    id: `${Date.now()}-${actor}-${moveId}-${Math.floor(practiceRandom() * 1e9).toString(16)}`,
    timestamp: Date.now(),
    actor,
    moveId,
    prevPlayerGrowth,
    nextPlayerGrowth,
    prevOpponentGrowth,
    nextOpponentGrowth,
    details,
    label,
  };
}

function formatDelta(delta: number) {
  if (delta === 0) return "no change";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function playPracticeRoundInternal(
  battle: PracticeBattle,
  playerMoveId: number,
): PracticeRoundResult {
  if (battle.finished || battle.winner) {
    return { battle, entries: [] };
  }
  if (!battle.player1Moves.includes(playerMoveId)) {
    throw new Error("That move is not in your Practice Mode hand.");
  }
  if (battle.playerMoveHistory[battle.playerMoveHistory.length - 1] === playerMoveId) {
    throw new Error("Choose a different move. The same card cannot be played twice in a row.");
  }

  const roundStartPlayerGrowth = battle.player1Growth;
  const roundStartBotGrowth = battle.player2Growth;
  const playerResolved = resolveMove(
    playerMoveId,
    battle.player1Growth,
    battle.player2Growth,
    battle.playerStatus,
    battle.botStatus,
    "You",
    "Garden Bot",
    battle.playerMoveHistory[battle.playerMoveHistory.length - 1],
    battle.botMoveHistory[battle.botMoveHistory.length - 1],
    battle.totalTurns,
  );

  let nextBattle: PracticeBattle = {
    ...battle,
    player1Growth: playerResolved.selfGrowth,
    player2Growth: playerResolved.opponentGrowth,
    playerStatus: playerResolved.selfStatus,
    botStatus: playerResolved.opponentStatus,
    playerMoveHistory: [...battle.playerMoveHistory, playerMoveId].slice(-8),
    allPlayerMoves: [...battle.allPlayerMoves, playerMoveId],
    totalTurns: battle.totalTurns + 1,
    lastMoveMs: Date.now(),
  };

  const playerWon = nextBattle.player1Growth >= PRACTICE_TARGET_GROWTH;
  let botMoveId = 0;
  let botResolved: MoveResolution | null = null;

  if (!playerWon) {
    botMoveId = choosePracticeBotMove(nextBattle);
    botResolved = resolveMove(
      botMoveId,
      nextBattle.player2Growth,
      nextBattle.player1Growth,
      nextBattle.botStatus,
      nextBattle.playerStatus,
      "Garden Bot",
      "Your tree",
      nextBattle.botMoveHistory[nextBattle.botMoveHistory.length - 1],
      nextBattle.playerMoveHistory[nextBattle.playerMoveHistory.length - 1],
      nextBattle.totalTurns,
    );

    nextBattle = {
      ...nextBattle,
      player1Growth: botResolved.opponentGrowth,
      player2Growth: botResolved.selfGrowth,
      playerStatus: botResolved.opponentStatus,
      botStatus: botResolved.selfStatus,
      botMoveHistory: [...nextBattle.botMoveHistory, botMoveId].slice(-8),
      allBotMoves: [...nextBattle.allBotMoves, botMoveId],
      totalTurns: nextBattle.totalTurns + 1,
      lastMoveMs: Date.now(),
    };
  }

  const winner =
    nextBattle.player1Growth >= PRACTICE_TARGET_GROWTH
      ? PRACTICE_PLAYER_ADDRESS
      : nextBattle.player2Growth >= PRACTICE_TARGET_GROWTH
        ? PRACTICE_BOT_ADDRESS
        : null;

  nextBattle = {
    ...nextBattle,
    finished: !!winner,
    winner,
  };

  const playerDelta = nextBattle.player1Growth - roundStartPlayerGrowth;
  const botDelta = nextBattle.player2Growth - roundStartBotGrowth;
  const entries: ActionEntry[] = [
    makeEntry(
      "you",
      playerMoveId,
      roundStartPlayerGrowth,
      playerResolved.selfGrowth,
      roundStartBotGrowth,
      playerResolved.opponentGrowth,
      [formatActorMove(playerMoveId, "You"), ...playerResolved.outcome.notes],
    ),
  ];

  if (botResolved && botMoveId) {
    entries.push(
      makeEntry(
        "opponent",
        botMoveId,
        playerResolved.selfGrowth,
        nextBattle.player1Growth,
        playerResolved.opponentGrowth,
        nextBattle.player2Growth,
        [formatActorMove(botMoveId, "Garden Bot"), ...botResolved.outcome.notes],
        MOVE_LABELS[botMoveId] ?? `Garden Bot Move #${botMoveId}`,
      ),
    );
  }

  entries.push(
    makeEntry(
      "round",
      0,
      roundStartPlayerGrowth,
      nextBattle.player1Growth,
      roundStartBotGrowth,
      nextBattle.player2Growth,
      [
        `Round result: You ${nextBattle.player1Growth} / ${PRACTICE_TARGET_GROWTH} - Garden Bot ${nextBattle.player2Growth} / ${PRACTICE_TARGET_GROWTH}`,
        `Your tree: ${roundStartPlayerGrowth} -> ${nextBattle.player1Growth} (${formatDelta(playerDelta)})`,
        `Garden Bot: ${roundStartBotGrowth} -> ${nextBattle.player2Growth} (${formatDelta(botDelta)})`,
        ...(winner
          ? [
              winner === PRACTICE_PLAYER_ADDRESS
                ? "You reached the Practice Mode target first."
                : "Garden Bot reached the Practice Mode target first.",
            ]
          : []),
      ],
      "Round Result",
    ),
  );

  return { battle: nextBattle, entries };
}

export function playPracticeRound(
  battle: PracticeBattle,
  playerMoveId: number,
): PracticeRoundResult {
  if (battle.randomState === undefined) {
    return playPracticeRoundInternal(battle, playerMoveId);
  }

  const previousState = seededRandomState;
  seededRandomState = battle.randomState >>> 0;
  try {
    const result = playPracticeRoundInternal(battle, playerMoveId);
    result.battle.randomState = seededRandomState;
    return result;
  } finally {
    seededRandomState = previousState;
  }
}
