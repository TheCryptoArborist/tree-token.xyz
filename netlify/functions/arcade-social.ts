import { createHash } from 'node:crypto';
import { ARCADE_GROWTH_ORIGINS } from '../lib/arcade-growth-core.ts';
import { arcadeGrowthSupabaseConfig } from '../lib/arcade-growth-store.ts';

type Env = Record<string, string | undefined>;
export function socialProof(mission: unknown, proof: unknown): string {
  if (typeof proof !== 'string' || proof.length > 1000) throw new Error('invalid-proof');
  if (mission === 'community-vote' && ['treeforce89','garden-bot','arborist-trials'].includes(proof)) return proof;
  if (!['share-score','friend-challenge'].includes(String(mission))) throw new Error('invalid-proof');
  const url = new URL(proof.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['x.com','twitter.com','www.x.com','www.twitter.com'].includes(url.hostname)) throw new Error('invalid-proof');
  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]{1,25})\/?$/);
  if (!match) throw new Error('invalid-proof');
  // A post ID identifies the proof; normalize aliases, case and tracking parameters.
  return `https://x.com/${match[1].toLowerCase()}/status/${match[2]}`;
}
function environment(): Env {
  const runtime = (globalThis as any).Netlify?.env;
  const keys = ['ARCADE_SOCIAL_ENABLED', ...['ARCADE_GROWTH','TREE_RAFFLE','TREE_KNOWLEDGE_TRIAL'].flatMap(p => [`${p}_SUPABASE_URL`,`${p}_SUPABASE_SECRET_KEY`])];
  return Object.fromEntries(keys.map(k => [k, runtime?.get(k) ?? process.env[k]]));
}
export function createSocialHandler({ env, fetchImpl = fetch }: { env?: Env; fetchImpl?: typeof fetch } = {}) {
  return async (request: Request) => {
    const reply = (value: unknown, status = 200) => Response.json(value, {status, headers: {'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    const settings = env || environment();
    if (settings.ARCADE_SOCIAL_ENABLED !== 'true') return reply({error:'missions-unavailable',message:'Community missions are being prepared. Daily tasks remain available.'},503);
    if (!['GET','POST'].includes(request.method)) return reply({error:'method-not-allowed'},405);
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    if (!(ARCADE_GROWTH_ORIGINS as readonly string[]).includes(origin)) return reply({error:'origin-not-allowed'},403);
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer [A-Za-z0-9_-]{32,512}$/.test(auth)) return reply({error:'authentication-required'},401);
    let mission: string | null = null, proof: string | null = null;
    if (request.method === 'POST') {
      try {
        if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new Error();
        const reader = request.body?.getReader(); let input = '', size = 0;
        const decoder = new TextDecoder();
        if (!reader) throw new Error();
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 2048) { await reader.cancel(); throw new Error(); }
          input += decoder.decode(part.value, {stream:true});
        }
        input += decoder.decode();
        const data = JSON.parse(input);
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !['mission','proof'].includes(k))) throw new Error();
        proof = socialProof(data.mission,data.proof); mission = data.mission;
      } catch { return reply({error:'invalid-proof',message:'Choose a vote or paste a public X post link.'},400); }
    }
    try {
      const connection = arcadeGrowthSupabaseConfig(settings);
      const response = await fetchImpl(`${connection.url}/rest/v1/rpc/arcade_social_v1`, {
        method:'POST', headers:{'Content-Type':'application/json',apikey:connection.secretKey,Authorization:`Bearer ${connection.secretKey}`},
        body:JSON.stringify({p_token_sha256:createHash('sha256').update(auth.slice(7)).digest('hex'),p_origin:origin,p_mission:mission,p_proof:proof}),
        signal:AbortSignal.timeout(8000),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.message === 'arcade-growth-invalid-session') return reply({error:'invalid-session',message:'Sign in again to load community missions.'},401);
        if (payload.code === '23505') return reply({error:'proof-already-used',message:'That post has already been submitted.'},409);
        throw new Error();
      }
      if (!payload || !/^0x[0-9a-f]{64}$/.test(payload.wallet) || !Array.isArray(payload.entries) || !Number.isFinite(Date.parse(payload.resetsAt))) throw new Error();
      return reply({status:'ok',...payload});
    } catch { return reply({error:'missions-unavailable',message:'Community missions are unavailable. Your daily progress is unchanged.'},503); }
  };
}
export default createSocialHandler();
export const config = {path:'/api/arcade-social',method:['GET','POST'],rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:30}};
