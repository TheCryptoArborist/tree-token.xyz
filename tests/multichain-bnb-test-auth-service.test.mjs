import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BNB_ORIGIN, BNB_IDENTITY_SCOPE, issueBnbChallenge } from '../scripts/multichain/bnb-game-access-core.mjs';
import { createBnbTestHandler, createBnbTestRpc, COOKIE, PATH } from '../scripts/multichain/bnb-test-auth-service.mjs';

const NOW=Date.parse('2026-11-20T19:40:00.000Z');
const account=privateKeyToAccount('0x'+'a5'.repeat(32));
const other=privateKeyToAccount('0x'+'b6'.repeat(32));
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture({clientOverride}={}){
  const state={now:NOW,challenges:new Map(),sessions:new Map(),calls:[]};
  const rpc=async(name,body)=>{
    state.calls.push(name);
    if(name==='arcade_bnb_test_create_challenge_v1'){
      const {record,message}=issueBnbChallenge({wallet:body.p_address,nonce:body.p_nonce,now:Date.parse(body.p_issued_at)});
      assert.equal(sha(message),body.p_message_hash);
      const stored={nonce:record.nonce,wallet:record.address.toLowerCase(),address:record.address,
        origin:record.origin,uri:record.uri,chainId:record.chainId,scope:record.scope,
        issuedAt:record.issuedAt,expiresAt:record.expiresAt,messageHash:body.p_message_hash,used:false};
      state.challenges.set(body.p_nonce,stored);
      return stored;
    }
    if(name==='arcade_bnb_test_read_challenge_v1'){
      const row=state.challenges.get(body.p_nonce);
      return row&&!row.used&&Date.parse(row.expiresAt)>state.now?row:null;
    }
    if(name==='arcade_bnb_test_consume_session_v1'){
      const row=state.challenges.get(body.p_nonce);
      if(!row||row.used||row.wallet!==body.p_wallet||row.messageHash!==body.p_message_hash||
          Date.parse(row.expiresAt)<=state.now)return null;
      row.used=true;
      const session={wallet:row.wallet,origin:BNB_ORIGIN,chainId:56,scope:BNB_IDENTITY_SCOPE,
        authenticated:true,revoked:false,expiresAt:body.p_expires_at};
      state.sessions.set(body.p_token_sha256,session);
      return session;
    }
    if(name==='arcade_bnb_test_read_session_v1'){
      const s=state.sessions.get(body.p_token_sha256);
      return s&&!s.revoked&&Date.parse(s.expiresAt)>state.now?s:null;
    }
    if(name==='arcade_bnb_test_revoke_session_v1'){
      const s=state.sessions.get(body.p_token_sha256);
      if(!s||s.revoked)return false;
      s.revoked=true;return true;
    }
    throw Error('unexpected RPC '+name);
  };
  const client=clientOverride||{getChainId:async()=>56,verifyMessage};
  const handler=createBnbTestHandler({rpc,client,clock:()=>state.now,entropy:randomBytes});
  return {state,rpc,handler};
}
async function call(handler,action,fields={},options={}){
  const headers={'origin':options.origin??BNB_ORIGIN,'Content-Type':options.type??'application/json'};
  if(options.cookie)headers.cookie=options.cookie;
  if(options.fetchSite)headers['Sec-Fetch-Site']=options.fetchSite;
  const req=new Request(options.url||BNB_ORIGIN+PATH,{
    method:options.method||'POST',headers,body:options.raw??JSON.stringify({action,...fields}),
  });
  const r=await handler(req);
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};
}
async function challenge(f,who=account){
  const result=await call(f.handler,'challenge',{wallet:who.address});
  assert.equal(result.status,200);
  assert.equal(result.data.gameplayAuthorized,false);
  return result.data;
}
async function signed(f,who=account){
  const c=await challenge(f,who),sig=await who.signMessage({message:c.message});
  const r=await call(f.handler,'sign-in',{wallet:who.address,nonce:c.nonce,signature:sig});
  return {challenge:c,signature:sig,reply:r};
}
test('one-time EOA signature yields isolated, host-only HttpOnly test cookie; never gameplay',async()=>{
  const f=fixture();
  const {reply}=await signed(f);
  assert.equal(reply.status,200);
  assert.equal(reply.data.authenticated,true);
  assert.equal(reply.data.scope,BNB_IDENTITY_SCOPE);
  assert.equal(reply.data.gameplayAuthorized,false);
  assert.match(reply.cookie,/^__Secure-tree_bnb_test=bnbtest_[a-f0-9]{64};/);
  assert(reply.cookie.includes('Secure')&&reply.cookie.includes('HttpOnly')&&reply.cookie.includes('SameSite=Strict'));
  assert(reply.cookie.includes('Path=/api/arcade-bnb-test'));
  const cookie=reply.cookie.split(';')[0];
  const status=await call(f.handler,'status',{}, {cookie});
  assert.equal(status.status,200);assert.equal(status.data.wallet,account.address.toLowerCase());
  const gate=await call(f.handler,'entitlement',{}, {cookie});
  assert.equal(gate.status,403);
  assert.equal(gate.data.reason,'production-backed-pass-not-enabled');
  assert.equal(gate.data.gameplayAuthorized,false);
  assert(!JSON.stringify(status.data).includes('bnbtest_'));
});
test('signed nonce can create only one session, including simultaneous retries',async()=>{
  const f=fixture(),c=await challenge(f),signature=await account.signMessage({message:c.message});
  const data={wallet:account.address,nonce:c.nonce,signature};
  const results=await Promise.all([call(f.handler,'sign-in',data),call(f.handler,'sign-in',data)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,403]);
  assert.equal(f.state.sessions.size,1);
  assert.equal(f.state.challenges.get(c.nonce).used,true);
});
test('wrong wallet, wrong signer, wrong chain, changed message and expiry fail without sessions',async()=>{
  const f=fixture(),c=await challenge(f);
  const good=await account.signMessage({message:c.message});
  for(const [wallet,signature] of [[other.address,good],[account.address,await other.signMessage({message:c.message})]]){
    const r=await call(f.handler,'sign-in',{wallet,nonce:c.nonce,signature});
    assert.equal(r.status,403);
  }
  f.state.now+=300001;
  assert.equal((await call(f.handler,'sign-in',{wallet:account.address,nonce:c.nonce,signature:good})).status,403);
  assert.equal(f.state.sessions.size,0);
  const wrongChain=fixture({clientOverride:{getChainId:async()=>1,verifyMessage}});
  const fresh=await challenge(wrongChain);
  const sig=await account.signMessage({message:fresh.message});
  assert.equal((await call(wrongChain.handler,'sign-in',{wallet:account.address,nonce:fresh.nonce,signature:sig})).status,403);
});
test('origin and untrusted fields are rejected without creating a session',async()=>{
  const f=fixture();
  assert.equal((await call(f.handler,'challenge',{wallet:account.address},{origin:'https://attacker.example'})).status,403);
  assert.equal((await call(f.handler,'challenge',{wallet:account.address},{fetchSite:'cross-site'})).status,403);
  assert.equal((await call(f.handler,'challenge',{wallet:account.address,admin:true})).status,400);
  assert.equal((await call(f.handler,'status',{token:'pretend'})).status,400);
  assert.equal((await call(f.handler,'status',{}, {url:'https://www.tree-token.xyz'+PATH})).status,403);
  assert.equal((await call(f.handler,'status',{}, {raw:'x'})).status,400);
  assert.equal(f.state.sessions.size,0);
});
test('logout revokes only test session and clearing cookie does not touch Arcade',async()=>{
  const f=fixture(),{reply}=await signed(f);
  const cookie=reply.cookie.split(';')[0];
  const out=await call(f.handler,'logout',{}, {cookie});
  assert.equal(out.status,200);
  assert.match(out.cookie,/Max-Age=0/);
  assert.equal((await call(f.handler,'status',{}, {cookie})).status,401);
  assert(f.state.calls.every(x=>x.startsWith('arcade_bnb_test_')));
});
test('missing hosted storage, RPC failure and wrong session cannot confer access',async()=>{
  assert.throws(()=>createBnbTestRpc({getEnv:()=>undefined}),/service-unavailable/);
  const f=fixture();
  const fail=createBnbTestHandler({rpc:async()=>{throw Error('private database failure')},
    client:{getChainId:async()=>56,verifyMessage}});
  const result=await call(fail,'challenge',{wallet:account.address});
  assert.equal(result.status,503);
  assert(!JSON.stringify(result.data).includes('private database failure'));
  assert.equal((await call(f.handler,'status',{}, {cookie:'__Secure-tree_bnb_test=not-real'})).status,401);
});
