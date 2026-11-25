// Source-only native v2 session bridge. No HTTP registration or payment activation.
import {createHash} from 'node:crypto';
import {createNativeSuiSessionAdapter} from './native-sui-session.mjs';
import {createSuiBnbContinue} from './sui-bnb-continue.mjs';
import {createPostgresContinueStore} from './sui-bnb-continue-store.mjs';
import {validateSnapshot} from '../../docs/multichain/generation-milestone/native-sui-payments/upstream/contract.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function createNativeBnbCheckout({pool,verifyRuntime,checkOwnership,readReviewedCheckpoint,readPayment}){
 const adapter=createNativeSuiSessionAdapter({verifyRuntime,checkOwnership,readReviewedCheckpoint});
 const deliveryProtocol='tree-paid-delivery.v2';
 const normalize=s=>{
  let checkpoint;
  try{
   const c=s.checkpoint;if(c?.validated!==true||typeof c.snapshotText!=='string'||sha(c.snapshotText)!==c.hash)throw Error();
   checkpoint=JSON.parse(c.snapshotText);
   if(checkpoint.format!=='treeforce89.checkpoint.v1'||checkpoint.ruleset!=='treeforce89.v1'||checkpoint.runId!==s.runId||checkpoint.lives!==0||checkpoint.finished===true||checkpoint.continuesUsed!==s.nativeContinuationNumber)throw Error();
   validateSnapshot(checkpoint.nativeSnapshot,s.nativeRunId);
  }catch{checkpoint=null;}
  return {...s,deliveryProtocol,sequence:s.nativeContinuationNumber+1,lives:checkpoint?0:null,continuesUsed:s.nativeContinuationNumber,finished:!checkpoint,continueAllowed:!!checkpoint&&s.entitled===true,ruleset:'treeforce89.v1'};
 };
 // Store calls this with its own active transaction. Preserve native-row locks.
 const lockSuiRun=async(db,sessionHash,runId)=>normalize(await adapter.lockSessionAndFlight(db,sessionHash,runId));
 const readSuiRun=async token=>{
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('native-session-required');
  const sessionHash=sha(token),db=await pool.connect();
  try{
   await db.query('begin');await db.query("set local lock_timeout='5s'");await db.query("set local statement_timeout='15s'");
   const row=(await db.query('select run_id from public.tree_game_sessions where session_token_hash=$1',[sessionHash])).rows[0];
   if(!row)throw Error('native-session-required');
   const mapping=await adapter.bind(db,{sessionHash,nativeRunId:row.run_id});
   const s=await lockSuiRun(db,sessionHash,mapping.runId);
   await db.query('commit');return {...s,checkedAt:new Date().toISOString()};
  }catch(error){await db.query('rollback').catch(()=>{});throw error;}finally{db.release();}
 };
 const store=createPostgresContinueStore({pool,lockSuiRun,deliveryProtocol});
 return createSuiBnbContinue({readSuiRun,store,readPayment,deliveryProtocol});
}
