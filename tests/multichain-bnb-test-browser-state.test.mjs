import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {issueBnbChallenge,BNB_IDENTITY_SCOPE} from '../scripts/multichain/bnb-game-access-core.mjs';

// Runs the actual browser module with a synthetic provider and API. No keys,
// browser extension, real cookie, HTTP request or on-chain action is involved.
const source=fs.readFileSync(new URL('../play/multichaintest/game/bnb/app.js',import.meta.url),'utf8');
const A='0x'+'a1'.repeat(20),B='0x'+'b2'.repeat(20);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const response=(body,status=200)=>({status,ok:status>=200&&status<300,json:async()=>body});
function fixture({installed=true,chain='0x38'}={}){
  const nodes=new Map();
  for(const id of ['connect','sign','logout','status-button','access','status','wallet','result']){
    nodes.set(id,{disabled:false,textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}});
  }
  const state={chain,account:A,active:false,reject:false,holdSign:null,holdAction:null,entered:null,gate:null,calls:[],api:[],message:null};
  const listeners=new Map();
  const provider={
    on(event,fn){const set=listeners.get(event)||new Set();set.add(fn);listeners.set(event,set);},
    removeListener(event,fn){listeners.get(event)?.delete(fn);},
    async request(request){
      state.calls.push(request);
      if(request.method==='eth_chainId')return state.chain;
      if(request.method==='eth_accounts'||request.method==='eth_requestAccounts')return [state.account];
      if(request.method==='personal_sign'){
        if(state.reject){const error=Error('User rejected the signature');error.code=4001;throw error;}
        if(state.holdSign){state.entered.resolve();await state.holdSign.promise;}
        return '0x'+'12'.repeat(65);
      }
      throw Error('Unexpected wallet action '+request.method);
    }
  };
  const window={};if(installed)window.ethereum=provider;
  const context=vm.createContext({window,document:{getElementById:id=>nodes.get(id)},TextEncoder,
    fetch:async(url,request)=>{
      assert.equal(url,'/api/arcade-bnb-test');assert.equal(request.method,'POST');
      assert.equal(request.credentials,'same-origin');assert.equal(request.cache,'no-store');
      const body=JSON.parse(request.body);state.api.push(body);
      if(body.action===state.holdAction){state.entered.resolve();await state.gate.promise;}
      if(body.action==='challenge'){
        const {record,message}=issueBnbChallenge({wallet:body.wallet,nonce:'ab'.repeat(32)});state.message=message;
        return response({wallet:record.address,message,nonce:record.nonce,chainId:56,scope:BNB_IDENTITY_SCOPE,gameplayAuthorized:false});
      }
      if(body.action==='sign-in'){
        state.active=true;return response({wallet:body.wallet,authenticated:true,chainId:56,scope:BNB_IDENTITY_SCOPE,gameplayAuthorized:false});
      }
      if(body.action==='logout'){state.active=false;return response({signedOut:true,gameplayAuthorized:false});}
      if(!state.active)return response({error:'invalid-session',gameplayAuthorized:false},401);
      if(body.action==='status')return response({wallet:A,authenticated:true,chainId:56,scope:BNB_IDENTITY_SCOPE,gameplayAuthorized:false});
      if(body.action==='entitlement')return response({reason:'production-backed-pass-not-enabled',gameplayAuthorized:false},403);
      throw Error('Unexpected API action '+body.action);
    }
  });
  vm.runInContext(source,context);
  return {
    state,node:id=>nodes.get(id),click:id=>nodes.get(id).listeners.click(),
    install(){window.ethereum=provider;},
    emit(event,value){
      if(event==='accountsChanged')state.account=value[0];
      if(event==='chainChanged')state.chain=value;
      for(const fn of listeners.get(event)||[])fn(value);
    },
    hold(action){state.holdAction=action;state.entered=deferred();state.gate=deferred();return {entered:state.entered.promise,release:()=>state.gate.resolve()};},
    holdSignature(){state.holdSign=deferred();state.entered=deferred();return {entered:state.entered.promise,release:()=>state.holdSign.resolve()};}
  };
}

test('successful sign-in uses only personal_sign with the exact server message and isolated endpoint',async()=>{
  const f=fixture();assert(f.node('sign').disabled);assert(f.node('access').disabled);
  await f.click('connect');await f.click('sign');
  const calls=f.state.calls.filter(x=>x.method==='personal_sign');assert.equal(calls.length,1);
  assert.equal(calls[0].params[1],A);assert.equal(Buffer.from(calls[0].params[0].slice(2),'hex').toString(),f.state.message);
  assert.match(f.node('status').textContent,/BNB sign-in verified/);assert(!f.node('access').disabled);
  await f.click('access');assert.match(f.node('result').textContent,/production-backed-pass-not-enabled/);
  await f.click('logout');assert(f.node('access').disabled);
  assert(f.state.calls.every(x=>['eth_chainId','eth_accounts','eth_requestAccounts','personal_sign'].includes(x.method)));
});

test('status401 clears previous authentication and explains absence of a test session',async()=>{
  const f=fixture();await f.click('connect');await f.click('sign');assert(!f.node('access').disabled);
  f.state.active=false;await f.click('status-button');
  assert(f.node('access').disabled);assert.match(f.node('status').textContent,/No BNB test session/);
});

for(const event of ['accountsChanged','chainChanged'])test(event+' during sign-in POST cannot restore stale authentication',async()=>{
  const f=fixture();await f.click('connect');const pending=f.hold('sign-in');
  const signing=f.click('sign');await pending.entered;
  f.emit(event,event==='accountsChanged'?[B]:'0x1');pending.release();await signing;
  assert(f.node('access').disabled);assert(f.node('sign').disabled);
  assert.equal(f.node('wallet').textContent,'No BNB wallet selected.');
  assert.match(f.node('status').textContent,/Wallet changed/);assert.doesNotMatch(f.node('status').textContent,/BNB sign-in verified/);
});

test('account change during challenge lookup never opens personal_sign',async()=>{
  const f=fixture();await f.click('connect');const pending=f.hold('challenge');
  const signing=f.click('sign');await pending.entered;f.emit('accountsChanged',[B]);pending.release();await signing;
  assert.equal(f.state.calls.filter(x=>x.method==='personal_sign').length,0);
  assert.equal(f.state.api.filter(x=>x.action==='sign-in').length,0);assert(f.node('access').disabled);
});

test('chain change during signature prompt never submits the returned proof',async()=>{
  const f=fixture();await f.click('connect');const pending=f.holdSignature();
  const signing=f.click('sign');await pending.entered;f.emit('chainChanged','0x1');pending.release();await signing;
  assert.equal(f.state.api.filter(x=>x.action==='sign-in').length,0);assert(f.node('access').disabled);
});

test('explicit signature rejection leaves no authenticated UI or server request',async()=>{
  const f=fixture();await f.click('connect');f.state.reject=true;await f.click('sign');
  assert.match(f.node('status').textContent,/User rejected/);assert(!f.node('sign').disabled);assert(f.node('access').disabled);
  assert.equal(f.state.api.filter(x=>x.action==='sign-in').length,0);
});

test('late provider injection still binds account-change listeners',async()=>{
  const f=fixture({installed:false});await f.click('connect');assert.match(f.node('status').textContent,/No EVM wallet detected/);
  f.install();await f.click('connect');assert(!f.node('sign').disabled);
  f.emit('accountsChanged',[B]);assert(f.node('sign').disabled);assert(f.node('access').disabled);
});

test('wrong network never requests accounts, a signature or automatic switching',async()=>{
  const f=fixture({chain:'0x1'});await f.click('connect');assert.match(f.node('status').textContent,/Select BNB Smart Chain/);
  assert(f.node('sign').disabled);assert.deepEqual(f.state.calls.map(x=>x.method),['eth_chainId']);assert.equal(f.state.api.length,0);
});

test('wallet change while status is pending cannot restore stale authentication',async()=>{
  const f=fixture();await f.click('connect');await f.click('sign');const pending=f.hold('status');
  const checking=f.click('status-button');await pending.entered;f.emit('accountsChanged',[B]);pending.release();await checking;
  assert(f.node('access').disabled);assert.match(f.node('status').textContent,/Wallet changed while checking/);
});
