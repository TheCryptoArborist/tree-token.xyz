import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createBnbCheckoutReview} from '../scripts/multichain/browser/bnb-checkout-review.mjs';
import {continueLinkMessage,CONTINUE_POLICY} from '../scripts/multichain/sui-bnb-continue.mjs';
function setup(){
 let now=100000,ctx={sessionToken:'a'.repeat(64),suiWallet:'0x'+'b'.repeat(64),payer:'0x'+'c'.repeat(40),accountId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',sequence:1,chainId:56,network:'sui:mainnet',epoch:'first',expiresAt:1000000};
 const calls=[],row={...ctx,id:'d'.repeat(64),sessionHash:createHash('sha256').update(ctx.sessionToken).digest('hex'),deliveryProtocol:'tree-paid-delivery.v2',expiresAt:now+300000};
 const c={id:row.id,message:continueLinkMessage(row),expiresAt:row.expiresAt,paymentEnabled:false,restoreAuthorized:false};
 const q={id:row.id,chainId:56,product:CONTINUE_POLICY.product,restoreLives:3,token:CONTINUE_POLICY.token,recipient:CONTINUE_POLICY.treasury,amount:CONTINUE_POLICY.amount,expiresAt:row.expiresAt,paymentEnabled:false,reviewOnly:true,restoreAuthorized:false,continueAuthorized:false,gameplayAuthorized:false};
 const options={getContext:()=>ctx,clock:()=>now,transport:{'bnb-challenge':async input=>{calls.push(['challenge',input]);return c;},'bnb-open':async input=>{calls.push(['open',input]);return q;}},signSuiMessage:async input=>{calls.push(['sui',input]);return 'YWJj';},signBnbMessage:async input=>{calls.push(['bnb',input]);return '0x'+'e'.repeat(130);}};
 return {options,c,q,calls,ctx,advance:()=>{now=row.expiresAt;},create:()=>createBnbCheckoutReview(options)};
}
async function signed(r){await r.request();await r.signSui();await r.signBnb();}
test('explicit ordered signatures match the displayed server message; review never sends funds',async()=>{
 const f=setup(),r=f.create();await signed(r);await r.review();assert.equal(r.state().phase,'reviewed');assert.equal(r.state().quote.amount,'1 USDT');assert.deepEqual(f.calls.map(c=>c[0]),['challenge','sui','bnb','open']);assert.equal(new TextDecoder().decode(f.calls[1][1].message),f.c.message);assert.equal(f.calls[2][1].message,f.c.message);assert(!JSON.stringify(r.state()).includes('YWJj'));await assert.rejects(r.review());assert.equal(f.calls.length,4);
});
test('reject altered link wallet, protocol, nonce, purpose before signing',async()=>{
 for(const edit of [s=>s.replace('tree-paid-delivery.v2','tree-paid-delivery.v1'),s=>s+'\nextra',s=>s.replace('BNB wallet:','Other wallet:'),s=>s.replace('1 USDT','25 USDT')]){const f=setup();f.c.message=edit(f.c.message);const r=f.create();await assert.rejects(r.request());await assert.rejects(r.signSui());assert.equal(f.calls.length,1);}
});
test('wallet/session/run/chain changes invalidate signing',async()=>{
 for(const [key,value] of [['payer','0x'+'f'.repeat(40)],['suiWallet','0x'+'f'.repeat(64)],['epoch','changed'],['runId','33333333-3333-4333-8333-333333333333'],['chainId',1]]){const f=setup(),r=f.create();await r.request();f.ctx[key]=value;await assert.rejects(r.signSui());assert.equal(f.calls.length,1);}
});
test('wallet change while signing discards signature and prevents next wallet prompt',async()=>{
 const f=setup();f.options.signSuiMessage=async()=>{f.ctx.epoch='changed';return 'YWJj';};const r=f.create();await r.request();await assert.rejects(r.signSui());await assert.rejects(r.signBnb());assert.equal(r.state().phase,'challenge');
});
test('rejected signature remains retryable by explicit click without second wallet prompt',async()=>{
 const f=setup();f.options.signSuiMessage=async()=>{throw Error('private wallet error');};const r=f.create();await r.request();await assert.rejects(r.signSui());assert.equal(r.state().phase,'challenge');assert.equal(r.state().busy,false);assert.equal(f.calls.length,1);
});
test('expiry and disposal deny signing and verification',async()=>{
 for(const dispose of [false,true]){const f=setup(),r=f.create();await signed(r);if(dispose)r.destroy();else f.advance();await assert.rejects(r.review());assert.equal(f.calls.length,3);}
});
test('lost verification response is uncertain and cannot retry/open another challenge',async()=>{
 const f=setup();f.options.transport['bnb-open']=async()=>{throw Error('lost');};const r=f.create();await signed(r);await assert.rejects(r.review());assert.equal(r.state().phase,'uncertain');await assert.rejects(r.review());await assert.rejects(r.request());
});
test('altered price, recipient, or permission flags cannot become a reviewed quote',async()=>{
 for(const patch of [{amount:'2'},{recipient:'0x'+'f'.repeat(40)},{paymentEnabled:true},{gameplayAuthorized:true},{chainId:1}]){const f=setup();Object.assign(f.q,patch);const r=f.create();await signed(r);await assert.rejects(r.review());assert.equal(r.state().quote,null);}
});
test('double click and teardown during a pending request never prompt wallet',async()=>{
 const f=setup();let release;f.options.transport['bnb-challenge']=()=>new Promise(resolve=>{release=()=>resolve(f.c);});const r=f.create(),pending=r.request();await assert.rejects(r.request());r.destroy();release();await assert.rejects(pending);assert.equal(r.state().phase,'disposed');assert.equal(f.calls.length,0);
});
