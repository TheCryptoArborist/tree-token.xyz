import {createHash} from "node:crypto";

const tokenHash=(token)=>{
  if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))
    throw new Error("Invalid authentication credential");
  return createHash("sha256").update(token,"utf8").digest("hex");
};

/**
 * Explicit server-side credential revocation.
 *
 * Credentials must come from an authenticated request; this module does not
 * authenticate HTTP callers or infer identity from an unverified wallet address.
 * A wallet extension disconnect alone does NOT call this service.
 *
 * The same PostgreSQL connection is used for both updates, and a failed
 * update rolls back both revocations.
 */
export function createCredentialRevoker(pool){
  if(typeof pool?.connect!=="function")throw new Error("PostgreSQL transaction pool required");
  return {
    async revoke({loginToken,sessionToken}={}){
      if(loginToken===undefined&&sessionToken===undefined)
        throw new Error("At least one credential required");
      const loginHash=loginToken===undefined?null:tokenHash(loginToken);
      const sessionHash=sessionToken===undefined?null:tokenHash(sessionToken);
      const client=await pool.connect();
      let begun=false;
      try{
        await client.query("BEGIN");
        begun=true;
        let loginRevoked=false,sessionRevoked=false;
        if(loginHash){
          const result=await client.query(
            `UPDATE tree_wallet_logins SET revoked_at=NOW()
             WHERE token_hash=$1 AND revoked_at IS NULL
             RETURNING token_hash`,[loginHash]);
          loginRevoked=result.rows?.length===1;
        }
        if(sessionHash){
          const result=await client.query(
            `UPDATE tree_game_sessions SET expires_at=NOW(),
                continue_pending=FALSE
             WHERE session_token_hash=$1 AND expires_at>NOW()
             RETURNING session_id`,[sessionHash]);
          sessionRevoked=result.rows?.length===1;
        }
        await client.query("COMMIT");
        begun=false;
        return {loginRevoked,sessionRevoked};
      }catch(error){
        if(begun){try{await client.query("ROLLBACK")}catch{}}
        throw error;
      }finally{client.release()}
    }
  };
}
