// Separate candidate-only function. Deliberately NOT under netlify/functions.
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { createBnbTestHandler, createBnbTestRpc } from '../../scripts/multichain/bnb-test-auth-service.mjs';
const getEnv=n=>globalThis.Netlify?.env?.get(n)??process.env[n];
export default async function handler(request){
  try{
    const rpcUrl=getEnv('BNB_TEST_RPC_URL');
    if(typeof rpcUrl!=='string'||!/^https:\/\/[^/@?#]+(?:\/[^?#]*)?$/.test(rpcUrl))
      throw Error('RPC not configured');
    const client=createPublicClient({chain:bsc,transport:http(rpcUrl,{timeout:10000})});
    return createBnbTestHandler({rpc:createBnbTestRpc({getEnv}),client})(request);
  }catch{
    return Response.json({status:'error',error:'service-unavailable',gameplayAuthorized:false},
      {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
export const config={path:'/api/arcade-bnb-test'};
