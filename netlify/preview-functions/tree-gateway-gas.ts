export default async function handler(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'GET') return Response.json({ error: 'Read only.' }, { status: 405, headers });
  const address = new URL(request.url).searchParams.get('address') || '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) return Response.json({ error: 'Invalid EVM address.' }, { status: 400, headers });
  try {
    const response = await fetch('https://mainnet.base.org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }), signal: AbortSignal.timeout(8000), redirect: 'error' });
    const data = await response.json();
    if (!response.ok || data.error || typeof data.result !== 'string' || !/^0x[0-9a-f]+$/i.test(data.result)) throw Error();
    return Response.json({ address, chainId: 8453, balance: data.result, checkedAt: new Date().toISOString() }, { headers });
  } catch { return Response.json({ error: 'Base balance check unavailable.' }, { status: 502, headers }); }
}
export const config = { path: '/api/tree-gateway-gas' };
