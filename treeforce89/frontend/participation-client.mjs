// A first-wave participation report. This does not submit a score or prove a win.
const ENDPOINT='/api/arcade-growth?action=treeforce-play';
const RUN=/^grove-[a-f0-9]{32}$/;
const WALLET=/^0x[a-f0-9]{64}$/i;
const TOKEN=/^[a-f0-9]{64}$/;
const PREFIX='treeforce89.arcade-participation.pending.v1:';
const IDLE=Object.freeze({status:'idle',message:'',canRetry:false,runId:null,receipt:null});

export function shouldTrackTreeForceStart({runId,serverRunId,wave,resumed,homeOnly,hasTestEntry,debug}={}){
 return RUN.test(runId||'')&&runId===serverRunId&&wave===0&&
  resumed===false&&homeOnly!==true&&hasTestEntry===false&&debug!==true;
}

function sessionIdentity(session){
 if(!session||!WALLET.test(session.wallet||'')||!RUN.test(session.runId||'')||!TOKEN.test(session.sessionToken||''))return null;
 return {wallet:session.wallet.toLowerCase(),runId:session.runId,sessionToken:session.sessionToken};
}

function savedReceipt(body,{runId,wallet}){
 const receipt=body?.participation;
 if(body?.status!=='ok'||receipt?.saved!==true||receipt.runId!==runId||
  receipt.sourceId!==`run:${runId}:${wallet}`||typeof receipt.alreadyRecorded!=='boolean'||
  !/^\d{4}-\d{2}-\d{2}$/.test(receipt.dateKey||'')||
  typeof receipt.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.+Z$/.test(receipt.recordedAt)||
  !Number.isFinite(Date.parse(receipt.recordedAt))||receipt.recordedAt.slice(0,10)!==receipt.dateKey)
  throw Error('Participation receipt could not be confirmed.');
 if(new Date(receipt.dateKey+'T00:00:00Z').toISOString().slice(0,10)!==receipt.dateKey)
  throw Error('Participation receipt date could not be confirmed.');
 return {saved:true,runId,sourceId:receipt.sourceId,dateKey:receipt.dateKey,
  recordedAt:receipt.recordedAt,alreadyRecorded:receipt.alreadyRecorded};
}

export function createTreeForceParticipationReporter({getSession,fetchImpl=globalThis.fetch,storage,
 onChange=(_state)=>{},setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,
 AbortControllerImpl=globalThis.AbortController,retryDelays=[1000,4000],timeoutMs=65000}={}){
 if(typeof getSession!=='function'||typeof fetchImpl!=='function')throw Error('Participation requires the current game session and fetch.');
 let state={...IDLE},active=null,generation=0,retryTimer=null,requestController=null,disposed=false;
 const emit=next=>{state={...next};try{onChange({...state});}catch{/* Saving progress never stops gameplay. */}};
 const readPending=wallet=>{
  try{
   const text=storage?.getItem(PREFIX+wallet);
   if(typeof text!=='string'||text.length>256)return null;
   const value=JSON.parse(text);
   return value?.version===1&&Object.keys(value).length===2&&RUN.test(value.runId||'')?value:null;
  }catch{return null;}
 };
 const writePending=operation=>{
  try{if(!storage)return false;storage.setItem(PREFIX+operation.wallet,JSON.stringify({version:1,runId:operation.runId}));return true;}
  catch{return false;}
 };
 const clearPending=operation=>{
  try{if(readPending(operation.wallet)?.runId===operation.runId)storage?.removeItem(PREFIX+operation.wallet);}
  catch{/* The receipt is saved on the server; a leftover marker is safe to retry. */}
 };
 const current=operation=>{
  const session=sessionIdentity(getSession());
  return !disposed&&active===operation&&operation.generation===generation&&session&&
   session.wallet===operation.wallet&&session.runId===operation.runId?session:null;
 };
 const cancel=()=>{
  generation++;
  if(retryTimer!==null){clearTimer(retryTimer);retryTimer=null;}
  requestController?.abort();requestController=null;active=null;
 };
 const unavailable=(operation,retryable)=>{
  if(!current(operation))return;
  if(retryable&&operation.attempts<=retryDelays.length){
   emit({status:'saving',message:'Saving Arcade participation… Your game can continue.',canRetry:false,runId:operation.runId,receipt:null});
   retryTimer=setTimer(()=>{retryTimer=null;void attempt(operation);},retryDelays[operation.attempts-1]);
  }else emit({status:retryable?'retry':'blocked',
   message:retryable?(operation.persisted?'Participation has not saved yet. You can keep playing.':'Participation has not saved yet. Keep this game open to retry.'):
    'Participation could not be saved for this game session. Your game can continue.',
   canRetry:retryable,runId:operation.runId,receipt:null});
 };
 const attempt=async operation=>{
  const session=current(operation);if(!session)return;
  operation.attempts++;
  const controller=new AbortControllerImpl();requestController=controller;
  const timeout=setTimer(()=>controller.abort(),timeoutMs);
  let retryable=true;
  try{
   const response=await fetchImpl(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.sessionToken},
    body:JSON.stringify({runId:operation.runId}),credentials:'omit',mode:'same-origin',cache:'no-store',redirect:'error',
    keepalive:true,signal:controller.signal});
   if(!current(operation))return;
   if(!response.ok){
    retryable=response.status===408||response.status===429||(response.status>=500&&response.status<=599);
    unavailable(operation,retryable);return;
   }
   const text=await response.text();
   if(!current(operation))return;
   if(text.length>16384)throw Error('Participation response is too large.');
   const receipt=savedReceipt(JSON.parse(text),operation);
   clearPending(operation);
   emit({status:'saved',message:'Arcade participation saved for '+receipt.dateKey+' (UTC).',canRetry:false,runId:operation.runId,receipt});
  }catch{
   unavailable(operation,retryable);
  }finally{
   clearTimer(timeout);
   if(requestController===controller)requestController=null;
  }
 };
 const reporter={
  start(runId){
   const session=sessionIdentity(getSession());
   if(disposed||!session||runId!==session.runId)return false;
   if(active?.wallet===session.wallet&&active.runId===runId)return false;
   cancel();
   // A new real first-wave event may replace an older run's marker. Never
   // replay an old run under the newly issued run's credential.
   const operation={wallet:session.wallet,runId,generation,attempts:0,persisted:false};
   active=operation;operation.persisted=writePending(operation);
   emit({status:'saving',message:'Saving Arcade participation…',canRetry:false,runId,receipt:null});
   void attempt(operation);return true;
  },
  retry(){
   if(!active||!state.canRetry||!current(active))return false;
   active.attempts=0;
   emit({status:'saving',message:'Saving Arcade participation…',canRetry:false,runId:active.runId,receipt:null});
   void attempt(active);return true;
  },
  recoverPending(){
   const session=sessionIdentity(getSession());
   if(!session||readPending(session.wallet)?.runId!==session.runId)return false;
   return reporter.start(session.runId);
  },
  reset(){cancel();if(!disposed)emit({...IDLE});},
  dispose(){cancel();disposed=true;},
  getState(){return {...state};},
 };
 return reporter;
}
