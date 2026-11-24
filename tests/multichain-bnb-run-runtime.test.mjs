import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{config,candidateConfiguration,reviewPolicy} from '../netlify/bnb-run-review-functions/arcade-bnb-run-review.mjs';

test('fixed package policy permits only completed generation 1 and never gameplay',()=>{
 assert.deepEqual(reviewPolicy,{mode:'review-only',approvedGeneration:'1',gameplayAuthorized:false});assert(Object.isFrozen(reviewPolicy));
 const c=candidateConfiguration(n=>({TREE_KNOWLEDGE_TRIAL_SUPABASE_URL:'https://lehswszuekjqottolmsf.supabase.co',TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY:'sb_secret_'+'x'.repeat(32)})[n]);
 assert.equal(c.approvedGeneration,'1');
});
test('any legacy flag fails closed before credentials, including true and generation 2',()=>{
 for(const [key,value] of [['BNB_RUN_REVIEW_ENABLED','true'],['BNB_RUN_REVIEW_ENABLED','false'],['BNB_RUN_REVIEW_ENABLED',''],['BNB_RUN_REVIEW_GENERATION','1'],['BNB_RUN_REVIEW_GENERATION','2']]){
  assert.equal(candidateConfiguration(n=>{assert(n.startsWith('BNB_RUN_REVIEW_'),'Must not read credentials');return n===key?value:undefined;}),null);
 }
});
test('fixed policy still requires complete existing database binding',()=>{
 assert.throws(()=>candidateConfiguration(n=>({BNB_TEST_SUPABASE_URL:'https://lehswszuekjqottolmsf.supabase.co'})[n]));
});
test('disabled handler denies without fetching and cannot grant gameplay',async()=>{
 const old=globalThis.Netlify,fetch=globalThis.fetch;
 globalThis.Netlify={env:{get:()=> 'false'}};
 globalThis.fetch=()=>{throw Error('Unexpected network access');};
 try{
  const r=await handler(new Request('https://tree-token.xyz/api/arcade-bnb-test/run-review'));
  assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(await r.json(),{error:'review-disabled',gameplayAuthorized:false});
 }finally{globalThis.Netlify=old;globalThis.fetch=fetch;}
});
test('platform route and admission are explicit with no schedule',()=>{
 assert.deepEqual(config,{path:'/api/arcade-bnb-test/run-review',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:20}});
});

test('fixed-policy handler denies missing identity and wrong platform without network access',async()=>{
 const old=globalThis.Netlify,fetcher=globalThis.fetch;
 globalThis.Netlify={env:{get:n=>({TREE_KNOWLEDGE_TRIAL_SUPABASE_URL:'https://lehswszuekjqottolmsf.supabase.co',TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY:'sb_secret_'+'x'.repeat(32)})[n]}};
 globalThis.fetch=()=>{throw Error('No request may reach the network');};
 try{
  const request=()=>new Request('https://tree-token.xyz/api/arcade-bnb-test/run-review',{method:'POST',headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json'},body:'{"action":"issue"}'});
  const wrong=await handler(request(),{});assert.equal(wrong.status,503);assert.equal((await wrong.json()).error,'platform-context-required');
  const r=await handler(request(),{site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'},ip:'192.0.2.1'});
  assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');assert(!r.headers.has('set-cookie'));assert.deepEqual(await r.json(),{error:'invalid-session',gameplayAuthorized:false});
 }finally{globalThis.Netlify=old;globalThis.fetch=fetcher;}
});
