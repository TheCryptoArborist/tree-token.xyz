import {createHash} from 'node:crypto';
const hash=t=>createHash('sha256').update(t).digest('hex');
const fail=code=>Object.assign(Error(code),{code});
const token=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
export function createRenewalService({pool,ownershipChecker,now=()=>Date.now()}){
 const atomic=async fn=>{const db=await pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}};
 const validRow=(r,runId)=>{if(!r||r.run_id!==runId)throw fail('SESSION_REQUIRED');if(r.cleared)throw fail('RUN_COMPLETED');};
 const reply=(r,sessionToken,expiresAt)=>({wallet:r.wallet,runId:r.run_id,sessionToken,expiresAt});
 return {
  async refresh({sessionToken,runId}){
   if(!token(sessionToken))throw fail('SESSION_REQUIRED');
   const h=hash(sessionToken),row=(await pool.query('SELECT * FROM tree_game_sessions WHERE session_token_hash=$1 AND expires_at>clock_timestamp()',[h])).rows[0];
   validRow(row,runId);
   const time=now(),cap=new Date(row.created_at).getTime()+24*60*60_000;
   if(!Number.isFinite(cap)||cap<=time)throw fail('REVERIFY_REQUIRED');
   if(new Date(row.expires_at).getTime()>time+15*60_000)return reply(row,sessionToken,new Date(row.expires_at).getTime());
   if(await ownershipChecker({wallet:row.wallet})!==true)throw fail('NFTREE_REQUIRED');
   return atomic(async db=>{
    const r=(await db.query('SELECT * FROM tree_game_sessions WHERE session_token_hash=$1 AND expires_at>clock_timestamp() FOR UPDATE',[h])).rows[0];validRow(r,runId);
    const expiry=Math.min(now()+2*60*60_000,new Date(r.created_at).getTime()+24*60*60_000);
    if(expiry<=now())throw fail('REVERIFY_REQUIRED');
    await db.query('UPDATE tree_game_sessions SET expires_at=$1 WHERE session_id=$2',[new Date(expiry),r.session_id]);
    return reply(r,sessionToken,expiry);
   });
  },
  // A fresh signed gateway login is mandatory for recovery after expiry.
  // Only credentials/expiry change. Gameplay, offers and redemption counters stay intact.
  async recover({sessionToken,freshToken,runId}){
   if(!token(sessionToken)||!token(freshToken)||sessionToken===freshToken)throw fail('SESSION_REQUIRED');
   return atomic(async db=>{
    const next=hash('treeforce89-renewal-v1:'+sessionToken+':'+freshToken);
    const rows=(await db.query('SELECT * FROM tree_game_sessions WHERE session_token_hash=ANY($1::text[]) ORDER BY session_id FOR UPDATE',[[hash(sessionToken),hash(freshToken),hash(next)]])).rows;
    const old=rows.find(r=>r.session_token_hash===hash(sessionToken)),fresh=rows.find(r=>r.session_token_hash===hash(freshToken)),restored=rows.find(r=>r.session_token_hash===hash(next));
    if(!old&&restored&&fresh&&restored.wallet===fresh.wallet&&restored.run_id===runId&&new Date(restored.expires_at).getTime()>now())return reply(restored,next,new Date(restored.expires_at).getTime());
    validRow(old,runId);
    const time=now();
    if(!fresh||!Number.isFinite(new Date(fresh.created_at).getTime())||!Number.isFinite(new Date(fresh.expires_at).getTime())||new Date(fresh.created_at).getTime()>time+5000||fresh.wave!==0||fresh.wallet!==old.wallet||new Date(fresh.expires_at).getTime()<=time||new Date(fresh.created_at).getTime()<time-120000||fresh.continue_pending||fresh.game_over||fresh.cleared||fresh.continuation_number!==0)throw fail('FRESH_SIGN_IN_REQUIRED');
    if(!Number.isFinite(new Date(old.created_at).getTime())||new Date(old.created_at).getTime()<time-24*60*60_000)throw fail('RUN_TOO_OLD');
    const expiresAt=new Date(fresh.expires_at).getTime();
    await db.query('UPDATE tree_game_sessions SET expires_at=clock_timestamp() WHERE session_id=$1',[fresh.session_id]);
    await db.query('UPDATE tree_game_sessions SET session_token_hash=$1,expires_at=$2 WHERE session_id=$3',[hash(next),new Date(expiresAt),old.session_id]);
    return reply(old,next,expiresAt);
   });
  }
 };
}
