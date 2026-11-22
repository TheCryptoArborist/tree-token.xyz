import test from 'node:test';import assert from 'node:assert/strict';import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
import {createAccessHandler} from '../server/access.mjs';import {nftreeOwnership,NFTREE_TYPE,PERSONAL_KIOSK_TYPE,rarityOf} from '../server/ownership.mjs';
const base='https://tree-token.xyz/play/canopy-breaker/',origin='https://tree-token.xyz';
function setup(){const map=new Map();let time=1000000,count=1,fail=false;const key=new Ed25519Keypair();const store={async get(k){return map.get(k)??null;},async setJSON(k,v,o={}){if(o.onlyIfNew&&map.has(k))return{modified:false};map.set(k,v);return{modified:true};},async delete(k){map.delete(k);}};const handler=createAccessHandler({store,now:()=>time,ownership:async address=>{if(fail)throw Error('private RPC error');return{address,count,rarity:2};},sources:{'app.js':'/* protected game */'}});const request=(body,cookie='',requestOrigin=origin)=>handler(new Request(base+'api/access',{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})}));return{map,key,handler,request,setTime:t=>time=t,setCount:n=>count=n,setFail:()=>fail=true};}
async function proof(s,key=s.key){const c=await(await s.request({action:'challenge',address:s.key.toSuiAddress()})).json();const signed=await key.signPersonalMessage(new TextEncoder().encode(c.message));return{action:'verify',address:c.address,nonce:c.nonce,signature:signed.signature};}
test('actual wallet signature grants a secure cookie and protects game modules',async()=>{const s=setup();assert.equal((await s.request()).status,401);assert.equal((await s.handler(new Request(base+'src/app.js'))).status,401);const r=await s.request(await proof(s));assert.equal(r.status,200);const d=await r.json();assert.equal(d.verified,true);assert.equal(d.rarity,2);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Path=\/play\/canopy-breaker\//);const module=await s.handler(new Request(base+'src/app.js',{headers:{Cookie:cookie}}));assert.equal(module.status,200);assert.equal(await module.text(),'/* protected game */');assert.match(module.headers.get('cache-control'),/no-store/);assert.equal((await s.request(null,cookie)).status,200);});
test('wrong signer, wrong domain, expired challenge and fake proof never grant access',async()=>{const s=setup();assert.equal((await s.request(await proof(s,new Ed25519Keypair()))).status,401);const p=await proof(s);assert.equal((await s.request(p,'','https://evil.example')).status,403);s.setTime(1400000);assert.equal((await s.request(p)).status,401);assert.equal((await s.request({action:'verify',address:s.key.toSuiAddress(),nonce:'f'.repeat(64),signature:'fake'})).status,401);});
test('one signed challenge cannot be replayed or consumed concurrently twice',async()=>{const s=setup(),p=await proof(s);const results=await Promise.all([s.request(p),s.request(p)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);assert.equal((await s.request(p)).status,401);});
test('non-holder and unavailable ownership fail closed without returning secrets',async()=>{const s=setup();s.setCount(0);assert.equal((await s.request(await proof(s))).status,403);s.setCount(1);s.setFail();const r=await s.request(await proof(s));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private RPC/);});
test('ownership loss, logout, forged cookies and expired sessions lock both access and code',async()=>{const s=setup();const r=await s.request(await proof(s)),cookie=r.headers.get('set-cookie');s.setCount(0);assert.equal((await s.request(null,cookie)).status,403);assert.equal((await s.handler(new Request(base+'src/app.js',{headers:{Cookie:cookie}}))).status,401);s.setCount(1);const r2=await s.request(await proof(s)),c2=r2.headers.get('set-cookie');await s.request({action:'logout'},c2);assert.equal((await s.request(null,c2)).status,401);const r3=await s.request(await proof(s)),c3=r3.headers.get('set-cookie');s.setTime(2000000);assert.equal((await s.request(null,c3)).status,401);assert.equal((await s.request(null,'__Secure-breaker-session='+ 'f'.repeat(64))).status,401);});
test('stale module requests recheck ownership, while unsupported paths never expose source',async()=>{const s=setup();const r=await s.request(await proof(s)),cookie=r.headers.get('set-cookie');s.setTime(1040000);s.setCount(0);assert.equal((await s.handler(new Request(base+'src/app.js',{headers:{Cookie:cookie}}))).status,403);assert.equal((await s.handler(new Request(base+'src/../../server/access.mjs'))).status,404);});
test('direct NFTs and standard or personal Kiosk items grant the actual highest rarity',async()=>{
 const addr='0x'+'1'.repeat(64),kiosk='0x'+'2'.repeat(64),field='0x'+'6'.repeat(64),id='0x'+'3'.repeat(64);
 for(const capType of ['0x2::kiosk::KioskOwnerCap',PERSONAL_KIOSK_TYPE]){
  let queries=0;
  const result=await nftreeOwnership(addr,{fetchImpl:async(url,req)=>{
   queries++;const{query,variables}=JSON.parse(req.body);let data;
   if(query.includes('objects(')){
    const json=capType===PERSONAL_KIOSK_TYPE?{cap:{for:kiosk}}:{for:kiosk};
    data={objects:{pageInfo:{hasNextPage:false},nodes:variables.type===NFTREE_TYPE?[{address:'0x4',asMoveObject:{contents:{json:{rarity:'Rare'}}}}]:variables.type===capType?[{address:'0x5',asMoveObject:{contents:{json}}}]:[]}};
   }else if(query.includes('dynamicFields'))data={object:{dynamicFields:{pageInfo:{hasNextPage:false},nodes:[{address:field,name:{type:{repr:'0x2::kiosk::Item'},json:{id}}}]}}};
   else data={o0:{address:id,owner:{__typename:'ObjectOwner',address:{address:field}},asMoveObject:{contents:{type:{repr:NFTREE_TYPE},json:{rarity:'Legendary'}}}}};
   return Response.json({data});
  }});
  assert.equal(result.count,2);assert.equal(result.rarity,3);assert.equal(queries,5);
 }
 assert.equal(rarityOf({rarity:'1/1'}),5);
});
test('incomplete RPC responses and API errors cannot be mistaken for missing NFTs',async()=>{await assert.rejects(nftreeOwnership('0x1',{fetchImpl:async()=>Response.json({data:{objects:{nodes:[]}}})}));await assert.rejects(nftreeOwnership('0x1',{fetchImpl:async()=>Response.json({errors:[{message:'unavailable'}]})}));});
test('Kiosk membership cannot grant access to an NFT whose owner is outside the controlled Kiosk chain',async()=>{
 const kiosk='0x'+'2'.repeat(64),field='0x'+'6'.repeat(64),id='0x'+'3'.repeat(64);
 await assert.rejects(nftreeOwnership('0x1',{fetchImpl:async(url,req)=>{
  const {query,variables}=JSON.parse(req.body);let data;
  if(query.includes('objects('))data={objects:{pageInfo:{hasNextPage:false},nodes:variables.type==='0x2::kiosk::KioskOwnerCap'?[{address:'0x5',asMoveObject:{contents:{json:{for:kiosk}}}}]:[]}};
  else if(query.includes('dynamicFields'))data={object:{dynamicFields:{pageInfo:{hasNextPage:false},nodes:[{address:field,name:{type:{repr:'0x2::kiosk::Item'},json:{id}}}]}}};
  else data={o0:{address:id,owner:{__typename:'ObjectOwner',address:{address:'0x7'}},asMoveObject:{contents:{type:{repr:NFTREE_TYPE},json:{rarity:'Legendary'}}}}};
  return Response.json({data});
 }}),/Kiosk ownership changed/);
});
