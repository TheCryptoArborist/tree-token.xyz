// BNB-only Tree Force '89 identity test. This module cannot grant gameplay.
import { createHash, randomBytes } from 'node:crypto';
import { keccak256, toHex } from 'viem';
import {
  BNB_ORIGIN, BNB_IDENTITY_SCOPE, BnbAccessError,
  issueBnbChallenge, formatBnbChallenge, verifyBnbChallenge,
} from './bnb-game-access-core.mjs';

export const PATH='/api/arcade-bnb-test';
export const COOKIE='__Secure-tree_bnb_test';
const SCOPE=BNB_IDENTITY_SCOPE;
const HASH=/^[0-9a-f]{64}$/;
const TOKEN=/^bnbtest_[0-9a-f]{64}$/;
const WALLET=/^0x[0-9a-f]{40}$/;
const sha=s=>createHash('sha256').update(s).digest('hex');
const validExpiry=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&
  new Date(value).toISOString()===value&&Date.parse(value)>now&&Date.parse(value)<=now+3600000;
const bad=(code,status=403)=>new BnbAccessError(code,status);
const unavailable=()=>bad('service-unavailable',503);
const exact=(o,keys)=>o && typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const setCookie=(v,age)=>COOKIE+'='+v+'; Path='+PATH+'; Max-Age='+age+'; HttpOnly; Secure; SameSite=Strict';
function getCookie(req){
  const all=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
  if(all.length!==1)return null;
  const raw=all[0].slice(COOKIE.length+1);
  return TOKEN.test(raw)?raw:null;
}
async function bodyObject(req){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))throw bad('invalid-request',400);
  if(Number(req.headers.get('content-length')||0)>8192)throw bad('request-too-large',413);
  const reader=req.body?.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let text='',size=0;
  try{
    if(reader)for(;;){
      const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>8192){await reader.cancel();throw bad('request-too-large',413);}
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    const value=JSON.parse(text);
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('not-object');
    return value;
  }catch(e){if(e instanceof BnbAccessError)throw e;throw bad('invalid-request',400);}
}
export function createBnbTestRpc({getEnv,fetchImpl=fetch}){
  const url=getEnv('BNB_TEST_SUPABASE_URL'),key=getEnv('BNB_TEST_SUPABASE_SECRET_KEY');
  if(typeof url!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||typeof key!=='string'||key.length<24)throw unavailable();
  const names=new Set(['arcade_bnb_test_create_challenge_v1','arcade_bnb_test_read_challenge_v1','arcade_bnb_test_consume_session_v1','arcade_bnb_test_read_session_v1','arcade_bnb_test_revoke_session_v1']);
  return async(name,args)=>{
    if(!names.has(name))throw unavailable();
    try{
      const response=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
        method:'POST',headers:{apikey:key,'Content-Type':'application/json',
          ...(!key.startsWith('sb_secret_')?{Authorization:'Bearer '+key}:{})},
        body:JSON.stringify(args),signal:AbortSignal.timeout(12000),
      });
      if(!response.ok)throw unavailable();
      return await response.json();
    }catch{throw unavailable();}
  };
}
export function createBnbTestHandler({rpc,client,clock=Date.now,entropy=randomBytes}={}){
  if(typeof rpc!=='function'||typeof client?.verifyMessage!=='function')throw unavailable();
  const readSession=async req=>{
    const raw=getCookie(req);
    if(!raw)throw bad('invalid-session',401);
    const session=await rpc('arcade_bnb_test_read_session_v1',{p_token_sha256:sha(raw)});
    if(!session||session.authenticated!==true||session.origin!==BNB_ORIGIN||
       session.scope!==SCOPE||session.chainId!==56||session.revoked!==false||
       !WALLET.test(session.wallet||'')||!validExpiry(session.expiresAt,clock()))throw bad('invalid-session',401);
    return session;
  };
  return async(req)=>{
    try{
      const u=new URL(req.url);
      if(u.origin!==BNB_ORIGIN||u.pathname!==PATH||req.headers.get('origin')!==BNB_ORIGIN||
         req.headers.get('sec-fetch-site')==='cross-site')throw bad('origin-denied',403);
      if(req.method!=='POST')throw bad('method-not-allowed',405);
      const b=await bodyObject(req);
      if(b.action==='challenge'){
        if(!exact(b,['action','wallet'])||typeof b.wallet!=='string'||!WALLET.test(b.wallet.toLowerCase()))throw bad('invalid-request',400);
        const nonce=entropy(32).toString('hex');
        const {record,message}=issueBnbChallenge({wallet:b.wallet,nonce,now:clock()});
        const saved=await rpc('arcade_bnb_test_create_challenge_v1',{
          p_nonce:nonce,p_wallet:record.address.toLowerCase(),p_address:record.address,
          p_issued_at:record.issuedAt,p_expires_at:record.expiresAt,p_message_hash:sha(message),
        });
        if(!saved||saved.nonce!==nonce||saved.wallet!==record.address.toLowerCase()||
           saved.address!==record.address||saved.issuedAt!==record.issuedAt||
           saved.expiresAt!==record.expiresAt||saved.messageHash!==sha(message))throw unavailable();
        return reply({status:'ok',wallet:record.address,nonce,message,chainId:56,
          expiresAt:record.expiresAt,scope:SCOPE,gameplayAuthorized:false});
      }
      if(b.action==='sign-in'){
        if(!exact(b,['action','nonce','wallet','signature'])||!HASH.test(b.nonce||'')||
           typeof b.wallet!=='string'||!WALLET.test(b.wallet.toLowerCase())||
           typeof b.signature!=='string'||b.signature.length>4096)throw bad('invalid-request',400);
        const saved=await rpc('arcade_bnb_test_read_challenge_v1',{p_nonce:b.nonce});
        if(!saved||saved.nonce!==b.nonce||saved.wallet!==b.wallet.toLowerCase()||
           saved.origin!==BNB_ORIGIN||saved.chainId!==56||saved.scope!==SCOPE||
           saved.uri!==BNB_ORIGIN+'/play/multichaintest/game/bnb/')throw bad('invalid-challenge',403);
        const rec={nonce:saved.nonce,address:saved.address,origin:saved.origin,
          uri:saved.uri,chainId:saved.chainId,scope:saved.scope,
          issuedAt:saved.issuedAt,expiresAt:saved.expiresAt};
        const message=formatBnbChallenge(rec);
        if(sha(message)!==saved.messageHash)throw unavailable();
        const raw='bnbtest_'+entropy(32).toString('hex'),expires=new Date(clock()+3590000).toISOString();
        if(!TOKEN.test(raw))throw unavailable();
        let issued=null;
        await verifyBnbChallenge({record:rec,message,signature:b.signature,wallet:b.wallet,client,now:clock(),
          consumeNonce:async ({nonce,wallet,origin,scope,messageHash})=>{
            if(origin!==BNB_ORIGIN||scope!==SCOPE||wallet!==b.wallet.toLowerCase()||
               messageHash!==keccak256(toHex(message)))return false;
            issued=await rpc('arcade_bnb_test_consume_session_v1',{
              p_nonce:nonce,p_wallet:wallet,p_message_hash:sha(message),
              p_token_sha256:sha(raw),p_expires_at:expires,
            });
            return issued?.authenticated===true&&issued.wallet===wallet&&issued.chainId===56&&
              issued.scope===SCOPE&&issued.origin===BNB_ORIGIN&&issued.revoked===false;
          },
        });
        if(!issued||issued.expiresAt!==expires||!validExpiry(issued.expiresAt,clock()))throw unavailable();
        return reply({status:'ok',authenticated:true,scope:SCOPE,chainId:56,wallet:issued.wallet,
          expiresAt:issued.expiresAt,gameplayAuthorized:false,passAccess:'not-enabled'},200,{
          'Set-Cookie':setCookie(raw,3590),
        });
      }
      if(!exact(b,['action']))throw bad('invalid-request',400);
      if(b.action==='logout'){
        const token=getCookie(req);
        if(token)await rpc('arcade_bnb_test_revoke_session_v1',{p_token_sha256:sha(token)});
        return reply({status:'ok',signedOut:true,gameplayAuthorized:false},200,{'Set-Cookie':setCookie('',0)});
      }
      if(b.action==='status'||b.action==='entitlement'){
        const s=await readSession(req);
        if(b.action==='status')return reply({status:'ok',authenticated:true,scope:SCOPE,chainId:56,
          wallet:s.wallet,expiresAt:s.expiresAt,gameplayAuthorized:false});
        // There is no audited multi-NFT BNB pass/registry yet: never enable.
        return reply({status:'denied',reason:'production-backed-pass-not-enabled',
          gameplayAuthorized:false,authenticated:true},403);
      }
      throw bad('unknown-action',404);
    }catch(e){return reply({status:'error',error:e instanceof BnbAccessError?e.code:'service-unavailable',
      gameplayAuthorized:false},e instanceof BnbAccessError?e.status:503);}
  };
}
