import { getDeployStore } from '@netlify/blobs';
import { authorizeProbe, runUnfundedProbe } from '../lib/gateway-rocketx-probe.ts';

// Temporary, operator-signed diagnostic. No browser UI, wallet signing or transfer path.
// The private signing key exists only in the operator's ignored local directory.
export default async function handler(request: Request, context: any) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (request.method !== 'POST') return reply({ error: 'Not available.' }, 405);
  if (context?.site?.id !== 'aa62f324-b880-47d6-85b8-4ba0700ff5bf') return reply({ error: 'Not available.' }, 404);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw Error();
    const { data, signature } = JSON.parse(raw);
    input = authorizeProbe(data, signature, '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAnaE80clvSMIrYLVD7GkC9JXdmIL9NmT6gBWCoa3d4Kc=\n-----END PUBLIC KEY-----', context.deploy);
  } catch { return reply({ error: 'Not authorized.' }, 403); }
  const key = Netlify.env.get('ROCKETX_API_KEY');
  if (!key) return reply({ error: 'Preview API access unavailable.' }, 503);
  try {
    const store = getDeployStore({ name: 'rocketx-unfunded-review', deployID: context.deploy.id, consistency: 'strong' });
    return reply(await runUnfundedProbe(input, store, key));
  } catch { return reply({ error: 'Review unavailable; do not create a replacement order.' }, 503); }
}
export const config = { path: '/api/tree-gateway-rocketx-probe' };
