import {createIntegratedGatewayHandler,getGatewayServices,getPaidContinueService} from '../preview-lib/treeforce89-gateway.mjs';
import {canonicalPaidContinuesEnabled} from '../preview-lib/treeforce89-runtime-policy.mjs';
import {createPaidContinueHttpHandler,paidContinueSchemaReady} from '../preview-lib/treeforce89-paid-continue.mjs';
import {canonicalDevelopmentRequestAllowed,getCanonicalDevelopmentDatabase} from '../preview-lib/treeforce89-database.mjs';
import {inspectTreeForceSchema} from '../../scripts/lib/treeforce89-schema.mjs';

const build={branch:'feature/treeforce89-play-integration',mode:'canonical-development'};
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
const services=origin=>getGatewayServices(origin,getCanonicalDevelopmentDatabase);
const actions={'tree-challenge':'challenge','tree-session':'enter','tree-logout':'logout','tree-run':'restart'};
const handlers=Object.fromEntries(Object.entries(actions).map(([path,action])=>[path,
  createIntegratedGatewayHandler({action,build,services,requestAllowed:canonicalDevelopmentRequestAllowed})]));

async function dispatch(request,context) {
  if(!canonicalDevelopmentRequestAllowed(build,context,request))
    return Response.json({enabled:false,authorized:false},{status:503,headers});
  const path=new URL(request.url).pathname.slice('/play/treeforce89/api/'.length);
  if(['tree-continue','tree-continue-offer','tree-continue-recover'].includes(path))
    return createPaidContinueHttpHandler({action:path==='tree-continue-offer'?'offer':'redeem',
      getService:()=>getPaidContinueService(new URL(request.url).origin,getCanonicalDevelopmentDatabase,{enabled:canonicalPaidContinuesEnabled})})(request);
  if(path==='status') {
    try {
      const {pool}=getCanonicalDevelopmentDatabase();
      const schema=await inspectTreeForceSchema(pool);
      const paymentSchemaReady=await paidContinueSchemaReady(pool);
      return Response.json({schemaReady:schema.schemaReady,tableCount:schema.tableCount,
        isolationVerified:true,paymentSchemaReady,paymentsEnabled:paymentSchemaReady&&canonicalPaidContinuesEnabled},{status:schema.schemaReady?200:503,headers});
    } catch {
      return Response.json({schemaReady:false,paymentsEnabled:false},{status:503,headers});
    }
  }
  return Object.hasOwn(handlers,path)?handlers[path](request,context):
    Response.json({error:'Not found'},{status:404,headers});
}
export default async function handler(request,context){
 const started=Date.now();
 const route=new URL(request.url).pathname.split('/').pop();
 const known=['status','tree-challenge','tree-session','tree-logout','tree-run','tree-continue','tree-continue-offer','tree-continue-recover'];
 let response;
 try{response=await dispatch(request,context);}
 catch{response=Response.json({error:'Game service is temporarily unavailable. Please retry.',code:'SERVICE_UNAVAILABLE'},{status:503,headers});}
 console.info(JSON.stringify({event:'treeforce89-api',route:known.includes(route)?route:'unknown',status:response.status,durationMs:Date.now()-started}));
 return response;
}
export const config={path:'/play/treeforce89/api/*',
  rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:60}};
