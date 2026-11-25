import test from 'node:test';import assert from 'node:assert/strict';
import {createBnbReviewWallets} from '../scripts/multichain/browser/bnb-review-wallets.mjs';
import {createConnectedBnbReview} from '../scripts/multichain/browser/bnb-connected-review.mjs';
function fixture(){
 const listeners={},calls=[],account={address:'0x'+'b'.repeat(64),chains:['sui:mainnet'],features:['sui:signPersonalMessage']};
 let suiChanged;const f={account,calls,listeners,accounts:['0x'+'c'.repeat(40)],chain:'0x38',hook:async()=>{}};
 const wallet={accounts:[account],features:{'sui:signPersonalMessage':{signPersonalMessage:async input=>{calls.push(['sui',input]);await f.hook();return {signature:'YWJj'};}}}};
 f.sui={wallet,account,network:'sui:mainnet'};
 const provider={on:(name,fn)=>{listeners[name]=fn;},removeListener:name=>{delete listeners[name];},request:async input=>{calls.push(input);if(input.method==='eth_accounts')return f.accounts;if(input.method==='eth_chainId')return f.chain;if(input.method==='personal_sign'){await f.hook();return '0x'+'d'.repeat(130);}assert.fail(input.method);}};
 f.wallets=createBnbReviewWallets({getSui:()=>f.sui,subscribeSui:fn=>{suiChanged=fn;return()=>{suiChanged=null;};},provider});f.changeSui=()=>suiChanged();return f;
}
test('uses account-bound Sui personal message and UTF8 hex EIP1193 personal_sign only',async()=>{
 const f=fixture();await f.wallets.signSuiMessage({address:f.account.address,message:new TextEncoder().encode('link')});await f.wallets.signBnbMessage({address:f.accounts[0],message:'link ✓',chainId:56});
 assert.equal(f.calls.find(c=>Array.isArray(c))[1].account,f.account);assert.deepEqual(f.calls.find(c=>c.method==='personal_sign').params,['0x6c696e6b20e29c93',f.accounts[0]]);assert(f.calls.every(c=>Array.isArray(c)||['eth_accounts','eth_chainId','personal_sign'].includes(c.method)));
});
test('wrong network/account/permission rejects before any wallet signature',async()=>{
 for(const mutate of [f=>{f.chain='0x1';},f=>{f.accounts=[];},f=>{f.sui.network='sui:testnet';},f=>{f.account.features=[];},f=>{f.sui.wallet.accounts=[];}]){const f=fixture();mutate(f);await assert.rejects(f.wallets.signSuiMessage({address:f.account.address,message:new Uint8Array()}));assert(!f.calls.some(c=>Array.isArray(c)||c.method==='personal_sign'));}
});
test('account switch away/back during either prompt invalidates signature by epoch',async()=>{
 for(const chain of ['sui','bnb']){const f=fixture();f.hook=async()=>{if(chain==='sui')f.changeSui();else f.listeners.accountsChanged();};await assert.rejects(chain==='sui'?f.wallets.signSuiMessage({address:f.account.address,message:new Uint8Array()}):f.wallets.signBnbMessage({address:f.accounts[0],message:'link',chainId:56}));}
});
test('disconnection and teardown invalidate in-flight signatures and remove subscriptions',async()=>{
 const f=fixture();f.hook=async()=>f.wallets.destroy();await assert.rejects(f.wallets.signBnbMessage({address:f.accounts[0],message:'link',chainId:56}));assert.equal(Object.keys(f.listeners).length,0);await assert.rejects(f.wallets.snapshot());
});
function connected(f){const session={sessionToken:'a'.repeat(64),nativeRunId:'grove-'+'a'.repeat(32),epoch:'login',expiresAt:Date.now()+60000};const context={accountId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222',nativeRunId:session.nativeRunId,suiWallet:f.account.address,sequence:1,expiresAt:session.expiresAt,network:'sui:mainnet',paymentEnabled:false,restoreAuthorized:false};return {session,context,options:{getSession:()=>session,wallets:f.wallets,transport:{'bnb-context':async input=>{assert.deepEqual(input,{});return context;}}}};}
test('authenticated context assembles review without connection or signature requests',async()=>{const f=fixture(),c=connected(f),review=await createConnectedBnbReview(c.options);assert.equal(review.state().phase,'idle');assert(f.calls.every(c=>['eth_accounts','eth_chainId'].includes(c.method)));});
test('foreign context or replaced session cannot assemble a review',async()=>{
 for(const change of [c=>{c.context.nativeRunId='foreign';},c=>{c.context.suiWallet='0x'+'f'.repeat(64);},c=>{c.context.paymentEnabled=true;},c=>{c.options.transport['bnb-context']=async()=>{c.session.epoch='changed';return c.context;};}]){const f=fixture(),c=connected(f);change(c);await assert.rejects(createConnectedBnbReview(c.options));}
});
test('epoch change after preparation blocks challenge before transport',async()=>{const f=fixture(),c=connected(f);c.options.transport['bnb-challenge']=()=>assert.fail();const review=await createConnectedBnbReview(c.options);f.listeners.chainChanged();await assert.rejects(review.request());});
test('adapter signatures from disposable keys verify against the real server link verifier',async()=>{
 const {Ed25519Keypair}=await import('@mysten/sui/keypairs/ed25519');const {privateKeyToAccount}=await import('viem/accounts');const {continueLinkMessage,verifyContinueLink}=await import('../scripts/multichain/sui-bnb-continue.mjs');
 const sui=new Ed25519Keypair(),bnb=privateKeyToAccount('0x'+'67'.repeat(32));
 const account={address:sui.toSuiAddress(),chains:['sui:mainnet'],features:['sui:signPersonalMessage']};
 const wallet={accounts:[account],features:{'sui:signPersonalMessage':{signPersonalMessage:({message})=>sui.signPersonalMessage(message)}}};
 const adapters=createBnbReviewWallets({getSui:()=>({wallet,account,network:'sui:mainnet'}),subscribeSui:()=>()=>{},provider:{on(){},removeListener(){},async request({method,params}){if(method==='eth_accounts')return [bnb.address];if(method==='eth_chainId')return '0x38';assert.equal(method,'personal_sign');assert.equal(params[1],bnb.address.toLowerCase());return bnb.signMessage({message:{raw:params[0]}});}}});
 const row={suiWallet:account.address,payer:bnb.address.toLowerCase(),accountId:'11111111-1111-4111-8111-111111111111',deliveryProtocol:'tree-paid-delivery.v2',sessionHash:'a'.repeat(64),runId:'22222222-2222-4222-8222-222222222222',sequence:1,id:'b'.repeat(64),expiresAt:Date.now()+60000};const message=continueLinkMessage(row);
 const s=await adapters.signSuiMessage({address:account.address,message:new TextEncoder().encode(message)}),b=await adapters.signBnbMessage({address:row.payer,message,chainId:56});assert.equal(await verifyContinueLink(row,s,b),true);adapters.destroy();
});
