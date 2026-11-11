import {createHash} from 'node:crypto';
import {getCanonicalNftreeOwnership} from '../functions/nftree-wallet.ts';
import {EVENT_ORIGINS,EventError,requireEventHolder,validEventSession} from '../lib/arcade-event-access.ts';
import {makeDraft} from '../../scripts/arcade-events/core.mjs';
const env=(key:string)=>(globalThis as any).Netlify?.env?.get(key)??process.env[key];
const json=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function database(){
  let url:string|undefined,secret:string|undefined;
  for(const prefix of ['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL']){url=env(prefix+'_SUPABASE_URL');secret=env(prefix+'_SUPABASE_SECRET_KEY');if(url||secret)break;}
  if(!url||!secret||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw new EventError('service-unavailable','Event setup is temporarily unavailable.',503);
  return async(name:string,args:any)=>{
    let r:Response;try{r=await fetch(url!.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret!,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});}catch{throw new EventError('service-unavailable','Event setup is temporarily unavailable.',503);}
    const data=await r.json().catch(()=>null);
    if(!r.ok){const m=String(data?.message||'');if(m.includes('invalid-session'))throw new EventError('invalid-session','Sign in to the Arcade again.',401);if(m.includes('event-admin-required'))throw new EventError('organizer-required','This wallet is not an event organizer.',403);if(m.includes('event-version-conflict'))throw new EventError('version-conflict','This event changed. Reload it before saving.',409);if(m.includes('event-locked'))throw new EventError('event-locked','Published event terms cannot be changed.',409);if(m.includes('event-invalid-draft'))throw new EventError('invalid-draft','Check the event settings.');throw new EventError('service-unavailable','Event setup is temporarily unavailable.',503);}
    return data;
  };
}
async function body(req:Request){
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new EventError('invalid-request','Send JSON.');
  const reader=req.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
  if(reader)for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>8192){await reader.cancel();throw new EventError('invalid-request','Request is too large.',413);}text+=decoder.decode(r.value,{stream:true});}
  let b:any;try{b=JSON.parse(text);}catch{throw new EventError('invalid-request','Invalid JSON.');}
  if(!b||Array.isArray(b)||typeof b!=='object'||Object.keys(b).some(k=>!['draft','expectedVersion'].includes(k))||!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion<0||b.expectedVersion>2147483646||!b.draft||Array.isArray(b.draft)||typeof b.draft!=='object'||Object.keys(b.draft).some(k=>!['id','title','gameId','timeZone','startLocal','endLocal'].includes(k))||(b.draft.gameId!==undefined&&!['treeforce89','canopy-breaker','canopy-defense'].includes(b.draft.gameId))||typeof b.draft.id!=='string'||! /^[a-z0-9-]{6,90}$/.test(b.draft.id))throw new EventError('invalid-request','Unsupported event settings.');
  try{return {draft:makeDraft(b.draft),expectedVersion:b.expectedVersion};}catch(e){throw new EventError('invalid-draft',(e as Error).message);}
}
export function createEventHandler(deps:any={}){return async(req:Request)=>{try{
  const u=new URL(req.url),action=u.searchParams.get('action')||'configuration';
  if(!['configuration','eligibility','admin-load','admin-save'].includes(action))throw new EventError('not-found','Unknown event action.',404);
  if(req.method!==(action==='admin-save'?'POST':'GET'))throw new EventError('method-not-allowed','Method not allowed.',405);
  if(action==='configuration')return json({status:'ok',access:'nftree-holder-only',paymentEnabled:false,scoringEnabled:false,checks:['before-entry-payment','before-each-ranked-run']});
  const origin=req.headers.get('origin')||u.origin;
  if(!EVENT_ORIGINS.includes(origin)||req.headers.get('sec-fetch-site')==='cross-site')throw new EventError('origin-not-allowed','Use the official TREE Arcade.',403);
  const auth=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization')||'');if(!auth)throw new EventError('invalid-session','Sign in to the Arcade first.',401);
  const rpc=deps.rpc||database(),base={p_token_sha256:createHash('sha256').update(auth[1]).digest('hex'),p_origin:origin},clock=deps.clock||Date.now;
  const session=validEventSession(await rpc('arcade_growth_read_session_v1',base),origin,clock());
  if(action==='eligibility'){
    const holder=await requireEventHolder(session,origin,deps.ownership||getCanonicalNftreeOwnership,clock);
    return json({status:'ok',...holder,paymentEnabled:false,entryOpen:false,message:'NFTree verified. Tournament entry is still closed.'});
  }
  // The database checks the session and organizer allowlist again inside the saving transaction.
  if(action==='admin-load'){
    const id=u.searchParams.get('id');if(!/^[a-z0-9-]{6,90}$/.test(id||''))throw new EventError('invalid-request','Choose a valid event.');
    return json({status:'ok',event:await rpc('arcade_event_load_draft_v1',{...base,p_event_id:id}),paymentEnabled:false});
  }
  const b=await body(req),event=await rpc('arcade_event_save_draft_v1',{...base,p_draft:b.draft,p_expected_version:b.expectedVersion});
  return json({status:'ok',event,paymentEnabled:false});
}catch(e){const error=e instanceof EventError?e:new EventError('service-unavailable','Event verification is temporarily unavailable.',503);return json({status:'error',error:error.code,message:error.message},error.status);}};}
export default createEventHandler();
export const config={path:'/api/arcade-events',method:['GET','POST'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:30}};
