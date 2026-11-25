import {test} from 'node:test';import assert from 'node:assert/strict';import {createGroveHandler} from '../netlify/grove-functions/grove-chess.ts';
const id='12345678-1234-4123-8123-123456789012';
function setup(seat='w',pgn=''){const calls=[];const handler=createGroveHandler({rpc:async(name,args)=>{calls.push(args);return {id,pgn,revision:1,status:'playing',seat,used:1,white_id:'secret-hash',white_wallet:'private-wallet',...args.p_pgn!==undefined?{pgn:args.p_pgn}:{}};}});return {calls,handler};}
function request(action,body={},headers={}){return new Request('https://tree-token.xyz/api/grove-chess?action='+action,{method:'POST',headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json',Cookie:'__Host-grove-player='+'a'.repeat(64),...headers},body:JSON.stringify({room:id,revision:1,...body})});}
test('rejects illegal moves and wrong turns before the write RPC',async()=>{
 let s=setup();assert.equal((await s.handler(request('move',{from:'e2',to:'e5'}))).status,409);assert.equal(s.calls.length,1);
 s=setup('b');assert.equal((await s.handler(request('move',{from:'e7',to:'e5'}))).status,409);assert.equal(s.calls.length,1);
 s=setup(null);assert.equal((await s.handler(request('move',{from:'e2',to:'e4'}))).status,409);assert.equal(s.calls.length,1);
});
test('server computes the PGN and strips private identifiers',async()=>{const s=setup();const res=await s.handler(request('move',{from:'e2',to:'e4',pgn:'malicious'}));assert.equal(res.status,200);assert.match(s.calls.at(-1).p_pgn,/1\. e4 \*$/);const text=await res.text();assert.doesNotMatch(text,/secret-hash|private-wallet/);});
test('cross-site requests cannot mutate a room',async()=>{const s=setup();assert.equal((await s.handler(request('create',{}, {Origin:'https://evil.example'}))).status,403);assert.equal(s.calls.length,0);});
test('room creation ignores supplied identity and generates a secure browser cookie',async()=>{const s=setup();const req=request('create',{actor:'forged',wallet:'forged',announce:true},{Cookie:''});const res=await s.handler(req);assert.match(res.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);assert.match(s.calls[0].p_actor,/^[a-f0-9]{64}$/);assert.equal(s.calls[0].p_wallet,null);assert.equal(s.calls[0].p_announce,true);});
test('holder access uses a valid signed Arcade session and canonical server ownership',async()=>{
 const wallet='0x'+'1'.repeat(64);let written;const ownership=async()=>({address:wallet,network:'sui-mainnet',nftreeType:'0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT',methodology:'canonical-nftree-direct-and-kiosk-cap-v2',nftreeCount:1,directCount:1,kioskCount:0});
 const handler=createGroveHandler({ownership,rpc:async(name,args)=>{if(name==='arcade_growth_read_session_v1')return {wallet,revoked:false,origin:'https://tree-token.xyz',expiresAt:new Date(Date.now()+60000).toISOString()};written=args;return {id,seat:'w',white_wallet:wallet,used:2};}});
 const result=await handler(request('create',{used:2},{Authorization:'Bearer '+'c'.repeat(64)}));assert.equal(result.status,200);assert.equal(written.p_wallet,wallet);
});
test('future revisions cannot apply a move computed from an older board',async()=>{const s=setup();assert.equal((await s.handler(request('move',{revision:2,from:'e2',to:'e4'}))).status,409);assert.equal(s.calls.length,1);});
test('records are derived on the server and use the cookie identity, not query claims',async()=>{
 const calls=[];const handler=createGroveHandler({rpc:async(name,args)=>{calls.push({name,args});if(args.p_action==='pending')return [];if(args.p_action==='read')return {alias:'Oak-1234567890',leaderboard:[],me:null};throw Error('Unexpected write');}});
 const response=await handler(new Request('https://tree-token.xyz/api/grove-chess?action=records&actor=forged&wallet=forged',{headers:{Cookie:'__Host-grove-player='+'a'.repeat(64)}}));assert.equal(response.status,200);assert.equal(calls.length,2);assert.equal(calls[1].args.p_wallet,null);assert.match(calls[1].args.p_actor,/^[a-f0-9]{64}$/);assert.notEqual(calls[1].args.p_actor,'a'.repeat(64));assert.deepEqual((await response.json()).leaderboard,[]);
});
