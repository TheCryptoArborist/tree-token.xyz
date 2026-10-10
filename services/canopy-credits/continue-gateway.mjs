import {createPaidDeliveryHttp} from './paid-delivery-http.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
/** Server channel only. Uses the same central opaque TREE-session authority as
 * storage, but a separate service/credential boundary. No runtime is installed
 * by importing this factory. No signing key, receipt fixture or browser actor.
 */
export function createContinueGateway({authOrigin,gameOrigin,service,fetcher=fetch,now=Date.now}){
 for(const origin of [authOrigin,gameOrigin])if(new URL(origin).origin!==origin||!origin.startsWith('https:'))throw Error('invalid-continue-origin');
 const handler=createPaidDeliveryHttp({origin:gameOrigin,service,resolveActor:async request=>{
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return null;
  const response=await fetcher(authOrigin+'/api/tree-account',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'game-session',token})});
  if(!response.ok)return null;
  const p=await response.json(),i=p.identity;
  if(p.status!=='ok'||i?.authenticated!==true||i.environment!=='preview'||!id(i.accountId)||i.wallet?.family!=='sui'||!/^0x[a-f0-9]{64}$/.test(i.wallet.address||'')||/^0x0+$/.test(i.wallet.address)||!Number.isSafeInteger(i.expiresAt)||i.expiresAt<=now())return null;
  // The pinned issuer's approved preview namespace maps only to release-candidate.
  return{authenticated:true,identityMappingReviewed:true,authOrigin,environment:'release-candidate',accountId:i.accountId,wallet:{family:'sui',address:i.wallet.address}};
 }});
 return async request=>{
  if(request.method!=='POST')return json({error:'method-not-allowed'},405);
  if(request.headers.has('origin')||request.headers.has('sec-fetch-site'))return json({error:'server-channel-required'},403);
  const headers=new Headers({'Origin':gameOrigin,'Content-Type':request.headers.get('content-type')||'','Authorization':request.headers.get('authorization')||''});
  return handler(new Request(gameOrigin+'/api/tree-continue',{method:'POST',headers,body:request.body,duplex:'half'}));
 };
}
