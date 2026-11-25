import { createHash } from "node:crypto";
import { normalizeSuiAddress } from "./tree-payment.mjs";

/**
 * Resolve an authenticated game session from a high-entropy bearer credential.
 * Token MUST be issued by a trusted server only after wallet signature proof.
 * Store only its SHA-256 hash; never expose raw tokens in logs or database.
 *
 * This resolver is not a wallet login implementation and does not issue tokens.
 * The development run endpoint uses this only after its deploy/origin guard.
 */
export function createAuthenticatedSessionResolver(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("PostgreSQL pool with query() required");
  }
  return async function resolveSession(authContext) {
    const token = authContext?.sessionToken;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      throw Object.assign(new Error("Valid authenticated session token required"),{code:'SESSION_REQUIRED'});
    }
    const hash = createHash("sha256").update(token, "utf8").digest("hex");
    const result = await pool.query(
      `SELECT session_id, wallet, run_id, wave, continuation_number,
              game_over, cleared, continue_pending, created_at, expires_at
       FROM tree_game_sessions
       WHERE session_token_hash = $1 AND expires_at > NOW()`,
      [hash],
    );
    if (result.rows?.length !== 1) {
      throw Object.assign(new Error("Session expired or not authenticated"),{code:'SESSION_REQUIRED'});
    }
    const row = result.rows[0];
    const createdAt=new Date(row.created_at).getTime(),expiresAt=new Date(row.expires_at).getTime();
    if(!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(expiresAt) || createdAt>=expiresAt)
      throw new Error('Invalid authoritative session lifetime');
    if (!Number.isSafeInteger(Number(row.wave)) || Number(row.wave) < 0 ||
        !Number.isSafeInteger(Number(row.continuation_number)) || Number(row.continuation_number) < 0) {
      throw new Error("Invalid authoritative session state");
    }
    return {
      sessionId: row.session_id,
      wallet: normalizeSuiAddress(row.wallet),
      runId: row.run_id,
      wave: Number(row.wave),
      continuationNumber: Number(row.continuation_number),
      gameOver: row.game_over === true,
      cleared: row.cleared === true,
      continuePending: row.continue_pending === true,
      createdAt,
      expiresAt,
    };
  };
}
