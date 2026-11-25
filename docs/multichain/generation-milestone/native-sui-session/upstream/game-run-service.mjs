import {createHash,randomBytes} from 'node:crypto';
import {createAuthenticatedSessionResolver} from './authenticated-session.mjs';

const failure=code=>Object.assign(new Error(code),{code});

// A restart abandons the old run. It is NOT a continuation or proof of loss.
// Do not copy client score/wave/lives, or set game_over/continue_pending here.
export function createGameRunService({pool,ownershipChecker}) {
  if(typeof pool?.connect!=='function' || typeof ownershipChecker!=='function')
    throw Error('Trusted database and NFTree checker required');
  const resolve=createAuthenticatedSessionResolver(pool);
  return {
    async restart({sessionToken,runId}) {
      let previous;
      try {previous=await resolve({sessionToken});}
      catch(error) {if(error?.code==='SESSION_REQUIRED')throw failure('SESSION_REQUIRED');throw error;}
      if(previous.runId!==runId)throw failure('RUN_CHANGED');
      if(await ownershipChecker({wallet:previous.wallet})!==true)throw failure('NFTREE_REQUIRED');

      const hash=createHash('sha256').update(sessionToken,'utf8').digest('hex');
      const nextToken=randomBytes(32).toString('hex');
      const nextHash=createHash('sha256').update(nextToken,'utf8').digest('hex');
      const nextRun='grove-'+randomBytes(16).toString('hex');
      const nextId=randomBytes(24).toString('hex');
      const db=await pool.connect();
      let begun=false;
      try {
        await db.query('BEGIN');begun=true;
        // Lock the credential again after the mainnet read. Concurrent restart
        // or logout wins only once; failed inserts roll back the revocation.
        const locked=await db.query(`SELECT session_id,wallet,run_id,expires_at
          FROM tree_game_sessions
          WHERE session_token_hash=$1 AND expires_at>clock_timestamp() FOR UPDATE`,[hash]);
        const row=locked.rows?.[0];
        if(!row || row.wallet!==previous.wallet)throw failure('SESSION_REQUIRED');
        if(row.run_id!==runId)throw failure('RUN_CHANGED');
        const expiresAt=new Date(row.expires_at).getTime();
        if(!Number.isSafeInteger(expiresAt))throw Error('Invalid expiry');
        await db.query(`UPDATE tree_game_sessions
          SET expires_at=clock_timestamp(),continue_pending=FALSE WHERE session_id=$1`,[row.session_id]);
        const inserted=await db.query(`INSERT INTO tree_game_sessions
          (session_id,wallet,session_token_hash,expires_at,run_id,wave,
           continuation_number,game_over,cleared,continue_pending)
          VALUES($1,$2,$3,$4,$5,0,0,FALSE,FALSE,FALSE) RETURNING session_id`,
        [nextId,previous.wallet,nextHash,new Date(expiresAt),nextRun]);
        if(inserted.rows?.length!==1)throw Error('Run not persisted');
        await db.query('COMMIT');begun=false;
        // Retain the original authentication expiry; restarting never extends it.
        return {sessionToken:nextToken,runId:nextRun,expiresAt};
      } catch(error) {
        if(begun){try{await db.query('ROLLBACK');}catch{}}
        throw error;
      } finally {db.release();}
    },
  };
}
