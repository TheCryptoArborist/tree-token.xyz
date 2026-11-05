import { createHash } from 'node:crypto';
import { ARCADE_GROWTH_ORIGINS } from '../lib/arcade-growth-core.ts';
import { arcadeGrowthSupabaseConfig } from '../lib/arcade-growth-store.ts';
type Env = Record<string,string|undefined>;
const errors:Record<string,[number,string]>={
 'arcade-growth-invalid-session':[401,'Sign in again to load your campaign progress.'],
 'arcade-campaign-incomplete':[409,'Complete all four verified tasks before claiming your badge.'],
 'arcade-campaign-rate-limited':[429,'Quiz attempt limit reached. Try again in an hour.'],
 'arcade-campaign-invalid-request':[400,'Choose an answer for each quiz question.'],
};
function environment():Env {
 const runtime=(globalThis as any).Netlify?.env;
 const keys=['ARCADE_CAMPAIGNS_ENABLED',...['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL'].flatMap(p=>[`${p}_SUPABASE_URL`,`${p}_SUPABASE_SECRET_KEY`])];
 return Object.fromEntries(keys.map(k=>[k,runtime?.get(k)??process.env[k]]));
}
export function createCampaignHandler({env,fetchImpl=fetch}:{env?:Env;fetchImpl?:typeof fetch}={}) {
 return async(request:Request)=>{
  const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const settings=env||environment();
  if(settings.ARCADE_CAMPAIGNS_ENABLED!=='true') return reply({error:'campaigns-unavailable',message:'Campaigns are being prepared. Your daily tasks remain available.'},503);
  if(!['GET','POST'].includes(request.method)) return reply({error:'method-not-allowed'},405);
  const origin=request.headers.get('origin')||new URL(request.url).origin;
  if(!(ARCADE_GROWTH_ORIGINS as readonly string[]).includes(origin)) return reply({error:'origin-not-allowed'},403);
  const match=/^Bearer ([A-Za-z0-9_-]{32,512})$/.exec(request.headers.get('authorization')||'');
  if(!match) return reply({error:'authentication-required',message:'Sign in above to participate.'},401);
  let action='status',answers:string[]|null=null;
  if(request.method==='POST'){
   try{
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))throw Error();
    const reader=request.body?.getReader();if(!reader)throw Error();let text='',size=0;const decoder=new TextDecoder();
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048){await reader.cancel();throw Error();}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
    const body=JSON.parse(text);
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','answers'].includes(k))||!['start','quiz','claim'].includes(body.action))throw Error();
    action=body.action;
    if(action==='quiz'){
     if(!Array.isArray(body.answers)||body.answers.length!==3||body.answers.some((a:unknown,i:number)=>typeof a!=='string'||!([['arcade','chart','wallet'],['buy','attendance','post'],['open','paste','review']][i].includes(a))))throw Error();
     answers=body.answers;
    }else if('answers' in body)throw Error();
   }catch{return reply({error:'invalid-request',message:'Submit a valid campaign action and quiz answers.'},400);}
  }
  try{
   const connection=arcadeGrowthSupabaseConfig(settings);
   const response=await fetchImpl(`${connection.url}/rest/v1/rpc/arcade_campaign_v1`,{method:'POST',headers:{'Content-Type':'application/json',apikey:connection.secretKey,Authorization:`Bearer ${connection.secretKey}`},body:JSON.stringify({p_token_sha256:createHash('sha256').update(match[1]).digest('hex'),p_origin:origin,p_action:action,p_answers:answers}),signal:AbortSignal.timeout(8000)});
   const data=await response.json();
   if(!response.ok){const known=errors[data?.message];if(known)return reply({error:data.message,message:known[1]},known[0]);throw Error();}
   const p=data?.progress;
   if(!p||!/^0x[0-9a-f]{64}$/.test(p.wallet)||p.campaignId!=='first-round-v1'||typeof p.canClaim!=='boolean'||!p.tasks||['checkIn','quiz','game','share'].some(k=>typeof p.tasks[k]!=='boolean')||!Number.isInteger(p.learningStamps))throw Error();
   return reply({status:'ok',...data});
  }catch{return reply({error:'campaigns-unavailable',message:'Campaign progress is unavailable. Your saved daily progress is unchanged.'},503);}
 };
}
export default createCampaignHandler();
export const config={path:'/api/arcade-campaign',method:['GET','POST'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:30}};
