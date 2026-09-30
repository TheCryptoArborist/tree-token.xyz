import {createRecoveryGateway,AUTH_ORIGIN} from '../../../services/canopy-credits/recovery-gateway.mjs';
// Custom authentication: verify a central TREE session scoped to the recovery candidate.
// Platform-held backend keys never leave this Edge Function environment.
Deno.serve(createRecoveryGateway({
 verifySession:async(token:string)=>{
  const r=await fetch(AUTH_ORIGIN+'/api/tree-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'game-session',token}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok)return null;const p=await r.json();return p.status==='ok'?p.identity:null;
 },
 invokeStorage:async(params:unknown)=>{
  const url=Deno.env.get('SUPABASE_URL');
  const modern=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
  const key=modern||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw Error('storage-not-configured');
  const headers:Record<string,string>={'Content-Type':'application/json',apikey:key};
  if(!modern)headers.Authorization='Bearer '+key;
  const r=await fetch(url+'/rest/v1/rpc/tree_recovery_candidate_rpc',{method:'POST',headers,body:JSON.stringify(params),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok){const p=await r.json().catch(()=>({}));if(p.message==='candidate_rate_limit')throw Object.assign(Error('recovery-rate-limit'),{status:429});throw Error('storage-failed');}
  return r.json();
 }
}));
