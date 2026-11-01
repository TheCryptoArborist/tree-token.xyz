// Check an exact authorized candidate/live endpoint without using a player wallet.
// Usage: node scripts/verify-arcade-growth-live.mjs ORIGIN ISOLATED_NODE_MODULES [REPORT]
// The optional real signature check creates an ephemeral, unfunded wallet and
// must be rejected for lack of an NFTree. No transaction is constructed.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const [origin,dependencies,reportPath]=process.argv.slice(2);
assert(origin==='https://tree-token.xyz'||/^https:\/\/[a-f0-9]{24}--tree-token\.netlify\.app$/.test(origin||''));
const checks=[];
async function call(name,action,expected,options={}){
  const response=await fetch(`${origin}/api/arcade-growth?action=${action}`,{
    cache:'no-store',redirect:'error',signal:AbortSignal.timeout(65000),...options,
  });
  const result=await response.json();
  assert.equal(response.status,expected,`${name}: ${result.error||result.status}`);
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  checks.push({name,status:response.status,result:result.error||result.status});
  return result;
}
const post=(body,originHeader='https://tree-token.xyz')=>({method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json'},body:JSON.stringify(body)});
const publicStatus=await call('public rules','status',200);
assert.equal(publicStatus.authenticated,false);
assert(!publicStatus.progress);
assert.deepEqual(publicStatus.configuration.enabledGames.map(g=>g.id),['garden-bot','pvp','arborist-trials']);
assert(['garden-bot','arborist-trials'].includes(publicStatus.configuration.todayPick.id));
await call('unauthenticated write blocked','check-in',401,post({}));
await call('client results blocked','sync',400,post({gameId:'garden-bot',completed:true}));
await call('foreign origin blocked','challenge',403,post({wallet:'0x'+'a'.repeat(64)},'https://example.com'));
await call('invalid wallet blocked','challenge',400,post({wallet:'invalid'}));
await call('wrong method blocked','challenge',405);
await call('unknown bearer blocked','status',401,{headers:{Origin:'https://tree-token.xyz',Authorization:'Bearer '+'0'.repeat(64)}});
if(dependencies){
  const {Ed25519Keypair}=await import(pathToFileURL(resolve(dependencies,'@mysten/sui/dist/keypairs/ed25519/index.mjs')).href);
  const key=Ed25519Keypair.generate();
  const wallet=key.getPublicKey().toSuiAddress();
  const {challenge}=await call('server challenge issued','challenge',200,post({wallet}));
  assert.equal(challenge.wallet,wallet);
  assert(challenge.message.includes('This signature does not authorize a transaction'));
  const {signature}=await key.signPersonalMessage(new TextEncoder().encode(challenge.message));
  const denied=await call('valid ephemeral signature requires NFTree','session',403,post({wallet,challengeId:challenge.challengeId,signature}));
  assert.equal(denied.error,'nftree-required');
}
const report={checkedAt:new Date().toISOString(),origin,dateKey:publicStatus.dateKey,
  todayPick:publicStatus.configuration.todayPick.id,enabledGames:publicStatus.configuration.enabledGames.map(g=>g.id),
  checks,playerWalletUsed:false,transactions:0,progressCreditCreated:false};
if(reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
