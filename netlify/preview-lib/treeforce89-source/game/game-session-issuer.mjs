import {randomBytes,createHash} from "node:crypto";
import {normalizeSuiAddress} from "./tree-payment.mjs";

/**
 * Start a fresh, server-authoritative game session only for an authenticated
 * wallet holding a directly owned NFTree.
 *
 * This deliberately accepts NO client-supplied wallet, runId, wave, score,
 * game-over flag or continuation counter.
 *
 * This is not yet connected to the public HTTP endpoint.
 */
export function createGameSessionIssuer({loginStore,ownershipChecker,pool,now=()=>Date.now(),ttlMs=2*60*60_000}) {
  if(typeof loginStore?.resolve!=="function")throw new Error("Authenticated wallet login store required");
  if(typeof ownershipChecker!=="function")throw new Error("Trusted NFTree ownership checker required");
  if(typeof pool?.query!=="function")throw new Error("PostgreSQL pool required");
  if(!Number.isSafeInteger(ttlMs)||ttlMs<60_000||ttlMs>24*60*60_000)throw new Error("Invalid session lifetime");

  return {
    async create({loginToken}) {
      if(typeof loginToken!=="string"||!/^[a-f0-9]{64}$/.test(loginToken))
        throw new Error("Valid wallet login credential required");
      const login=await loginStore.resolve(loginToken);
      if(!login?.wallet)throw new Error("Wallet login not authenticated");
      const wallet=normalizeSuiAddress(login.wallet);
      const eligible=await ownershipChecker({wallet});
      if(eligible!==true)throw Object.assign(new Error("NFTree ownership required"),{code:'NFTREE_REQUIRED'});

      const sessionId=randomBytes(24).toString("hex");
      const runId="grove-"+randomBytes(16).toString("hex");
      const sessionToken=randomBytes(32).toString("hex");
      const tokenHash=createHash("sha256").update(sessionToken,"utf8").digest("hex");
      const expiresAt=now()+ttlMs;
      const inserted=await pool.query(
        `INSERT INTO tree_game_sessions
          (session_id,wallet,session_token_hash,expires_at,run_id,wave,
           continuation_number,game_over,cleared,continue_pending)
         VALUES($1,$2,$3,$4,$5,0,0,FALSE,FALSE,FALSE)
         RETURNING session_id`,
        [sessionId,wallet,tokenHash,new Date(expiresAt),runId],
      );
      if(inserted.rows?.length!==1)throw new Error("Game session not persisted");
      return {sessionId,sessionToken,runId,wallet,expiresAt};
    },
  };
}
