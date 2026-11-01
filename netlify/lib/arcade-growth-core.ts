import { ARCADE_ENABLED_GAME_IDS, type ArcadeGrowthGameEvent, type ArcadeGrowthGameId } from './arcade-growth-games.ts';

export const ARCADE_GROWTH_VERSION = 'arcade-growth-v1';
export const ARCADE_GROWTH_CHALLENGE_MS = 5 * 60_000;
export const ARCADE_GROWTH_SESSION_MS = 60 * 60_000;
export const ARCADE_GROWTH_ORIGINS = ['https://tree-token.xyz', 'https://www.tree-token.xyz'] as const;
// Participation eligibility is separate from the frozen monthly Passport set.
// Garden adapters continue to accept only their three completed-result modes.
export const GROWTH_ELIGIBLE_GAME_IDS = [...ARCADE_ENABLED_GAME_IDS, 'treeforce89'] as const;
export type GrowthEligibleGameId = typeof GROWTH_ELIGIBLE_GAME_IDS[number];
export const ARCADE_GROWTH_MILESTONES = [
  { id: 'seedling', label: 'Seedling', target: 3 },
  { id: 'sapling', label: 'Sapling', target: 7 },
  { id: 'deep-roots', label: 'Deep Roots', target: 14 },
  { id: 'full-canopy', label: 'Full Canopy', target: 21 },
] as const;
const GAME_DETAILS: Record<GrowthEligibleGameId, { id: GrowthEligibleGameId; label: string; href: string; creditRule: 'complete-result' | 'start-run' }> = {
  'garden-bot': { id: 'garden-bot', label: 'Garden Bot', href: 'https://nftree.net/battle/garden-bot', creditRule: 'complete-result' },
  pvp: { id: 'pvp', label: 'PvP Battle', href: 'https://nftree.net/battle/pvp', creditRule: 'complete-result' },
  'arborist-trials': { id: 'arborist-trials', label: 'Arborist Trials', href: 'https://nftree.net/battle/trials', creditRule: 'complete-result' },
  treeforce89: { id: 'treeforce89', label: 'TREE FORCE ’89', href: '/play/treeforce89/', creditRule: 'start-run' },
};

export class ArcadeGrowthError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message); this.name = 'ArcadeGrowthError'; this.code = code; this.status = status;
  }
}

export function growthWallet(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value) || /^0x0{64}$/i.test(value)) {
    throw new ArcadeGrowthError('invalid-wallet', 'Choose a valid Sui wallet.');
  }
  return value.toLowerCase();
}

export function growthDateKey(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new ArcadeGrowthError('service-unavailable', 'The server clock is unavailable.', 503);
  return now.toISOString().slice(0, 10);
}

export function growthMonthKey(now: Date): string { return growthDateKey(now).slice(0, 7); }

export function growthEnabledGames(value: unknown): ArcadeGrowthGameId[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > ARCADE_ENABLED_GAME_IDS.length ||
      value.some((id) => !ARCADE_ENABLED_GAME_IDS.includes(id)) || new Set(value).size !== value.length) {
    throw new ArcadeGrowthError('service-unavailable', 'The saved monthly game rules could not be verified.', 503);
  }
  return [...value] as ArcadeGrowthGameId[];
}

export function growthEligibleGames(value: unknown): GrowthEligibleGameId[] {
  if (!Array.isArray(value) || value.length !== GROWTH_ELIGIBLE_GAME_IDS.length ||
      value.some((id) => !GROWTH_ELIGIBLE_GAME_IDS.includes(id)) || new Set(value).size !== value.length) {
    throw new ArcadeGrowthError('service-unavailable', 'Eligible game rules could not be verified.', 503);
  }
  return [...value] as GrowthEligibleGameId[];
}

export function growthConfiguration(enabled: readonly ArcadeGrowthGameId[], now: Date) {
  const ids = growthEnabledGames(enabled);
  const ordinal = Math.floor(Date.parse(`${growthDateKey(now)}T00:00:00.000Z`) / 86_400_000);
  const soloIds: GrowthEligibleGameId[] = [...ids.filter((id) => id === 'garden-bot' || id === 'arborist-trials'), 'treeforce89'];
  return { ruleVersion: ARCADE_GROWTH_VERSION, enabledGames: ids.map((id) => GAME_DETAILS[id]),
    eligibleGames: GROWTH_ELIGIBLE_GAME_IDS.map((id) => GAME_DETAILS[id]),
    todayPick: GAME_DETAILS[soloIds[ordinal % soloIds.length]],
    questRule: 'Complete a Garden Battles result or start the first wave of a TREE FORCE ’89 run. A win is not required.',
    resetAt: new Date(Date.parse(`${growthDateKey(now)}T00:00:00.000Z`) + 86_400_000).toISOString() };
}

export type GrowthChallenge = {
  challengeId: string; wallet: string; origin: string; dateKey: string;
  message: string; expiresAt: string; consumed: boolean;
};
export type GrowthSession = { wallet: string; origin: string; expiresAt: string; revoked: boolean };
export type GrowthSnapshot = {
  wallet: string; dateKey: string; monthKey: string; enabledGames: ArcadeGrowthGameId[];
  eligibleGames: GrowthEligibleGameId[];
  checkins: string[];
  quests: Array<{ dateKey: string; gameId: GrowthEligibleGameId }>;
  gamesByDay: Array<{ dateKey: string; gameIds: GrowthEligibleGameId[] }>;
  badges: Array<{ id: string; monthKey: string; earnedAt: string }>;
};

export function growthChallengeMessage(input: { wallet: string; origin: string; challengeId: string; nonce: string; now: Date; expiresAt: string }) {
  if (!(ARCADE_GROWTH_ORIGINS as readonly string[]).includes(input.origin)) {
    throw new ArcadeGrowthError('origin-not-allowed', 'Sign in from the official TREE Arcade website.', 403);
  }
  return [
    'TREE Arcade Daily Growth',
    'Action: Sign in to save check-ins and game participation',
    `Domain: ${new URL(input.origin).host}`,
    `URI: ${input.origin}/play/`,
    'Network: sui:mainnet',
    `Wallet: ${growthWallet(input.wallet)}`,
    `UTC date: ${growthDateKey(input.now)}`,
    `Challenge: ${input.challengeId}`,
    `Nonce: ${input.nonce}`,
    `Issued at: ${input.now.toISOString()}`,
    `Expires: ${input.expiresAt}`,
    'This signature does not authorize a transaction, token approval, payment, or reward claim.',
  ].join('\n');
}

export function validateGrowthEvents(events: unknown, wallet: string, dateKey: string, now: Date): ArcadeGrowthGameEvent[] {
  if (!Array.isArray(events) || events.length > 100) throw new ArcadeGrowthError('verification-unavailable', 'Game results could not be verified.', 503);
  const seen = new Set<string>();
  return events.map((event) => {
    if (!event || typeof event !== 'object' || event.source !== 'garden-battles' ||
        typeof event.sourceId !== 'string' || event.sourceId.length < 3 || event.sourceId.length > 200 ||
        !/^[a-zA-Z0-9:_-]+$/.test(event.sourceId) || event.wallet !== wallet ||
        !ARCADE_ENABLED_GAME_IDS.includes(event.gameId)) {
      throw new ArcadeGrowthError('verification-unavailable', 'A game result identity could not be verified.', 503);
    }
    const completedAt = typeof event.completedAt === 'string' ? Date.parse(event.completedAt) : NaN;
    if (!Number.isFinite(completedAt) || completedAt > now.getTime() || new Date(completedAt).toISOString().slice(0, 10) !== dateKey ||
        (event.proofDigest !== undefined && (typeof event.proofDigest !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(event.proofDigest)))) {
      throw new ArcadeGrowthError('verification-unavailable', 'A game result date or proof could not be verified.', 503);
    }
    const key = `${event.source}:${event.sourceId}`;
    if (seen.has(key)) throw new ArcadeGrowthError('verification-unavailable', 'Game results contained a duplicate identity.', 503);
    seen.add(key);
    return { source: event.source, sourceId: event.sourceId, gameId: event.gameId, wallet,
      completedAt: new Date(completedAt).toISOString(), ...(event.proofDigest ? { proofDigest: event.proofDigest } : {}) };
  });
}

export function buildGrowthProgress(snapshot: GrowthSnapshot) {
  const wallet = growthWallet(snapshot.wallet);
  const date = new Date(`${snapshot.dateKey}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.dateKey) || growthDateKey(date) !== snapshot.dateKey ||
      snapshot.monthKey !== snapshot.dateKey.slice(0, 7)) {
    throw new ArcadeGrowthError('service-unavailable', 'The saved progress date could not be verified.', 503);
  }
  const enabledGames = growthEnabledGames(snapshot.enabledGames);
  const eligibleGames = growthEligibleGames(snapshot.eligibleGames);
  const validDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value.slice(0, 7) === snapshot.monthKey && value <= snapshot.dateKey &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!Array.isArray(snapshot.checkins) || snapshot.checkins.some((day) => !validDay(day)) ||
      new Set(snapshot.checkins).size !== snapshot.checkins.length || !Array.isArray(snapshot.quests) ||
      snapshot.quests.some((item) => !item || !validDay(item.dateKey) || !eligibleGames.includes(item.gameId)) ||
      new Set(snapshot.quests.map((item) => item.dateKey)).size !== snapshot.quests.length ||
      !Array.isArray(snapshot.gamesByDay) || snapshot.gamesByDay.some((item) => !item || !validDay(item.dateKey) ||
        !Array.isArray(item.gameIds) || item.gameIds.length === 0 || new Set(item.gameIds).size !== item.gameIds.length ||
        item.gameIds.some((id) => !eligibleGames.includes(id))) ||
      new Set(snapshot.gamesByDay.map((item) => item.dateKey)).size !== snapshot.gamesByDay.length || !Array.isArray(snapshot.badges)) {
    throw new ArcadeGrowthError('service-unavailable', 'Saved progress could not be verified.', 503);
  }
  const checked = new Set(snapshot.checkins);
  const quests = new Set(snapshot.quests.map((item) => item.dateKey));
  if ([...quests].some((day) => !checked.has(day))) throw new ArcadeGrowthError('service-unavailable', 'Saved quest attendance is inconsistent.', 503);
  const games = new Map(snapshot.gamesByDay.map((item) => [item.dateKey, [...new Set(item.gameIds)]]));
  if ([...games.keys()].some((day) => !checked.has(day) || !quests.has(day)) ||
      snapshot.quests.some((quest) => !games.get(quest.dateKey)?.includes(quest.gameId))) {
    throw new ArcadeGrowthError('service-unavailable', 'Saved game and quest progress is inconsistent.', 503);
  }
  const year = date.getUTCFullYear(); const month = date.getUTCMonth();
  const calendar = Array.from({ length: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() }, (_, index) => {
    const dateKey = new Date(Date.UTC(year, month, index + 1)).toISOString().slice(0, 10);
    return { dateKey, checkedIn: checked.has(dateKey), questCompleted: quests.has(dateKey), gameIds: games.get(dateKey) || [] };
  });
  const completedGameIds = enabledGames.filter((id) => [...games.values()].some((ids) => ids.includes(id)));
  const optionalGames = eligibleGames.filter((id) => !(enabledGames as readonly string[]).includes(id));
  const optionalCompletedGameIds = optionalGames.filter((id) => [...games.values()].some((ids) => ids.includes(id)));
  const badgeLabels = new Map<string, string>([...ARCADE_GROWTH_MILESTONES.map((item) => [item.id, item.label] as [string, string]), ['arcade-passport', 'Arcade Passport']]);
  const badges = snapshot.badges.map((badge) => {
    if (!badge || !badgeLabels.has(badge.id) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(badge.monthKey) || badge.monthKey > snapshot.monthKey ||
        !Number.isFinite(Date.parse(badge.earnedAt))) throw new ArcadeGrowthError('service-unavailable', 'Saved badges could not be verified.', 503);
    return { ...badge, label: badgeLabels.get(badge.id)! };
  });
  const today = calendar.find((day) => day.dateKey === snapshot.dateKey)!;
  return { wallet, monthKey: snapshot.monthKey, dateKey: snapshot.dateKey, calendar,
    checkedInDays: checked.size, questDays: quests.size,
    today: { checkedIn: today.checkedIn, questCompleted: today.questCompleted, gameIds: today.gameIds },
    passport: { monthKey: snapshot.monthKey, enabledGames: enabledGames.map((id) => GAME_DETAILS[id]),
      completedGameIds, complete: enabledGames.every((id) => completedGameIds.includes(id)),
      optionalGames: optionalGames.map((id) => GAME_DETAILS[id]), optionalCompletedGameIds },
    milestones: ARCADE_GROWTH_MILESTONES.map((item) => ({ ...item, earned: checked.size >= item.target })), badges };
}
