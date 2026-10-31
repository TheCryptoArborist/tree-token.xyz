/// <reference path="./arcade-pg.d.ts" />
import { createHash } from 'node:crypto';
import { ArcadeGrowthError, growthWallet } from './arcade-growth-core.ts';

type Environment = Record<string, string | undefined>;
type QueryResult = { rows: Record<string, unknown>[] };
export type TreeforceSessionQuery = (text: string, values: string[]) => Promise<QueryResult>;
export type TreeforceParticipationSession = {
  wallet: string; runId: string; sessionExpiresAt: string; verifiedAt: string;
};

// This is the existing isolated TREE FORCE database, not the site's default DB.
// Keep the identity pinned to the recorded, published game binding.
export const TREEFORCE_DATABASE_IDENTITY = 'df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const unavailable = () => new ArcadeGrowthError('participation-unavailable', 'Your game can continue. Participation could not be saved yet. Please retry.', 503);
const expired = () => new ArcadeGrowthError('invalid-game-session', 'Your game sign-in expired. Verify your NFTree again before starting a new run.', 401);

export function treeforceRunId(value: unknown): string {
  if (typeof value !== 'string' || !/^grove-[a-f0-9]{32}$/.test(value)) {
    throw new ArcadeGrowthError('invalid-request', 'The game run could not be identified.');
  }
  return value;
}

export function validateTreeforceTransportOptions(url: URL): void {
  // pg-connection-string permits query fields to override URL authority. Only
  // the existing transport options are accepted; host/user/port overrides and
  // file-based TLS options can never bypass the pinned database identity.
  const options = [...url.searchParams.keys()];
  if (new Set(options).size !== options.length || options.some((key) => !['sslmode', 'channel_binding'].includes(key)) ||
      !['require', 'verify-full'].includes(url.searchParams.get('sslmode') || '') ||
      (url.searchParams.has('channel_binding') && url.searchParams.get('channel_binding') !== 'require')) throw unavailable();
}

export function treeforceDatabaseIdentity(connectionString: string): string {
  let url: URL;
  try { url = new URL(connectionString); } catch { throw unavailable(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.db.netlify.com') ||
      url.pathname !== '/netlifydb' || url.username !== 'netlifydb_owner' || !url.password || url.hash ||
      (url.port !== '' && url.port !== '5432')) throw unavailable();
  validateTreeforceTransportOptions(url);
  const identity = sha256(url.hostname.replace(/-pooler(?=\.)/, '') + '|' + url.pathname);
  if (identity !== TREEFORCE_DATABASE_IDENTITY) throw unavailable();
  return identity;
}

let cached: { fingerprint: string; pool: { query: TreeforceSessionQuery; end: () => Promise<void> } } | undefined;
async function configuredQuery(env: Environment): Promise<TreeforceSessionQuery> {
  const connectionString = env.TREEFORCE89_DEV_DATABASE_URL;
  if (!connectionString) throw unavailable();
  treeforceDatabaseIdentity(connectionString);
  const fingerprint = sha256(connectionString);
  if (!cached || cached.fingerprint !== fingerprint) {
    // Exact isolated lock: pg 8.23.1, already used by TREE FORCE's database SDK.
    // Explicit connection prevents fallback to the unrelated default database.
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000,
      query_timeout: 6_000, statement_timeout: 5_000, idleTimeoutMillis: 10_000, allowExitOnIdle: true });
    pool.on('error', () => {}); // Never log credential-bearing database errors.
    const previous = cached;
    cached = { fingerprint, pool };
    if (previous) void previous.pool.end().catch(() => {});
  }
  const pool = cached.pool;
  return (text, values) => pool.query(text, values);
}

/** Authenticates the first-wave report; it does not verify browser gameplay. */
export async function readTreeforceParticipationSession(input: {
  tokenSha256: string; runId: string; env: Environment;
  query?: TreeforceSessionQuery; now?: Date | (() => Date);
}): Promise<TreeforceParticipationSession> {
  const runId = treeforceRunId(input.runId);
  if (!/^[a-f0-9]{64}$/.test(input.tokenSha256)) throw expired();
  let result: QueryResult;
  try {
    const query = input.query || await configuredQuery(input.env);
    result = await query(`SELECT wallet, run_id, expires_at::text AS expires_at,
      clock_timestamp()::text AS verified_at
      FROM public.tree_game_sessions
      WHERE session_token_hash = $1 AND expires_at > clock_timestamp()
      LIMIT 2`, [input.tokenSha256]);
  } catch (error) {
    if (error instanceof ArcadeGrowthError) throw error;
    throw unavailable();
  }
  if (!Array.isArray(result.rows) || result.rows.length > 1) throw unavailable();
  if (!result.rows.length) throw expired();
  const row = result.rows[0];
  if (row.run_id !== runId) throw new ArcadeGrowthError('run-changed', 'This game run has changed. Start the current run to record participation.', 409);
  let wallet: string;
  try { wallet = growthWallet(row.wallet); } catch { throw unavailable(); }
  const expiresAt = typeof row.expires_at === 'string' ? Date.parse(row.expires_at) : NaN;
  const verifiedAt = typeof row.verified_at === 'string' ? Date.parse(row.verified_at) : NaN;
  const now = (typeof input.now === 'function' ? input.now() : input.now || new Date()).getTime();
  if (!Number.isFinite(expiresAt) || !Number.isFinite(verifiedAt) || !Number.isFinite(now) ||
      verifiedAt > now + 5_000 || verifiedAt < now - 15_000) throw unavailable();
  if (expiresAt <= now || expiresAt <= verifiedAt) throw expired();
  return { wallet, runId, sessionExpiresAt: new Date(expiresAt).toISOString(), verifiedAt: new Date(verifiedAt).toISOString() };
}
