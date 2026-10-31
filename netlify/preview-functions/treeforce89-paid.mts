import build from '../generated/treeforce89-context.json' with {type:'json'};
import {previewRequestAllowed,getPreviewDatabase} from '../preview-lib/treeforce89-database.mjs';
import {getPaidContinueService,paidContinuesEnabled} from '../preview-lib/treeforce89-gateway.mjs';
import {createPaidContinueHttpHandler,paidContinueSchemaReady} from '../preview-lib/treeforce89-paid-continue.mjs';
export default async function handler(request,context) {
 const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
 if(!previewRequestAllowed(build,context,request))return Response.json({enabled:false},{status:503,headers});
 const path=new URL(request.url).pathname.split('/').at(-1);
 if(path==='status'){
  try{const {pool}=getPreviewDatabase();const paymentSchemaReady=await paidContinueSchemaReady(pool);
   return Response.json({paymentSchemaReady,paymentsEnabled:paymentSchemaReady&&paidContinuesEnabled()},{headers});}
  catch{return Response.json({paymentSchemaReady:false,paymentsEnabled:false},{status:503,headers});}
 }
 return createPaidContinueHttpHandler({action:path==='tree-continue-offer'?'offer':'redeem',
  getService:()=>getPaidContinueService(new URL(request.url).origin)})(request);
}
export const config={path:['/play/treeforce89/api/tree-continue','/play/treeforce89/api/tree-continue-offer',
 '/play/treeforce89/api/tree-continue-recover','/play/treeforce89/api/status'],
 rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:60}};
