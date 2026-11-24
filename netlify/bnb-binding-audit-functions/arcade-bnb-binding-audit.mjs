// Unpublished diagnostic candidate only. No session/ticket writes or game grants.
export const config={path:'/api/arcade-bnb-test/binding-check',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:10}};
const response=(body,status)=>Response.json({...body,gameplayAuthorized:false},{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});
export default async function handler(request,context){
 try{
  if(context?.site?.id!=='aa62f324-b880-47d6-85b8-4ba0700ff5bf'||request.method!=='POST')return response({error:'denied'},403);
  const get=n=>Netlify.env.get(n);if(get('BNB_RUN_REVIEW_ENABLED')==='true')return response({error:'not-disabled'},503);
  const u=get('BNB_TEST_SUPABASE_URL'),k=get('BNB_TEST_SUPABASE_SECRET_KEY');const override=u!=null||k!=null;
  const url=override?u:get('TREE_KNOWLEDGE_TRIAL_SUPABASE_URL'),key=override?k:get('TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY');
  if(url?.replace(/\/$/,'')!=='https://lehswszuekjqottolmsf.supabase.co'||typeof key!=='string'||key.length<24)throw Error();
  const read=async(name,args)=>{const r=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{apikey:key,'Content-Type':'application/json',...(!key.startsWith('sb_secret_')?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});if(!r.ok||(await r.json())!==null)throw Error();};
  await read('arcade_bnb_run_review_v1',{p_action:'read',p_data:{hash:'0'.repeat(64)}});
  await read('arcade_bnb_test_read_session_v1',{p_token_sha256:'0'.repeat(64)});
  return response({verified:true,project:'lehswszuekjqottolmsf',runRead:true,identityRead:true,userRowsWritten:0,enabled:false},200);
 }catch{return response({error:'binding-check-failed'},503);}
}
