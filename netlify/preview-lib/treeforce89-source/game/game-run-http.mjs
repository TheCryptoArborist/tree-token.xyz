import {previewAccessAllowed} from './preview-access.mjs';

const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
const reply=(body,status)=>Response.json(body,{status,headers});

export function createAuthenticatedRunHttpHandler({build,getService,action}) {
  if(!['restart','review'].includes(action))throw Error('Invalid authenticated run action');
  return async function handler(request,context) {
    if(!previewAccessAllowed(build,context,request))return reply({enabled:false},503);
    if(request.method!=='POST')return Response.json({error:'Method not allowed'},
      {status:405,headers:{...headers,Allow:'POST'}});
    if(request.headers.get('origin')!==new URL(request.url).origin ||
      request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Origin not permitted'},403);
    const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
    if(!token)return reply({error:'Verify your NFTree again.',code:'SESSION_REQUIRED'},401);
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return reply({error:'JSON required'},415);
    let runId;
    try {
      const reader=request.body?.getReader();
      if(!reader)throw Error('Body required');
      const chunks=[];let size=0;
      try {
        while(true){const {done,value}=await reader.read();if(done)break;
          size+=value.byteLength;if(size>256){await reader.cancel();throw Error('Too large');}chunks.push(value);}
      } finally {reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const body=JSON.parse(new TextDecoder().decode(bytes));
      if(!body || Array.isArray(body) || Object.keys(body).length!==1 || typeof body.runId!=='string' ||
        !/^grove-[a-f0-9]{32}$/.test(body.runId))throw Error('Invalid run');
      runId=body.runId;
    } catch {return reply({error:'Only the current run identifier is permitted.'},400);}
    try {
      const service=await getService();
      return reply(await service[action]({sessionToken:token,runId}),201);
    } catch(error) {
      const errors={
        SESSION_REQUIRED:[401,'Verify your NFTree again.'],
        RUN_CHANGED:[409,'This run has changed. Verify your NFTree again.'],
        NFTREE_REQUIRED:[403,'A directly held NFTree is required.'],
      };
      if(Object.hasOwn(errors,error?.code)){
        const [status,message]=errors[error.code];return reply({code:error.code,error:message},status);
      }
      return reply({error:action==='review'?'Checkout details could not be confirmed. Please retry.':
        'A new run could not be confirmed. Retry, or disconnect and verify your NFTree again.'},503);
    }
  };
}

export function createGameRunHttpHandler(options) {
  return createAuthenticatedRunHttpHandler({...options,action:'restart'});
}
