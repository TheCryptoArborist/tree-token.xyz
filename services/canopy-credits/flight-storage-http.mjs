/** Deployment-neutral HTTP handler. A host must inject real session verification
 * and rate limiting. Never pass a browser-supplied identity as resolveSession.
 * This module does not deploy a route or enable paid checkout.
 */
import { MAX_CHECKPOINT_BYTES } from './flight-storage.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const known=new Set(['verified-flight-identity-required','flight_identity_mismatch','flight_not_found','invalid-flight-id',
  'flight_checkpoint_already_fixed','checkpoint-flight-mismatch','checkpoint-not-exhausted','unexpected-checkpoint-field',
  'checkpoint-too-large','checkpoint-too-deep','invalid-checkpoint','invalid-checkpoint-number','invalid-checkpoint-score',
  'invalid-checkpoint-wave','invalid-checkpoint-scene','invalid-checkpoint-key','invalid-checkpoint-value']);
export function createFlightStorageHandler({storage,resolveSession,allowRequest,origin}) {
  if(typeof resolveSession!=='function'||typeof allowRequest!=='function'||new URL(origin).origin!==origin) throw Error('reviewed-host-adapters-required');
  return async request=>{
    try {
      if(new URL(request.url).origin!==origin) return json({error:'origin-mismatch'},403);
      if(request.method!=='POST') return json({error:'method-not-allowed'},405);
      if(request.headers.get('origin')!==origin) return json({error:'origin-mismatch'},403);
      if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json') return json({error:'json-required'},415);
      const actor=await resolveSession(request);
      if(actor?.authenticated!==true) return json({error:'sign-in-required'},401);
      if(!await allowRequest(actor,request)) return json({error:'rate-limited'},429);
      const reader=request.body?.getReader();if(!reader)return json({error:'invalid-json'},400);
      let size=0;const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
        if(size>MAX_CHECKPOINT_BYTES+4096){await reader.cancel();return json({error:'checkpoint-too-large'},413);}chunks.push(value);}
      let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json({error:'invalid-json'},400);}
      const fields={register:['runId'],checkpoint:['runId','requestId','snapshot'],recover:['runId']};
      if(!b||Array.isArray(b)||!Object.hasOwn(fields,b.action)||Object.keys(b).length!==fields[b.action].length+1
        ||Object.keys(b).some(k=>k!=='action'&&!fields[b.action].includes(k)))return json({error:'invalid-command'},400);
      const result=b.action==='register'?await storage.register(actor,b.runId):b.action==='checkpoint'
        ?await storage.save(actor,b.runId,b.requestId,b.snapshot):await storage.recover(actor,b.runId);
      return json({status:'ok',result});
    }catch(error){
      const code=known.has(error.code)?error.code:known.has(error.message)?error.message:null;
      return json({error:code||'flight-storage-unavailable'},code?(code==='verified-flight-identity-required'?401:409):503);
    }
  };
}
