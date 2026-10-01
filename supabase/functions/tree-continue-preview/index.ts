import { SuiGrpcClient, GrpcWebFetchTransport } from '@mysten/sui/grpc';
import { createHostedPreview, boundedJson } from './gateway.mjs';
import { ENDPOINT, createProbe } from './probe.mjs';
class ProbeTransport extends GrpcWebFetchTransport {
  constructor() { super({ baseUrl: ENDPOINT, format: 'binary', fetchInit: { redirect: 'error' } }); }
  unary(method: any, input: any, options: any) {
    if (!['sui.rpc.v2.LedgerService/GetServiceInfo', 'sui.rpc.v2.StateService/GetCoinInfo'].includes(`${method.service.typeName}/${method.name}`)) throw Error('readonly-method-required');
    return super.unary(method, input, options);
  }
  serverStreaming(): never { throw Error('streaming-disabled'); }
  clientStreaming(): never { throw Error('streaming-disabled'); }
  duplex(): never { throw Error('streaming-disabled'); }
}
const client = new SuiGrpcClient({ network: 'mainnet', transport: new ProbeTransport() });
const handler = createHostedPreview({ probe: createProbe(client), lookup: async (params: object) => {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (url !== 'https://lehswszuekjqottolmsf.supabase.co' || !key) throw Error('storage-not-configured');
  const r = await fetch(url + '/rest/v1/rpc/tree_continue_preview_lookup', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key }, body: JSON.stringify(params),
  });
  if (!r.ok) throw Error('storage-unavailable');
  return boundedJson(r, 280000);
}});
Deno.serve(handler);
