import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{config,candidateConfiguration} from '../netlify/bnb-run-review-functions/arcade-bnb-run-review.mjs';

test('disabled config reads no secrets or generation',()=>{
 const reads=[];
 assert.equal(candidateConfiguration(n=>{reads.push(n);return undefined;}),null);
 assert.deepEqual(reads,['BNB_RUN_REVIEW_ENABLED']);
});
test('only explicit completed generation can be configured',()=>{
 for(const generation of [undefined,'2','01','1.0'])assert.throws(()=>candidateConfiguration(n=>({BNB_RUN_REVIEW_ENABLED:'true',BNB_RUN_REVIEW_GENERATION:generation})[n]),/Generation not reviewed/);
});
test('enabled config refuses incomplete database override',()=>{
 assert.throws(()=>candidateConfiguration(n=>({BNB_RUN_REVIEW_ENABLED:'true',BNB_RUN_REVIEW_GENERATION:'1',BNB_TEST_SUPABASE_URL:'https://lehswszuekjqottolmsf.supabase.co'})[n]));
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
