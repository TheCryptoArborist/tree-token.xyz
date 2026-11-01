import { ArcadeGrowthError, growthEnabledGames, growthWallet, type GrowthChallenge, type GrowthEligibleGameId, type GrowthSession, type GrowthSnapshot } from './arcade-growth-core.ts';
import type { ArcadeGrowthGameEvent } from './arcade-growth-games.ts';

type Environment = Record<string, string | undefined>;
type JsonRecord = Record<string, unknown>;
export type GrowthChallengeInput = { challengeId: string; wallet: string; origin: string; dateKey: string;
  nonceSha256: string; message: string; expiresAt: string; requestFingerprint: string };
export type GrowthTreeforcePlayInput = { wallet: string; runId: string; sessionExpiresAt: string; verifiedAt: string };
export type GrowthParticipationReceipt = { saved: true; runId: string; sourceId: string; dateKey: string;
  recordedAt: string; alreadyRecorded: boolean };
export type GrowthTreeforcePlayResult = { snapshot: GrowthSnapshot; participation: GrowthParticipationReceipt };
export interface ArcadeGrowthStore {
  publicRules(enabledGames: readonly GrowthEligibleGameId[]): Promise<GrowthEligibleGameId[]>;
  createChallenge(input: GrowthChallengeInput): Promise<GrowthChallenge>;
  readChallenge(challengeId: string): Promise<GrowthChallenge>;
  createSession(input: { challengeId: string; wallet: string; origin: string; tokenSha256: string; expiresAt: string }): Promise<GrowthSession>;
  readSession(tokenSha256: string, origin: string): Promise<GrowthSession>;
  revokeSession(tokenSha256: string, origin: string): Promise<void>;
  snapshot(tokenSha256: string, origin: string, enabledGames: readonly GrowthEligibleGameId[]): Promise<GrowthSnapshot>;
  checkIn(tokenSha256: string, origin: string, enabledGames: readonly GrowthEligibleGameId[]): Promise<GrowthSnapshot>;
  recordEvents(tokenSha256: string, origin: string, enabledGames: readonly GrowthEligibleGameId[], dateKey: string, events: ArcadeGrowthGameEvent[]): Promise<GrowthSnapshot>;
  recordTreeforcePlay(input: GrowthTreeforcePlayInput): Promise<GrowthTreeforcePlayResult>;
}

export function arcadeGrowthSupabaseConfig(env: Environment) {
  const prefixes = ['ARCADE_GROWTH', 'TREE_RAFFLE', 'TREE_KNOWLEDGE_TRIAL'];
  for (const prefix of prefixes) {
    const url = env[`${prefix}_SUPABASE_URL`]; const secretKey = env[`${prefix}_SUPABASE_SECRET_KEY`];
    if (!url && !secretKey) continue;
    if (!url || !secretKey) throw new ArcadeGrowthError('service-unavailable', 'Daily Growth storage is not configured.', 503);
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new ArcadeGrowthError('service-unavailable', 'Daily Growth storage is not configured.', 503); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new ArcadeGrowthError('service-unavailable', 'Daily Growth storage is not configured.', 503);
    }
    return { url: parsed.origin, secretKey };
  }
  throw new ArcadeGrowthError('service-unavailable', 'Daily Growth storage is not configured.', 503);
}

const record = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ArcadeGrowthError('service-unavailable', 'The progress service returned an invalid response.', 503);
  return value as JsonRecord;
};
const text = (value: unknown): string => {
  if (typeof value !== 'string' || !value) throw new ArcadeGrowthError('service-unavailable', 'The progress service returned an invalid response.', 503);
  return value;
};
function challenge(value: unknown): GrowthChallenge {
  const row = record(value);
  if (typeof row.consumed !== 'boolean') throw new ArcadeGrowthError('service-unavailable', 'The sign-in challenge could not be read.', 503);
  return { challengeId: text(row.challengeId), wallet: growthWallet(row.wallet), origin: text(row.origin), dateKey: text(row.dateKey),
    message: text(row.message), expiresAt: text(row.expiresAt), consumed: row.consumed };
}
function session(value: unknown): GrowthSession {
  const row = record(value);
  if (typeof row.revoked !== 'boolean') throw new ArcadeGrowthError('service-unavailable', 'The sign-in session could not be read.', 503);
  return { wallet: growthWallet(row.wallet), origin: text(row.origin), expiresAt: text(row.expiresAt), revoked: row.revoked };
}

const STORE_ERRORS: Record<string, [string, string, number]> = {
  'arcade-growth-rate-limited': ['rate-limited', 'Too many sign-in requests. Please wait a few minutes.', 429],
  'arcade-growth-invalid-challenge': ['expired-challenge', 'This sign-in request expired or was already used. Sign in again.', 401],
  'arcade-growth-invalid-session': ['invalid-session', 'Your Daily Growth session expired. Sign in again.', 401],
  'arcade-growth-day-changed': ['utc-day-changed', 'The UTC day changed. Refresh and try again.', 409],
  'arcade-growth-event-conflict': ['verification-unavailable', 'A saved game result could not be reconciled.', 503],
  'arcade-growth-invalid-game-session': ['invalid-treeforce-session', 'Your TREE FORCE session expired. Verify your NFTree in the game again.', 401],
  'arcade-growth-stale-game-verification': ['verification-unavailable', 'TREE FORCE session verification expired. Check participation again.', 503],
};

export class SupabaseArcadeGrowthStore implements ArcadeGrowthStore {
  private readonly connection: { url: string; secretKey: string };
  private readonly fetchImpl: typeof fetch;
  constructor(connection: { url: string; secretKey: string }, fetchImpl: typeof fetch = fetch) {
    this.connection = connection; this.fetchImpl = fetchImpl;
  }
  private async rpc(name: string, body: JsonRecord): Promise<unknown> {
    try {
      const response = await this.fetchImpl(`${this.connection.url}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json',
          Authorization: `Bearer ${this.connection.secretKey}`, apikey: this.connection.secretKey, 'X-Client-Info': 'tree-arcade-growth/1' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(8_000),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === 'object' ? String((payload as JsonRecord).message || '') : '';
        const mapped = STORE_ERRORS[message];
        if (mapped) throw new ArcadeGrowthError(...mapped);
        throw new ArcadeGrowthError('service-unavailable', 'Daily Growth storage is temporarily unavailable.', 503);
      }
      return payload;
    } catch (error) {
      if (error instanceof ArcadeGrowthError) throw error;
      throw new ArcadeGrowthError('service-unavailable', 'Daily Growth storage is temporarily unavailable.', 503);
    }
  }
  async publicRules(enabledGames: readonly GrowthEligibleGameId[]) {
    return growthEnabledGames(await this.rpc('arcade_growth_public_rules_v1', { p_enabled_games: enabledGames }));
  }
  async createChallenge(input: GrowthChallengeInput) {
    return challenge(await this.rpc('arcade_growth_create_challenge_v1', {
      p_challenge_id: input.challengeId, p_wallet: input.wallet, p_origin: input.origin, p_date_key: input.dateKey,
      p_nonce_sha256: input.nonceSha256, p_message: input.message, p_expires_at: input.expiresAt, p_request_fingerprint: input.requestFingerprint,
    }));
  }
  async readChallenge(challengeId: string) {
    return challenge(await this.rpc('arcade_growth_read_challenge_v1', { p_challenge_id: challengeId }));
  }
  async createSession(input: { challengeId: string; wallet: string; origin: string; tokenSha256: string; expiresAt: string }) {
    return session(await this.rpc('arcade_growth_create_session_v1', { p_challenge_id: input.challengeId, p_wallet: input.wallet,
      p_origin: input.origin, p_token_sha256: input.tokenSha256, p_expires_at: input.expiresAt }));
  }
  async readSession(tokenSha256: string, origin: string) {
    return session(await this.rpc('arcade_growth_read_session_v1', { p_token_sha256: tokenSha256, p_origin: origin }));
  }
  async revokeSession(tokenSha256: string, origin: string) {
    await this.rpc('arcade_growth_revoke_session_v1', { p_token_sha256: tokenSha256, p_origin: origin });
  }
  async snapshot(tokenSha256: string, origin: string, enabledGames: readonly GrowthEligibleGameId[]) {
    return record(await this.rpc('arcade_growth_snapshot_v1', { p_token_sha256: tokenSha256, p_origin: origin, p_enabled_games: enabledGames })) as unknown as GrowthSnapshot;
  }
  async checkIn(tokenSha256: string, origin: string, enabledGames: readonly GrowthEligibleGameId[]) {
    return record(await this.rpc('arcade_growth_check_in_v1', { p_token_sha256: tokenSha256, p_origin: origin, p_enabled_games: enabledGames })) as unknown as GrowthSnapshot;
  }
  async recordEvents(tokenSha256: string, origin: string, enabledGames: readonly GrowthEligibleGameId[], dateKey: string, events: ArcadeGrowthGameEvent[]) {
    return record(await this.rpc('arcade_growth_record_events_v1', { p_token_sha256: tokenSha256, p_origin: origin,
      p_enabled_games: enabledGames, p_date_key: dateKey, p_events: events })) as unknown as GrowthSnapshot;
  }
  async recordTreeforcePlay(input: GrowthTreeforcePlayInput): Promise<GrowthTreeforcePlayResult> {
    const wallet = growthWallet(input.wallet);
    if (!/^grove-[a-f0-9]{32}$/.test(input.runId) || !Number.isFinite(Date.parse(input.sessionExpiresAt)) || !Number.isFinite(Date.parse(input.verifiedAt))) {
      throw new ArcadeGrowthError('invalid-treeforce-session', 'The TREE FORCE run could not be verified.', 401);
    }
    const result = record(await this.rpc('arcade_growth_record_treeforce_play_v1', { p_wallet: wallet, p_run_id: input.runId,
      p_session_expires_at: input.sessionExpiresAt, p_verified_at: input.verifiedAt }));
    const saved = record(result.participation); const snapshot = record(result.snapshot);
    const recordedAt = typeof saved.recordedAt === 'string' ? Date.parse(saved.recordedAt) : NaN;
    if (saved.saved !== true || saved.runId !== input.runId || saved.sourceId !== `run:${input.runId}:${wallet}` ||
        typeof saved.alreadyRecorded !== 'boolean' || typeof saved.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saved.dateKey) ||
        !Number.isFinite(recordedAt) || new Date(recordedAt).toISOString().slice(0, 10) !== saved.dateKey || snapshot.wallet !== wallet) {
      throw new ArcadeGrowthError('service-unavailable', 'Saved TREE FORCE participation could not be verified.', 503);
    }
    return { snapshot: snapshot as unknown as GrowthSnapshot, participation: { saved: true, runId: input.runId,
      sourceId: saved.sourceId as string, dateKey: saved.dateKey, recordedAt: new Date(recordedAt).toISOString(), alreadyRecorded: saved.alreadyRecorded } };
  }
}

export function configuredArcadeGrowthStore(env: Environment, fetchImpl: typeof fetch = fetch) {
  return new SupabaseArcadeGrowthStore(arcadeGrowthSupabaseConfig(env), fetchImpl);
}
