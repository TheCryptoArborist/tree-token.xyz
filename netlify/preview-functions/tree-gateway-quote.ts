import { SOURCES, SUI, USDC, TREE, amountToRaw } from '../../gateway/options.js';

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function summarizeQuote(q: any, chain: string, source: string, destination: string, now = Date.now()) {
  const sameSource = chain === 'solana' ? q?.fromToken?.contract === source : q?.fromToken?.contract?.toLowerCase() === source.toLowerCase();
  if (q?.fromChain !== chain || q?.toChain !== 'sui' || !sameSource || q?.toToken?.contract !== destination) return null;
  if (!Number.isFinite(Number(q.expectedAmountOut)) || Number(q.expectedAmountOut) <= 0 || !Number.isFinite(Number(q.minAmountOut)) || Number(q.minAmountOut) <= 0 || Number(q.minAmountOut) > Number(q.expectedAmountOut)) return null;
  const deadline = Number(q.deadline64) * 1000;
  if (!Number.isFinite(deadline) || deadline <= now || Number(q.referrerBps) !== 0) return null;
  return { protocol: String(q.type), expectedAmountOut: String(q.expectedAmountOut), minAmountOut: String(q.minAmountOut), symbol: String(q.toToken.symbol), eta: String(q.clientEta || 'Not supplied'), expiresAt: Math.min(deadline, now + 30_000), protocolFeeUsd: Number.isFinite(q.protocolFeeUsd) ? q.protocolFeeUsd : null };
}
export default async function handler(request: Request) {
  if (request.method !== 'GET') return reply({ error: 'Quotes are read-only.' }, 405);
  const params = new URL(request.url).searchParams;
  const chain = params.get('chain') || '';
  const asset = params.get('asset') || '';
  const destination = params.get('destination') || TREE;
  const settlement = params.get('settlement') === 'USDC' ? USDC : SUI;
  const source = Object.hasOwn(SOURCES, chain) && Object.hasOwn(SOURCES[chain], asset) ? SOURCES[chain][asset] : null;
  if (!source || ![TREE, SUI, USDC].includes(destination)) return reply({ error: 'Select a supported source and destination.' }, 400);
  let raw;
  try { raw = amountToRaw(params.get('amount') || '', source[1]); } catch (e) { return reply({ error: (e as Error).message }, 400); }
  const target = destination === TREE ? settlement : destination;
  const query = new URLSearchParams({ fromChain: chain, fromToken: source[0], toChain: 'sui', toToken: target, amountIn64: raw, slippageBps: '100', swift: 'true', mctp: 'true', fastMctp: 'true', wormhole: 'true', gasless: 'false', sdkVersion: '15_2_2', referrerBps: '0' });
  try {
    const upstream = await fetch(`https://price-api.mayan.finance/v3/quote?${query}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!upstream.ok) return reply({ error: 'Mayan has no available quote for this selection right now. Try another amount or settlement asset.' }, 502);
    const body = await upstream.json();
    const now = Date.now();
    const quotes = (Array.isArray(body.quotes) ? body.quotes : []).map(q => summarizeQuote(q, chain, source[0], target, now)).filter(Boolean);
    quotes.sort((a, b) => Number(b.expectedAmountOut) - Number(a.expectedAmountOut));
    return reply({ status: quotes.length ? 'ok' : 'no-route', fetchedAt: new Date(now).toISOString(), executionEnabled: false, destination, settlement: target, requiresTreeSwap: destination === TREE, gatewayFeeBps: 25, gatewayFeeIncluded: false, slippageBps: 100, quotes });
  } catch { return reply({ error: 'Mayan quote service is temporarily unavailable. Please retry.' }, 502); }
}
export const config = { path: '/api/tree-gateway-quote' };
