import {createHash} from "node:crypto";
import {normalizeSuiAddress} from "./tree-payment.mjs";

/**
 * Database-backed wallet login credentials.
 * A login credential proves wallet identity but does not authorize gameplay,
 * NFT ownership, or paid continuation.
 */
export function createPostgresWalletLoginStore(pool) {
  if(typeof pool?.query!=="function")throw new Error("PostgreSQL pool required");
  return {
    async save({tokenHash,wallet,expiresAt}) {
      if(typeof tokenHash!=="string"||!/^[a-f0-9]{64}$/.test(tokenHash))
        throw new Error("Invalid token hash");
      if(!Number.isSafeInteger(expiresAt))throw new Error("Invalid login expiration");
      const address=normalizeSuiAddress(wallet);
      const result=await pool.query(
        `INSERT INTO tree_wallet_logins(token_hash,wallet,expires_at)
         VALUES($1,$2,$3) RETURNING token_hash`,
        [tokenHash,address,new Date(expiresAt)],
      );
      if(result.rows?.length!==1)throw new Error("Login credential not persisted");
    },
    async resolve(token) {
      if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))
        throw new Error("Invalid login credential");
      const tokenHash=createHash("sha256").update(token,"utf8").digest("hex");
      const result=await pool.query(
        `SELECT wallet FROM tree_wallet_logins
         WHERE token_hash=$1 AND expires_at>NOW() AND revoked_at IS NULL`,
        [tokenHash],
      );
      if(result.rows?.length!==1)throw new Error("Login credential expired or revoked");
      return {wallet:normalizeSuiAddress(result.rows[0].wallet)};
    },
  };
}
