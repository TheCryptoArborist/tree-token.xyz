/**
 * Durable PostgreSQL challenge store for Sui wallet login.
 * The database must have the schema in docs/tree-continuation-schema.sql.
 *
 * consumeOnce uses DELETE ... RETURNING, which is atomic even with
 * concurrent Netlify function instances. Challenge tokens never persist
 * in plaintext; only their SHA-256 hashes are stored.
 */
export function createPostgresChallengeStore(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("PostgreSQL pool required for wallet challenges");
  }
  return {
    async save({challengeHash,wallet,message,expiresAt}) {
      if (typeof challengeHash !== "string" || !/^[a-f0-9]{64}$/.test(challengeHash)) {
        throw new Error("Invalid challenge hash");
      }
      if (typeof wallet !== "string" || typeof message !== "string" || !Number.isSafeInteger(expiresAt)) {
        throw new Error("Invalid wallet challenge");
      }
      const result = await pool.query(
        `INSERT INTO tree_wallet_challenges
          (challenge_hash, wallet, message, expires_at)
         VALUES ($1,$2,$3,$4) RETURNING challenge_hash`,
        [challengeHash,wallet,message,new Date(expiresAt)],
      );
      if (result.rows?.length !== 1) throw new Error("Challenge not saved");
    },
    async consumeOnce(challengeHash) {
      if (typeof challengeHash !== "string" || !/^[a-f0-9]{64}$/.test(challengeHash)) {
        throw new Error("Invalid challenge hash");
      }
      // DELETE RETURNING is a single atomic SQL operation: a concurrent
      // verifier cannot obtain the same challenge after it is deleted.
      const result = await pool.query(
        `DELETE FROM tree_wallet_challenges
         WHERE challenge_hash = $1
         RETURNING wallet, message, expires_at`,
        [challengeHash],
      );
      if (result.rows?.length !== 1) return null;
      const row=result.rows[0];
      const expiresAt = row.expires_at instanceof Date
        ? row.expires_at.getTime()
        : new Date(row.expires_at).getTime();
      if (!Number.isFinite(expiresAt)) throw new Error("Invalid stored challenge expiry");
      return {wallet:row.wallet,message:row.message,expiresAt};
    },
  };
}
