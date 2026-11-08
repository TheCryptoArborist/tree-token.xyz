import {randomBytes,createHash} from 'node:crypto';
import {verifyPersonalMessageSignature} from '@mysten/sui/verify';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
const signatureClient=new SuiGraphQLClient({network:'mainnet',url:'https://graphql.mainnet.sui.io/graphql',fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})});
import {addressOf,nftreeOwnership} from './ownership.mjs';
const PREFIX='/play/canopy-breaker/',COOKIE='__Secure-breaker-session';
export const messageFor=c=>['Canopy Breaker NFTree access','Origin: '+c.origin,'Network: sui:mainnet','Wallet: '+c.address,'Nonce: '+c.nonce,'Expires: '+new Date(c.expiresAt).toISOString(),'Sign in only. No transaction, token transfer, or token approval.'].join('\n');
const hash=t=>createHash('sha256').update(t).digest('hex');
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
export function createAccessHandler({store,prefix=PREFIX,cookieName=COOKIE,ownership=nftreeOwnership,verify=verifyPersonalMessageSignature,sources={},now=Date.now,nonce=()=>randomBytes(32).toString('hex')}){
 const cookie=(t,age)=>`${cookieName}=${t}; Path=${prefix}; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;
 const reply=(data,status=200,extra={})=>Response.json(data,{status,headers:{...headers,...extra}});
 const current=async req=>{const token=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!/^[a-f0-9]{64}$/.test(token||''))return null;const key='session/'+hash(token),s=await store.get(key,{type:'json'});if(!s||s.expiresAt<=now()||s.origin!==new URL(req.url).origin)return null;return {...s,key};};
 return async(req)=>{
  const url=new URL(req.url),origin=url.origin;
  try{
   if(url.pathname.startsWith(prefix+'src/')){
    if(req.method!=='GET')return reply({error:'Method not allowed'},405);const s=await current(req);if(!s)return reply({error:'NFTree sign-in required'},401);if(now()-s.verifiedAt>30000){const owned=await ownership(s.address);if(owned.count<1){await store.delete(s.key);return reply({error:'NFTree ownership is required'},403);}}const file=url.pathname.slice((prefix+'src/').length);if(!Object.hasOwn(sources,file))return reply({error:'Not found'},404);return new Response(sources[file],{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
   }
   if(url.pathname!==prefix+'api/access')return reply({error:'Not found'},404);
   if(req.method==='GET'){
    const s=await current(req);if(!s)return reply({error:'NFTree sign-in required'},401);const owned=await ownership(s.address);
    if(owned.count<1){await store.delete(s.key);return reply({error:'NFTree ownership is required'},403,{'Set-Cookie':cookie('',0)});}
    return reply({verified:true,address:s.address,count:owned.count,rarity:owned.rarity,expiresAt:s.expiresAt});
   }
   if(req.method!=='POST')return reply({error:'Method not allowed'},405);
   if(req.headers.get('origin')!==origin||req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Use the game’s own sign-in page'},403);
   if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required'},400);
   const reader=req.body?.getReader();if(!reader)return reply({error:'JSON required'},400);let text='',size=0;const decoder=new TextDecoder();for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>12000){await reader.cancel();return reply({error:'Request too large'},413);}text+=decoder.decode(r.value,{stream:true});}let b;try{b=JSON.parse(text);}catch{return reply({error:'Invalid JSON'},400);}
   if(b?.action==='logout'){const s=await current(req);if(s)await store.delete(s.key);return reply({verified:false},200,{'Set-Cookie':cookie('',0)});}
   if(b?.action==='challenge'){
    const address=addressOf(b.address);if(!address)return reply({error:'Invalid wallet address'},400);
    const c={address,origin,nonce:nonce(),expiresAt:now()+300000};await store.setJSON('challenge/'+c.nonce,c,{onlyIfNew:true});return reply({...c,message:messageFor(c)});
   }
   if(b?.action!=='verify'||!addressOf(b.address)||!/^([a-f0-9]{64})$/.test(b.nonce||'')||typeof b.signature!=='string'||b.signature.length>4000)return reply({error:'Invalid sign-in proof'},400);
   const key='challenge/'+b.nonce,c=await store.get(key,{type:'json'});if(!c||c.expiresAt<=now()||c.origin!==origin||c.address!==addressOf(b.address))return reply({error:'Sign-in expired. Request a new message.'},401);
   try{await verify(new TextEncoder().encode(messageFor(c)),b.signature,{address:c.address,client:signatureClient});}catch{return reply({error:'Wallet signature could not be verified'},401);}
   const used=await store.setJSON('used/'+b.nonce,{expiresAt:c.expiresAt},{onlyIfNew:true});if(!used.modified)return reply({error:'Sign-in message already used'},401);await store.delete(key);
   const owned=await ownership(c.address);if(owned.count<1)return reply({error:'An NFTree is required in this wallet or its Kiosk'},403);
   const token=nonce(),session={address:c.address,origin,verifiedAt:now(),expiresAt:now()+15*60000};await store.setJSON('session/'+hash(token),session,{onlyIfNew:true});return reply({verified:true,...owned,expiresAt:session.expiresAt},200,{'Set-Cookie':cookie(token,900)});
  }catch{return reply({error:'Access verification is temporarily unavailable. Please retry.'},503);}
 };
}
