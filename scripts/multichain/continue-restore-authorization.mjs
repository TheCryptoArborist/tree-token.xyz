// Source-only authorization boundary; no default release approval or HTTP route.
import {createHash} from 'node:crypto';
import {validateSnapshot} from '../../docs/multichain/generation-milestone/native-sui-payments/upstream/contract.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code);};
export function createRestoreAuthorization({delivery,readReleasePolicy=async()=>null,clock=Date.now}) {
 check(typeof delivery?.prepare==='function'&&typeof delivery?.activate==='function'&&typeof readReleasePolicy==='function','restore-adapters-required');
 const denied=()=>({protocol:'tree-paid-delivery.v2',status:'review-required',restoreAuthorized:false,requiresPayment:false});
 async function policy(){
  const p=await readReleasePolicy(),now=clock();
  if(!p||p.enabled!==true||p.runtimeVerified!==true||p.origin!=='https://tree-token.xyz'||p.checkpointPolicy!=='native-client-nonreward-v1'||
   !['isolated-test','production'].includes(p.environment)||!/^[a-f0-9]{40}$/.test(p.sourceCommit||'')||!/^[a-f0-9]{64}$/.test(p.gameCodeHash||'')||!/^[a-f0-9]{64}$/.test(p.releaseId||'')||
   !Number.isSafeInteger(p.checkedAt)||p.checkedAt>now||now-p.checkedAt>5000||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now||p.expiresAt>now+60000)return null;
  // Observation timestamps may refresh without changing the approved release.
  return createHash('sha256').update(JSON.stringify([p.releaseId,p.sourceCommit,p.gameCodeHash,p.origin,p.environment,p.checkpointPolicy])).digest('hex');
 }
 return Object.freeze({
  async prepare(input){
   const digest=await policy();if(!digest)return denied();
   const p=await delivery.prepare(input);
   if(p?.status!=='prepared'||p.protocol!=='tree-paid-delivery.v2')return denied();
   check(p.runId===input.runId&&p.paymentId===input.paymentId&&Number.isSafeInteger(p.sequence)&&p.sequence>0,'invalid-prepared-binding');
   check(typeof p.snapshotText==='string'&&Buffer.byteLength(p.snapshotText)<=262144&&createHash('sha256').update(p.snapshotText).digest('hex')===p.checkpointHash,'invalid-prepared-checkpoint');
   const snapshot=JSON.parse(p.snapshotText);
   check(snapshot.format==='treeforce89.checkpoint.v1'&&snapshot.ruleset==='treeforce89.v1'&&snapshot.runId===p.runId&&snapshot.lives===0&&snapshot.continuesUsed===p.sequence-1&&snapshot.finished!==true,'invalid-prepared-checkpoint');
   validateSnapshot(snapshot.nativeSnapshot,p.nativeRunId);
   if(await policy()!==digest)return denied();
   return {...p,policyDigest:digest,restoreAuthorized:true};
  },
  async activate(input){
   const digest=await policy();if(!digest||input.policyDigest!==digest)return denied();
   const {policyDigest:_,...request}=input;
   const a=await delivery.activate(request);
   if(a?.protocol!=='tree-paid-delivery.v2'||a.status!=='started'||a.consumed!==true||a.activationId!==input.requestId||a.runId!==input.runId)return denied();
   if(await policy()!==digest)return denied(); // consumption may have committed; never issue an obsolete grant
   return {...a,policyDigest:digest,restoreAuthorized:true};
  },
 });
}
