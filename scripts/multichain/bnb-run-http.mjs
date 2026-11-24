// Unpublished HTTP factory: no Netlify route or production activation.
import {RunAuthorizationError} from './bnb-run-authorization.mjs';
export const PATH='/api/arcade-bnb-test/run-review';
const ORIGIN='https://tree-token.xyz',COOKIE='__Secure-tree_bnb_test';
export function createRunStore(rpc){return Object.freeze({insert:async row=>(await rpc('arcade_bnb_run_review_v1',{p_action:'insert',p_data:row}))===true,read:hash=>rpc('arcade_bnb_run_review_v1',{p_action:'read',p_data:{hash}}),consume:async row=>(await rpc('arcade_bnb_run_review_v1',{p_action:'consume',p_data:row}))===true});}
export function createRunHttp({service,admit}){
 if(typeof service?.issue!=='function'||typeof service?.consume!=='function'||typeof admit!=='function')throw Error('Server service and rate limiter required');
 const reply=(body,status=200)=>Response.json({...body,gameplayAuthorized:false},{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return async req=>{
  try{
   const u=new URL(req.url);if(u.origin!==ORIGIN||u.pathname!==PATH||u.search||req.headers.get('origin')!==ORIGIN||req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'wrong-origin'},403);
   if(req.method!=='POST')return reply({error:'method-not-allowed'},405);
   if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply({error:'invalid-request'},400);
   const cookies=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
   if(cookies.length!==1||!/^bnbtest_[a-f0-9]{64}$/.test(cookies[0].slice(COOKIE.length+1)))return reply({error:'invalid-session'},401);
   if(!await admit(req))return reply({error:'rate-limited'},429);
   const reader=req.body?.getReader();let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});if(!reader)return reply({error:'invalid-request'},400);
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return reply({error:'request-too-large'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
   let b;try{b=JSON.parse(text);}catch{return reply({error:'invalid-request'},400);}
   if(!b||Array.isArray(b)||typeof b!=='object'||!['issue','consume'].includes(b.action)||Object.keys(b).sort().join(',')!==(b.action==='issue'?'action':'action,ticket'))return reply({error:'invalid-request'},400);
   const result=await service[b.action]({sessionToken:cookies[0].slice(COOKIE.length+1),origin:ORIGIN,...(b.action==='consume'?{ticket:b.ticket}:{})});return reply(result);
  }catch(e){return reply({error:e instanceof RunAuthorizationError?'review-denied':'service-unavailable'},e instanceof RunAuthorizationError?403:503);}
 };
}
export function createRunRpc({url,key,fetcher=fetch}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url||'')||typeof key!=='string'||key.length<24)throw Error('Server credentials required');
 return async(name,args)=>{
  if(name!=='arcade_bnb_run_review_v1')throw Error('Unapproved RPC');
  const r=await fetcher(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{apikey:key,'Content-Type':'application/json',...(!key.startsWith('sb_secret_')?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Run store unavailable');return r.json();
 };
}
