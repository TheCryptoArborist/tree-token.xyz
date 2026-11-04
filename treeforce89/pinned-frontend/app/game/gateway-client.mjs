import {normalizeSuiAddress} from './tree-payment.mjs';

async function post(fetchImpl,path,body,signal) {
  const response=await fetchImpl(path,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),cache:'no-store',signal});
  let result;
  try {result=await response.json();} catch {throw Error('Sign-in service is unavailable. Please retry.');}
  if(!response.ok)throw Error(result.error || 'NFTree access could not be verified.');
  return result;
}

export async function authenticateGateway({wallet,origin,signMessage,fetchImpl=fetch,onStage=()=>{},signal}) {
  const address=normalizeSuiAddress(wallet);
  onStage('Preparing secure sign-in…');
  const challenge=await post(fetchImpl,'/.netlify/functions/tree-challenge',{wallet:address},signal);
  if(!/^[a-f0-9]{64}$/.test(challenge.nonce) || !Number.isSafeInteger(challenge.expiresAt) ||
    challenge.expiresAt<=Date.now() || challenge.expiresAt>Date.now()+6*60_000)
    throw Error('The sign-in message could not be validated. Please retry.');
  const expected=["TREE FORCE '89 wallet login",'Origin: '+origin,'Network: sui:mainnet',
    'Wallet: '+address,'Nonce: '+challenge.nonce,
    'Expires: '+new Date(challenge.expiresAt).toISOString(),
    'This signature does not authorize a token transfer.'].join('\n');
  if(challenge.message!==expected)
    throw Error('The sign-in message could not be validated. Please retry.');
  if(signal?.aborted)throw Error('Sign-in cancelled.');
  onStage('Approve the sign-in message in your wallet…');
  const signed=await signMessage(new TextEncoder().encode(challenge.message));
  if(signal?.aborted)throw Error('Sign-in cancelled.');
  onStage('Verifying NFTree access…');
  const session=await post(fetchImpl,'/.netlify/functions/tree-session',{
    wallet:address,nonce:challenge.nonce,signature:signed.signature,
  },signal);
  if(!/^[a-f0-9]{64}$/.test(session.sessionToken) || !/^grove-[a-f0-9]{32}$/.test(session.runId) ||
    !Number.isSafeInteger(session.expiresAt) || session.expiresAt<=Date.now())
    throw Error('A valid game session was not returned. Please retry.');
  return {...session,wallet:address};
}

export function isGatewaySessionCurrent(session,wallet,now=Date.now()) {
  try {return !!session && session.wallet===normalizeSuiAddress(wallet) && session.expiresAt>now;}
  catch {return false;}
}

export async function revokeGatewaySession(session,{fetchImpl=fetch,keepalive=false}={}) {
  if(!session?.sessionToken)return;
  const response=await fetchImpl('/.netlify/functions/tree-logout',{
    method:'POST',headers:{Authorization:'Bearer '+session.sessionToken},cache:'no-store',keepalive,
  });
  if(!response.ok || (await response.json()).loggedOut!==true)throw Error('Server sign-out could not be confirmed.');
}

export async function restartGatewayRun(session,{fetchImpl=fetch,signal}={}) {
  const response=await fetchImpl('/.netlify/functions/tree-run',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.sessionToken},
    body:JSON.stringify({runId:session.runId}),cache:'no-store',signal,
  });
  let result;
  try {result=await response.json();}catch{throw Error('A new run could not be confirmed. Please retry.');}
  if(!response.ok)throw Object.assign(Error(result.error||'A new run could not be confirmed.'),{code:result.code});
  if(!/^[a-f0-9]{64}$/.test(result.sessionToken) || result.sessionToken===session.sessionToken ||
    !/^grove-[a-f0-9]{32}$/.test(result.runId) || result.runId===session.runId ||
    !Number.isSafeInteger(result.expiresAt) || result.expiresAt<=Date.now() || result.expiresAt>session.expiresAt)
    throw Error('A valid new run was not returned. Disconnect and verify your NFTree again.');
  return {...result,wallet:session.wallet};
}
