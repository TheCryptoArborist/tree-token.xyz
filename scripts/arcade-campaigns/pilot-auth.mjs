// Server-only authentication for free pilot access. This module never creates,
// changes, or revokes a Daily Growth/Arcade session or checks NFTree ownership.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isValidPersonalMessageSignature } from '../../vendor/arcade-monthly/node_modules/@mysten/sui/dist/verify/index.mjs';
import { parseSerializedSignature } from '../../vendor/arcade-monthly/node_modules/@mysten/sui/dist/cryptography/index.mjs';
import { SuiGrpcClient } from '../../vendor/arcade-monthly/node_modules/@mysten/sui/dist/grpc/index.mjs';
import { PilotError } from './pilot-errors.mjs';

export const PILOT_SESSION_SCOPE = 'challenge-pilot';
export const PILOT_TOKEN = /^pilot_[a-f0-9]{64}$/;
export const PILOT_AUTH_ACTIONS = ['auth-challenge', 'auth-session', 'auth-logout'];
const WALLET = /^0x[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ORIGINS = ['https://tree-token.xyz', 'https://www.tree-token.xyz'];
const CHALLENGE_MS = 5 * 60_000, SESSION_MS = 60 * 60_000, CLOCK_HEADROOM_MS = 10000;
const hash = value => createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const unavailable = () => new PilotError('verification-unavailable', 'Pilot sign-in verification is temporarily unavailable. Please try again.', 503);
const badChallenge = () => new PilotError('invalid-challenge', 'Request a fresh pilot sign-in message.', 403);

export function pilotSignInMessage({ wallet, origin, challengeId, expiresAt }) {
  if (!WALLET.test(wallet || '') || !ORIGINS.includes(origin) || !UUID.test(challengeId || '') || !Number.isFinite(Date.parse(expiresAt))) throw badChallenge();
  return [
    'TREE Arcade — Free Challenge Pilot Sign-In', '',
    'Audience: tree-arcade:challenge-pilot:v1',
    'Origin: ' + origin,
    'URI: ' + origin + '/play/challenge/',
    'Wallet: ' + wallet,
    'Nonce: ' + challengeId,
    'Expires: ' + new Date(expiresAt).toISOString(), '',
    'Authorize up to one hour of access only to the free, no-prize challenge pilot.',
    'No NFTree or purchase is required for this pilot.',
    'This message grants no check-ins, rewards, event access, payments, transfers, or other Arcade permissions.',
    'No blockchain transaction will be submitted.',
  ].join('\n');
}

// The pinned SDK verifies ordinary keypairs, passkeys and ordinary multisig
// locally. Top-level zkLogin additionally needs the mainnet verification RPC.
// Its environmental failures remain 503 rather than being called bad signatures.
export async function verifyPilotPersonalMessage({ message, signature, wallet }, { zkLoginClient } = {}) {
  let parsed;
  try { parsed = parseSerializedSignature(signature); } catch { return false; }
  if (parsed.signatureScheme === 'MultiSig' && parsed.multisig.multisig_pk.pk_map.some(({ pubKey }) => Object.hasOwn(pubKey, 'ZkLogin') || Object.hasOwn(pubKey, 'Passkey'))) {
    throw new PilotError('unsupported-signature', 'This multisignature wallet format is not supported by the pilot’s pinned verifier.', 400);
  }
  const client = zkLoginClient || new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
  const boundedClient = { core: { verifyZkLoginSignature: options => client.core.verifyZkLoginSignature({ ...options, signal: AbortSignal.timeout(8000) }) } };
  try {
    return await isValidPersonalMessageSignature(new TextEncoder().encode(message), signature, { address: wallet, client: boundedClient });
  } catch { throw unavailable(); }
}

export function createPilotAuthenticator({ rpc, clock = Date.now, entropy = randomBytes, nonce = randomUUID, verifyPersonalMessage = verifyPilotPersonalMessage }) {
  function validChallenge(record, wallet, origin) {
    if (!record || !UUID.test(record.id || '') || record.wallet !== wallet || record.origin !== origin || record.consumedAt !== null ||
        !Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= clock() ||
        record.message !== pilotSignInMessage({ wallet, origin, challengeId: record.id, expiresAt: record.expiresAt })) throw badChallenge();
    return record;
  }
  return async ({ action, body, origin, authorization }) => {
    if (!ORIGINS.includes(origin)) throw new PilotError('origin-not-allowed', 'Use the official TREE Arcade.', 403);
    if (action === 'auth-challenge') {
      if (!exact(body, ['wallet']) || !WALLET.test(body.wallet || '')) throw new PilotError('invalid-request', 'Choose a valid Sui wallet.');
      const challengeId = nonce(), expiresAt = new Date(clock() + CHALLENGE_MS - CLOCK_HEADROOM_MS).toISOString();
      const message = pilotSignInMessage({ wallet: body.wallet, origin, challengeId, expiresAt });
      const record = validChallenge(await rpc('arcade_challenge_pilot_auth_create_challenge_v1', {
        p_challenge_id: challengeId, p_wallet: body.wallet, p_origin: origin, p_message: message, p_expires_at: expiresAt,
      }), body.wallet, origin);
      if (record.id !== challengeId || record.message !== message) throw unavailable();
      return { challenge: { challengeId: record.id, wallet: record.wallet, origin: record.origin, message: record.message, expiresAt: record.expiresAt, sessionScope: PILOT_SESSION_SCOPE } };
    }
    if (action === 'auth-session') {
      if (!exact(body, ['wallet', 'challengeId', 'signature']) || !WALLET.test(body.wallet || '') || !UUID.test(body.challengeId || '') || typeof body.signature !== 'string' || body.signature.length < 1 || body.signature.length > 16384) throw new PilotError('invalid-request', 'Provide the current pilot sign-in message and wallet signature.');
      const record = validChallenge(await rpc('arcade_challenge_pilot_auth_read_challenge_v1', { p_challenge_id: body.challengeId }), body.wallet, origin);
      if (record.id !== body.challengeId) throw badChallenge();
      let verified;
      try { verified = await verifyPersonalMessage({ message: record.message, signature: body.signature, wallet: body.wallet }); }
      catch (error) { if (error instanceof PilotError) throw error; throw unavailable(); }
      if (verified !== true) throw new PilotError('invalid-signature', 'The signature does not authorize this pilot sign-in.', 403);
      const token = 'pilot_' + entropy(32).toString('hex');
      if (!PILOT_TOKEN.test(token)) throw unavailable();
      const session = await rpc('arcade_challenge_pilot_auth_create_session_v1', {
        p_challenge_id: record.id, p_wallet: body.wallet, p_origin: origin, p_token_sha256: hash(token), p_expires_at: new Date(clock() + SESSION_MS - CLOCK_HEADROOM_MS).toISOString(),
      });
      if (!session || session.wallet !== body.wallet || session.origin !== origin || session.sessionScope !== PILOT_SESSION_SCOPE || session.revoked !== false ||
          !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= clock() || Date.parse(session.expiresAt) > clock() + SESSION_MS + 10000) throw unavailable();
      return { session: { version: 1, token, wallet: session.wallet, origin: session.origin, expiresAt: session.expiresAt, sessionScope: PILOT_SESSION_SCOPE } };
    }
    if (action === 'auth-logout') {
      if (!exact(body, [])) throw new PilotError('invalid-request', 'Send an empty logout request.');
      const token = /^Bearer (pilot_[a-f0-9]{64})$/.exec(authorization || '')?.[1];
      if (!token) throw new PilotError('invalid-session', 'Use this pilot’s sign-in to sign out.', 401);
      const revoked = await rpc('arcade_challenge_pilot_auth_revoke_session_v1', { p_token_sha256: hash(token), p_origin: origin });
      if (typeof revoked !== 'boolean') throw unavailable();
      return { signedOut: true, sessionScope: PILOT_SESSION_SCOPE };
    }
    throw new PilotError('not-found', 'Unknown pilot sign-in action.', 404);
  };
}
