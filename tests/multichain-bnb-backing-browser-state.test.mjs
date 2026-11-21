import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {issueBnbChallenge,BNB_IDENTITY_SCOPE} from '../scripts/multichain/bnb-game-access-core.mjs';

const source=fs.readFileSync(new URL('../play/multichaintest/game/bnb/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../play/multichaintest/game/bnb/index.html',import.meta.url),'utf8');
const A='0x'+'a1'.repeat(20),B='0x'+'b2'.repeat(20);
const NFT='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const response=(body,status=200)=>({status,ok:status>=200&&status<300,json:async()=>body});
const report=()=>({schemaVersion:1,mode:'original-one-slot-diagnostic',checkedAt:new Date().toISOString(),
  inspectedWallet:A,gameplayAuthorized:false,productionReady:false,classification:'trial-retired',
  blockers:['production-backing-registry-not-approved','retired-one-slot-trial'],
  backing:{nftId:NFT,sourceCustodyConfirmed:false,lifecycle:'released'},
  bnb:{chainId:56,blockNumber:'100',blockHash:'0x'+'11'.repeat(32),finality:'finalized',
    passState:'Retired',passStateCode:4,owner:null,ownerMatches:false,canPlay:false},
  sui:{checkpoint:{sequenceNumber:'200'}}});
const denied=backingCheck=>response({reason:'production-backed-pass-not-enabled',gameplayAuthorized:false,backingCheck},403);

// Runs the actual browser module. Provider signatures and every API response
// are synthetic; no extension, network request, real key or cookie is used.
function fixture(){
  const nodes=new Map();
  for(const id of ['connect','sign','logout','status-button','access','status','wallet','result','start-game']){
    const node={disabled:id==='start-game',textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}};
    Object.defineProperty(node,'innerHTML',{set(){throw Error('Server content must never be assigned as HTML');}});
    nodes.set(id,node);
  }
  const state={account:A,chain:'0x38',active:false,sessionWallet:A,calls:[],api:[],reply:()=>denied(report()),hold:null};
  const listeners=new Map();
  const provider={
    on(event,fn){const set=listeners.get(event)||new Set();set.add(fn);listeners.set(event,set);},
    removeListener(event,fn){listeners.get(event)?.delete(fn);},
    async request(request){
      state.calls.push(request);
      if(request.method==='eth_chainId')return state.chain;
      if(request.method==='eth_accounts'||request.method==='eth_requestAccounts')return [state.account];
      if(request.method==='personal_sign')return '0x'+'12'.repeat(65);
      throw Error('Unexpected wallet action');
    },
  };
  const context=vm.createContext({window:{ethereum:provider},document:{getElementById:id=>nodes.get(id)},TextEncoder,
    fetch:async(url,request)=>{
      assert.equal(url,'/api/arcade-bnb-test');assert.equal(request.method,'POST');
      assert.equal(request.credentials,'same-origin');assert.equal(request.cache,'no-store');
      const body=JSON.parse(request.body);state.api.push(body);
      if(state.hold?.action===body.action){state.hold.entered.resolve();await state.hold.gate.promise;}
      if(body.action==='challenge'){
        const {record,message}=issueBnbChallenge({wallet:body.wallet,nonce:'ab'.repeat(32)});
        return response({wallet:record.address,message,nonce:record.nonce,chainId:56,scope:BNB_IDENTITY_SCOPE,gameplayAuthorized:false});
      }
      if(body.action==='sign-in'){
        state.active=true;state.sessionWallet=body.wallet;
        return response({wallet:body.wallet,authenticated:true,chainId:56,scope:BNB_IDENTITY_SCOPE,gameplayAuthorized:false});
      }
      if(body.action==='logout'){state.active=false;return response({signedOut:true,gameplayAuthorized:false});}
      if(!state.active)return response({error:'invalid-session',gameplayAuthorized:false},401);
      if(body.action==='status')return response({wallet:state.sessionWallet,authenticated:true,chainId:56,scope:BNB_IDENTITY_SCOPE,gameplayAuthorized:false});
      if(body.action==='entitlement')return state.reply();
      throw Error('Unexpected mocked API action');
    },
  });
  vm.runInContext(source,context);
  const click=id=>nodes.get(id).listeners.click();
  return {state,node:id=>nodes.get(id),click,
    async signIn(){await click('connect');await click('sign');},
    emit(event,value){
      if(event==='accountsChanged')state.account=value[0];
      if(event==='chainChanged')state.chain=value;
      for(const fn of listeners.get(event)||[])fn(value);
    },
    hold(action){state.hold={action,entered:deferred(),gate:deferred()};
      return {entered:state.hold.entered.promise,release:()=>state.hold.gate.resolve()};},
  };
}

test('retired trial report uses plain scoped copy and requests no additional wallet operation',async()=>{
  const f=fixture();await f.signIn();const walletCalls=f.state.calls.length;
  await f.click('access');
  assert.match(f.node('result').textContent,/BNB trial pass is retired/);
  assert.match(f.node('result').textContent,/Original NFTree #2720 was released on Sui/);
  assert.match(f.node('result').textContent,/new approved pass backed by an original NFT/);
  assert.match(f.node('result').textContent,/Checked .* UTC/);
  assert.match(f.node('result').textContent,/covers the #2720 trial only/);
  assert.doesNotMatch(f.node('result').textContent,/production-backed-pass-not-enabled/);
  assert.equal(f.state.calls.length,walletCalls);
  assert.deepEqual(f.state.api.at(-1),{action:'entitlement'});
  assert(f.node('start-game').disabled);
});

test('even an active backed trial report cannot enable gameplay',async()=>{
  const f=fixture();await f.signIn();
  f.state.reply=()=>{const r=report();r.classification='trial-active-backed';r.backing.lifecycle='held';r.backing.sourceCustodyConfirmed=true;
    Object.assign(r.bnb,{passState:'Active',passStateCode:2,owner:A,ownerMatches:true,canPlay:true});return denied(r);};
  await f.click('access');
  assert.match(f.node('result').textContent,/trial does not grant BNB game access/);
  assert(f.node('start-game').disabled);
});

test('wrong-wallet, wrong-NFT, altered permissions and contradictory reports are rejected',async()=>{
  const mutations=[r=>{r.inspectedWallet=B;},r=>{r.backing.nftId='0x'+'ff'.repeat(32);},
    r=>{r.gameplayAuthorized=true;},r=>{r.productionReady=true;},r=>{r.bnb.chainId=1;},
    r=>{r.bnb.finality='latest';},r=>{r.mode='wallet-wide-eligibility';},r=>{r.schemaVersion=2;},
    r=>{r.backing.sourceCustodyConfirmed=true;},r=>{r.bnb.passState='Active';},r=>{r.blockers=[];}];
  for(const mutate of mutations){
    const f=fixture();await f.signIn();f.state.reply=()=>{const r=report();mutate(r);return denied(r);};
    await f.click('access');assert.match(f.node('result').textContent,/Unable to verify/);assert(f.node('start-game').disabled);
  }
});

test('invalid, stale and far-future report timestamps are rejected',async()=>{
  for(const checkedAt of ['not-a-date',new Date(Date.now()-61_000).toISOString(),new Date(Date.now()+60_000).toISOString()]){
    const f=fixture();await f.signIn();f.state.reply=()=>denied({...report(),checkedAt});
    await f.click('access');assert.match(f.node('result').textContent,/Unable to verify/);assert(f.node('start-game').disabled);
  }
});

test('a restored session accepts only its authenticated wallet even with no wallet connection',async()=>{
  const f=fixture();f.state.active=true;await f.click('status-button');
  assert.equal(f.node('wallet').textContent,'No BNB wallet selected.');
  await f.click('access');assert.match(f.node('result').textContent,/trial pass is retired/);
  f.state.reply=()=>denied({...report(),inspectedWallet:B});
  await f.click('access');assert.match(f.node('result').textContent,/Unable to verify/);
});

for(const event of ['accountsChanged','chainChanged'])test(event+' invalidates an in-flight backing report',async()=>{
  const f=fixture();await f.signIn();const pending=f.hold('entitlement');
  const checking=f.click('access');await pending.entered;
  f.emit(event,event==='accountsChanged'?[B]:'0x1');pending.release();await checking;
  assert.match(f.node('result').textContent,/Wallet or network changed/);
  assert.doesNotMatch(f.node('result').textContent,/Checked |trial pass is retired/);
  assert(f.node('access').disabled);assert(f.node('start-game').disabled);
});

test('a late401 from the prior wallet cannot overwrite the wallet-change message',async()=>{
  const f=fixture();await f.signIn();const pending=f.hold('entitlement');
  const checking=f.click('access');await pending.entered;
  f.emit('accountsChanged',[B]);f.state.active=false;pending.release();await checking;
  assert.match(f.node('status').textContent,/Wallet or network changed/);
  assert.match(f.node('result').textContent,/Wallet or network changed/);assert(f.node('access').disabled);
});

test('signing out clears the previous trial result and keeps gameplay disabled',async()=>{
  const f=fixture();await f.signIn();await f.click('access');await f.click('logout');
  assert.doesNotMatch(f.node('result').textContent,/Checked |trial pass is retired/);
  assert.match(f.node('result').textContent,/Sign in or check your session/);
  assert(f.node('access').disabled);assert(f.node('start-game').disabled);
});

for(const action of ['status-button','access'])test(action+'401 clears prior backing and session state',async()=>{
  const f=fixture();await f.signIn();await f.click('access');f.state.active=false;
  await f.click(action);
  assert.match(f.node('status').textContent,/No BNB test session/);
  assert.match(f.node('result').textContent,/Sign in again/);
  assert.doesNotMatch(f.node('result').textContent,/Checked |trial pass is retired/);assert(f.node('access').disabled);
});

test('network and RPC failures show a retryable check failure without rendering server messages',async()=>{
  for(const reply of [()=>{throw Error('private upstream details');},
    ()=>response({error:'<img src=x onerror=alert(1)>',gameplayAuthorized:false},503),
    ()=>response({gameplayAuthorized:true,backingCheck:report()},200),
    ()=>denied(null)]){
    const f=fixture();await f.signIn();f.state.reply=reply;await f.click('access');
    assert.match(f.node('result').textContent,/Unable to verify.*Try again shortly/);
    assert.doesNotMatch(f.node('result').textContent,/upstream|img|alert/);assert(f.node('start-game').disabled);
  }
});

test('the previous deployment denial remains compatible without a structured backing report',async()=>{
  const f=fixture();await f.signIn();
  f.state.reply=()=>response({reason:'production-backed-pass-not-enabled',gameplayAuthorized:false},403);
  await f.click('access');assert.equal(f.node('result').textContent,'No gameplay access: production-backed-pass-not-enabled.');
  assert(f.node('start-game').disabled);
});

test('page keeps the trial scope explicit and the gameplay control permanently disabled',()=>{
  assert.match(html,/Original NFTree #2720 trial/);
  assert.match(html,/not every NFT or pass in your wallet/);
  assert.match(html,/<button id="start-game"[^>]* disabled>Start BNB game \(not enabled\)<\/button>/);
  assert.match(html,/id="result"[^>]*aria-live="polite"/);
});
