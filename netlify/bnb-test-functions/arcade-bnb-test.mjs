// Separately packaged BNB sign-in function. Never rebuild the existing Arcade.
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { createBnbTestHandler, createBnbTestRpc } from '../../scripts/multichain/bnb-test-auth-service.mjs';
const getEnv=n=>globalThis.Netlify?.env?.get(n)??process.env[n];
const DATABASE_URL='https://lehswszuekjqottolmsf.supabase.co';

// Read the existing same-project server binding inside Netlify. No credential
// copying, public exposure, existing session access, or environment changes.
// An explicit BNB override must provide a complete pair for this same project.
export function runtimeConfiguration(read=getEnv){
  const explicitUrl=read('BNB_TEST_SUPABASE_URL');
  const explicitKey=read('BNB_TEST_SUPABASE_SECRET_KEY');
  const hasOverride=explicitUrl!==undefined&&explicitUrl!==null||explicitKey!==undefined&&explicitKey!==null;
  const url=hasOverride?explicitUrl:read('TREE_KNOWLEDGE_TRIAL_SUPABASE_URL');
  const key=hasOverride?explicitKey:read('TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY');
  if(typeof url!=='string'||url.replace(/\/$/,'')!==DATABASE_URL||typeof key!=='string'||key.length<24)
    throw Error('Database binding unavailable');
  const rpcUrl=read('BNB_TEST_RPC_URL')??'https://bsc-dataseed.bnbchain.org';
  if(typeof rpcUrl!=='string'||!/^https:\/\/[^/@?#]+(?:\/[^?#]*)?$/.test(rpcUrl))
    throw Error('RPC not configured');
  return {rpcUrl,getEnv:n=>n==='BNB_TEST_SUPABASE_URL'?url:n==='BNB_TEST_SUPABASE_SECRET_KEY'?key:undefined};
}
export default async function handler(request){
  try{
    const configured=runtimeConfiguration(),{rpcUrl}=configured;
    const client=createPublicClient({chain:bsc,transport:http(rpcUrl,{timeout:10000})});
    return createBnbTestHandler({rpc:createBnbTestRpc({getEnv:configured.getEnv}),client})(request);
  }catch{
    return Response.json({status:'error',error:'service-unavailable',gameplayAuthorized:false},
      {status:503,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
}
export const config={path:'/api/arcade-bnb-test',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:60}};
