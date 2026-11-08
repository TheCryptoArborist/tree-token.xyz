import {randomUUID,randomBytes} from 'node:crypto';
import {isValidTransactionDigest} from '@mysten/sui/utils';
import {createGame,restartGame,step,PRICE} from '../src/engine.js';
import {MAX_BATCH_FRAMES,MAX_CLOCK_CREDIT} from '../src/replay-limits.js';
import {TREE_PAYMENT_RECIPIENT} from './payments/config.mjs';
import {TREE_TYPE,treeAmount} from './payments/tree.mjs';
import {recordBestScore} from './leaderboard.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const fail=(text,status=400)=>Object.assign(Error(text),{status});
const pack=r=>({id:r.id,revision:r.revision,state:r.state});
export const invoice=r=>({id:r.id,network:'mainnet',product:'continue',wallet:r.wallet,recipient:r.recipient,amount:String(r.amount),decimals:r.decimals,runId:r.run_id,createdAt:Number(r.created_at),expiresAt:Number(r.expires_at),status:r.status,expectedDigest:r.expected_digest,boundAt:r.bound_at===null?null:Number(r.bound_at)});
export function createGameService({database:db,authorize,reader,inspectSigned,executeSigned,now=Date.now,seed=()=>randomBytes(4).readUInt32LE()}){
 const holder=async context=>{const a=await authorize(context);if(!a?.address||a.expiresAt<=now())throw fail('Verify your NFTree wallet again',401);return a;};
 async function lock(tx,a){if(a.expiresAt<=now())throw fail('NFTree session expired',401);await tx.query('INSERT INTO breaker.accounts(wallet) VALUES($1) ON CONFLICT DO NOTHING',[a.address]);const {rows}=await tx.query('SELECT * FROM breaker.accounts WHERE wallet=$1 FOR UPDATE',[a.address]);return rows[0];}
 async function restoreCarriedScore(tx,a,run){
  if(run.state.scoreCarryVersion===1)return run;
  const validScore=value=>{if(!Number.isSafeInteger(value)||value<0)throw Error('Saved score is invalid');return value;};
  let cursor=run,carriedScore=0;const visited=new Set([run.id]);
  while(cursor.state.scoreCarryVersion!==1){
   const {rows}=await tx.query("SELECT prior.id,prior.state FROM breaker.restarts restart JOIN breaker.invoices invoice ON invoice.id=restart.invoice_id AND invoice.status='paid' JOIN breaker.receipts receipt ON receipt.invoice_id=invoice.id JOIN breaker.runs prior ON prior.id=invoice.run_id AND prior.wallet=invoice.wallet WHERE restart.new_run=$1 AND invoice.wallet=$2",[cursor.id,a.address]);
   const prior=rows[0];if(!prior)break;
   if(visited.has(prior.id)||prior.state.status!=='gameover'||prior.state.lives!==0)throw Error('Saved restart history is invalid');
   visited.add(prior.id);carriedScore=validScore(carriedScore+validScore(prior.state.score));cursor=prior;
  }
  const state={...run.state,score:validScore(validScore(run.state.score)+carriedScore),scoreCarryVersion:1,carriedScore};
  const {rows}=await tx.query('UPDATE breaker.runs SET state=$1,revision=revision+1 WHERE id=$2 AND wallet=$3 RETURNING *',[JSON.stringify(state),run.id,a.address]);return rows[0];
 }
 async function current(tx,a){const acct=await lock(tx,a);if(!acct.current_run)return null;const {rows}=await tx.query('SELECT * FROM breaker.runs WHERE id=$1 AND wallet=$2 FOR UPDATE',[acct.current_run,a.address]);return rows[0]?restoreCarriedScore(tx,a,rows[0]):null;}
 async function ranked(tx,a,run){await recordBestScore(tx,a.address,run,Number(run.updated_at));return pack(run);}
 async function fresh(tx,a,previous=null,newGameFrom=null){const id=randomUUID(),state=previous?restartGame(previous,seed()):createGame(seed());if(newGameFrom)state.newGameFrom=newGameFrom;const {rows}=await tx.query('INSERT INTO breaker.runs(id,wallet,state,updated_at) VALUES($1,$2,$3,$4) RETURNING *',[id,a.address,JSON.stringify(state),now()]);await tx.query('UPDATE breaker.accounts SET current_run=$1 WHERE wallet=$2',[id,a.address]);return ranked(tx,a,rows[0]);}
 async function owned(tx,a,id){if(!uuid(id))throw fail('Invalid invoice');const {rows}=await tx.query('SELECT * FROM breaker.invoices WHERE id=$1 AND wallet=$2 FOR UPDATE',[id,a.address]);if(!rows[0])throw fail('Invoice not found',404);return rows[0];}
 return Object.freeze({
  async open(ctx){const a=await holder(ctx);return db.transaction(async tx=>{const r=await current(tx,a);return r?ranked(tx,a,r):fresh(tx,a);});},
  async frames(ctx,{id,revision,inputs}){
   if(!uuid(id)||!Number.isSafeInteger(revision)||revision<0||!Array.isArray(inputs)||!inputs.length||inputs.length>MAX_BATCH_FRAMES||inputs.some(i=>!i||Object.keys(i).some(k=>!['x','launch','fire'].includes(k))||!Number.isFinite(i.x)||i.x<0||i.x>800||typeof i.launch!=='boolean'||typeof i.fire!=='boolean'))throw fail('Invalid game inputs');
   const a=await holder(ctx);return db.transaction(async tx=>{
    const r=await current(tx,a);if(!r||r.id!==id)throw fail('This run is no longer active',409);
    if(r.revision!==revision)return {...await ranked(tx,a,r),resync:true};
    const budget=Math.min(MAX_CLOCK_CREDIT,r.credit+Math.floor(Math.max(0,now()-Number(r.updated_at))*60/1000));if(inputs.length>budget)throw fail('Game clock is ahead. Pause and reconnect.',429);
    for(const input of inputs)step(r.state,input);
    const {rows}=await tx.query('UPDATE breaker.runs SET state=$1,revision=revision+1,updated_at=$2,credit=$3 WHERE id=$4 RETURNING *',[JSON.stringify(r.state),now(),budget-inputs.length,id]);return ranked(tx,a,rows[0]);
   });
  },
  async next(ctx){const a=await holder(ctx);return db.transaction(async tx=>{const r=await current(tx,a);if(r?.state.status!=='won')throw fail('Finish this run first');await recordBestScore(tx,a.address,r,Number(r.updated_at));return fresh(tx,a);});},
  async newGame(ctx,{id}={}){
   if(!uuid(id))throw fail('Invalid game request');
   const a=await holder(ctx);return db.transaction(async tx=>{
    const run=await current(tx,a);let result;
    // A retry returns the same new run, including any progress made since it
    // started. The client can never use an old defeat to reset another run.
    if(run?.state.newGameFrom===id)result=await ranked(tx,a,run);
    else{
     if(!run||run.id!==id||run.state.status!=='gameover'||run.state.lives!==0)throw fail('Start a new game after all three lives are lost.',409);
     const pending=await tx.query("SELECT id,status FROM breaker.invoices WHERE wallet=$1 AND run_id=$2 AND status IN ('quoted','bound') FOR UPDATE",[a.address,run.id]);
     if(pending.rows.some(row=>row.status==='bound'))throw fail('Recover your recorded TREE payment in payment history before starting a new game.',409);
     await recordBestScore(tx,a.address,run,Number(run.updated_at));
     await tx.query("UPDATE breaker.invoices SET status='cancelled' WHERE wallet=$1 AND run_id=$2 AND status='quoted'",[a.address,run.id]);
     result=await fresh(tx,a,null,run.id);
    }
    if(a.expiresAt<=now())throw fail('Session expired; verify your NFTree wallet again.',401);
    return result;
   });
  },
  async history(ctx){const a=await holder(ctx);const {rows}=await db.query('SELECT * FROM breaker.invoices WHERE wallet=$1 ORDER BY created_at DESC LIMIT 30',[a.address]);return rows.map(invoice);},
  async quote(ctx){const a=await holder(ctx);if(a.address===TREE_PAYMENT_RECIPIENT)throw fail('Self-payment is not a purchase');const decimals=await reader.decimals();return db.transaction(async tx=>{
   const r=await current(tx,a);if(!r||r.state.status!=='gameover'||r.state.lives!==0)throw fail('Restarts are available after all three lives are lost');
   await tx.query("UPDATE breaker.invoices SET status='expired' WHERE wallet=$1 AND status='quoted' AND expires_at<=$2",[a.address,now()]);
   const pending=await tx.query("SELECT * FROM breaker.invoices WHERE wallet=$1 AND run_id=$2 AND status IN ('quoted','bound','paid') ORDER BY created_at DESC LIMIT 1",[a.address,r.id]);if(pending.rows[0])return invoice(pending.rows[0]);
   const t=now(),id=randomUUID();const {rows}=await tx.query('INSERT INTO breaker.invoices(id,wallet,run_id,recipient,amount,decimals,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,a.address,r.id,TREE_PAYMENT_RECIPIENT,treeAmount('continue',decimals),decimals,t,t+600000]);return invoice(rows[0]);
  });},
  async bind(ctx,{id,signed}){const a=await holder(ctx);const first=await db.transaction(tx=>owned(tx,a,id));if(first.status!=='quoted'&&first.status!=='bound')throw fail('Invoice cannot be signed');const digest=await inspectSigned(signed,invoice(first));if(!isValidTransactionDigest(digest))throw fail('Invalid signed digest');await holder(ctx);return db.transaction(async tx=>{await lock(tx,a);const r=await owned(tx,a,id);if(r.status==='bound'&&r.expected_digest===digest)return invoice(r);if(r.status!=='quoted'||Number(r.expires_at)<=now())throw fail('Invoice expired. No payment was submitted.');const {rows}=await tx.query("UPDATE breaker.invoices SET status='bound',expected_digest=$1,signed_bytes=$2,signed_signature=$3,bound_at=$4 WHERE id=$5 RETURNING *",[digest,signed.bytes,signed.signature,now(),id]);return invoice(rows[0]);});},
  async submit(ctx,{id}){const a=await holder(ctx),r=await db.transaction(tx=>owned(tx,a,id));if(!['bound','paid'].includes(r.status))throw fail('Recorded signed payment required');if(r.status==='bound'){await executeSigned({bytes:r.signed_bytes,signature:r.signed_signature},r.expected_digest);}return {digest:r.expected_digest};},
  async redeem(ctx,{id}){
   const a=await holder(ctx),first=await db.transaction(tx=>owned(tx,a,id));if(!['bound','paid'].includes(first.status))throw fail('Recorded signed payment required');
   const proof=first.status==='bound'?await reader.receipt(invoice(first),()=>now(),{allowLateRecovery:true}):null;await holder(ctx);
   return db.transaction(async tx=>{
    await lock(tx,a);const r=await owned(tx,a,id);
    if(r.status==='paid'){const result=await tx.query('SELECT r.* FROM breaker.restarts p JOIN breaker.runs r ON r.id=p.new_run WHERE p.invoice_id=$1 AND r.wallet=$2',[id,a.address]);if(!result.rows[0])throw Error('Paid restart missing');return {...await ranked(tx,a,await restoreCarriedScore(tx,a,result.rows[0])),applied:false};}
    if(r.status!=='bound'||!proof||proof.digest!==r.expected_digest||proof.wallet!==a.address||proof.recipient!==TREE_PAYMENT_RECIPIENT||proof.coinType!==TREE_TYPE||proof.amount!==String(r.amount)||!/^\d+$/.test(proof.checkpoint)||!Number.isSafeInteger(proof.timestampMs)||proof.timestampMs<Number(r.created_at)||proof.timestampMs>now()||(proof.timestampMs>=Number(r.expires_at)&&!(Number(r.bound_at)>=Number(r.created_at)&&Number(r.bound_at)<Number(r.expires_at))))throw fail('Receipt does not match this restart');
    const run=await current(tx,a);if(!run||run.id!==r.run_id||run.state.status!=='gameover')throw fail('This defeat is no longer current',409);
    await tx.query('INSERT INTO breaker.receipts(digest,invoice_id,checkpoint,timestamp_ms) VALUES($1,$2,$3,$4)',[proof.digest,id,proof.checkpoint,proof.timestampMs]);
    await recordBestScore(tx,a.address,run,Number(run.updated_at));
    const next=await fresh(tx,a,run.state);await tx.query('INSERT INTO breaker.restarts(invoice_id,new_run) VALUES($1,$2)',[id,next.id]);await tx.query("UPDATE breaker.invoices SET status='paid',paid_at=$1 WHERE id=$2",[now(),id]);if(a.expiresAt<=now())throw fail('Session expired; reconnect to recover your payment',401);return {...next,applied:true};
   });
  },
  async cancel(ctx,{id}){const a=await holder(ctx);return db.transaction(async tx=>{await lock(tx,a);const r=await owned(tx,a,id);if(r.status!=='quoted')throw fail('A signed payment must be recovered');await tx.query("UPDATE breaker.invoices SET status='cancelled' WHERE id=$1",[id]);return {cancelled:true};});},
  async reconcile(ctx,{id}){const a=await holder(ctx),first=await db.transaction(tx=>owned(tx,a,id));if(first.status!=='bound'||!await reader.failed(invoice(first)))throw fail('No finalized failed transaction found. Recover the recorded payment.');await holder(ctx);return db.transaction(async tx=>{await lock(tx,a);const r=await owned(tx,a,id);if(r.status!=='bound'||r.expected_digest!==first.expected_digest)throw fail('Invoice changed');await tx.query("UPDATE breaker.invoices SET status='cancelled' WHERE id=$1",[id]);return {cancelled:true};});}
 });
}
