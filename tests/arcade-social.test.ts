import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialHandler,socialProof} from '../netlify/functions/arcade-social.ts';
const origin='https://tree-token.xyz',token='a'.repeat(64),wallet='0x'+'b'.repeat(64);
const env={ARCADE_SOCIAL_ENABLED:'true',ARCADE_GROWTH_SUPABASE_URL:'https://db.example',ARCADE_GROWTH_SUPABASE_SECRET_KEY:'server-only'};
const request=(value?:unknown,extra:Record<string,string>={})=>new Request(origin+'/api/arcade-social',{method:value===undefined?'GET':'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...extra},...(value===undefined?{}:{body:JSON.stringify(value)})});
test('post links normalize safely and invalid missions/URLs fail',()=>{
 assert.equal(socialProof('share-score','https://twitter.com/Player/status/123?s=20'),'https://x.com/player/status/123');
 for(const proof of ['javascript:alert(1)','https://x.com.evil/a/status/1','https://evil@x.com/a/status/1','https://x.com/home']) assert.throws(()=>socialProof('share-score',proof));
 assert.throws(()=>socialProof('community-vote','made-up-game'));
});
test('disabled, unauthenticated, foreign origin, and forged completion cannot reach storage',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('must not fetch')};
 assert.equal((await createSocialHandler({env:{ARCADE_SOCIAL_ENABLED:'false'},fetchImpl})(request())).status,503);
 const handler=createSocialHandler({env,fetchImpl});
 assert.equal((await handler(request(undefined,{Authorization:''}))).status,401);
 assert.equal((await handler(request(undefined,{Origin:'https://evil.example'}))).status,403);
 assert.equal((await handler(request({mission:'share-score',proof:'https://x.com/player/status/1',status:'completed'}))).status,400);
 assert.equal(calls,0);
});
test('only hashed session and normalized proof reach RPC; receipt contains no secret',async()=>{
 const handler=createSocialHandler({env,fetchImpl:async(url,options)=>{
 assert.equal(String(url),'https://db.example/rest/v1/rpc/arcade_social_v1');
 const payload=JSON.parse(String(options?.body));assert.notEqual(payload.p_token_sha256,token);assert.match(payload.p_token_sha256,/^[a-f0-9]{64}$/);
 assert.equal(payload.p_proof,'https://x.com/player/status/123');
 return Response.json({wallet,entries:[{mission:'share-score',status:'pending',proof:payload.p_proof}],monthlyStamps:0,resetsAt:'2026-11-09T00:00:00Z'});
 }});
 const response=await handler(request({mission:'share-score',proof:'https://twitter.com/Player/status/123?s=20'}));
 assert.equal(response.status,200);const body=await response.text();assert.doesNotMatch(body,/server-only/);assert.match(body,/pending/);
});
test('expired sessions, reused proof, unavailable storage map to bounded public errors',async()=>{
 for(const [payload,status] of [[{message:'arcade-growth-invalid-session'},401],[{code:'23505'},409],[{message:'private database detail'},503]] as const){
 const handler=createSocialHandler({env,fetchImpl:async()=>Response.json(payload,{status:400})});
 const response=await handler(request());assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/private database detail/);
 }
});

test('release default enables only the new handler; explicit false disables it before storage',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('storage must not be called')};
 assert.equal((await createSocialHandler({env:{},fetchImpl})(request(undefined,{Authorization:''}))).status,401);
 assert.equal((await createSocialHandler({env:{ARCADE_SOCIAL_ENABLED:'false'},fetchImpl})(request())).status,503);
 assert.equal(calls,0);
});
