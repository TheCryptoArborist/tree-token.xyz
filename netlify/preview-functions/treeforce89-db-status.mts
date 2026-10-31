import build from '../generated/treeforce89-context.json' with {type:'json'};
import {previewRequestAllowed,databaseStatus} from '../preview-lib/treeforce89-database.mjs';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
export default async function handler(request,context) {
  if(!previewRequestAllowed(build,context,request))
    return Response.json({ready:false},{status:503,headers});
  try {
    const result=await databaseStatus();
    return Response.json(result,{status:200,headers});
  } catch {
    return Response.json({ready:false,error:'Preview database verification unavailable'},
      {status:503,headers});
  }
}
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}};
