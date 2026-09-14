import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {TREE_TYPE,NETWORK,LIVE_CHECKOUT_ENABLED,draftOrder,verifyQuote,verifyFromReader,beginLiveCheckout,validateStoredTerms} from '../mainnet-payment.mjs';
import {runtimeLedger,settlementWorker,validateCommand} from '../ledger.mjs';
const now=1800000000000,key=randomBytes(32),addr=n=>'0x'+String(n).repeat(64),digest='A'.repeat(43);
const config={network:NETWORK,coinType:TREE_TYPE,recipient:addr(2),checkoutPackage:addr(3),eventType:addr(3)+'::checkout::Purchase',
  metadataVerified:true,decimals:6,policyVersion:'UNIT-TEST-NOT-MARKET-PRICE',bonusBps:1000,chainIdentifier:'1234abcd',maxBaseCC:'1000'};
const price={policyVersion:config.policyVersion,source:'reviewed-policy',observedAtMs:now,usdMicroPerTree:'3000'};
function fixture(){
 const accountId=randomUUID(),args={accountId,payer:addr(1),baseCC:'1000'};
 const {terms,signature}=draftOrder(args,config,price,key,now);
 const fields={orderId:terms.orderId,accountId,payer:terms.payer,recipient:terms.recipient,coinType:TREE_TYPE,amountRaw:terms.requiredRaw,quoteHash:terms.quoteHash};
 const tx={digest,status:'success',finalized:true,simulated:false,checkpoint:'100',timestampMs:now+1000,sender:terms.payer,
   events:[{index:'0',type:terms.eventType,packageId:config.checkoutPackage,fields}],
   balanceChanges:[{owner:terms.payer,coinType:TREE_TYPE,amount:'-'+terms.requiredRaw},{owner:terms.recipient,coinType:TREE_TYPE,amount:terms.requiredRaw}]};
 const net={network:NETWORK,chainIdentifier:config.chainIdentifier};let reads=0;
 const reader={getNetworkIdentity:async()=>net,getFinalizedTransaction:async id=>{assert.equal(id,digest);reads++;return tx;}};
 return {terms,signature,tx,net,reader,args,get reads(){return reads}};
}
test('draft snapshot uses integer rounding UP, separated bonus, and no payable authorization',()=>{const f=fixture();assert.equal(f.terms.requiredRaw,'333333334');assert.equal(f.terms.baseCC,'1000');assert.equal(f.terms.bonusCC,'100');assert.equal(f.terms.totalCC,'1100');assert.equal(f.terms.expiresAtMs-now,45000);assert.equal(draftOrder(f.args,config,price,key,now).payable,false)});
test('quote signature binds every payment and account term',()=>{const f=fixture();assert.equal(verifyQuote(f.terms,f.signature,key),true);for(const change of [{recipient:addr(4)},{baseCC:'2'},{payer:addr(5)},{network:'sui:testnet'},{quoteHash:'f'.repeat(64)}])assert.equal(verifyQuote({...f.terms,...change},f.signature,key),false)});
test('short or invalid keys cannot sign quotes',()=>{assert.throws(()=>draftOrder(fixture().args,config,price,new Uint8Array(8),now),/signing-key/)});
for(const [name,patch,error] of [
 ['missing recipient',{recipient:null},/address/],['testnet',{network:'sui:testnet'},/network/],['wrong coin',{coinType:'FAKE'},/coin/],
 ['unverified metadata',{metadataVerified:false},/metadata/],['unknown decimals',{decimals:undefined},/metadata/],
 ['no pilot cap',{maxBaseCC:'0'},/cap/],['unreviewed contract',{eventType:addr(5)+'::checkout::Purchase'},/contract/],
 ['unverified chain',{chainIdentifier:null},/chain/],['bonus abuse',{bonusBps:10001},/bonus/],
])test('draft rejects '+name,()=>assert.throws(()=>draftOrder(fixture().args,{...config,...patch},price,key,now),error));
test('quote rejects zero negative fractional and unsafe JS-number credit inputs',()=>{for(const baseCC of ['0','-1','1.5',1000,'01','9223372036854775808'])assert.throws(()=>draftOrder({...fixture().args,baseCC},config,price,key,now))});
test('no current/fictional default price is substituted',()=>{for(const p of [undefined,{...price,usdMicroPerTree:'0'},{...price,source:'pool-spot'},{...price,observedAtMs:now-30001},{...price,observedAtMs:now+1}])assert.throws(()=>draftOrder(fixture().args,config,p,key,now))});
test('purchase cap and self-payment are rejected',()=>{assert.throws(()=>draftOrder({...fixture().args,baseCC:'1001'},config,price,key,now),/cap/);assert.throws(()=>draftOrder({...fixture().args,payer:config.recipient},config,price,key,now),/self-payment/)});
test('stored order cannot be modified after commitment',()=>{const f=fixture();validateStoredTerms(f.terms);assert.throws(()=>validateStoredTerms({...f.terms,recipient:addr(4)}),/commitment/)});
test('finalized receipt is read independently and matched to exact stored order and effects',async()=>{const f=fixture(),e=await verifyFromReader(f.terms,digest,'0',f.reader);assert.equal(f.reads,1);assert.equal(e.orderId,f.terms.orderId);assert.equal(e.source,'chain-reader');assert.equal(e.evidenceHash.length,64);assert.equal(e.amountRaw,f.terms.requiredRaw);assert.equal(Object.isFrozen(e),true)});
for(const [name,change,error] of [
 ['failed transaction',t=>t.status='failed',/unsuccessful/],['submitted only',t=>t.finalized=false,/unfinalized/],
 ['simulation',t=>t.simulated=true,/unfinalized/],['missing checkpoint',t=>delete t.checkpoint,/integer/],
 ['wrong digest',t=>t.digest='B'.repeat(43),/unsuccessful/],['wrong payer',t=>t.sender=addr(4),/payer/],
 ['late payment',t=>t.timestampMs=now+45001,/window/],['payment before quote',t=>t.timestampMs=now-1,/window/],
 ['forged event package',t=>t.events[0].packageId=addr(4),/package/],['wrong order',t=>t.events[0].fields.orderId=randomUUID(),/fields/],
 ['wrong event amount',t=>t.events[0].fields.amountRaw='1',/fields/],['wrong coin',t=>t.events[0].fields.coinType='FAKE',/fields/],
 ['wrong recipient',t=>t.events[0].fields.recipient=addr(4),/fields/],['wrong quote hash',t=>t.events[0].fields.quoteHash='f'.repeat(64),/fields/],
 ['duplicate event index',t=>t.events.push(structuredClone(t.events[0])),/unique/],['no received funds',t=>t.balanceChanges=[],/effects/],
 ['underpayment',t=>t.balanceChanges[1].amount='1',/effects/],['other token balance',t=>t.balanceChanges[1].coinType='FAKE',/effects/],
])test('verification rejects '+name,async()=>{const f=fixture();change(f.tx);await assert.rejects(verifyFromReader(f.terms,digest,'0',f.reader),error)});
test('wrong chain fails before transaction is read',async()=>{const f=fixture();f.net.chainIdentifier='ffffffff';await assert.rejects(verifyFromReader(f.terms,digest,'0',f.reader),/chain/);assert.equal(f.reads,0)});
test('late observation of an on-time finalized payment remains valid',async()=>{const f=fixture();f.tx.timestampMs=f.terms.expiresAtMs;await verifyFromReader(f.terms,digest,'0',f.reader)});
test('RPC errors do not become successful payments',async()=>{const f=fixture();f.reader.getFinalizedTransaction=async()=>{throw Error('RPC unavailable')};await assert.rejects(verifyFromReader(f.terms,digest,'0',f.reader),/RPC/)});
test('live checkout remains hard disabled regardless of environment variables',()=>{process.env.CANOPY_LIVE_CHECKOUT='true';assert.equal(LIVE_CHECKOUT_ENABLED,false);assert.throws(beginLiveCheckout,/disabled/);delete process.env.CANOPY_LIVE_CHECKOUT});
test('runtime adapter cannot issue, transfer, or choose a debit amount',()=>{for(const c of [{action:'credit_receipt'},{action:'transfer'},{action:'reserve',runId:randomUUID(),sku:'treeforce89.continue.v1',amount:1},{action:'commit',reservationId:randomUUID()}])assert.throws(()=>validateCommand(c))});
test('server identity mapping is required, rather than a browser account string',()=>{const db={query(){throw Error('unexpected-query')}},runtime=runtimeLedger(db);assert.throws(()=>runtime.balance({accountId:randomUUID()}),/identity/);assert.throws(()=>runtime.balance({accountId:randomUUID(),authenticated:true,environment:'preview',identityMappingReviewed:true}),/identity/)});
test('runtime SQL uses parameters and serializes BIGINT values without rounding',async()=>{const accountId=randomUUID(),requestId=randomUUID();const db={query:async(sql,params)=>{assert.match(sql,/\$1::uuid/);assert.equal(params[0],accountId);assert.equal(params[1],requestId);return{rows:[{result:{amount:'9007199254740993'}}]}}};const r=await runtimeLedger(db).execute({authenticated:true,accountId,environment:'isolated-ledger',identityMappingReviewed:true},requestId,{action:'open_run',runId:randomUUID(),ruleset:'test'});assert.equal(r.amount,'9007199254740993')});
test('settlement worker reads saved terms; does not accept client evidence',async()=>{const f=fixture(),calls=[];const db={query:async(sql,params)=>{calls.push({sql,params});return{rows:[{result:sql.includes('get_order')?f.terms:{credited:'1100'}}]}}};const actor={authenticated:true,accountId:f.terms.accountId,environment:'isolated-ledger',identityMappingReviewed:true};const r=await settlementWorker(db,f.reader).settle(actor,randomUUID(),f.terms.orderId,digest,'0');assert.equal(r.credited,'1100');assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].params[3]).evidenceHash.length,64)});
test('bad payment never reaches the crediting query',async()=>{const f=fixture();f.tx.status='failed';let queries=0;const db={query:async()=>{queries++;return{rows:[{result:f.terms}]}}};await assert.rejects(settlementWorker(db,f.reader).settle({authenticated:true,accountId:f.terms.accountId,environment:'isolated-ledger',identityMappingReviewed:true},randomUUID(),f.terms.orderId,digest,'0'));assert.equal(queries,1)});
test('missing/empty/null run and reservation identifiers are rejected before DB access',()=>{for(const runId of [null,'',undefined])assert.throws(()=>validateCommand({action:'recover',runId}));for(const reservationId of [null,'',undefined])assert.throws(()=>validateCommand({action:'release',reservationId}));});
