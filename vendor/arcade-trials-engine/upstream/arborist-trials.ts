export const ARBORIST_TRIAL_TARGET_GROWTH = 50;
import { TRIAL_PORTABLE_START_DATE } from "./trial-engine";
export const ARBORIST_TRIAL_VERSION = 2;
export const ARBORIST_TRIAL_V2_START_DATE = "2026-09-02";

export type ArboristTrialRule =
  | "standard"
  | "canopy_diagnosis"
  | "toolbelt_rotation"
  | "storm_response"
  | "integrated_pest_management";

export type ArboristTrialChallenge = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  description: string;
  seed: number;
  targetGrowth: number;
  playerStartGrowth: number;
  botStartGrowth: number;
  rule: ArboristTrialRule;
  ruleDescription: string;
  expiresAt: number;
  simulationVersion?: number;
};

export type ArboristTrialResultInput = {
  won: boolean;
  rounds: number;
  playerGrowth: number;
  botGrowth: number;
  uniqueMoves: number;
  specialtyBonus?: number;
};

export function createArboristTrialProofMessage(
  challengeId: string,
  wallet: string,
  playerMoves: number[],
  replayVersion?: string,
): string {
  return [
    "Garden Battles Arborist Trial",
    `Challenge: ${challengeId}`,
    `Wallet: ${wallet.toLowerCase()}`,
    `Moves: ${playerMoves.join(",")}`,
    ...(replayVersion ? [`Replay: ${replayVersion}`] : []),
  ].join("\n");
}

const LEGACY_TRIAL_VARIANTS = [
  {
    title: "Root Rush",
    subtitle: "Race the clock",
    description: "Both trees start even. Win efficiently and use a varied hand to maximize your daily score.",
    playerStartGrowth: 0,
    botStartGrowth: 0,
    rule: "standard",
    ruleDescription: "Win efficiently and use a varied hand to maximize your score.",
  },
  {
    title: "Comeback Canopy",
    subtitle: "Overcome the head start",
    description: "Garden Bot begins ahead. Counter carefully, recover the gap, and take the canopy.",
    playerStartGrowth: 0,
    botStartGrowth: 8,
    rule: "standard",
    ruleDescription: "Erase the Garden Bot's 8-Growth head start and claim the canopy.",
  },
  {
    title: "Crown Race",
    subtitle: "Every card matters",
    description: "Both trees begin established. The shorter runway rewards counters, timing, and card variety.",
    playerStartGrowth: 10,
    botStartGrowth: 10,
    rule: "standard",
    ruleDescription: "Both trees start established in a shorter race to 50 Growth.",
  },
] as const;

const SEVEN_DAY_TRIAL_ROTATION = [
  LEGACY_TRIAL_VARIANTS[0],
  {
    title: "Canopy Diagnosis",
    subtitle: "Read the threat",
    description: "The Garden Bot reveals its next card type. Choose the right response and earn a diagnosis bonus for every successful counter.",
    playerStartGrowth: 0,
    botStartGrowth: 0,
    rule: "canopy_diagnosis",
    ruleDescription: "Attack counters Growth, Growth counters Hybrid, and Hybrid counters Attack.",
  },
  LEGACY_TRIAL_VARIANTS[1],
  {
    title: "Toolbelt Rotation",
    subtitle: "Use every tool",
    description: "Once a standard card is played, it locks until all four standard cards have been used. The bonus fifth move remains separate.",
    playerStartGrowth: 0,
    botStartGrowth: 0,
    rule: "toolbelt_rotation",
    ruleDescription: "Complete the four-card Toolbelt cycle to unlock the standard hand again.",
  },
  LEGACY_TRIAL_VARIANTS[2],
  {
    title: "Storm Response",
    subtitle: "Recover under pressure",
    description: "A storm strips 4 Growth from both trees after every third completed round. Time your recovery and finishing move carefully.",
    playerStartGrowth: 0,
    botStartGrowth: 0,
    rule: "storm_response",
    ruleDescription: "Storm damage strikes after rounds 3, 6, 9, and every third round thereafter.",
  },
  {
    title: "Integrated Pest Management",
    subtitle: "Control with restraint",
    description: "Win with two or fewer Attack cards to earn the full IPM specialty bonus. Additional attacks remain available but reduce the bonus.",
    playerStartGrowth: 0,
    botStartGrowth: 0,
    rule: "integrated_pest_management",
    ruleDescription: "Use Growth and Hybrid tools to limit Attack plays without sacrificing the win.",
  },
] as const;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getArboristTrialDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysSince(date: string, startingDate: string): number {
  return Math.floor(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${startingDate}T00:00:00.000Z`)) /
      86_400_000,
  );
}

export function getArboristTrialChallenge(now = new Date()): ArboristTrialChallenge {
  const date = getArboristTrialDate(now);
  const version = date >= ARBORIST_TRIAL_V2_START_DATE ? ARBORIST_TRIAL_VERSION : 1;
  const seed = hashText(`garden-battles:arborist-trials:v${version}:${date}`);
  const variant = version === 1
    ? LEGACY_TRIAL_VARIANTS[seed % LEGACY_TRIAL_VARIANTS.length]
    : SEVEN_DAY_TRIAL_ROTATION[
        daysSince(date, ARBORIST_TRIAL_V2_START_DATE) % SEVEN_DAY_TRIAL_ROTATION.length
      ];
  const expiresAt = Date.parse(`${date}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return {
    id: `arborist-trial-v${version}-${date}`,
    date,
    seed,
    targetGrowth: ARBORIST_TRIAL_TARGET_GROWTH,
    expiresAt,
    ...(date >= TRIAL_PORTABLE_START_DATE ? { simulationVersion: 2 } : {}),
    ...variant,
  };
}

export function calculateArboristTrialScore(result: ArboristTrialResultInput): number {
  const rounds = Math.max(1, Math.min(100, Math.round(result.rounds)));
  const playerGrowth = Math.max(0, Math.min(100, Math.round(result.playerGrowth)));
  const botGrowth = Math.max(0, Math.min(100, Math.round(result.botGrowth)));
  const uniqueMoves = Math.max(0, Math.min(5, Math.round(result.uniqueMoves)));
  const victory = result.won ? 10_000 : 0;
  const efficiency = result.won ? Math.max(0, 30 - rounds) * 200 : 0;
  const margin = result.won
    ? Math.max(0, playerGrowth - botGrowth) * 25
    : playerGrowth * 10;
  const variety = uniqueMoves * 100;
  const specialtyBonus = Math.max(0, Math.min(5_000, Math.round(result.specialtyBonus ?? 0)));
  return victory + efficiency + margin + variety + specialtyBonus;
}
