const MAYAN_PRICE_URL = 'https://price-api.mayan.finance/v3';
const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';

function normalizeType(value: unknown) {
  const parts = String(value || '').trim().split('::');
  if (parts.length < 3) return String(value || '').trim().toLowerCase();
  const address = parts.shift()!.toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${address}::${parts.join('::')}`.toLowerCase();
}

export function summarizeSuiTokens(payload: any) {
  const tokens = Array.isArray(payload?.sui) ? payload.sui : Array.isArray(payload) ? payload : [];
  const clean = tokens
    .filter((token: any) => token && typeof token === 'object')
    .map((token: any) => ({
      symbol: String(token.symbol || token.name || '').trim(),
      name: String(token.name || token.symbol || '').trim(),
      contract: String(token.contract || token.verifiedAddress || '').trim(),
      verifiedAddress: String(token.verifiedAddress || token.contract || '').trim(),
      decimals: Number.isInteger(Number(token.decimals)) ? Number(token.decimals) : null,
      logoURI: typeof token.logoURI === 'string' ? token.logoURI : typeof token.logoUrl === 'string' ? token.logoUrl : null,
    }))
    .filter((token: any) => token.symbol && token.contract && token.contract.includes('::'));
  const tree = clean.find((token: any) => normalizeType(token.contract) === normalizeType(TREE_TYPE)) || null;
  return { tokens: clean, treeDirectListed: Boolean(tree), tree };
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' },
    });
  }
  try {
    const upstream = await fetch(`${MAYAN_PRICE_URL}/tokens?chain=sui`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`Mayan token API returned ${upstream.status}`);
    const payload = await upstream.json();
    const summary = summarizeSuiTokens(payload);
    return new Response(JSON.stringify({
      status: 'ok',
      provider: 'Mayan',
      chain: 'sui',
      fetchedAt: new Date().toISOString(),
      ...summary,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('TREE Gateway Mayan token discovery failed', error);
    return new Response(JSON.stringify({ status: 'unavailable', provider: 'Mayan', chain: 'sui', tokens: [], treeDirectListed: false }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};

export const config = { path: '/api/tree-gateway-tokens' };
