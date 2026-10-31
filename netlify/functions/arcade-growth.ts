import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ARCADE_ENABLED_GAME_IDS, syncGardenParticipation, type ArcadeGrowthGameSyncResult } from '../lib/arcade-growth-games.ts';
import { ARCADE_GROWTH_CHALLENGE_MS, ARCADE_GROWTH_SESSION_MS, ARCADE_GROWTH_ORIGINS,
  ArcadeGrowthError, buildGrowthProgress, growthChallengeMessage, growthConfiguration, growthDateKey,
  growthWallet, validateGrowthEvents, type GrowthSnapshot } from '../lib/arcade-growth-core.ts';
import { configuredArcadeGrowthStore, type ArcadeGrowthStore } from '../lib/arcade-growth-store.ts';

type Environment = Record<string, string | undefined>;
type Context = { ip?: string };
type Ownership = { address: string; network: string; nftreeCount: number };
export type ArcadeGrowthDependencies = {
  env?: Environment; store?: ArcadeGrowthStore; now?: () => Date;
  randomToken?: () => string; randomId?: () => string;
  verifySignature?: (message: Uint8Array, signature: string, wallet: string) => Promise<boolean>;
  ownership?: (wallet: string) => Promise<Ownership>;
  syncGames?: typeof syncGardenParticipation;
};
const ENV_KEYS = ['ARCADE_GROWTH_ENABLED', 'ARCADE_GROWTH_RATE_LIMIT_SECRET', 'TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET',
  ...['ARCADE_GROWTH', 'TREE_RAFFLE', 'TREE_KNOWLEDGE_TRIAL'].flatMap((key) => [`${key}_SUPABASE_URL`, `${key}_SUPABASE_SECRET_KEY`])];
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function environment(): Environment {
  const netlify = (globalThis as unknown as { Netlify?: { env: { get: (key: string) => string | undefined } } }).Netlify;
  return Object.fromEntries(ENV_KEYS.map((key) => [key, netlify?.env.get(key) ?? process.env[key]]));
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function productionOrigin(request: Request): string {
  const origin = request.headers.get('origin') || new URL(request.url).origin;
  if (!(ARCADE_GROWTH_ORIGINS as readonly string[]).includes(origin)) {
    throw new ArcadeGrowthError('origin-not-allowed', 'Use Daily Growth from the official TREE Arcade website.', 403);
  }
  return origin;
}
async function body(request: Request, allowed: string[]): Promise<Record<string, unknown>> {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    throw new ArcadeGrowthError('invalid-request', 'Send a JSON request.');
  }
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 16_384) throw new ArcadeGrowthError('invalid-request', 'This request is too large.', 413);
  const reader = request.body?.getReader(); let length = 0; const chunks: Uint8Array[] = [];
  if (reader) {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new ArcadeGrowthError('invalid-request', 'This request is too large.', 413); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ArcadeGrowthError('invalid-request', 'This request is not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new ArcadeGrowthError('invalid-request', 'This request contains unsupported fields.');
  }
  return value as Record<string, unknown>;
}
function tokenHash(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header) throw new ArcadeGrowthError('authentication-required', 'Sign in to save Daily Growth progress.', 401);
  const match = /^Bearer ([0-9a-f]{64})$/.exec(header);
  if (!match) throw new ArcadeGrowthError('invalid-session', 'Your Daily Growth session is invalid. Sign in again.', 401);
  return sha256(match[1]);
}
async function verifySignature(message: Uint8Array, signature: string, wallet: string): Promise<boolean> {
  // Exact root lock: @mysten/sui 2.26.1. A client is required for zkLogin verification;
  // the SDK also handles personal-message intent, passkeys and wallet-address binding.
  const [{ isValidPersonalMessageSignature }, { SuiGrpcClient }] = await Promise.all([
    import('@mysten/sui/verify'), import('@mysten/sui/grpc'),
  ]);
  const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
  // The pinned verifier does not forward a signal. Bound only this read call;
  // no global transport, provider, wallet or SDK behavior is changed.
  const verifyZkLogin = client.core.verifyZkLoginSignature.bind(client.core);
  client.core.verifyZkLoginSignature = (options) => verifyZkLogin({ ...options, signal: AbortSignal.timeout(12_000) });
  return isValidPersonalMessageSignature(message, signature, { address: wallet, client });
}
async function ownership(wallet: string): Promise<Ownership> {
  const { getCanonicalNftreeOwnership } = await import('./nftree-wallet.ts');
  return getCanonicalNftreeOwnership(wallet);
}

export function createArcadeGrowthHandler(dependencies: ArcadeGrowthDependencies = {}) {
  const now = dependencies.now || (() => new Date());
  const randomToken = dependencies.randomToken || (() => randomBytes(32).toString('hex'));
  return async (request: Request, context: Context = {}): Promise<Response> => {
    try {
      const env = dependencies.env || environment();
      const action = new URL(request.url).searchParams.get('action') || 'status';
      if ((action === 'status' && request.method !== 'GET') || (action !== 'status' && request.method !== 'POST')) {
        throw new ArcadeGrowthError('method-not-allowed', 'This action does not support that request method.', 405);
      }
      if (!['status', 'challenge', 'session', 'check-in', 'sync', 'logout'].includes(action)) {
        throw new ArcadeGrowthError('invalid-request', 'Unknown Daily Growth action.', 404);
      }
      if (env.ARCADE_GROWTH_ENABLED !== 'true') throw new ArcadeGrowthError('service-unavailable', 'Daily Growth is not available yet.', 503);
      const store = dependencies.store || configuredArcadeGrowthStore(env);
      const origin = action === 'status' && !request.headers.has('authorization') ? null : productionOrigin(request);
      const envelope = (snapshot?: GrowthSnapshot) => {
        const time = now();
        if (snapshot && snapshot.dateKey !== growthDateKey(time)) throw new ArcadeGrowthError('utc-day-changed', 'The UTC day changed. Refresh and try again.', 409);
        return { status: 'ok', serverTime: time.toISOString(), dateKey: growthDateKey(time), monthKey: growthDateKey(time).slice(0, 7),
          authenticated: !!snapshot, ...(snapshot ? { configuration: growthConfiguration(snapshot.enabledGames, time), progress: buildGrowthProgress(snapshot) } : {}) };
      };
      const requireOwnership = async (wallet: string) => {
        let result: Ownership;
        try { result = await (dependencies.ownership || ownership)(wallet); }
        catch { throw new ArcadeGrowthError('ownership-unavailable', 'NFTree ownership could not be checked. Please try again.', 503); }
        if (result.address !== wallet || result.network !== 'sui-mainnet' || !Number.isSafeInteger(result.nftreeCount) || result.nftreeCount < 0) {
          throw new ArcadeGrowthError('ownership-unavailable', 'NFTree ownership could not be verified. Please try again.', 503);
        }
        if (result.nftreeCount < 1) throw new ArcadeGrowthError('nftree-required', 'Hold an NFTree in this wallet or its owned Kiosk to save Daily Growth progress.', 403);
      };
      const authenticate = async () => {
        const hash = tokenHash(request); const session = await store.readSession(hash, origin!);
        if (session.revoked || session.origin !== origin || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now().getTime()) {
          throw new ArcadeGrowthError('invalid-session', 'Your Daily Growth session expired. Sign in again.', 401);
        }
        return { hash, wallet: growthWallet(session.wallet) };
      };
      if (action === 'status') {
        if (!request.headers.has('authorization')) {
          const enabled = await store.publicRules(ARCADE_ENABLED_GAME_IDS);
          return json({ ...envelope(), configuration: growthConfiguration(enabled, now()) });
        }
        const { hash, wallet } = await authenticate();
        const snapshot = await store.snapshot(hash, origin!, ARCADE_ENABLED_GAME_IDS);
        if (snapshot.wallet !== wallet) throw new ArcadeGrowthError('service-unavailable', 'Saved progress identity could not be verified.', 503);
        return json(envelope(snapshot));
      }
      if (action === 'challenge') {
        const data = await body(request, ['wallet']); const wallet = growthWallet(data.wallet);
        const secret = env.ARCADE_GROWTH_RATE_LIMIT_SECRET || env.TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET;
        if (!secret || secret.length < 32 || typeof context.ip !== 'string' || !context.ip || context.ip.length > 128) {
          throw new ArcadeGrowthError('service-unavailable', 'Secure sign-in is temporarily unavailable.', 503);
        }
        const time = now(); const expiresAt = new Date(time.getTime() + ARCADE_GROWTH_CHALLENGE_MS).toISOString();
        const challengeId = (dependencies.randomId || randomUUID)(); const nonce = randomToken();
        const message = growthChallengeMessage({ wallet, origin: origin!, challengeId, nonce, now: time, expiresAt });
        const challenge = await store.createChallenge({ challengeId, wallet, origin: origin!, dateKey: growthDateKey(time),
          nonceSha256: sha256(nonce), message, expiresAt,
          requestFingerprint: createHmac('sha256', secret).update(`arcade-growth-v1:challenge:${context.ip}`).digest('hex') });
        if (challenge.challengeId !== challengeId || challenge.wallet !== wallet || challenge.origin !== origin || challenge.message !== message || challenge.consumed) {
          throw new ArcadeGrowthError('service-unavailable', 'The sign-in challenge could not be verified.', 503);
        }
        return json({ status: 'ok', challenge: { challengeId, wallet, message, expiresAt: challenge.expiresAt, dateKey: challenge.dateKey } });
      }
      if (action === 'session') {
        const data = await body(request, ['wallet', 'challengeId', 'signature']); const wallet = growthWallet(data.wallet);
        if (typeof data.challengeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.challengeId) ||
            typeof data.signature !== 'string' || data.signature.length < 40 || data.signature.length > 12_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.signature)) {
          throw new ArcadeGrowthError('invalid-signature', 'The wallet sign-in response could not be verified.', 401);
        }
        const challenge = await store.readChallenge(data.challengeId);
        if (challenge.challengeId !== data.challengeId || challenge.wallet !== wallet || challenge.origin !== origin || challenge.consumed ||
            challenge.dateKey !== growthDateKey(now()) || !Number.isFinite(Date.parse(challenge.expiresAt)) || Date.parse(challenge.expiresAt) <= now().getTime()) {
          throw new ArcadeGrowthError('expired-challenge', 'This sign-in request expired or was already used. Sign in again.', 401);
        }
        const verify = async () => {
          let valid: boolean;
          try { valid = await (dependencies.verifySignature || verifySignature)(new TextEncoder().encode(challenge.message), data.signature as string, wallet); }
          catch { throw new ArcadeGrowthError('verification-unavailable', 'Wallet signature verification is temporarily unavailable. Please try again.', 503); }
          if (!valid) throw new ArcadeGrowthError('invalid-signature', 'The signature does not match this wallet and sign-in message.', 401);
        };
        // Both checks are read-only and required before the atomic consume. Their
        // bounded parallel requests keep the complete login inside the function deadline.
        await Promise.all([verify(), requireOwnership(wallet)]);
        const token = randomToken(); const expiresAt = new Date(now().getTime() + ARCADE_GROWTH_SESSION_MS).toISOString();
        const session = await store.createSession({ challengeId: data.challengeId, wallet, origin: origin!, tokenSha256: sha256(token), expiresAt });
        if (session.wallet !== wallet || session.origin !== origin || session.revoked) throw new ArcadeGrowthError('service-unavailable', 'The sign-in session could not be verified.', 503);
        const snapshot = await store.snapshot(sha256(token), origin!, ARCADE_ENABLED_GAME_IDS);
        if (snapshot.wallet !== wallet) throw new ArcadeGrowthError('service-unavailable', 'Saved progress identity could not be verified.', 503);
        return json({ ...envelope(snapshot), session: { token, wallet, expiresAt: session.expiresAt } });
      }
      await body(request, []); // No client dates, results, wins, launch events or achievement flags are accepted.
      const { hash, wallet } = await authenticate();
      if (action === 'logout') { await store.revokeSession(hash, origin!); return json({ status: 'ok', authenticated: false }); }
      let snapshot: GrowthSnapshot; let sync: ArcadeGrowthGameSyncResult | undefined;
      if (action === 'check-in') {
        await requireOwnership(wallet);
        snapshot = await store.checkIn(hash, origin!, ARCADE_ENABLED_GAME_IDS);
      } else {
        const time = now(); const dateKey = growthDateKey(time);
        [, sync] = await Promise.all([requireOwnership(wallet), (dependencies.syncGames || syncGardenParticipation)({ wallet, dateKey, now: time })]);
        if (growthDateKey(now()) !== dateKey) throw new ArcadeGrowthError('utc-day-changed', 'The UTC day changed. Refresh to verify today’s games.', 409);
        const events = validateGrowthEvents(sync.events, wallet, dateKey, now());
        snapshot = await store.recordEvents(hash, origin!, ARCADE_ENABLED_GAME_IDS, dateKey, events);
      }
      if (snapshot.wallet !== wallet) throw new ArcadeGrowthError('service-unavailable', 'Saved progress identity could not be verified.', 503);
      return json({ ...envelope(snapshot), ...(sync ? { sync: { games: sync.games, checkedAt: sync.checkedAt } } : {}) });
    } catch (error) {
      const known = error instanceof ArcadeGrowthError ? error : new ArcadeGrowthError('service-unavailable', 'Daily Growth is temporarily unavailable. Your saved progress has not been removed.', 503);
      return json({ status: 'error', error: known.code, message: known.message }, known.status);
    }
  };
}

export default createArcadeGrowthHandler();
export const config = { path: '/api/arcade-growth', method: ['GET', 'POST'],
  rateLimit: { action: 'rate_limit', aggregateBy: ['domain', 'ip'], windowSize: 60, windowLimit: 60 } };
