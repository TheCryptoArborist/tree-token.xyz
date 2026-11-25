// Read-only completion evidence. Never grants gameplay or changes payment state.
export function createNativePaymentCompletion({pool,verifyRuntime}){
 if(typeof pool?.connect!=='function'||typeof verifyRuntime!=='function')throw Error('completion-adapters-required');
 return async({sessionHash,paymentId})=>{
  if(!/^[a-f0-9]{64}$/.test(sessionHash||'')||!/^[a-f0-9-]{36}$/.test(paymentId||''))throw Error('completion-reference-required');
  const db=await pool.connect();
  try{
   await db.query('begin read only');await db.query("set local statement_timeout='5s'");
   const runtime=await verifyRuntime(db);
   if(runtime?.verified!==true||runtime.origin!=='https://tree-token.xyz'||runtime.network!=='sui:mainnet'||!/^[a-f0-9]{64}$/.test(runtime.databaseIdentity||''))throw Error('completion-runtime-required');
   const {rows}=await db.query(`select p.id as "paymentId",p.run_id as "runId",p.sequence,n.offer_id as "offerId",n.digest,n.native_run_id as "nativeRunId"
    from private.arcade_continue_payments_v2 p
    join private.arcade_native_sui_runs m on m.id=p.run_id and m.account_id=p.account_id and m.database_identity=$3
    join private.arcade_native_sui_accounts a on a.id=m.account_id and a.database_identity=m.database_identity and a.wallet=p.sui_wallet
    join public.tree_game_sessions auth on auth.session_token_hash=$1 and auth.wallet=p.sui_wallet and auth.expires_at>clock_timestamp()
    join private.arcade_native_sui_payments n on n.offer_id=p.source_id and n.account_id=p.account_id and n.run_id=p.run_id and n.sequence=p.sequence and n.wallet=p.sui_wallet and n.native_run_id=m.native_run_id
    join private.arcade_continue_claims_v2 c on c.payment_id=p.id and c.account_id=p.account_id and c.run_id=p.run_id and c.sequence=p.sequence and c.state='started' and c.activation_id is not null
    join public.tree_continue_redemptions r on r.session_id=n.native_session_id and r.digest=n.digest and r.offer_id=n.offer_id and r.wallet=n.wallet and r.run_id=n.native_run_id and r.continuation_number=p.sequence-1
    join public.tree_game_sessions target on target.session_id=r.session_id and target.run_id=n.native_run_id and target.wallet=n.wallet and target.continuation_number>=p.sequence
    where p.id=$2 and p.source='sui-native-tree' and p.receipt_id='sui:mainnet:'||n.digest`,[sessionHash,paymentId,runtime.databaseIdentity]);
   await db.query('commit');
   return rows.length===1?{...rows[0],status:'completed',archiveAllowed:true,restoreAuthorized:false,requiresPayment:false}:{paymentId,status:'review-required',archiveAllowed:false,restoreAuthorized:false,requiresPayment:false};
  }catch(error){await db.query('rollback').catch(()=>{});throw error;}finally{db.release();}
 };
}
