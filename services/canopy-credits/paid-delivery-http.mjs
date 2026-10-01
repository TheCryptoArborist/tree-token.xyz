const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
/** Deployment-neutral boundary. resolveActor must verify the HttpOnly session;
 * it cannot trust request-body account identifiers. No route is activated here.
 */
export function createPaidDeliveryHttp({origin,resolveActor,service}){
 if(new URL(origin).origin!==origin||!origin.startsWith('https://')||typeof resolveActor!=='function'||typeof service!=='function')throw Error('invalid-delivery-handler');
 return async request=>{
  if(new URL(request.url).origin!==origin||request.headers.get('origin')!==origin)return response({error:'origin-mismatch'},403);
  if(request.method!=='POST')return response({error:'method-not-allowed'},405);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return response({error:'json-required'},415);
  const reader=request.body?.getReader();if(!reader)return response({error:'invalid-json'},400);
  let length=0;const parts=[];
  try{
   while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();return response({error:'request-too-large'},413);}parts.push(value);}
   let command;try{command=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return response({error:'invalid-json'},400);}
   if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).some(k=>['accountId','payer','actor','evidence','verified','restoreAuthorized','clientHash'].includes(k)))return response({error:'invalid-command'},400);
   const actor=await resolveActor(request);if(!actor?.authenticated)return response({error:'sui-sign-in-required'},401);
   return response(await service(actor,command));
  }catch(e){
   const expected=new Set(['delivery-protocol-required','invalid-delivery-command','invalid-delivery-activation','delivery-client-required','delivery_lease_expired','delivery_lease_mismatch','delivery_checkpoint_mismatch','paid_order_not_found','paid_delivery_prerequisite_failed','checkout-not-enabled','verified-delivery-identity-required']);
   const code=e.code==='P0001'?e.message:e.code;
   return response({error:expected.has(code)?code:'delivery-unavailable',requiresPayment:false},expected.has(code)?409:503);
  }
 };
}
