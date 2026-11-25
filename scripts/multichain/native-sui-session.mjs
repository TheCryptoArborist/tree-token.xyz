// Source-only bridge to the recovered native TREE FORCE session schema.
// Caller owns BEGIN/COMMIT; every session and mapping lock uses that connection.
import {randomUUID} from 'node:crypto';
const check=(ok,code)=>{if(!ok)throw Error(code);};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export function createNativeSuiSessionAdapter({verifyRuntime,checkOwnership,readReviewedCheckpoint=async()=>null}) {
 check(typeof verifyRuntime==='function'&&typeof checkOwnership==='function'&&typeof readReviewedCheckpoint==='function','trusted-native-adapters-required');
 async function runtime(db){
  // Must verify the selected database/runtime against independently captured
  // production provenance. No default or preview-to-mainnet relabelling.
  const r=await verifyRuntime(db);
  check(r?.verified===true&&r.origin==='https://tree-token.xyz'&&r.network==='sui:mainnet'&&hash(r.databaseIdentity),'unverified-native-runtime');
  return r;
 }
 async function valid(db,row){
  const now=Number((await db.query('select floor(extract(epoch from clock_timestamp())*1000)::float8 as now')).rows[0].now);
  check(row&&/^0x[a-f0-9]{64}$/.test(row.wallet)&&/^grove-[a-f0-9]{32}$/.test(row.run_id)&&
   row.expires_at.getTime()>now&&row.created_at.getTime()<row.expires_at.getTime(),'native-session-required');
  check(Number.isSafeInteger(row.continuation_number)&&row.continuation_number>=0,'invalid-native-run');
  return now;
 }
 return Object.freeze({
  async bind(db,{sessionHash,nativeRunId}){
   check(hash(sessionHash)&&/^grove-[a-f0-9]{32}$/.test(nativeRunId||''),'invalid-native-reference');
   const r=await runtime(db);
   const row=(await db.query('select * from public.tree_game_sessions where session_token_hash=$1 for update',[sessionHash])).rows[0];
   await valid(db,row);check(row.run_id===nativeRunId,'native-run-mismatch');
   // Wallet namespaces are persisted server-side; never accept a browser UUID.
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`native-sui-wallet:${r.databaseIdentity}:${row.wallet}`]);
   await db.query('insert into private.arcade_native_sui_accounts(id,database_identity,wallet) values($1,$2,$3) on conflict(database_identity,wallet) do nothing',[randomUUID(),r.databaseIdentity,row.wallet]);
   const a=(await db.query('select id from private.arcade_native_sui_accounts where database_identity=$1 and wallet=$2',[r.databaseIdentity,row.wallet])).rows[0];
   await db.query('insert into private.arcade_native_sui_runs(id,account_id,database_identity,native_run_id) values($1,$2,$3,$4) on conflict(database_identity,native_run_id) do nothing',[randomUUID(),a.id,r.databaseIdentity,row.run_id]);
   const m=(await db.query('select * from private.arcade_native_sui_runs where database_identity=$1 and native_run_id=$2',[r.databaseIdentity,row.run_id])).rows[0];
   check(m.account_id===a.id,'native-binding-conflict');
   return {accountId:a.id,runId:m.id,nativeRunId:row.run_id,suiWallet:row.wallet};
  },
  async lockSessionAndFlight(db,sessionHash,runId){
   check(hash(sessionHash)&&uuid(runId),'invalid-native-reference');
   const r=await runtime(db);
   const row=(await db.query(`select s.*,m.id as mapped_run_id,a.id as account_id
    from public.tree_game_sessions s
    join private.arcade_native_sui_runs m on m.native_run_id=s.run_id and m.database_identity=$3
    join private.arcade_native_sui_accounts a on a.id=m.account_id and a.wallet=s.wallet and a.database_identity=m.database_identity
    where s.session_token_hash=$1 and m.id=$2 for update of s`,[sessionHash,runId,r.databaseIdentity])).rows[0];
   await valid(db,row);
   // The ownership adapter is trusted code, receives no browser wallet, and must
   // return an observation timestamp rather than marking a cached answer fresh.
   const proof=await checkOwnership({wallet:row.wallet,network:'sui:mainnet'});
   const now=await valid(db,row);
   const entitled=proof?.owned===true&&Number.isSafeInteger(proof.checkedAt)&&proof.checkedAt<=now&&now-proof.checkedAt<=5000;
   const checkpoint=await readReviewedCheckpoint(db,{nativeRunId:row.run_id,runId,accountId:row.account_id,sessionId:row.session_id});
   return {authenticated:true,revoked:false,sessionHash,runId,accountId:row.account_id,suiWallet:row.wallet,
    expiresAt:row.expires_at.getTime(),origin:r.origin,environment:'mainnet',entitled,
    entitlementCheckedAt:proof?.checkedAt,checkpoint:!row.game_over||row.cleared||row.continuation_number!==0?null:checkpoint,
    nativeRunId:row.run_id,nativeContinuationNumber:row.continuation_number};
  },
 });
}
