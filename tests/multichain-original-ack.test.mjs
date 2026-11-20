import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {encodeFunctionData,keccak256,parseAbi,toHex} from 'viem';
import {C,payload,packet,baseline,validateState,buildTransaction,verifyRelease,verifyQuote,verifySend,readBnb,preflight,recoverReceipt,requestAcknowledgement,readStoredState} from '../scripts/multichain/original-ack-core.mjs';
import {entries,json} from '../scripts/multichain/original-peer-state.mjs';
import {C as B} from '../scripts/multichain/original-send-core.mjs';
const dir='docs/multichain/original-trial/',read=n=>JSON.parse(fs.readFileSync(dir+n+'.json')),before=()=>structuredClone(baseline),sim=()=>read('ack-send-simulation'),qs=()=>read('ack-quote-simulation'),fee='94962136',digest='A'.repeat(43);
function after(){
 const s=before(),nodes=read('ack-send-poststate-simulation').data.simulateTransaction.effects.objectChanges.nodes;
 for(const n of nodes){if(!n.outputState)continue;for(const k of ['vault','oapp','channel'])if(n.address===C[k])s[k]=n.outputState;if(n.address===entries.channelPath.id)s.channelPath={dynamicField:{value:{json:json(n.outputState).value}}};}
 return s;
}
function client(state=before()){
 const files=['publication-receipt','slot-receipt','registration-receipt','route-config-receipt','peer-binding-receipt','fund-receipt','ack-release-receipt'].map(read),map=new Map(files.map(x=>[x.Transaction.digest,x]));
 const receipt=sim();receipt.Transaction.digest=digest;delete receipt.commandResults;map.set(digest,receipt);
 let i=0;return {query:async()=>({data:state}),core:{getChainIdentifier:async()=>({chainIdentifier:C.chain}),getTransaction:async({digest})=>map.get(digest),simulateTransaction:async()=>++i===1?qs():sim()}};
}
const bnb=async()=>({status:'verified',destinationStatus:'pending'}),retired=async()=>({status:'verified',destinationStatus:'retired'});
const store=()=>{const map=new Map();return {map,storage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};};
const locks={request:async(k,o,f)=>f({})};
const quote={stage:'ready',transaction:buildTransaction('send',C.sender,before(),fee),feeMist:fee,gasMist:'4053255',grossGasMist:'16599600',totalMist:'99015391',guid:C.guid,quotedAt:1000};
function request(extra={}){const {storage}=store();return requestAcknowledgement({storage,locks,identity:()=>({address:C.sender,network:'mainnet',epoch:1}),reviewed:()=>true,reviewedQuote:()=>quote,prepare:async()=>quote,sign:async()=>({$kind:'Transaction',Transaction:{digest}}),now:()=>1000,...extra});}

test('original nonce-two kind-three packet and wallet-managed gas are fixed',()=>{
 assert.equal(C.guid,'0xe9b1c9627995eb8c09471150e121847770e7b28d9d705acd7b2a7f42b5a44c8c');
 assert.equal(payload,'0x0203'+C.vault.slice(2)+C.nft.slice(2)+C.request.slice(2)+C.recipient.slice(2));assert.equal((payload.length-2)/2,130);assert.equal((packet.length-2)/2,243);
 const d=quote.transaction.getData();assert.equal(d.gasData.budget,null);assert.equal(d.gasData.payment,null);assert.equal(d.gasData.owner,null);assert.equal(d.gasData.price,null);
 assert.ok(d.inputs.every(x=>!x.Object?.ImmOrOwnedObject));assert.ok(!d.inputs.some(x=>[C.nft,C.admin,C.vaultAdmin,C.upgrade].includes(x.Object?.SharedObject?.objectId)));
 assert.equal(d.inputs[5].Pure.bytes,'Aw==');assert.equal(d.inputs[6].Pure.bytes,'AA==');assert.equal(d.commands[1].MoveCall.package,C.package);assert.deepEqual(d.commands[1].MoveCall.typeArguments,[C.nftType]);
 assert.ok(!d.commands.some(x=>x.Publish||x.Upgrade||/set_|fund|bind|register/.test(x.MoveCall?.function??'')));
});
test('exact Sui executor receipt proves unwrapping original NFT to recipient, not minting',()=>{
 const r=verifyRelease(read('ack-release-receipt'));assert.equal(r.digest,C.release);assert.equal(r.nftId,C.nft);assert.equal(r.recipient,C.sender);
 for(const edit of [t=>t.digest=digest,t=>t.events[1].json.request.bytes='AA==',t=>t.events[0].json.nonce='2',t=>t.effects.changedObjects.find(x=>x.objectId===C.nft).idOperation='Created',t=>t.effects.changedObjects.find(x=>x.objectId===C.nft).outputOwner.AddressOwner=C.vault,t=>t.transaction.inputs[8].Pure.bytes='AA==']){const r=read('ack-release-receipt');edit(r.Transaction);assert.throws(()=>verifyRelease(r));}
});
test('released and acknowledgement poststates validate, with no obsolete phase-one custody check',()=>{
 validateState(before(),0);validateState(after(),1);assert.equal(json(after().vault).nft,null);assert.equal(json(after().vault).ack_sent,true);assert.equal(after().channelPath.dynamicField.value.json.outbound_nonce,'2');
 const s=after();s.nft=null;assert.throws(()=>validateState(s,1));validateState(s,1,{requireCustody:false});
});
test('attached poststate changes only ack_sent and outbound nonce while NFT remains untouched',()=>{
 const s=after(),nodes=read('ack-send-poststate-simulation').data.simulateTransaction.effects.objectChanges.nodes;
 assert.deepEqual(json(s.vault),{...json(before().vault),ack_sent:true});assert.deepEqual(json(s.oapp),json(before().oapp));assert.deepEqual(json(s.channel),json(before().channel));
 assert.deepEqual(s.channelPath.dynamicField.value.json,{...before().channelPath.dynamicField.value.json,outbound_nonce:'2'});assert.ok(!nodes.some(x=>x.address===C.nft));
});
test('one-shot duplicate send aborts in original vault payload with EWrongState',()=>{
 const r=read('ack-repeat-negative-simulation');assert.equal(r.$kind,'FailedTransaction');assert.equal(r.FailedTransaction.status.error.command,30);assert.equal(r.FailedTransaction.status.error.MoveAbort.abortCode,'5');assert.deepEqual(r.FailedTransaction.status.error.MoveAbort.location,{package:C.package,module:'vault',functionName:'payload',instruction:88});assert.deepEqual(r.FailedTransaction.events,[]);
});
test('changed ownership, release identity, nonce, authority or route policy fail closed',()=>{
 for(const edit of [s=>json(s.vault).phase=1,s=>json(s.vault).nft=json(fund()),s=>json(s.vault).request.bytes='AA==',s=>json(s.vault).recipient.bytes='AA==',s=>s.nft.owner.address.address=C.vault,s=>s.nft.asMoveObject.contents.json.number='2721',s=>s.channelPath.dynamicField.value.json.outbound_nonce='2',s=>s.channelPath.dynamicField.value.json.lazy_inbound_nonce='0',s=>s.appReceive.dynamicField.value.json.uln_config.confirmations='1',s=>s.ackOptions.dynamicField.value.json='AA==',s=>s.vaultAdmin.owner.address.address=C.nft,s=>s.upgrade.digest='wrong']){const s=before();edit(s);assert.throws(()=>validateState(s,0));}
 function fund(){return read('fund-baseline').nft;}
});
test('wrong wallet, zero/excessive fee and repeated acknowledgement are rejected',()=>{
 assert.throws(()=>buildTransaction('send',C.nft,before(),fee));for(const f of ['0','500000001','-1'])assert.throws(()=>buildTransaction('send',C.sender,before(),f));assert.throws(()=>buildTransaction('send',C.sender,after(),fee));
});
test('actual unsigned quote/send fixtures pass exact events, payments and gas bounds',()=>{
 assert.deepEqual(verifyQuote(qs(),buildTransaction('quote',C.sender,before())),{feeMist:fee});const r=verifySend(sim(),quote.transaction,fee);assert.equal(r.totalMist,'99015391');assert.equal(r.grossGasMist,'16599600');
});
for(const [name,edit]of [
 ['extra transfer',t=>t.transaction.commands.push({TransferObjects:{objects:[],address:{Input:0}}})],
 ['wrong kind',t=>t.transaction.inputs[5].Pure.bytes='AQ=='],
 ['wrong generic',t=>t.transaction.commands[1].MoveCall.typeArguments=['0x2::sui::SUI']],
 ['wrong application',t=>t.transaction.commands[1].MoveCall.package=C.endpointPackage],
 ['wrong fee',t=>t.transaction.inputs[4].Pure.bytes='AA=='],
 ['wrong packet nonce/backing',t=>t.events[2].json.encoded_packet='AA=='],
 ['native delivery',t=>t.events[2].json.options='AA=='],
 ['wrong executor',t=>t.events[0].json.executor=C.vault],
 ['missing DVN',t=>t.events[1].json.dvns.pop()],
 ['wrong worker payee',t=>t.events[1].json.fees[0].recipient=C.sender],
 ['wrong fee total',t=>t.events[0].json.fee.fee='1'],
 ['NFT mutation',t=>t.effects.changedObjects.push({...t.effects.changedObjects.find(x=>x.objectId===C.vault),objectId:C.nft})],
 ['admin mutation',t=>t.effects.changedObjects.push({...t.effects.changedObjects.find(x=>x.objectId===C.vault),objectId:C.vaultAdmin})],
 ['wrong path parent',t=>t.effects.changedObjects.find(x=>x.objectId===entries.channelPath.id).outputOwner.ObjectOwner=C.vault],
 ['changed vault ownership',t=>t.effects.changedObjects.find(x=>x.objectId===C.vault).outputOwner.Shared.initialSharedVersion='1'],
 ['non-SUI output',t=>{const x=t.effects.changedObjects.find(x=>x.inputState==='DoesNotExist'&&x.outputState==='ObjectWrite');t.objectTypes[x.objectId]='USDT';}],
 ['extra payment',t=>t.balanceChanges.push({...t.balanceChanges[0],address:C.nft})],
 ['excessive budget',t=>t.transaction.gasData.budget='100000001'],
 ['excessive gross gas',t=>t.effects.gasUsed.storageCost='100000001'],
 ['other gas owner',t=>t.transaction.gasData.owner=C.nft]
])test('send rejects '+name,()=>{const r=sim();edit(r.Transaction);assert.throws(()=>verifySend(r,quote.transaction,fee));});
test('simulation must show exact ack-only vault mutation',()=>{const r=sim();r.commandResults[1].mutatedReferences[0].bcs[0]=1;assert.throws(()=>verifySend(r,quote.transaction,fee));});
test('quote rejects source mutation, packet event, nonzero ZRO fee or extra balance payment',()=>{
 for(const edit of [r=>r.Transaction.effects.changedObjects.push(sim().Transaction.effects.changedObjects.find(x=>x.objectId===C.vault)),r=>r.Transaction.events.push(sim().Transaction.events[2]),r=>r.commandResults.at(-1).returnValues[0].bcs[0]=1,r=>r.Transaction.balanceChanges.push({...r.Transaction.balanceChanges[0]})]){const r=qs();edit(r);assert.throws(()=>verifyQuote(r,buildTransaction('quote',C.sender,before())));}
});
function bnbProvider({retired=false,delivered=retired?keccak256(payload):'0x'+'0'.repeat(64)}={}){
 const reads=read('redemption-send-receipt').reads;
 const key=q=>JSON.stringify([q.method,q.method==='eth_call'?[q.params[0].to.toLowerCase(),q.params[0].data.toLowerCase()]:q.method==='eth_getCode'?[q.params[0].toLowerCase()]:q.params??[]]);
 const map=new Map(reads.map(x=>[key(x),x.result]));
 const stateData=encodeFunctionData({abi:parseAbi(['function state() view returns(uint8)']),functionName:'state'}),balanceData=encodeFunctionData({abi:parseAbi(['function balanceOf(address) view returns(uint256)']),functionName:'balanceOf',args:[B.from]});
 return {request:async q=>{if(q.method==='eth_call'&&q.params[0].data.startsWith('0xe495f1d4'))return delivered;if(retired&&q.method==='eth_call'&&q.params[0].to.toLowerCase()===C.pass.toLowerCase()){if(q.params[0].data===stateData)return toHex(4n,{size:32});if(q.params[0].data===balanceData)return toHex(0n,{size:32});}const k=key(q);assert.ok(map.has(k),'Unexpected RPC '+k);return structuredClone(map.get(k));}};
}
test('BNB full original send receipt/route validates locked and final retirement at the same block',async()=>{
 const pending=await readBnb({provider:bnbProvider()});assert.equal(pending.destinationStatus,'pending');assert.equal(pending.passState,'3');
 const done=await readBnb({provider:bnbProvider({retired:true})});assert.equal(done.destinationStatus,'retired');assert.equal(done.acknowledgementHash,keccak256(payload));
 await assert.rejects(readBnb({provider:bnbProvider({retired:true,delivered:'0x'+'0'.repeat(64)})}),/disagree/);
 await assert.rejects(readBnb({provider:bnbProvider({delivered:keccak256(payload)})}),/disagree/);
});
test('preflight requires actual release, original BNB state and fresh simulations',async()=>{
 await assert.rejects(preflight(C.sender,{client:client(),bnb:async()=>({status:'pending'})}),/BNB route/);
 const bad=client();const get=bad.core.getTransaction;bad.core.getTransaction=async q=>q.digest===C.release?{}:get(q);await assert.rejects(preflight(C.sender,{client:bad,bnb}),/release receipt/);
 const c=client(),signals=[],simulate=c.core.simulateTransaction;c.core.simulateTransaction=async o=>{assert.equal(o.checksEnabled,true);assert.equal(o.doGasSelection,true);signals.push(o.signal);return simulate(o);};
 const r=await preflight(C.sender,{client:c,bnb,now:()=>1000});assert.equal(r.stage,'ready');assert.equal(r.totalMist,'99015391');assert.notEqual(signals[0],signals[1]);
});
test('already acknowledged and later Retired preflights are read-only completed states',async()=>{
 const s=after();s.nft=null;for(const [b,expected]of [[bnb,'acknowledged'],[retired,'retired']]){const c=client(s);c.core.simulateTransaction=()=>{throw Error('Must not simulate or send twice');};const r=await preflight(C.sender,{client:c,bnb:b});assert.equal(r.stage,expected);assert.equal(r.transaction,undefined);}
 await assert.rejects(preflight(C.sender,{client:client(),bnb:retired}),/retired before/);
});
test('preflight refuses a simulation response that omits vault mutation proof',async()=>{
 const c=client(),simulate=c.core.simulateTransaction;let i=0;c.core.simulateTransaction=async o=>{const r=await simulate(o);if(++i===2)delete r.commandResults;return r;};
 await assert.rejects(preflight(C.sender,{client:c,bnb}),/mutation proof/);
});
test('durable pending guard precedes wallet handoff and prevents duplicates',async()=>{
 const h=store();await request({storage:h.storage,sign:async()=>{assert.ok(readStoredState(h.storage).pending);return {$kind:'Transaction',Transaction:{digest}};}});assert.equal(readStoredState(h.storage).receipt.digest,digest);await assert.rejects(request({storage:h.storage}),/pending or recorded/);
});
test('ambiguous wallet errors and malformed digests stay pending; explicit rejection clears pending',async()=>{
 for(const code of [undefined,4001]){const h=store();await assert.rejects(request({storage:h.storage,sign:async()=>{throw Object.assign(Error('wallet'),{code});}}));assert.equal(readStoredState(h.storage).pending,code!==4001);}
 const h=store();await assert.rejects(request({storage:h.storage,sign:async()=>({$kind:'Transaction',Transaction:{digest:'bad'}})}));assert.equal(readStoredState(h.storage).pending,true);
});
test('stale reviews, wallet switches, new acknowledgement, changed fees and failed storage block handoff',async()=>{
 await assert.rejects(request({now:()=>200000}),/fresh acknowledgement quote/);let i=0;await assert.rejects(request({identity:()=>({address:C.sender,network:'mainnet',epoch:++i})}),/Wallet or review changed/);
 for(const update of [{feeMist:'1'},{gasMist:'1'},{grossGasMist:'1'},{stage:'acknowledged'}])await assert.rejects(request({prepare:async()=>({...quote,...update})}),/progress, fee or gas changed/);
 await assert.rejects(request({storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}}),/persist pending/);await assert.rejects(request({locks:{request:async(k,o,f)=>f(null)}}),/Another tab/);
});
test('receipt recovery distinguishes Sui confirmation from final BNB retirement, without stale NFT ownership',async()=>{
 for(const [b,expected]of [[bnb,'pending'],[retired,'retired']]){const h=store(),state=after();h.map.set(C.key+'-pending','1');state.nft=null;const r=await recoverReceipt(digest,{storage:h.storage,client:client(state),bnb:b,now:()=>1000});assert.equal(r.status,'chain_verified');assert.equal(r.destinationStatus,expected);assert.equal(readStoredState(h.storage).pending,false);}
});
test('handoff independently enforces positive fee and gross gas ceilings even if a prepared quote is invalid',async()=>{
 for(const update of [{feeMist:'0'},{feeMist:'500000001'},{grossGasMist:'100000001'},{gasMist:'16599601'},{totalMist:'1'}]){
  const q={...quote,...update};await assert.rejects(request({reviewedQuote:()=>q,prepare:async()=>q,sign:async()=>{throw Error('Must not sign');}}),/exceeds the reviewed ceilings/);
 }
});
test('receipt recovery rejects wrong/currently unsent receipts and storage races without clearing pending',async()=>{
 const h=store();h.map.set(C.key+'-pending','1');await assert.rejects(recoverReceipt(digest,{storage:h.storage,client:client(),bnb}),/not yet reflected/);assert.equal(readStoredState(h.storage).pending,true);
 const c=client(after());const old=c.query;c.query=async()=>{h.map.set(C.key+'-pending',null);return old();};await assert.rejects(recoverReceipt(digest,{storage:h.storage,client:c,bnb}),/changed during/);
});
