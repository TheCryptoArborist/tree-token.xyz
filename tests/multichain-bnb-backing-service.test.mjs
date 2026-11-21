import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBnbTestHandler, COOKIE, PATH } from '../scripts/multichain/bnb-test-auth-service.mjs';
import { BNB_ORIGIN, BNB_IDENTITY_SCOPE } from '../scripts/multichain/bnb-game-access-core.mjs';

const NOW=Date.parse('2026-11-21T15:30:00.000Z');
const wallet='0x'+'11'.repeat(20);
const token='bnbtest_'+'12'.repeat(32); // Offline session fixture, never a live credential.
const tokenHash=createHash('sha256').update(token).digest('hex');
function fixture({inspect}={}){
  const state={now:NOW,reads:0,inspections:0,session:{
    authenticated:true,revoked:false,wallet,chainId:56,origin:BNB_ORIGIN,
    scope:BNB_IDENTITY_SCOPE,expiresAt:new Date(NOW+3590000).toISOString(),
  }};
  const proof=()=>({schemaVersion:1,mode:'original-one-slot-diagnostic',
    inspectedWallet:wallet,checkedAt:new Date(state.now).toISOString(),
    gameplayAuthorized:false,productionReady:false,
    blockers:['production-backing-registry-not-approved','retired-one-slot-trial'],
    backing:{nftId:'0x'+'34'.repeat(32),sourceCustodyConfirmed:false,lifecycle:'released'},
    bnb:{chainId:56,passState:'Retired',ownerMatches:false,canPlay:false},
  });
  const handler=createBnbTestHandler({
    client:{verifyMessage:async()=>true},clock:()=>state.now,
    rpc:async(name,args)=>{
      assert.equal(name,'arcade_bnb_test_read_session_v1');
      assert.deepEqual(args,{p_token_sha256:tokenHash});
      state.reads++;return state.session?{...state.session}:null;
    },
    inspectBacking:async input=>{
      state.inspections++;assert.equal(input.wallet,wallet);
      assert(input.signal instanceof AbortSignal);
      return inspect?inspect({state,proof,input}):proof();
    },
  });
  const call=async({anonymous=false,fields={},origin=BNB_ORIGIN}={})=>{
    const response=await handler(new Request(BNB_ORIGIN+PATH,{
      method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
        ...(!anonymous?{Cookie:COOKIE+'='+token}:{})},
      body:JSON.stringify({action:'entitlement',...fields}),
    }));
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
    const body=await response.json();assert.equal(body.gameplayAuthorized,false);
    assert(!JSON.stringify(body).includes(token));
    return {status:response.status,body};
  };
  return {state,proof,call};
}

test('authenticated entitlement returns actual backing observation with access denied and session rechecked',async()=>{
  const f=fixture(),r=await f.call();
  assert.equal(r.status,403);assert.equal(r.body.reason,'production-backed-pass-not-enabled');
  assert.deepEqual(r.body.backingCheck,f.proof());
  assert.equal(f.state.reads,2);assert.equal(f.state.inspections,1);
});

test('anonymous, revoked, expired, wrong-scope and forged-wallet requests never invoke chain reader',async()=>{
  const anonymous=fixture();assert.equal((await anonymous.call({anonymous:true})).status,401);
  assert.equal(anonymous.state.inspections,0);assert.equal(anonymous.state.reads,0);
  for(const change of [{revoked:true},{expiresAt:new Date(NOW).toISOString()},
    {scope:'sui:mainnet'},{origin:'https://attacker.example'},{chainId:1},{authenticated:false}]){
    const f=fixture();Object.assign(f.state.session,change);
    assert.equal((await f.call()).status,401);assert.equal(f.state.inspections,0);
  }
  for(const options of [{fields:{wallet}},{fields:{policy:{approved:true}}},{origin:'https://attacker.example'}]){
    const f=fixture();assert([400,403].includes((await f.call(options)).status));
    assert.equal(f.state.inspections,0);assert.equal(f.state.reads,0);
  }
});

test('logout, expiry or identity replacement during chain reads discards the observation',async()=>{
  for(const mutate of [s=>{s.session.revoked=true;},s=>{s.now+=3600000;},
    s=>{s.session.wallet='0x'+'22'.repeat(20);},s=>{s.session=null;}]){
    const f=fixture({inspect:({state,proof})=>{mutate(state);return proof();}});
    const r=await f.call();assert.equal(r.status,401);assert.equal(r.body.error,'invalid-session');
    assert.equal(r.body.backingCheck,undefined);assert.equal(f.state.reads,2);
  }
});

test('RPC failure and malformed, stale, wrong-wallet or positive-authorization reports fail closed',async()=>{
  const bad=[null,{schemaVersion:2},{mode:'production'},{productionReady:true},
    {gameplayAuthorized:true},{inspectedWallet:'0x'+'22'.repeat(20)},
    {checkedAt:'invalid'},{checkedAt:new Date(NOW-30001).toISOString()},
    {checkedAt:new Date(NOW+2001).toISOString()},{padding:'x'.repeat(24000)}];
  for(const change of bad){
    const f=fixture({inspect:({proof})=>change===null?null:{...proof(),...change}});
    const r=await f.call();assert.equal(r.status,503);assert.equal(r.body.error,'backing-check-unavailable');
    assert.equal(r.body.backingCheck,undefined);
  }
  const f=fixture({inspect:()=>{throw Error('Private RPC URL or response must not leak');}});
  const r=await f.call();assert.equal(r.status,503);
  assert(!JSON.stringify(r.body).includes('Private RPC'));
});

test('even a fully held trial backing observation cannot approve production gameplay',async()=>{
  const f=fixture({inspect:({proof})=>({...proof(),blockers:['production-backing-registry-not-approved'],
    backing:{...proof().backing,sourceCustodyConfirmed:true,lifecycle:'held'},
    bnb:{chainId:56,passState:'Active',ownerMatches:true,canPlay:true},
  })});
  const r=await f.call();assert.equal(r.status,403);
  assert.equal(r.body.reason,'production-backed-pass-not-enabled');
  assert.equal(r.body.backingCheck.productionReady,false);
  assert.equal(r.body.gameplayAuthorized,false);
});
