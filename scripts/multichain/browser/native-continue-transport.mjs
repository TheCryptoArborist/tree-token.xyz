// Source-only checkout transport. No signing, auto-payment, retry or persistence.
// Wire to the existing authenticated session and wallet checkout UI explicitly.
export function createNativeContinueTransport({getSession,fetch:send=globalThis.fetch,origin=globalThis.location?.origin,clock=Date.now}){
 if(!['https://tree-token.xyz','https://www.tree-token.xyz'].includes(origin)||typeof getSession!=='function'||typeof send!=='function')throw Error('canonical-native-transport-required');
 const actions=['complete','offer','record','recover','prepare','activate'];
 const identity=s=>s&&JSON.stringify([s.sessionToken,s.nativeRunId,s.runId,s.accountId,s.epoch,s.expiresAt]);
 return Object.freeze(Object.fromEntries(actions.map(action=>[action,async input=>{
  const session=getSession(),before=identity(session);
  if(!/^[a-f0-9]{64}$/.test(session?.sessionToken||'')||!/^grove-[a-f0-9]{32}$/.test(session?.nativeRunId||'')||typeof session?.epoch!=='string'||!session.epoch.length||!Number.isSafeInteger(session.expiresAt)||session.expiresAt<=clock())throw Error('native-session-required');
  if(action==='offer'&&input?.runId!==session.nativeRunId)throw Error('native-run-changed');
  // Serialize before sending; credentials can only be supplied by getSession.
  const body=JSON.stringify(input);if(new TextEncoder().encode(body).byteLength>2048)throw Error('request-too-large');
  const response=await send(origin+'/play/treeforce89/api/shared-continue-'+action,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.sessionToken},body});
  if(identity(getSession())!==before||session.expiresAt<=clock())throw Error('native-session-changed-review-required');
  if(!response.ok)throw Error('continue-review-required');
  const result=await response.json();
  if(identity(getSession())!==before||session.expiresAt<=clock())throw Error('native-session-changed-review-required');
  if(!result||typeof result!=='object'||Array.isArray(result))throw Error('invalid-continue-response');
  if(['complete','offer','record','recover'].includes(action)&&result.restoreAuthorized!==false)throw Error('invalid-continue-response');
  return result;
 }])));
}
