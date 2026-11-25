// Source-only recovery of an unconsumed shared payment after a fresh native login.
// This never consumes a continue or grants restoration. Use the same native DB.
export function createNativePaidRunRecovery({pool,verifyRuntime,checkOwnership}) {
 const check=(ok,code)=>{if(!ok)throw Error(code);};
 check(typeof pool?.connect==='function'&&typeof verifyRuntime==='function'&&typeof checkOwnership==='function','trusted-recovery-adapters-required');
 return async({sessionHash,paymentId})=>{
  check(/^[a-f0-9]{64}$/.test(sessionHash||'')&&/^[a-f0-9-]{36}$/.test(paymentId||''),'invalid-recovery-reference');
  const db=await pool.connect();
  try{
   await db.query('begin');await db.query("set local lock_timeout='5s'");await db.query("set local statement_timeout='15s'");
   const runtime=await verifyRuntime(db);
   check(runtime?.verified===true&&runtime.origin==='https://tree-token.xyz'&&runtime.network==='sui:mainnet'&&/^[a-f0-9]{64}$/.test(runtime.databaseIdentity||''),'unverified-native-runtime');
   const payment=(await db.query(`select p.*,m.native_run_id from private.arcade_continue_payments_v2 p
    join private.arcade_native_sui_runs m on m.id=p.run_id and m.account_id=p.account_id
    join private.arcade_native_sui_accounts a on a.id=m.account_id and a.wallet=p.sui_wallet and a.database_identity=m.database_identity
    where p.id=$1 and m.database_identity=$2`,[paymentId,runtime.databaseIdentity])).rows[0];
   check(payment,'recovery-unavailable');
   // Same deterministic native-row order as the existing Sui recovery service.
   const rows=(await db.query(`select * from public.tree_game_sessions
    where session_token_hash=$1 or run_id=$2 order by session_id for update`,[sessionHash,payment.native_run_id])).rows;
   const auth=rows.find(r=>r.session_token_hash===sessionHash),target=rows.find(r=>r.run_id===payment.native_run_id);
   const clock=async()=>Number((await db.query('select floor(extract(epoch from clock_timestamp())*1000)::float8 as now')).rows[0].now);
   let now=await clock();
   check(auth&&target&&auth.expires_at.getTime()>now&&auth.wallet===payment.sui_wallet&&target.wallet===auth.wallet&&!target.cleared,'recovery-unavailable');
   const proof=await checkOwnership({wallet:auth.wallet,network:'sui:mainnet'});now=await clock();
   check(auth.expires_at.getTime()>now&&proof?.owned===true&&Number.isSafeInteger(proof.checkedAt)&&proof.checkedAt<=now&&now-proof.checkedAt<=5000,'recovery-entitlement-required');
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`shared-continue:${payment.account_id}:${payment.run_id}`]);
   const claim=(await db.query('select * from private.arcade_continue_claims_v2 where account_id=$1 and run_id=$2 and sequence=$3 for update',[payment.account_id,payment.run_id,payment.sequence])).rows[0];
   const result={runId:payment.run_id,nativeRunId:target.run_id,paymentId,sequence:payment.sequence,restoreAuthorized:false,requiresPayment:false};
   // A consumed or competing payment is retained for review, never rebound as
   // a new purchase or a second restoration after a lost activation response.
   if((claim&&(claim.state==='started'||claim.payment_id!==paymentId))||target.continuation_number!==payment.sequence-1){
    await db.query('commit');return {...result,status:'review-required'};
   }
   check(target.game_over===true,'recovery-unavailable');
   // Recheck wall time after every potentially contended lock.
   now=await clock();check(auth.expires_at.getTime()>now&&now-proof.checkedAt<=5000,'recovery-entitlement-required');
   if(auth.session_id!==target.session_id){
    await db.query('update public.tree_game_sessions set session_token_hash=null,expires_at=clock_timestamp() where session_id=$1',[auth.session_id]);
    await db.query('update public.tree_game_sessions set session_token_hash=$2,expires_at=$3 where session_id=$1',[target.session_id,sessionHash,auth.expires_at]);
    await db.query('insert into private.arcade_native_paid_recoveries(payment_id,from_session,to_session) values($1,$2,$3)',[paymentId,auth.session_id,target.session_id]);
   }
   await db.query('commit');return {...result,status:'recovered'};
  }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{db.release();}
 };
}
