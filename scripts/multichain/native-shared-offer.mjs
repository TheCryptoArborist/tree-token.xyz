// Wrap the verified native service's offer method; never call its redeem method.
import {createHash} from 'node:crypto';
export function createNativeSharedOffer({pool,sessionAdapter,nativeOffer}){
 if(typeof pool?.connect!=='function'||typeof sessionAdapter?.bind!=='function'||typeof nativeOffer!=='function')throw Error('native-offer-adapters-required');
 return async input=>{
  if(!/^[a-f0-9]{64}$/.test(input?.sessionToken||'')||!/^grove-[a-f0-9]{32}$/.test(input?.runId||''))throw Error('native-offer-session-required');
  const db=await pool.connect();
  try{
   await db.query('begin');await db.query("set local lock_timeout='5s'");await db.query("set local statement_timeout='15s'");
   await sessionAdapter.bind(db,{sessionHash:createHash('sha256').update(input.sessionToken).digest('hex'),nativeRunId:input.runId});
   await db.query('commit');
  }catch(error){await db.query('rollback').catch(()=>{});throw error;}finally{db.release();}
  // The unchanged native service revalidates credential, NFT ownership, run and
  // checkpoint under its own transaction. A failed offer leaves only an inert,
  // idempotent run mapping; no payment, claim or restoration is created here.
  return nativeOffer(input);
 };
}
