import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { BNB_ORIGIN, BNB_IDENTITY_SCOPE, issueBnbChallenge } from './multichain/bnb-game-access-core.mjs';
import { COOKIE, PATH } from './multichain/bnb-test-auth-service.mjs';

// This generates a disposable, unfunded test identity and signs only a login
// message. It never submits a chain transaction or uses a user's wallet/key.
const account=privateKeyToAccount('0x'+randomBytes(32).toString('hex'));
let cookie=null,revoked=false;
const results=[];
async function call(action,fields={},options={}){
  const headers={'Content-Type':'application/json',Origin:options.origin??BNB_ORIGIN};
  if(cookie&&!options.anonymous)headers.Cookie=cookie;
  const response=await fetch(BNB_ORIGIN+PATH,{method:'POST',redirect:'error',cache:'no-store',
    headers,body:JSON.stringify({action,...fields}),signal:AbortSignal.timeout(30000)});
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  const body=await response.json();
  assert.equal(body.gameplayAuthorized,false,'Test auth must never authorize gameplay');
  return {response,body};
}
try{
  let r=await call('status',{}, {anonymous:true});
  assert.equal(r.response.status,401);assert.equal(r.body.error,'invalid-session');
  results.push('anonymous status denied');
  r=await call('status',{}, {origin:'https://invalid.example',anonymous:true});
  assert.equal(r.response.status,403);assert.equal(r.body.error,'origin-denied');
  results.push('foreign origin denied');
  r=await call('challenge',{wallet:account.address});
  assert.equal(r.response.status,200,'Live challenge failed: '+r.body.error);
  const challenge=r.body;
  assert.equal(challenge.scope,BNB_IDENTITY_SCOPE);assert.equal(challenge.chainId,56);
  assert.equal(challenge.wallet.toLowerCase(),account.address.toLowerCase());
  const issuedAt=challenge.message.match(/^Issued At: (.+)$/m)?.[1];
  const expected=issueBnbChallenge({wallet:account.address,nonce:challenge.nonce,now:Date.parse(issuedAt)});
  assert.equal(challenge.message,expected.message);
  assert.equal(challenge.expiresAt,expected.record.expiresAt);
  assert(Date.parse(challenge.expiresAt)>Date.now());
  results.push('durable exact challenge issued');
  const signature=await account.signMessage({message:challenge.message});
  const signed={wallet:account.address,nonce:challenge.nonce,signature};
  r=await call('sign-in',signed);
  assert.equal(r.response.status,200,'Live signature verification failed: '+r.body.error);
  const setCookie=r.response.headers.get('set-cookie')||'';
  assert.match(setCookie,new RegExp('^'+COOKIE+'=bnbtest_[a-f0-9]{64};'));
  for(const attribute of ['HttpOnly','Secure','SameSite=Strict','Path='+PATH])assert(setCookie.includes(attribute));
  assert(!/\bDomain=/i.test(setCookie));
  cookie=setCookie.split(';')[0];
  assert.equal(r.body.authenticated,true);assert.equal(r.body.scope,BNB_IDENTITY_SCOPE);
  assert.equal(r.body.wallet,account.address.toLowerCase());
  results.push('real EOA signature accepted with isolated private cookie');
  r=await call('sign-in',signed);
  assert.equal(r.response.status,403,'Replayed challenge must be denied');
  assert.equal(r.response.headers.get('set-cookie'),null);
  results.push('nonce replay denied');
  r=await call('status');
  assert.equal(r.response.status,200);assert.equal(r.body.authenticated,true);
  assert.equal(r.body.wallet,account.address.toLowerCase());
  results.push('durable session read verified');
  r=await call('entitlement');
  assert.equal(r.response.status,403);assert.equal(r.body.reason,'production-backed-pass-not-enabled');
  results.push('signed-in gameplay denied');
  r=await call('logout');
  assert.equal(r.response.status,200);assert.equal(r.body.signedOut,true);
  assert.match(r.response.headers.get('set-cookie')||'',/Max-Age=0/);
  revoked=true;
  r=await call('status');
  assert.equal(r.response.status,401);assert.equal(r.body.error,'invalid-session');
  results.push('logout revoked session and stale cookie denied');
  const report={passed:true,checkedAt:new Date().toISOString(),sourceCommit:process.env.REVIEWED_SHA,
    deploymentId:process.env.BNB_TEST_CANDIDATE_ID,origin:BNB_ORIGIN,path:PATH,
    testWallet:account.address,syntheticUnfundedIdentity:true,chainTransactionsSubmitted:0,
    userWalletUsed:false,gameplayAuthorized:false,sessionRevoked:revoked,results};
  fs.mkdirSync('.netlify',{recursive:true});
  fs.writeFileSync('.netlify/bnb-test-auth-live.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(report));
}finally{
  if(cookie&&!revoked){
    const r=await call('logout').catch(()=>null);
    assert(r?.response.status===200,'Synthetic session cleanup failed; review this test session before continuing');
  }
}
