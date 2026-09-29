import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewRocketXOrderPair, reviewRocketXRecovery } from '../netlify/lib/gateway-rocketx-review.ts';
const load = () => JSON.parse(readFileSync(new URL('./fixtures/rocketx-unfunded-response-shape.json', import.meta.url), 'utf8'));
test('matching order responses never imply verified expiry, refund handling or payment readiness', () => {
 const {order,status,binding}=load();
 const result=reviewRocketXOrderPair(order,status,binding);
 assert.equal(result.checksPassed,true);
 assert.equal(result.recovery.fundingReady,false);
 for(const fields of [{},{expiresAt:Date.now()+3600000},{initiatedAt:new Date().toISOString(),estTimeInSeconds:{avg:300}},{depositDeadline:Date.now()+3600000,refundAddress:binding.sourceAddress}]){
  const r=reviewRocketXRecovery({...status,...fields},binding);
  assert.equal(r.depositDeadline,null);
  assert.equal(r.refundAddressVerified,false);
  assert.equal(r.action,'hold-payment');
  assert.deepEqual(r.blockers,['deposit-deadline-unverified','refund-handling-unverified']);
 }
});
test('failed, expired, uncertain and progressing orders never suggest resending or promise refunds',()=>{
 const {status,binding}=load();
 for(const [state,subState,action] of [['failed','pending','review-with-provider'],['pending','invalid','review-with-provider'],['refunded','refunded','reconcile-existing-order'],['pending','unrecognized','reconcile-existing-order'],['pending','approved','track-existing-order'],['pending','withdrawal','track-existing-order'],['success','withdraw_success','track-existing-order']]){
  const r=reviewRocketXRecovery({...status,status:state,subState,destinationTransactionHash:'A'.repeat(44)},binding);
  assert.equal(r.action,action); assert.equal(r.canResend,false); assert.equal(r.canCreateReplacement,false);
  assert.equal(r.refundVerified,false); assert.equal(r.automaticRefundAvailable,false); assert.equal(r.executionEnabled,false);
 }
 assert.throws(()=>reviewRocketXRecovery({...status,requestId:'other'},binding));
 assert.throws(()=>reviewRocketXRecovery({...status,originTokenAmount:'0.09'},binding));
 assert.throws(()=>reviewRocketXRecovery({...status,originTokenAmount:'0.11'},binding));
});
