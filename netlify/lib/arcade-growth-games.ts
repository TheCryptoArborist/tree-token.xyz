import { normalizeSuiAddress } from './nftree-wallet-verification.ts';

/** Only games with a completed-result source belong in this allowlist. */
export const ARCADE_ENABLED_GAME_IDS = ['garden-bot', 'pvp', 'arborist-trials'] as const;
export type ArcadeGrowthGameId = typeof ARCADE_ENABLED_GAME_IDS[number];

export type ArcadeGrowthGameEvent = {
  source: string;
  sourceId: string;
  gameId: ArcadeGrowthGameId;
  wallet: string;
  completedAt: string;
  proofDigest?: string;
};

export type ArcadeGrowthGameStatus = {
  gameId: ArcadeGrowthGameId;
  status: 'verified' | 'no-result' | 'partial' | 'unavailable' | 'unsupported';
  message?: string;
};

export type ArcadeGrowthGameSyncResult = {
  events: ArcadeGrowthGameEvent[];
  games: ArcadeGrowthGameStatus[];
  checkedAt: string;
};

export type SyncGardenParticipationInput = {
  wallet: string;
  dateKey: string;
  fetchImpl?: typeof fetch;
  now?: Date;
};

// The deployed NFTree bundle at f8f014c2869dbaed04735c43f94d01a1a818abaa
// uses this origin. Do not accept a URL, result, or timestamp from a browser.
const GARDEN_API_ORIGIN = 'https://gardenbattles-production.up.railway.app';
const GARDEN_BOT_ADDRESS = '0xbbe518c2a2025d2d95b9e5b6435911771f64d7d9fe037fbf2ec661981890d5b4';
const HISTORY_LIMIT = 50;
const MAX_RESPONSE_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const DAY_MS = 86_400_000;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BATTLE_VERSIONS = new Set(['legacy', 'pvp-v2', 'pvp-v3', 'bot-v2']);

type JsonRecord = Record<string, unknown>;
type DayContext = { wallet: string; dateKey: string; start: number; end: number; now: number };
type SourceResult = Pick<ArcadeGrowthGameSyncResult, 'events' | 'games'>;

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid result document.');
  return value as JsonRecord;
}

function address(value: unknown): string {
  const normalized = typeof value === 'string' ? normalizeSuiAddress(value) : null;
  if (!normalized || /^0x0{64}$/.test(normalized)) throw new Error('Invalid result identity.');
  return normalized;
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error('Invalid result number.');
  }
  return value;
}

function timestamp(value: unknown, context: DayContext): number {
  // The live APIs serialize database millisecond timestamps as JSON numbers.
  return integer(value, 1, context.now);
}

function transactionDigest(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
    throw new Error('Invalid transaction digest.');
  }
  let decoded = 0n;
  for (const character of value) decoded = decoded * 58n + BigInt(BASE58.indexOf(character));
  let bytes = 0;
  for (let rest = decoded; rest > 0n; rest >>= 8n) bytes += 1;
  bytes += /^1*/.exec(value)![0].length;
  if (bytes !== 32 || decoded === 0n) throw new Error('Invalid transaction digest.');
  return value;
}

function assertNoSourceError(document: JsonRecord) {
  if (document.ok === false || (document.error != null && document.error !== '')) {
    throw new Error('Source reported an error.');
  }
}

async function readJson(path: string, fetchImpl: typeof fetch): Promise<JsonRecord> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${GARDEN_API_ORIGIN}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status !== 200 || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error('Source response was unavailable.');
    }
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
      throw new Error('Source response exceeded its limit.');
    }
    if (!response.body) throw new Error('Source response was empty.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error('Source response exceeded its limit.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const document = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    assertNoSourceError(document);
    return document;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function statuses(gameIds: readonly ArcadeGrowthGameId[], events: ArcadeGrowthGameEvent[]): ArcadeGrowthGameStatus[] {
  return gameIds.map((gameId) => ({
    gameId,
    status: events.some((event) => event.gameId === gameId) ? 'verified' : 'no-result',
    message: events.some((event) => event.gameId === gameId)
      ? 'A completed result for this UTC day was verified.'
      : 'No completed result is available for this UTC day yet.',
  }));
}

function sourceFailure(gameIds: readonly ArcadeGrowthGameId[]): SourceResult {
  return {
    events: [],
    games: gameIds.map((gameId) => ({
      gameId,
      status: 'unavailable',
      message: 'Completed results could not be verified. Previously saved progress is unchanged; try syncing again.',
    })),
  };
}

async function syncBattles(context: DayContext, fetchImpl: typeof fetch): Promise<SourceResult> {
  const modes = ['garden-bot', 'pvp'] as const;
  try {
    const document = await readJson(`/api/player/${context.wallet}/battles?limit=${HISTORY_LIMIT}`, fetchImpl);
    if (!Array.isArray(document.battles) || document.battles.length > HISTORY_LIMIT) {
      throw new Error('Invalid battle history.');
    }
    const reportedPartial = document.truncated === true || document.hasMore === true ||
      document.hasNextPage === true || document.complete === false;
    const events = new Map<string, ArcadeGrowthGameEvent>();
    const digestBattles = new Map<string, string>();
    let previousTime = context.now;
    for (const value of document.battles) {
      const row = record(value);
      const finishedAt = timestamp(row.finished_at, context);
      if (finishedAt > previousTime) throw new Error('Battle history was not ordered.');
      previousTime = finishedAt;
      const player1 = address(row.player1);
      const player2 = address(row.player2);
      if (player1 === player2 || (player1 !== context.wallet && player2 !== context.wallet)) {
        throw new Error('Battle history did not belong to this wallet.');
      }
      // Old records establish the date boundary, not historical absence. They
      // may predate transaction-digest tracking and never receive new credit.
      if (finishedAt < context.start) continue;
      if (finishedAt >= context.end) throw new Error('Result belongs to another UTC day.');
      const battleId = address(row.battle_id);
      if (row.is_bot_battle !== 0 && row.is_bot_battle !== 1) throw new Error('Battle mode was unavailable.');
      if (typeof row.battle_version !== 'string' || !BATTLE_VERSIONS.has(row.battle_version)) {
        throw new Error('Battle version was unavailable.');
      }
      const bot = row.is_bot_battle === 1;
      if (bot ? (player1 !== context.wallet || player1 === GARDEN_BOT_ADDRESS || player2 !== GARDEN_BOT_ADDRESS || row.battle_version.startsWith('pvp-'))
        : (player1 === GARDEN_BOT_ADDRESS || player2 === GARDEN_BOT_ADDRESS || row.battle_version === 'bot-v2')) {
        throw new Error('Battle mode contradicted its participants.');
      }
      // An unfinished record never qualifies; neither does a queue or launch.
      if (row.winner === null) continue;
      const winner = address(row.winner);
      if (winner !== player1 && winner !== player2) throw new Error('Battle outcome was invalid.');
      const digest = transactionDigest(row.transaction_digest);
      const priorBattle = digestBattles.get(digest);
      if (priorBattle && priorBattle !== battleId) throw new Error('Transaction identity was reused.');
      digestBattles.set(digest, battleId);
      const event: ArcadeGrowthGameEvent = {
        source: 'garden-battles',
        sourceId: `battle:${battleId}:${context.wallet}`,
        gameId: bot ? 'garden-bot' : 'pvp',
        wallet: context.wallet,
        completedAt: new Date(finishedAt).toISOString(),
        proofDigest: digest,
      };
      const prior = events.get(battleId);
      if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error('Battle identity conflicted.');
      events.set(battleId, event);
    }
    const completed = [...events.values()];
    // This endpoint has no cursor. A capped history still proves each validated
    // completion, but cannot establish absence of other results for the day.
    // Preserve positives and expose partial coverage for both modes.
    if (reportedPartial || (document.battles.length === HISTORY_LIMIT && previousTime >= context.start)) {
      return { events: completed, games: modes.map((gameId) => ({
        gameId,
        status: 'partial',
        message: completed.some((event) => event.gameId === gameId)
          ? 'Completed results were verified, but recent history may omit other results. Previously saved progress is unchanged.'
          : 'Recent history does not cover the full UTC day, so missing results cannot be ruled out. Previously saved progress is unchanged.',
      })) };
    }
    return { events: completed, games: statuses(modes, completed) };
  } catch {
    return sourceFailure(modes);
  }
}

async function syncTrial(context: DayContext, fetchImpl: typeof fetch): Promise<SourceResult> {
  const modes = ['arborist-trials'] as const;
  try {
    const document = await readJson(`/api/arborist-trials/today?wallet=${context.wallet}`, fetchImpl);
    const challenge = record(document.challenge);
    if (challenge.date !== context.dateKey || typeof challenge.id !== 'string' ||
      !/^arborist-trial-v[1-9]\d{0,2}-\d{4}-\d{2}-\d{2}$/.test(challenge.id) ||
      !challenge.id.endsWith(`-${context.dateKey}`) || typeof document.rankedAttemptUsed !== 'boolean') {
      throw new Error('Daily Trial identity was unavailable or stale.');
    }
    if (document.result === null && document.rankedAttemptUsed === false) {
      return { events: [], games: statuses(modes, []) };
    }
    const result = record(document.result);
    if (document.rankedAttemptUsed !== true || address(result.wallet) !== context.wallet || typeof result.won !== 'boolean') {
      throw new Error('Official Trial result did not belong to this wallet.');
    }
    integer(result.rounds, 1, 100);
    integer(result.score, 0);
    integer(result.uniqueMoves, 1, 5);
    integer(result.playerGrowth, 0);
    integer(result.botGrowth, 0);
    const completedAt = timestamp(result.completedAt, context);
    if (completedAt < context.start || completedAt >= context.end) throw new Error('Trial was saved on another UTC day.');
    // The source verifies the signed move sequence and completed replay before
    // saving this official result. Practice/local counters are not imported.
    const event: ArcadeGrowthGameEvent = {
      source: 'garden-battles',
      sourceId: `trial:${challenge.id}:${context.wallet}`,
      gameId: 'arborist-trials',
      wallet: context.wallet,
      completedAt: new Date(completedAt).toISOString(),
    };
    return { events: [event], games: statuses(modes, [event]) };
  } catch {
    return sourceFailure(modes);
  }
}

/**
 * Read verified Garden Battles completions for the server's current UTC day.
 * Call only with a server-authenticated wallet. This does not authenticate the
 * caller, award currency, write a result, or erase previously stored progress.
 * Monthly views must accumulate accepted events; this API is not a backfill.
 */
export async function syncGardenParticipation({
  wallet: walletInput,
  dateKey,
  fetchImpl = fetch,
  now = new Date(),
}: SyncGardenParticipationInput): Promise<ArcadeGrowthGameSyncResult> {
  const wallet = address(walletInput);
  const nowMs = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0 || typeof dateKey !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey !== new Date(nowMs).toISOString().slice(0, 10)) {
    throw new Error('Only the current server UTC day can be synchronized.');
  }
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  const context: DayContext = { wallet, dateKey, start, end: start + DAY_MS, now: nowMs };
  const [battles, trial] = await Promise.all([syncBattles(context, fetchImpl), syncTrial(context, fetchImpl)]);
  return { events: [...battles.events, ...trial.events], games: [...battles.games, ...trial.games], checkedAt: now.toISOString() };
}
