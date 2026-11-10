const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
const reply=(b,status=200)=>Response.json(b,{status,headers});
export function createRenewalHandler({getService}){return async(request,context)=>{
 const url=new URL(request.url);
 if(context?.site?.id!=='aa62f324-b880-47d6-85b8-4ba0700ff5bf'||context?.deploy?.context!=='production'||url.protocol!=='https:'||!['tree-token.xyz','www.tree-token.xyz',`${context.deploy.id}--tree-token.netlify.app`].includes(url.host))return reply({code:'NOT_AVAILABLE'},503);
 if(request.method!=='POST')return reply({code:'METHOD_NOT_ALLOWED'},405);
 if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return reply({code:'ORIGIN_REJECTED'},403);
 const sessionToken=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];if(!sessionToken)return reply({code:'SESSION_REQUIRED'},401);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({code:'JSON_REQUIRED'},415);
 let body;try{const reader=request.body?.getReader();if(!reader)throw Error();let size=0,chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length;}body=JSON.parse(new TextDecoder().decode(bytes));if(!body||Array.isArray(body)||!/^grove-[a-f0-9]{32}$/.test(body.runId)||Object.keys(body).some(k=>!['runId','freshToken'].includes(k))||body.freshToken!==undefined&&!/^[a-f0-9]{64}$/.test(body.freshToken))throw Error();}catch{return reply({code:'INVALID_REQUEST'},400);}
 try{const service=await getService();return reply(await service[body.freshToken?'recover':'refresh']({...body,sessionToken}));}catch(e){const known={SESSION_REQUIRED:401,FRESH_SIGN_IN_REQUIRED:401,REVERIFY_REQUIRED:401,NFTREE_REQUIRED:403,RUN_COMPLETED:409,RUN_TOO_OLD:409};return reply({code:Object.hasOwn(known,e.code)?e.code:'RENEWAL_UNAVAILABLE'},known[e.code]||503);}
};}
