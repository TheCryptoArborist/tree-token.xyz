import test from 'node:test';import assert from 'node:assert/strict';
import {createSharedNativeCheckout,createBrowserSharedNativeCheckout} from '../scripts/multichain/browser/shared-native-checkout.mjs';
import {TREE_COIN_TYPE,TREE_RECIPIENT} from '../docs/multichain/generation-milestone/native-sui-payments/upstream/contract.mjs';
function fixture(){
 let session={wallet:'0x'+'a'.repeat(64),nativeRunId:'grove-'+'b'.repeat(32),sessionToken:'c'.repeat(64),epoch:'one'},signs=0,failRecord=false,failSign=false;
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};let queue=Promise.resolve();
 const locks={request:(k,o,fn)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};
 const offer={enabled:true,recipientConfirmed:true,wallet:session.wallet,runId:session.nativeRunId,network:'sui:mainnet',coinType:TREE_COIN_TYPE,recipient:TREE_RECIPIENT,price:'20000',decimals:6,amountBaseUnits:'20000000000',lives:3,offerId:'d'.repeat(48),expiresAt:Date.now()+60000};
 class Transaction{pure={address:v=>v};coin(v){return v;}transferObjects(){}}
 const options={getSession:()=>session,transport:{record:async p=>{if(failRecord)throw Error('lost response');return {...p,status:'recorded',paymentId:'11111111-1111-4111-8111-111111111111',restoreAuthorized:false};}},Transaction,storage,legacyStorage:storage,locks,signAndExecute:async()=>{signs++;if(failSign)throw Error('unknown wallet result');return {$kind:'Transaction',Transaction:{digest:'D'.repeat(44)}};}};
 return {options,offer,data,storage,client:createSharedNativeCheckout(options),signs:()=>signs,setFailRecord:v=>failRecord=v,setFailSign:v=>failSign=v,switchWallet:()=>session={...session,wallet:'0x'+'e'.repeat(64)}};
}
test('concurrent payment clicks produce one signature',async()=>{const f=fixture();const results=await Promise.allSettled([f.client.pay(f.offer),f.client.pay(f.offer)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.signs(),1);});
test('lost recording response reconciles saved digest without another signature',async()=>{const f=fixture();f.setFailRecord(true);await assert.rejects(f.client.pay(f.offer));f.setFailRecord(false);assert.equal((await f.client.reconcile()).status,'recorded');await assert.rejects(f.client.pay(f.offer));assert.equal(f.signs(),1);});
test('unknown signing outcome keeps durable marker and prevents another payment',async()=>{const f=fixture();f.setFailSign(true);await assert.rejects(f.client.pay(f.offer));await assert.rejects(f.client.pay(f.offer),/recover-existing/);await assert.rejects(f.client.reconcile(),/receipt-review/);assert.equal(f.signs(),1);});
test('storage failure blocks before wallet request',async()=>{const f=fixture();f.storage.setItem=()=>{};await assert.rejects(f.client.pay(f.offer),/durable/);assert.equal(f.signs(),0);});
test('legacy pending checkout prevents shared payment',async()=>{const f=fixture();f.data.set('treeforce89-pending-continue:'+f.offer.wallet,'legacy receipt');await assert.rejects(f.client.pay(f.offer),/recover-existing/);assert.equal(f.signs(),0);});
test('wallet switch after signature retains original-wallet digest and denies record',async()=>{const f=fixture();const client=createSharedNativeCheckout({...f.options,signAndExecute:async()=>{f.switchWallet();return {$kind:'Transaction',Transaction:{digest:'D'.repeat(44)}};}});await assert.rejects(client.pay(f.offer),/session-changed/);assert([...f.data.values()].some(v=>JSON.parse(v).digest==='D'.repeat(44)));});
test('expired or changed offer never signs',async()=>{const f=fixture();await assert.rejects(f.client.pay({...f.offer,expiresAt:0}));await assert.rejects(f.client.pay({...f.offer,recipient:'0x'+'e'.repeat(64)}));assert.equal(f.signs(),0);});
test('separate legacy session store blocks pay and recovery without clearing either store',async()=>{
 const f=fixture(),legacy=new Map([['treeforce89-pending-continue:'+f.offer.wallet,'old receipt']]);
 const client=createSharedNativeCheckout({...f.options,legacyStorage:{getItem:k=>legacy.get(k)||null}});
 assert.deepEqual(client.pending(),{kind:'legacy',canPay:false});await assert.rejects(client.pay(f.offer));await assert.rejects(client.reconcile({digest:'D'.repeat(44)}));assert.equal(f.signs(),0);assert.equal(legacy.size,1);
});
test('manual digest verifies unknown signing result without signing again',async()=>{
 const f=fixture();f.setFailSign(true);await assert.rejects(f.client.pay(f.offer));assert.equal(f.client.pending().hasDigest,false);
 await assert.rejects(f.client.reconcile({digest:'invalid'}));assert.equal(f.client.pending().hasDigest,false);
 assert.equal((await f.client.reconcile({digest:'D'.repeat(44)})).status,'recorded');assert.equal(f.signs(),1);assert.equal(f.client.pending().canRecover,true);
 await assert.rejects(f.client.reconcile({digest:'E'.repeat(44)}));
});
test('failed manual verification retains original marker and permits correcting the digest',async()=>{
 const f=fixture();f.setFailSign(true);await assert.rejects(f.client.pay(f.offer));f.setFailRecord(true);
 await assert.rejects(f.client.reconcile({digest:'E'.repeat(44)}));assert.equal(f.client.pending().hasDigest,false);f.setFailRecord(false);
 await f.client.reconcile({digest:'D'.repeat(44)});assert.equal(f.signs(),1);
});
test('recovery retains journal and does not sign or grant restoration',async()=>{
 const f=fixture();await f.client.pay(f.offer);const client=createSharedNativeCheckout({...f.options,transport:{...f.options.transport,recover:async({paymentId})=>({paymentId,status:'recovered',restoreAuthorized:false,requiresPayment:false})}});
 assert.equal((await client.recoverPending()).status,'recovered');assert.equal(client.pending().canPay,false);assert.equal(f.signs(),1);
});
test('unreadable or malformed pending stores fail closed',()=>{
 const f=fixture();f.data.set('tree-shared-native-checkout.v1:'+f.offer.wallet,'broken');assert.equal(f.client.pending().kind,'review');
 const c=createSharedNativeCheckout({...f.options,legacyStorage:{getItem:()=>{throw Error('denied');}}});assert.equal(c.pending().canPay,false);
});

test('browser wiring uses distinct local and session stores',async()=>{
 const f=fixture();const old=new Map([['treeforce89-pending-continue:'+f.offer.wallet,'receipt']]);
 const c=createBrowserSharedNativeCheckout(f.options,{localStorage:f.storage,sessionStorage:{getItem:k=>old.get(k)||null},navigator:{locks:f.options.locks}});
 assert.equal(c.pending().kind,'legacy');await assert.rejects(c.pay(f.offer));assert.equal(f.signs(),0);
 old.clear();assert.equal(c.pending().kind,'none');await c.pay(f.offer);assert.equal(f.data.size,1);assert.equal(old.size,0);
});

function withCompletion(f,change={}){return createSharedNativeCheckout({...f.options,transport:{...f.options.transport,complete:async({paymentId})=>({paymentId,source:'sui-native-tree',status:'completed',archiveAllowed:true,restoreAuthorized:false,requiresPayment:false,offerId:f.offer.offerId,digest:'D'.repeat(44),nativeRunId:f.offer.runId,...change})}});}
test('matching server completion archives before removing pending marker',async()=>{
 const f=fixture();await f.client.pay(f.offer);const c=withCompletion(f);assert.equal((await c.archiveCompleted()).status,'archived');assert.equal(c.pending().canPay,true);assert.equal(f.data.size,1);assert.equal(JSON.parse([...f.data.values()][0]).status,'completed');assert.equal(f.signs(),1);
});
test('mismatched or incomplete completion never clears marker',async()=>{
 for(const change of [{source:'bnb-usdt'},{archiveAllowed:false},{status:'review-required'},{digest:'E'.repeat(44)},{offerId:'e'.repeat(48)},{nativeRunId:'grove-'+'e'.repeat(32)},{restoreAuthorized:true}]){
 const f=fixture();await f.client.pay(f.offer);await assert.rejects(withCompletion(f,change).archiveCompleted());assert.equal(f.client.pending().canPay,false);assert.equal(f.signs(),1);
 }
});
test('archive storage failure retains pending marker',async()=>{
 const f=fixture();await f.client.pay(f.offer);f.storage.setItem=()=>{};await assert.rejects(withCompletion(f).archiveCompleted(),/durable-archive/);assert.equal(f.client.pending().canPay,false);
});
test('wallet rejection is retained as reported cancellation, not permission to repay',async()=>{
 const f=fixture(),c=createSharedNativeCheckout({...f.options,signAndExecute:async()=>{throw Object.assign(Error('cancelled'),{code:4001});}});
 await assert.rejects(c.pay(f.offer));assert.equal(c.pending().cancellationReported,true);await assert.rejects(c.pay(f.offer),/recover-existing/);await assert.rejects(c.archiveCompleted());
});
