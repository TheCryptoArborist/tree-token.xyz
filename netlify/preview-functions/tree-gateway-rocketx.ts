import { amountToRaw } from '../../gateway/options.js';

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

// Return only display fields. Never return upstream payloads, deposit instructions or credentials.
export function summarizeRocketX(q: any, chain: string, amount: string) {
  const input = q?.fromTokenInfo;
  const output = q?.toTokenInfo;
  const sourceChain = chain === 'bsc' ? '0x38' : '0x1237';
  const sourceSymbol = chain === 'bsc' ? 'BNB' : 'ETH';
  const native = (v: unknown) => v === true || v === 1 || v === '1';
  if (input?.chainId !== sourceChain || input?.token_symbol !== sourceSymbol || !native(input?.is_native_token)) return null;
  if (output?.chainId !== 'sui-mainnet' || output?.token_symbol !== 'SUI' || !native(output?.is_native_token)) return null;
  if (!/^0x0*2(?:::sui::SUI)?$/.test(output.contract_address || '')) return null;
  if (Number(q.fromAmount) !== Number(amount) || !Number.isFinite(Number(q.toAmount)) || Number(q.toAmount) <= 0) return null;
  if (q.isTxnAllowed !== true && q.isTxnAllowed !== 1) return null;
  const number = (value: unknown) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const label = (value: unknown) => typeof value === 'string' ? value.slice(0, 100) : null;
  return {
    provider: label(q.exchangeInfo?.title), exchangeType: label(q.exchangeInfo?.exchange_type),
    walletless: q.exchangeInfo?.walletLess === true, fixedRate: q.exchangeInfo?.fixedRate === true,
    expectedAmountOut: String(q.toAmount), symbol: 'SUI', coinType: '0x2::sui::SUI',
    platformFeeUsd: number(q.platformFeeUsd), platformFeePercent: number(q.platformFeeInPercent),
    gasFeeUsd: number(q.gasFeeUsd), estimatedSeconds: number(q.estTimeInSeconds?.avg),
    minAmountOut: null,
  };
}

export default async function handler(request: Request) {
  if (request.method !== 'GET') return reply({ error: 'Quotes are read-only.' }, 405);
  const params = new URL(request.url).searchParams;
  const chain = params.get('chain') || '';
  const amount = params.get('amount') || '';
  if (!['bsc', 'robinhood'].includes(chain)) return reply({ error: 'Choose BNB Chain or Robinhood Chain.' }, 400);
  try { amountToRaw(amount, 18); } catch { return reply({ error: 'Enter a valid positive native-token amount.' }, 400); }
  const key = Netlify.env.get('ROCKETX_API_KEY');
  if (!key) return reply({ error: 'RocketX is not configured for this preview.' }, 503);
  const query = new URLSearchParams({ fromToken: 'null', fromNetwork: chain === 'bsc' ? 'binance' : 'robinhood', toToken: 'null', toNetwork: 'Sui Mainnet', amount, slippage: '1' });
  try {
    const response = await fetch('https://api.rocketx.exchange/v1/quotation?' + query, {
      headers: { 'x-api-key': key, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json();
    if (response.status === 401 || response.status === 403 || Number(body?.code) === 401 || Number(body?.code) === 403) return reply({ error: 'RocketX rejected this preview API key. Check API access in the partner dashboard.' }, 502);
    if (!response.ok || body?.err || body?.error) return reply({ error: 'RocketX could not quote this route right now.' }, 502);
    const candidates = Array.isArray(body?.quotes) ? body.quotes : [];
    const quotes = candidates.map(q => summarizeRocketX(q, chain, amount)).filter(Boolean);
    return reply({ status: quotes.length ? 'ok' : 'no-route', executionEnabled: false, source: chain, amount,
      destination: 'SUI', coinType: '0x2::sui::SUI', fetchedAt: new Date().toISOString(),
      quotes, candidateCount: candidates.length, validatedCount: quotes.length,
      notice: 'Indicative quote only. No order or transfer created. Market-rate output is not guaranteed. Source gas is payable by the sender. TREE does not subsidize gas.',
    });
  } catch { return reply({ error: 'RocketX quote service is temporarily unavailable.' }, 502); }
}

export const config = { path: '/api/tree-gateway-rocketx' };
