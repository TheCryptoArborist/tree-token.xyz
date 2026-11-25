// Source-only Fetch handler. No route registration, cookie fallback or login issuance.
import {validateSnapshot} from '../../docs/multichain/generation-milestone/native-sui-payments/upstream/contract.mjs';
import {createHash} from 'node:crypto';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const fields={'bnb-challenge':{payer:v=>typeof v==='string'&&/^0x[a-f0-9]{40}$/.test(v)},'bnb-open':{id:hex,suiSignature:v=>typeof v==='string'&&v.length>0&&v.length<=6000&&/^[A-Za-z0-9+/]+={0,2}$/.test(v),bnbSignature:v=>typeof v==='string'&&/^0x[a-fA-F0-9]{130}$/.test(v)},'bnb-reconcile':{id:hex,txHash:v=>typeof v==='string'&&/^0x[a-f0-9]{64}$/.test(v)},'bnb-record':{runId:uuid,checkoutId:hex,txHash:v=>typeof v==='string'&&/^0x[a-f0-9]{64}$/.test(v)},complete:{paymentId:uuid},record:{offerId:v=>typeof v==='string'&&/^[a-f0-9]{48}$/.test(v),digest:v=>typeof v==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(v)},recover:{paymentId:uuid},offer:{runId:v=>typeof v==='string'&&/^grove-[a-f0-9]{32}$/.test(v),snapshot:v=>v&&typeof v==='object'&&!Array.isArray(v),lives:v=>v===0},prepare:{runId:uuid,paymentId:uuid,clientKey:hex},activate:{runId:uuid,clientKey:hex,leaseId:uuid,checkpointHash:hex,policyDigest:hex,requestId:uuid}};
export function createRestoreHttpHandler({action,authorization}) {
 if(!Object.hasOwn(fields,action)||typeof authorization?.[action]!=='function')throw Error('restore-http-adapter-required');
 const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff',...(status===405?{Allow:'POST'}:{})}});
 const deny=(status,code)=>reply({protocol:'tree-paid-delivery.v2',status:'review-required',restoreAuthorized:false,requiresPayment:false,code},status);
 return async request=>{
  const url=new URL(request.url);
  if(!['https://tree-token.xyz','https://www.tree-token.xyz'].includes(url.origin)||url.search||url.username||url.password)return deny(403,'ORIGIN_DENIED');
  if(request.method!=='POST')return deny(405,'POST_REQUIRED');
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return deny(403,'ORIGIN_DENIED');
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return deny(401,'SESSION_REQUIRED');
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')||''))return deny(415,'JSON_REQUIRED');
  let input;
  try{
   const reader=request.body?.getReader();if(!reader)throw Error();
   const chunks=[];let size=0;
   try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>(action==='bnb-open'?8192:2048)){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}
   input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
   const schema=fields[action];
   if(!input||Array.isArray(input)||Object.keys(input).length!==Object.keys(schema).length||!Object.entries(schema).every(([k,valid])=>Object.hasOwn(input,k)&&valid(input[k])))throw Error();
   if(action==='offer')input.snapshot=validateSnapshot(input.snapshot,input.runId);
  }catch{return deny(400,'INVALID_REQUEST');}
  try{
   // Hash only the native bearer. The delivery transaction resolves and locks the
   // authoritative session, payment owner and run; body identity is never trusted.
   const result=await authorization[action]({...input,...(['bnb-challenge','bnb-open','bnb-reconcile'].includes(action)?{sessionToken:token,origin:'https://tree-token.xyz'}:action==='offer'?{sessionToken:token}:{sessionHash:createHash('sha256').update(token,'utf8').digest('hex')})});
   return reply(result,200);
  }catch{
   // A failure may occur after consumption committed. Never leak SQL/credentials,
   // promise rollback, request payment again, or retry activation automatically.
   return deny(503,'REVIEW_REQUIRED');
  }
 };
}
