import {SuiGrpcClient} from './treeforce89-source/node_modules/@mysten/sui/dist/grpc/index.mjs';
import {createWalletGatewayService} from './treeforce89-source/game/wallet-gateway-service.mjs';
import {createGameRunService} from './treeforce89-source/game/game-run-service.mjs';
import {checkDirectNFTreeOwnership} from './treeforce89-source/game/nftree-access.mjs';
import {createWalletGatewayHttpHandler} from './treeforce89-source/game/wallet-gateway-http.mjs';
import {createGameRunHttpHandler} from './treeforce89-source/game/game-run-http.mjs';
import {createGameLogoutHttpHandler} from './treeforce89-source/game/game-logout-http.mjs';
import {previewRequestAllowed,getPreviewDatabase} from './treeforce89-database.mjs';
import {inspectTreeForceSchema} from '../../scripts/lib/treeforce89-schema.mjs';

let schemaReady;
let suiClient;
export async function getGatewayServices(origin,database=getPreviewDatabase) {
  const {pool}=database();
  schemaReady??=inspectTreeForceSchema(pool).then(result=>{
    if(!result.schemaReady)throw Error('Authentication schema unavailable');
  });
  await schemaReady;
  suiClient??=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
  return {
    gateway:createWalletGatewayService({pool,client:suiClient,origin}),
    runs:createGameRunService({pool,ownershipChecker:({wallet})=>
      checkDirectNFTreeOwnership({client:suiClient,wallet,network:'mainnet'})}),
  };
}

export function createIntegratedGatewayHandler({action,build,services=getGatewayServices,requestAllowed=previewRequestAllowed}) {
  if(!['challenge','enter','logout','restart'].includes(action))throw Error('Unknown Gateway action');
  return async(request,context)=>{
    const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
    if(!requestAllowed(build,context,request))
      return Response.json({enabled:false,authorized:false},{status:503,headers});
    const origin=new URL(request.url).origin;
    if(action==='challenge'||action==='enter')return createWalletGatewayHttpHandler({
      action,build,getService:async()=> (await services(origin)).gateway})(request,context);
    if(action==='restart')return createGameRunHttpHandler({
      build,getService:async()=> (await services(origin)).runs})(request,context);
    return createGameLogoutHttpHandler({revoker:{revoke:async input=>
      (await services(origin)).gateway.revoke(input)}})(request);
  };
}
