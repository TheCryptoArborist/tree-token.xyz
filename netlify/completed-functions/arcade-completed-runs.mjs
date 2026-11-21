import pg from 'pg';
import {GAME_IDS,ORIGINS,hash,readBreakerReceipts,readTreeforceReceipts} from '../lib/arcade-completed-runs.mjs';
const env=key=>globalThis.Netlify?.env.get(key)??process.env[key];
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private,no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
let treeforcePool;
function gamePool(){
 if(treeforcePool)return treeforcePool;
 const value=env('TREEFORCE89_DEV_DATABASE_URL');if(!value)throw Error('Game results unavailable');const url=new URL(value);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname.endsWith('.db.netlify.com')||url.pathname!=='/netlifydb'||hash(url.hostname.replace(/-pooler(?=\.)/,'')+'|'+url.pathname)!=='df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065')throw Error('Game database identity mismatch');
 treeforcePool=new pg.Pool({connectionString:value,connectionTimeoutMillis:5000,query_timeout:8000,statement_timeout:7000,idleTimeoutMillis:1000,max:2});treeforcePool.on('error',()=>{});return treeforcePool;
}
function rpcClient(fetchImpl){
 let url,key;for(const prefix of ['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL']){url=env(prefix+'_SUPABASE_URL');key=env(prefix+'_SUPABASE_SECRET_KEY');if(url||key)break;}
 if(!url||!key||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))throw Error('Arcade progress unavailable');
 return async(name,args)=>{const r=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok){const error=Object.assign(Error('Arcade progress unavailable'),{status:String(data.message).includes('invalid-session')?401:503});throw error;}return data;};
}
export function createCompletedRunsHandler(deps={}){return async request=>{
 if(request.method!=='GET')return response({error:'Method not allowed'},405);
 const origin=request.headers.get('origin')||new URL(request.url).origin;
 if(!ORIGINS.includes(origin)||request.headers.get('sec-fetch-site')==='cross-site')return response({error:'Use the official TREE Arcade'},403);
 const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];if(!token)return response({error:'Sign in to the Arcade first'},401);
 try{
  const fetchImpl=deps.fetchImpl||fetch,rpc=deps.rpc||rpcClient(fetchImpl),base={p_token_sha256:hash(token),p_origin:origin};
  const session=await rpc('arcade_growth_read_session_v1',base),now=deps.now?.()??Date.now();
  if(session.revoked||session.origin!==origin||!/^0x[0-9a-f]{64}$/.test(session.wallet)||Date.parse(session.expiresAt)<=now||!Number.isFinite(Date.parse(session.expiresAt)))return response({error:'Sign in to the Arcade again'},401);
  const results=await Promise.allSettled([
   Promise.resolve().then(()=>deps.treeforce?deps.treeforce(session.wallet,now):readTreeforceReceipts(gamePool(),session.wallet,now)),
   Promise.resolve().then(()=>deps.breaker?deps.breaker(session.wallet,now):readBreakerReceipts(fetchImpl,session.wallet,now)),
  ]);
  const sources={treeforce89:results[0].status==='fulfilled'?'ready':'unavailable','canopy-breaker':results[1].status==='fulfilled'?'ready':'unavailable'};
  const events=results.flatMap(result=>result.status==='fulfilled'?result.value.slice(-100):[]);
  const saved=await rpc('arcade_completed_runs_sync_v1',{...base,p_events:events});
  if(saved.wallet!==session.wallet||!Array.isArray(saved.runs))throw Error('Saved result mismatch');
  return response({...saved,gameIds:GAME_IDS,sources,checkedAt:new Date(now).toISOString()});
 }catch(error){return response({error:error.status===401?'Sign in to the Arcade again':'Saved runs are temporarily unavailable. Refresh to retry.'},error.status||503);}
};}
export default createCompletedRunsHandler();
export const config={path:'/api/arcade-completed-runs',rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:30}};
