import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction} from '../netlify/preview-lib/treeforce89-source/node_modules/@mysten/sui/dist/transactions/index.mjs';
import {createPaidContinueClient,loadPendingContinuation} from '../treeforce89/paid/client.mjs';
import {TREE_COIN_TYPE,TREE_RECIPIENT,validateSnapshot,baseUnits} from '../treeforce89/paid/contract.mjs';
const wallet='0x'+'8'.repeat(64),runId='grove-'+'a'.repeat(32),offerId='b'.repeat(48),digest='C'.repeat(44);
const session={wallet,runId,sessionToken:'d'.repeat(64),expiresAt:Date.now()+600000};
const snapshot={runId,seed:42,score:12500,wave:4,kills:39,perfect:2,maxStage:3,shotsFired:100,shotsHit:60,start:Date.now()-60000,mode:'ARCADE'};
const offer={enabled:true,recipientConfirmed:true,offerId,wallet,runId,network:'sui:mainnet',coinType:TREE_COIN_TYPE,
 recipient:TREE_RECIPIENT,price:'20000',lives:3,decimals:6,amountBaseUnits:'20000000000',expiresAt:session.expiresAt};
const grant={authorized:true,offerId,digest,runId,lives:3,wave:4,continuationNumber:1,snapshot,session};
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function setup({sign,fetcher,wait,storage=memory(),current=()=>wallet}={}) {
 let walletCalls=0,redemptions=0;
 const client=createPaidContinueClient({session,Transaction,storage,getCurrentWallet:current,
  signAndExecute:async tx=>{walletCalls++;assert(tx instanceof Transaction);
   const json=JSON.stringify(tx.getData(),(_,v)=>typeof v==='bigint'?v.toString():v);assert(json.includes(TREE_COIN_TYPE));assert(!json.includes('GasCoin'));
   return sign?sign(tx):{$kind:'Transaction',Transaction:{digest}};},waitForTransaction:wait,
  fetchImpl:async(path,request)=>{
   assert.equal(request.headers.Authorization,'Bearer '+session.sessionToken);
   if(fetcher)return fetcher(path,request);
   if(path.endsWith('tree-continue-offer'))return Response.json(offer);
   redemptions++;return Response.json(grant);
  }});
 return {client,storage,walletCalls:()=>walletCalls,redemptions:()=>redemptions};
}
test('uses exact TREE base units and rejects altered snapshots',()=>{
 assert.equal(baseUnits(6),20_000_000_000n);assert.equal(baseUnits(9),20_000_000_000_000n);
 assert.throws(()=>baseUnits(6.5));assert.throws(()=>validateSnapshot({...snapshot,authorized:true},runId));
 assert.throws(()=>validateSnapshot({...snapshot,wave:10},runId));
});
test('real SDK transaction is handed to the wallet; authorization is required before acknowledgement',async()=>{
 const f=setup();assert.deepEqual(await f.client.review(snapshot),offer);
 assert.deepEqual(await f.client.pay(offer),grant);assert.equal(f.walletCalls(),1);assert.equal(f.redemptions(),1);
 assert.equal(loadPendingContinuation(wallet,f.storage).digest,digest);
 f.client.acknowledge();assert.equal(loadPendingContinuation(wallet,f.storage),null);
});
test('wallet cancellation and failed transactions grant no lives',async()=>{
 for(const sign of [()=>{throw Object.assign(Error('User rejected'),{code:4001});},()=>({$kind:'FailedTransaction'})]){
  const f=setup({sign});await assert.rejects(f.client.pay(offer));assert.equal(f.redemptions(),0);
  assert.equal(loadPendingContinuation(wallet,f.storage),null);
 }
});
test('wrong recipient, amount, network or holder wallet cannot open checkout',async()=>{
 for(const patch of [{recipient:'0x1'},{amountBaseUnits:'1'},{network:'sui:testnet'},{wallet:'0x1'},{enabled:false}]){
  const f=setup();await assert.rejects(f.client.pay({...offer,...patch}));assert.equal(f.walletCalls(),0);
 }
});
test('double click never submits two wallet transactions',async()=>{
 let release;const f=setup({sign:()=>new Promise(r=>{release=()=>r({$kind:'Transaction',Transaction:{digest}});})});
 const first=f.client.pay(offer);await assert.rejects(f.client.pay(offer),/already in progress/);release();
 await first;assert.equal(f.walletCalls(),1);
});
test('delayed indexing retries only verification and retains the submitted digest',async()=>{
 const f=setup({wait:async()=>{throw Error('Indexer delayed');}});
 await assert.rejects(f.client.pay(offer),/Indexer delayed/);
 assert.equal(loadPendingContinuation(wallet,f.storage).digest,digest);
 await assert.rejects(f.client.pay(offer),/Recover/);assert.deepEqual(await f.client.retry(),grant);
 assert.equal(f.walletCalls(),1);
});
test('network failure after payment never automatically charges again',async()=>{
 let failed=true;const f=setup({fetcher:async()=>{if(failed){failed=false;throw Error('Network unavailable');}return Response.json(grant);}});
 await assert.rejects(f.client.pay(offer),/Network unavailable/);assert.deepEqual(await f.client.retry(),grant);
 assert.equal(f.walletCalls(),1);
});
test('account switching after submission preserves recovery but grants no access',async()=>{
 let active=wallet;const f=setup({current:()=>active,sign:()=>{active='0x'+'9'.repeat(64);return {$kind:'Transaction',Transaction:{digest}};}});
 await assert.rejects(f.client.pay(offer),/Reconnect/);assert.equal(f.redemptions(),0);
 assert.equal(loadPendingContinuation(wallet,f.storage).digest,digest);
});
test('refresh recovery uses a fresh authenticated lease, not another payment',async()=>{
 const f=setup({wait:async()=>{throw Error('refresh');}});await assert.rejects(f.client.pay(offer));
 const fresh={...session,sessionToken:'e'.repeat(64),runId:'grove-'+'f'.repeat(32)};
 const recovered=createPaidContinueClient({session:fresh,Transaction,storage:f.storage,getCurrentWallet:()=>wallet,
  signAndExecute:()=>{throw Error('Recovery must not sign');},fetchImpl:async()=>Response.json({...grant,session:{...fresh,runId}})});
 const r=await recovered.retry();assert.equal(r.runId,runId);assert.equal(r.session.sessionToken,fresh.sessionToken);
});
test('unverifiable grants and unknown wallet errors preserve a recoverable checkout',async()=>{
 const f=setup({fetcher:async()=>Response.json({...grant,lives:99})});await assert.rejects(f.client.pay(offer),/invalid/);
 assert.equal(loadPendingContinuation(wallet,f.storage).digest,digest);
 const unknown=setup({sign:()=>{throw Error('Wallet RPC connection lost');}});
 await assert.rejects(unknown.client.pay(offer));assert.equal(loadPendingContinuation(wallet,unknown.storage).offerId,offerId);
 await assert.rejects(unknown.client.pay(offer),/Recover/);
});
