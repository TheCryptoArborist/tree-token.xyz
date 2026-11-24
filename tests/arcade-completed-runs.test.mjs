import test from 'node:test';import assert from 'node:assert/strict';
import {createCompletedRunsHandler} from '../netlify/completed-functions/arcade-completed-runs.mjs';
import {normalizeBreakerReceipt,normalizeTreeforceReceipt,playerId,readBreakerReceipts,hash} from '../netlify/lib/arcade-completed-runs.mjs';
const wallet='0x'+'a'.repeat(64),other='0x'+'b'.repeat(64),now=Date.parse('2026-11-11T12:00:00Z');
const breaker={id:'b'.repeat(32),playerId:playerId(wallet),completedAt:now-60000,score:18500,level:2,outcome:'gameover'};
test('Canopy completed results bind to the exact wallet; live runs and future/malformed scores reject',()=>{
 assert.equal(normalizeBreakerReceipt(breaker,other,now),null);
 const result=normalizeBreakerReceipt(breaker,wallet,now);assert.equal(result.score,18500);assert.equal(result.outcome,'gameover');
 for(const change of [{outcome:'playing'},{completedAt:now+1},{score:-1},{level:31}])assert.throws(()=>normalizeBreakerReceipt({...breaker,...change},wallet,now));
});
test('Tree Force saved-result identity stays fixed when score or save time changes',()=>{
 const row={wallet,run_id:'grove-'+'a'.repeat(32),score:1000,stats:{ranked:true,score:1000,wave:1,cleared:false},updated_at:new Date(now-1000)};
 const a=normalizeTreeforceReceipt(row,wallet,now),b=normalizeTreeforceReceipt({...row,score:2000,stats:{...row.stats,score:2000},updated_at:new Date(now)},wallet,now);
 assert.equal(a.sourceRunKey,b.sourceRunKey);assert.notEqual(a.score,b.score);
 assert.throws(()=>normalizeTreeforceReceipt({...row,stats:{...row.stats,ranked:false}},wallet,now));
 assert.throws(()=>normalizeTreeforceReceipt({...row,wallet:other},wallet,now));
});
test('completion feed pagination advances and retains only the signed-in player',async()=>{
 const responses=[{entries:[breaker],hasMore:true,cursor:{at:breaker.completedAt,key:breaker.id}},{entries:[{...breaker,id:'c'.repeat(32),playerId:playerId(other)}],hasMore:false}];let calls=0;
 const runs=await readBreakerReceipts(async()=>new Response(JSON.stringify(responses[calls++])),wallet,now);assert.equal(calls,2);assert.equal(runs.length,1);
 await assert.rejects(readBreakerReceipts(async()=>new Response(JSON.stringify({entries:[],hasMore:true,cursor:{at:0,key:'a'.repeat(32)}})),wallet,now),/advance/);
});
test('endpoint authenticates before reading any game data and accepts no client result submissions',async()=>{
 let calls=0;const handler=createCompletedRunsHandler({rpc:async()=>{calls++;throw Error('unexpected');}});
 assert.equal((await handler(new Request('https://tree-token.xyz/api/arcade-completed-runs'))).status,401);
 assert.equal((await handler(new Request('https://tree-token.xyz/api/arcade-completed-runs',{method:'POST'}))).status,405);assert.equal(calls,0);
});
test('endpoint isolates a source outage and never trusts browser wallet or score parameters',async()=>{
 const receipt=normalizeBreakerReceipt(breaker,wallet,now),seen=[];
 const handler=createCompletedRunsHandler({now:()=>now,rpc:async(name,args)=>{seen.push({name,args});return name==='arcade_growth_read_session_v1'?{wallet,origin:'https://tree-token.xyz',expiresAt:new Date(now+60000).toISOString()}:{wallet,dateKey:'2026-11-11',runs:[]};},treeforce:async()=>{throw Error('offline');},breaker:async w=>{assert.equal(w,wallet);return [receipt];}});
 const response=await handler(new Request('https://tree-token.xyz/api/arcade-completed-runs?wallet='+other+'&score=999999',{headers:{Authorization:'Bearer '+'c'.repeat(64)}}));
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.wallet,wallet);assert.equal(result.sources.treeforce89,'unavailable');assert.equal(result.sources['canopy-breaker'],'ready');assert.deepEqual(seen[1].args.p_events,[receipt]);assert.equal(seen[0].args.p_token_sha256,hash('c'.repeat(64)));
});
