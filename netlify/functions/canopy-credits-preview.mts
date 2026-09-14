import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { CreditError, createSimulationLedger, readJson } from '../lib/canopy-credits-simulation.mjs';
const json = (body: unknown, status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});

export default async (request: Request) => {
  try {
    const origin=Netlify.env.get('TREE_ACCOUNT_PREVIEW_ORIGIN');
    if(Netlify.env.get('TREE_CC_SIMULATION_ENABLED')!=='true' || !origin || new URL(request.url).origin!==origin || !new URL(origin).hostname.startsWith('deploy-preview-')) return json({error:'simulation-disabled'},503);
    if(request.method!=='POST')return json({error:'method-not-allowed'},405);
    if(request.headers.has('origin')||request.headers.has('sec-fetch-site'))return json({error:'server-channel-required'},403);
    const body=await readJson(request);
    if(!/^[a-f0-9]{64}$/.test(body?.token||'') || Object.keys(body).some(k=>!['token','command'].includes(k)))return json({error:'sign-in-required'},401);
    // Reuse the existing central account verifier, including audience/parent revocation.
    const auth=await fetch(`${origin}/api/tree-account`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'game-session',token:body.token}),redirect:'error',signal:AbortSignal.timeout(12000)});
    const identity=(await auth.json()).identity;
    if(!auth.ok)return json({error:auth.status===401?'sign-in-required':'authentication-unavailable'},auth.status===401?401:503);
    if(!identity?.authenticated||identity.environment!=='preview')return json({error:'sign-in-required'},401);
    const namespace=createHash('sha256').update(origin).digest('hex').slice(0,12);
    const store=getStore({name:`canopy-credits-simulation-v1-${namespace}`,consistency:'strong'});
    // Private preview signing key; never exported or used for mainnet quotes.
    let key=await store.get('quote-signing-key',{type:'text'});
    if(!key){await store.set('quote-signing-key',randomBytes(32).toString('hex'),{onlyIfNew:true});key=await store.get('quote-signing-key',{type:'text'});}
    const execute=createSimulationLedger({store,key,paused:Netlify.env.get('TREE_CC_SIMULATION_PAUSED')==='true'});
    const result=await execute(identity.accountId,body.command);
    return json({status:'ok',...result});
  } catch(error) { return json({error:error instanceof CreditError?error.message:'simulation-unavailable'},error instanceof CreditError?error.status:503); }
};
export const config={path:'/api/canopy-credits-preview'};
