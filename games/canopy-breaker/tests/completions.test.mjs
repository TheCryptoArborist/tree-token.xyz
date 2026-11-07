import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCompletionsHTTP} from '../server/completions.mjs';
const url='https://tree-token.xyz/play/canopy-breaker/api/completions';
const row={id:'a'.repeat(32),updated_at:'100',outcome:'gameover',score:'12345',level:'7',username:'Tree Player',wallet:'private',run_id:'private',signed_bytes:'private'};
test('completion output contains only public fields',async()=>{
 const handler=createCompletionsHTTP({database:{query:async(sql,params)=>{assert.match(sql,/IN \('won','gameover'\)/);assert.deepEqual(params,[0,'']);return {rows:[row]};}}});
 const r=await handler(new Request(url));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.json();
 assert.deepEqual(body.entries,[{id:row.id,completedAt:100,outcome:'gameover',score:12345,level:7,username:'Tree Player'}]);assert.doesNotMatch(JSON.stringify(body),/private|wallet|run_id|signed/);
});
test('baseline does not read or disclose history',async()=>{
 const handler=createCompletionsHTTP({database:{query:async()=>assert.fail()},now:()=>999});const r=await handler(new Request(url+'?baseline=1'));assert.deepEqual(await r.json(),{cursor:{at:999,key:''},entries:[],hasMore:false});
});
test('writes and invalid cursors are rejected without database queries',async()=>{
 const handler=createCompletionsHTTP({database:{query:async()=>assert.fail()}});
 assert.equal((await handler(new Request(url,{method:'POST'}))).status,405);
 for(const suffix of ['?after=-1','?after=NaN','?key=invalid','?after=1.2'])assert.equal((await handler(new Request(url+suffix))).status,400);
});
test('pagination has stable tie-breaker and bounds page size',async()=>{
 let params;const rows=Array.from({length:101},(_,i)=>({...row,id:i.toString(16).padStart(32,'0'),outcome:'won',level:30}));
 const handler=createCompletionsHTTP({database:{query:async(sql,p)=>{params=p;assert.match(sql,/ORDER BY r.updated_at ASC,md5\(r.id::text\) ASC LIMIT 101/);return {rows};}}});
 const r=await handler(new Request(url+'?after=10&key='+'b'.repeat(32)));const b=await r.json();assert.equal(b.entries.length,100);assert.equal(b.hasMore,true);assert.equal(b.cursor.key,rows[99].id);assert.deepEqual(params,[10,'b'.repeat(32)]);
});
test('anonymous players do not expose a wallet',async()=>{
 const handler=createCompletionsHTTP({database:{query:async()=>({rows:[{...row,username:null}]})}});assert.equal((await (await handler(new Request(url))).json()).entries[0].username,null);
});
test('database failures return 503 without leaking details',async()=>{
 const handler=createCompletionsHTTP({database:{query:async()=>{throw Error('secret connection');}}});const r=await handler(new Request(url));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret/);
});
