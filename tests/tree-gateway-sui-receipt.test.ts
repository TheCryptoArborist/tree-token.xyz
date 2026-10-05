import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewSuiReceipt, verifyRocketXSuiReceipt } from '../netlify/lib/gateway-sui-receipt.ts';
const expected={digest:'A'.repeat(44),recipient:'0x'+'2'.repeat(64),amountRaw:'60000000001',orderCreatedAt:1000};
const fixture=()=>({data:{chainIdentifier:'4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S',transaction:{digest:expected.digest,effects:{status:'SUCCESS',timestamp:new Date(2000).toISOString(),checkpoint:{sequenceNumber:100},balanceChanges:{pageInfo:{hasNextPage:false},nodes:[{owner:{address:expected.recipient},coinType:{repr:'0x'+'0'.repeat(63)+'2::sui::SUI'},amount:expected.amountRaw}]}}}}});
test('receipt requires finalized Mainnet success, exact native SUI credit and order time; no floating-point arithmetic',()=>{
 assert.equal(reviewSuiReceipt(fixture(),expected,3000).deliveryVerified,true);
 for(const mutate of [p=>p.errors=[{}],p=>p.data.chainIdentifier='testnet',p=>p.data.transaction=null,p=>p.data.transaction.digest='B'.repeat(44),p=>p.data.transaction.effects.status='FAILURE',p=>p.data.transaction.effects.checkpoint=null,p=>p.data.transaction.effects.timestamp=new Date(999).toISOString(),p=>p.data.transaction.effects.timestamp=new Date(4000).toISOString(),p=>p.data.transaction.effects.balanceChanges.pageInfo.hasNextPage=true,p=>p.data.transaction.effects.balanceChanges.nodes[0].owner.address='0x'+'3'.repeat(64),p=>p.data.transaction.effects.balanceChanges.nodes[0].coinType.repr='0x3::sui::SUI',p=>p.data.transaction.effects.balanceChanges.nodes[0].amount='60000000000',p=>p.data.transaction.effects.balanceChanges.nodes[0].amount='-60000000001',p=>p.data.transaction.effects.balanceChanges.nodes.push(p.data.transaction.effects.balanceChanges.nodes[0])]){const p:any=fixture();mutate(p);assert.equal(reviewSuiReceipt(p,expected,3000).deliveryVerified,false);}
});
test('provider adapter reads only the fixed Mainnet endpoint after validating the bound payout; failures never claim delivery',async()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/rocketx-unfunded-response-shape.json',import.meta.url),'utf8'));
 const b={...f.binding,orderCreatedAt:1000}, status={...f.status,status:'success',subState:'withdraw_success',destinationTransactionHash:expected.digest,actualAmount:'60.000000001'};
 let calls=0;
 const fetcher=async(url,opts)=>{calls++;assert.equal(url,'https://graphql.mainnet.sui.io/graphql');assert.equal(opts.redirect,'error');const body=JSON.parse(opts.body);assert.match(body.query,/^query /);assert.deepEqual(body.variables,{digest:expected.digest});return Response.json(fixture());};
 assert.equal((await verifyRocketXSuiReceipt(status,b,fetcher,3000)).deliveryVerified,true);
 for(const s of [f.status,{...status,requestId:'wrong'},{...status,actualAmount:'60.0000000001'},{...status,destinationAddress:'0x'+'4'.repeat(64)}])assert.equal((await verifyRocketXSuiReceipt(s,b,fetcher,3000)).deliveryVerified,false);
 assert.equal(calls,1);
 assert.equal((await verifyRocketXSuiReceipt(status,b,async()=>{throw Error('timeout')},3000)).deliveryVerified,false);
 assert.equal((await verifyRocketXSuiReceipt(status,b,async()=>Response.json({errors:[{}]}),3000)).deliveryVerified,false);
});
