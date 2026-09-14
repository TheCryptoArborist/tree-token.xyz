/** Actual codec + mainnet normalizer + existing payment verifier. RPC/coins are fixtures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAINNET, createMainnetReader } from '../../../mainnet-reader.mjs';
import { verifyFromReader } from '../../../mainnet-payment.mjs';
import { Purchase, createCheckoutReceiptCodec } from '../codec.mjs';
import { buildCheckoutForReview } from '../builder.mjs';
import { fixture, now, addr } from './fixture.mjs';
const D=MAINNET.genesisDigest;
const stamp=ms=>({seconds:BigInt(Math.floor(ms/1000)),nanos:(ms%1000)*1000000});
function chainFixture({checkpointTime=now,paidTime=now,withoutCodec=false}={}) {
  const f=fixture();f.purchase.paid_at_ms=String(paidTime);
  const tx={digest:D,checkpoint:1n,timestamp:stamp(checkpointTime),transaction:{sender:f.terms.payer},
    effects:{digest:D,transactionDigest:D,status:{success:true},eventsDigest:D},
    events:{digest:D,events:[{packageId:f.deployment.packageId,sender:f.terms.payer,eventType:f.terms.eventType,
      contents:{value:Purchase.serialize(f.purchase).toBytes()}}]},
    balanceChanges:[{address:f.terms.payer,coinType:f.terms.coinType,amount:'-'+f.terms.requiredRaw},
      {address:f.terms.recipient,coinType:f.terms.coinType,amount:f.terms.requiredRaw}]};
  const cp={sequenceNumber:1n,digest:D,summary:{timestamp:stamp(checkpointTime),contentDigest:D},contents:{digest:D,transactions:[{transaction:D,effects:D}]}};
  const reader=createMainnetReader({
    getServiceInfo:async()=>({response:{chain:'mainnet',chainId:D,checkpointHeight:1n,timestamp:stamp(checkpointTime)}}),
    getCoinInfo:async()=>{throw Error('unused-metadata')},getTransaction:async()=>({response:{transaction:tx}}),
    getCheckpoint:async()=>({response:{checkpoint:cp}}),
  },{now:()=>checkpointTime,decodeReceipt:withoutCodec?null:createCheckoutReceiptCodec(f.deployment)});
  return {...f,tx,reader};
}
test('exact compiled-contract receipt schema flows through reader and verifier',async()=>{const f=chainFixture(),e=await verifyFromReader(f.terms,D,'0',f.reader);assert.equal(e.orderId,f.terms.orderId);assert.equal(e.checkoutId,f.deployment.checkoutId);assert.equal(e.timestampMs,now);assert.equal(e.checkpointTimestampMs,now);assert.equal(e.paymentTimeSource,'checkout-clock')});
test('a late checkpoint does not reject execution within the signed quote window',async()=>{const expires=fixture().terms.expiresAtMs,f=chainFixture({checkpointTime:expires+2000,paidTime:expires});const e=await verifyFromReader(f.terms,D,'0',f.reader);assert.equal(e.timestampMs,expires);assert.equal(e.checkpointTimestampMs,expires+2000)});
test('actual late execution still fails',async()=>{const expires=fixture().terms.expiresAtMs,f=chainFixture({checkpointTime:expires+2000,paidTime:expires+1});await assert.rejects(verifyFromReader(f.terms,D,'0',f.reader),/window/)});
test('receipt cannot change the stored quote window while reusing the commitment',async()=>{const f=chainFixture();f.purchase.issued_at_ms=String(now);f.tx.events.events[0].contents.value=Purchase.serialize(f.purchase).toBytes();await assert.rejects(verifyFromReader(f.terms,D,'0',f.reader),/order-window/)});
test('payment timestamp cannot be after its checkpoint',async()=>{const f=chainFixture({paidTime:now+1});await assert.rejects(verifyFromReader(f.terms,D,'0',f.reader),/after-checkpoint/)});
test('missing codec, failed effects and mismatched received funds cannot credit',async()=>{let f=chainFixture({withoutCodec:true});await assert.rejects(verifyFromReader(f.terms,D,'0',f.reader),/fields/);f=chainFixture();f.tx.effects.status.success=false;await assert.rejects(verifyFromReader(f.terms,D,'0',f.reader),/unsuccessful/);f=chainFixture();f.tx.balanceChanges[1].amount='1';await assert.rejects(verifyFromReader(f.terms,D,'0',f.reader),/effects/)});
test('caller mutation during async build does not alter signed transaction summary',async()=>{const f=fixture();const build=buildCheckoutForReview(f.args,now);f.args.terms.totalCC='999999';f.args.terms.payer=addr(8);const r=await build;assert.equal(r.summary.totalCC,'1100');assert.equal(r.summary.payer,r.transaction.getData().sender)});
test('codec snapshots deployment identity rather than following mutable caller settings',()=>{const f=fixture(),codec=createCheckoutReceiptCodec(f.deployment);f.deployment.checkoutId=addr(8);assert.equal(codec.decode(f.event).checkoutId,fixture().deployment.checkoutId)});
