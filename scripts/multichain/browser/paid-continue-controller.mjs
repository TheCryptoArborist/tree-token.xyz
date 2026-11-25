// Undeployed browser integration. No wallet calls, payment creation or HTTP route.
// prepare/activate are trusted same-origin transport adapters provided by the host.
const check=(ok,code)=>{if(!ok)throw Error(code);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function createPaidContinueController({prepare,activate,getSession,render,prepareNativeRun,
 storage=globalThis.localStorage,locks=globalThis.navigator?.locks,crypto=globalThis.crypto,origin=globalThis.location?.origin,clock=Date.now}) {
 check(['https://tree-token.xyz','https://www.tree-token.xyz'].includes(origin),'canonical-origin-required');
 check([prepare,activate,getSession,render,prepareNativeRun].every(x=>typeof x==='function'),'trusted-browser-adapters-required');
 check(typeof locks?.request==='function'&&typeof storage?.getItem==='function'&&typeof storage?.setItem==='function'&&crypto?.subtle&&crypto?.randomUUID&&crypto?.getRandomValues,'durable-browser-support-required');
 const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
 const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 const session=()=>{const s=getSession();check(s&&uuid(s.accountId)&&uuid(s.runId)&&/^grove-[a-f0-9]{32}$/.test(s.nativeRunId||'')&&typeof s.epoch==='string'&&s.epoch.length>0&&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>clock(),'current-session-required');return {...s};};
 const unchanged=s=>{const n=session();check(['accountId','runId','nativeRunId','epoch'].every(k=>n[k]===s[k]),'session-changed');};
 return Object.freeze({
  async resume({paymentId,sequence}) {
   check(uuid(paymentId)&&Number.isSafeInteger(sequence)&&sequence>0&&sequence<=2147483647,'invalid-paid-continue');
   const s=session(),key=`tree-shared-continue.v2:${s.accountId}:${s.runId}:${sequence}`;
   return locks.request(key,{mode:'exclusive'},async()=>{
    unchanged(s);
    // Never erase an uncertain/attempted marker to retry a restore. Storage is a
    // reliability guard; the server consumption record remains the authority.
    const prior=storage.getItem(key);
    if(prior!==null)return {status:'review-required',restoreAttempted:false};
    const clientKey=secret(),requestId=crypto.randomUUID();
    const p=await prepare({runId:s.runId,paymentId,clientKey});unchanged(s);
    check(p?.protocol==='tree-paid-delivery.v2'&&p.status==='prepared'&&p.restoreAuthorized===true,'restoration-not-enabled');
    check(p.runId===s.runId&&p.paymentId===paymentId&&p.sequence===sequence&&uuid(p.leaseId)&&hex(p.policyDigest)&&hex(p.checkpointHash)&&Number.isSafeInteger(p.leaseExpiresAt)&&p.leaseExpiresAt>clock()&&p.leaseExpiresAt<=s.expiresAt,'invalid-prepare-binding');
    check(typeof p.snapshotText==='string'&&new TextEncoder().encode(p.snapshotText).length<=262144&&await digest(p.snapshotText)===p.checkpointHash,'checkpoint-integrity-failed');
    const checkpoint=JSON.parse(p.snapshotText);
    check(checkpoint.format==='treeforce89.checkpoint.v1'&&checkpoint.ruleset==='treeforce89.v1'&&checkpoint.runId===s.runId&&checkpoint.lives===0&&checkpoint.continuesUsed===sequence-1&&checkpoint.finished!==true&&checkpoint.nativeSnapshot?.runId===s.nativeRunId,'invalid-native-checkpoint');
    // Validate before consuming. This retains the native snapshot whitelist and
    // its existing game rules; these client fields are not scoring evidence.
    const run=prepareNativeRun(checkpoint.nativeSnapshot,{authorized:true,lives:3,runId:s.nativeRunId,wave:checkpoint.nativeSnapshot.wave});
    unchanged(s);check(p.leaseExpiresAt>clock(),'expired-prepare');
    const marker={version:1,accountId:s.accountId,runId:s.runId,sequence,paymentId,requestId,state:'activation-pending'};
    const persist=state=>{const value=JSON.stringify({...marker,state});storage.setItem(key,value);check(storage.getItem(key)===value,'journal-write-failed');};
    persist('activation-pending');
    let restoreAttempted=false;
    try{
     const a=await activate({runId:s.runId,clientKey,leaseId:p.leaseId,checkpointHash:p.checkpointHash,policyDigest:p.policyDigest,requestId});unchanged(s);
     check(a?.protocol==='tree-paid-delivery.v2'&&a.status==='started'&&a.restoreAuthorized===true&&a.runId===s.runId&&a.sequence===sequence&&a.activationId===requestId&&a.consumed===true&&a.policyDigest===p.policyDigest,'activation-not-authorized');
     // Write ahead of the renderer: crashes, exceptions and refreshed tabs must
     // never replay a potentially completed scene restore.
     persist('restore-attempted');unchanged(s);
     restoreAttempted=true;
     await render({run,activationId:requestId,sequence,nativeRunId:s.nativeRunId,sessionEpoch:s.epoch});
     persist('restored');return {status:'restored',restoreAttempted:true};
    }catch(error){
     // Keep the durable pre-call marker even when reporting/recovery storage fails.
     try{persist('review-required');}catch{}
     return {status:'review-required',restoreAttempted,mayHaveConsumed:true,reason:error?.message||'interrupted'};
    }
   });
  },
 });
}
