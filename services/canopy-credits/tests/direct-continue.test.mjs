import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECT_CONTINUE as P, commitment, createFixedContinueTerms, validateFixedContinueTerms } from '../continue-product.mjs';
import { createDirectContinueService } from '../direct-continue-service.mjs';
function fixture() {
  const actor = { authenticated: true, accountId: crypto.randomUUID(), wallet: { family: 'sui', address: '0x' + '1'.repeat(64) } };
  const flight = { accountId: actor.accountId, runId: crypto.randomUUID(), lives: 0, continuesUsed: 0, ruleset: 'treeforce89.v1', checkpointHash: 'a'.repeat(64) };
  const deployment = { network: P.network, packageId: '0x' + '3'.repeat(64), checkoutId: '0x' + '4'.repeat(64), keyEpoch: '1' };
  const config = { deployment, metadata: { network: P.network, coinType: P.coinType, decimals: 6 }, paymentsEnabled: true };
  const now = 1800000000000;
  return { actor, flight, config, now, terms: () => createFixedContinueTerms({ actor, flight, deployment, metadata: config.metadata, now }) };
}
test('direct terms bind one continue and 20,000 TREE with no credit or dollar fields', () => {
  const f = fixture(), t = f.terms(); assert.equal(t.requiredRaw, '20000000000'); assert.equal(t.restoreLives, 3); assert.equal(t.quantity, 1);
  for (const key of ['baseCC','bonusCC','totalCC','usdMicro','usdMicroPerTree','bonusBps']) assert.equal(Object.hasOwn(t,key), false);
});
for (const change of [{requiredRaw:'1'}, {recipient:'0x'+'5'.repeat(64)}, {decimals:9}, {quantity:10}, {restoreLives:5}, {coinType:'FAKE'}, {network:'sui:testnet'}, {product:'cc-topup'}]) {
  test('fixed policy rejects rehashed substitution '+Object.keys(change)[0], () => { const f = fixture(), { quoteHash, ...rest } = f.terms(); Object.assign(rest, change); assert.throws(() => validateFixedContinueTerms({ ...rest, quoteHash: commitment(rest) })); });
}
test('no price field can be slipped into direct terms', () => {
  const { quoteHash, ...t } = fixture().terms(); t.bonusCC = '100'; assert.throws(() => validateFixedContinueTerms({...t,quoteHash:commitment(t)}),/unexpected-direct-terms/);
});
for(const change of [{lives:1},{continuesUsed:1},{finished:true},{accountId:crypto.randomUUID()},{ruleset:'different-game'}])
  test('reject ineligible server flight '+Object.keys(change)[0],()=>{const f=fixture();Object.assign(f.flight,change);assert.throws(f.terms,/ineligible-flight/);});
test('metadata and Sui identity are required',()=>{const f=fixture();f.config.metadata.decimals=9;assert.throws(f.terms,/metadata/);f.config.metadata.decimals=6;f.actor.wallet.family='evm';assert.throws(f.terms,/sui-sign-in/);});
function serviceFixture() {
  const f=fixture(),rows=new Map(),receipts=new Map(); let chain=Promise.resolve(),active=null,paid=false,clock=f.now;
  const calls={quotes:0,verifies:0};
  const repository={
    transact(account,run,fn){const go=chain.then(async()=>{const key=account+':'+run;active={key,record:structuredClone(rows.get(key)||null),claims:new Map(receipts)};try{const out=await fn(structuredClone(active.record));if(active.record)rows.set(key,active.record);receipts.clear();for(const [k,v]of active.claims)receipts.set(k,v);return out;}finally{active=null;}});chain=go.catch(()=>{});return go;},
    async save(r){active.record=structuredClone(r);},
    async claimReceipt(id,order){if(active.claims.has(id)&&active.claims.get(id)!==order)throw Error('receipt-already-used');active.claims.set(id,order);},
  };
  const service=createDirectContinueService({repository,resolveFlight:async()=>f.flight,loadConfiguration:async()=>f.config,now:()=>clock,
    authorizeQuote:async()=>{calls.quotes++;return {quoteBase64:'test-only',signatureBase64:'test-only'};},
    verifyPayment:async (terms,digest)=>{calls.verifies++;if(!paid)throw Error('unverified-payment');const e={source:'chain-reader',status:'success',finalized:true,
      network:P.network,digest,eventIndex:'0',orderId:terms.orderId,accountId:terms.accountId,payer:terms.payer,recipient:P.recipient,
      coinType:P.coinType,amountRaw:P.requiredRaw,quoteHash:terms.quoteHash,checkoutId:terms.checkoutId,keyEpoch:terms.keyEpoch};return {...e,evidenceHash:commitment(e)};},
  });
  const call=(action,extra={})=>service(f.actor,{action,requestId:crypto.randomUUID(),runId:f.flight.runId,...extra});
  return {...f,calls,rows,receipts,call,service,pay(){paid=true;},advance(ms){clock+=ms;}};
}
test('concurrent order requests persist one order and one signature',async()=>{const f=serviceFixture(),r=await Promise.all([f.call('order'),f.call('order')]);assert.equal(r[0].order.orderId,r[1].order.orderId);assert.equal(f.calls.quotes,1);assert.equal(f.rows.size,1);});
test('unverified wallet hint cannot grant entitlement or delivery',async()=>{const f=serviceFixture(),o=(await f.call('order')).order;await assert.rejects(f.call('reconcile',{orderId:o.orderId,digest:'hint'}),/unverified/);await assert.rejects(f.call('deliver',{orderId:o.orderId,receiptId:'hint'}),/not-verified/);});
test('verified purchase reconciles and delivers idempotently without credit issuance',async()=>{const f=serviceFixture(),o=(await f.call('order')).order;f.pay();const a=await f.call('reconcile',{orderId:o.orderId,digest:'hint'});await f.call('reconcile',{orderId:o.orderId,digest:'hint'});assert.equal(f.calls.verifies,1);assert.equal(f.receipts.size,1);for(let n=0;n<2;n++)assert.equal((await f.call('deliver',{orderId:o.orderId,receiptId:a.authorization.receiptId})).status,'delivered');});
test('new purchases pause while recovery of paid order remains available',async()=>{const f=serviceFixture(),o=(await f.call('order')).order;f.config.paymentsEnabled=false;await assert.rejects(f.call('order'),/not-enabled/);f.pay();assert.equal((await f.call('reconcile',{orderId:o.orderId,digest:'hint'})).status,'verified');});
test('cancelled order remains recoverable if an already signed payment completes',async()=>{const f=serviceFixture(),o=(await f.call('order')).order;await f.call('cancel',{orderId:o.orderId});f.pay();assert.equal((await f.call('reconcile',{orderId:o.orderId,digest:'hint'})).status,'verified');});
test('unknown outcome never fabricates a receipt or a second order',async()=>{const f=serviceFixture(),o=(await f.call('order')).order;assert.equal((await f.call('reconcile',{orderId:o.orderId,digest:null})).status,'pending');assert.equal(f.receipts.size,0);assert.equal((await f.call('order')).order.orderId,o.orderId);});
test('expired quote stays in history; no silently replaced order',async()=>{const f=serviceFixture();await f.call('order');f.advance(45001);await assert.rejects(f.call('order'),/expired/);assert.equal(f.rows.size,1);});
test('order cannot be used by another account or a changed payer',async()=>{const f=serviceFixture(),o=(await f.call('order')).order;f.actor.wallet.address='0x'+'2'.repeat(64);await assert.rejects(f.call('reconcile',{orderId:o.orderId,digest:'hint'}),/owner/);});
test('caller cannot choose amount, credit count or verified status',async()=>{const f=serviceFixture();for(const extra of [{amountRaw:'1'},{lives:100},{status:'verified'},{baseCC:100}])await assert.rejects(f.call('order',extra),/invalid-command/);});
