// Isolated candidate; not in any currently published functions directory.
import {runtimeConfiguration} from '../bnb-test-functions/arcade-bnb-test.mjs';
import {createBnbTestRpc} from '../../scripts/multichain/bnb-test-auth-service.mjs';
import {createRunRpc} from '../../scripts/multichain/bnb-run-http.mjs';
import {createGenerationRunReviewHttp} from '../../contracts/bnb-generation/scripts/run-authorization-adapter.mjs';
import {createReadProvider} from '../../contracts/bnb-generation/browser/read-rpc.mjs';
import {newClient} from '../../contracts/nftree-generation/scripts/readiness.mjs';
export const config={path:'/api/arcade-bnb-test/run-review',rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:20}};
const read=n=>globalThis.Netlify?.env?.get(n)??process.env[n];
const deny=(error,status=503)=>Response.json({error,gameplayAuthorized:false},{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function candidateConfiguration(get=read){
 if(get('BNB_RUN_REVIEW_ENABLED')!=='true')return null;
 // Only the completed generation is currently reviewed. No implicit gen-2 grant.
 if(get('BNB_RUN_REVIEW_GENERATION')!=='1')throw Error('Generation not reviewed');
 const c=runtimeConfiguration(get);return {identityRpc:createBnbTestRpc({getEnv:c.getEnv}),runRpc:createRunRpc({url:c.getEnv('BNB_TEST_SUPABASE_URL'),key:c.getEnv('BNB_TEST_SUPABASE_SECRET_KEY')}),approvedGeneration:'1'};
}
export default async function handler(request,context){
 try{
  const c=candidateConfiguration();if(!c)return deny('review-disabled');
  if(context?.site?.id!=='aa62f324-b880-47d6-85b8-4ba0700ff5bf'||!context?.ip)return deny('platform-context-required');
  // Admission is enforced by Netlify config.rateLimit before this function;
  // package verification requires the exact traffic rules. DB adds session cap.
  return createGenerationRunReviewHttp({...c,provider:createReadProvider({request:async()=>{throw Error('Read-only remote')}}),sui:newClient(),admit:async()=>true})(request);
 }catch{return deny('service-unavailable');}
}
