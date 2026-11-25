// Undeployed dispatcher: the host supplies its verified native handler and policy.
// No route registration or default activation. The new shared client is required.
const prefix='/play/treeforce89/api/';
const sharedPaths={
 'shared-continue-bnb-record':'bnb-record',
 'shared-continue-complete':'complete',
 'shared-continue-prepare':'prepare','shared-continue-activate':'activate',
 'shared-continue-record':'record','shared-continue-recover':'recover','shared-continue-offer':'offer',
};
const legacyPaymentPaths=new Set(['tree-continue','tree-continue-recover','tree-continue-offer']);
const deny=(code,status=503)=>Response.json({protocol:'tree-paid-delivery.v2',code,status:'review-required',restoreAuthorized:false,requiresPayment:false},{status,headers:{'Cache-Control':'no-store'}});
export function createNativeContinueGateway({legacyHandler,sharedHandlers={},readMode=async()=> 'legacy'}){
 if(typeof legacyHandler!=='function'||typeof readMode!=='function')throw Error('gateway-adapters-required');
 return async (request,context)=>{
  const url=new URL(request.url);const name=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):null;
  // Ordinary native authentication/game paths keep their original guards and behavior.
  if(!Object.hasOwn(sharedPaths,name)&&!legacyPaymentPaths.has(name))return legacyHandler(request,context);
  let mode;try{mode=await readMode();}catch{return deny('POLICY_UNAVAILABLE');}
  if(mode==='legacy')return Object.hasOwn(sharedPaths,name)?deny('SHARED_CONTINUE_DISABLED'):legacyHandler(request,context);
  // A failed/unknown policy must never fall back to a legacy redemption writer.
  if(mode!=='shared')return deny('POLICY_UNAVAILABLE');
  if(legacyPaymentPaths.has(name))return deny('SHARED_CONTINUE_REQUIRED',409);
  // Require a complete coordinated composition, not just the activation endpoint.
  if(!Object.values(sharedPaths).every(action=>typeof sharedHandlers[action]==='function'))return deny('SHARED_GATEWAY_INCOMPLETE');
  if(!['https://tree-token.xyz','https://www.tree-token.xyz'].includes(url.origin)||request.headers.get('origin')!==url.origin||url.search||request.method!=='POST'||request.headers.get('sec-fetch-site')==='cross-site')return deny('REQUEST_DENIED',403);
  try{return await sharedHandlers[sharedPaths[name]](request,context);}catch{return deny('REVIEW_REQUIRED');}
 };
}
