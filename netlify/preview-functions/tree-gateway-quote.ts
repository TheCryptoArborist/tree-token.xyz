import { SOURCES, SUI, USDC, TREE, amountToRaw } from '../../gateway/options.js';
import { estimateTree } from '../lib/gateway-tree-estimate.ts';

const RELAY_ORIGINS = { bsc: 56, robinhood: 4663 };
// Documentation example identity for non-executable estimates, never a deposit recipient.
const ESTIMATE_USER = '0x03508bb71268bba25ecacc8f620e01866650532c';
export function summarizeRelay(body: any, origin: number, raw: string) {
  const input = body?.details?.currencyIn;
  const output = body?.details?.currencyOut;
  if (input?.currency?.chainId !== origin || input?.currency?.address !== SOURCES.bsc.BNB[0] || input?.currency?.decimals !== 18 || input?.amount !== raw ||
      output?.currency?.chainId !== 8453 || output?.currency?.address?.toLowerCase() !== SOURCES.base.USDC[0] || output?.currency?.decimals !== 6) throw Error('Relay returned an unexpected asset or network.');
  const positive = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
  if (!positive(output.amount) || !positive(output.minimumAmount) || BigInt(output.minimumAmount) > BigInt(output.amount)) throw Error('Relay returned an invalid output amount.');
  const seconds = Number(body.details.timeEstimate);
  return { provider: 'Relay', destination: 'Base USDC', expectedRaw: output.amount, minimumRaw: output.minimumAmount, eta: Number.isFinite(seconds) && seconds >= 0 ? `${Math.ceil(seconds)}s` : 'Not supplied' };
}

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
  try {
    let relay = null;
    const startedAt = Date.now();
    if (Object.hasOwn(RELAY_ORIGINS, chain)) {
      const response = await fetch('https://api.relay.link/quote/v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ user: ESTIMATE_USER, originChainId: RELAY_ORIGINS[chain], destinationChainId: 8453, originCurrency: source[0], destinationCurrency: SOURCES.base.USDC[0], amount: raw, tradeType: 'EXACT_INPUT', indicativeQuote: true, slippageTolerance: '100' }),
        signal: AbortSignal.timeout(12_000), redirect: 'error',
      });
      if (!response.ok) return reply({ error: 'Relay has no available route to Base USDC for this amount. Try again or choose another source.' }, 502);
      relay = summarizeRelay(await response.json(), RELAY_ORIGINS[chain], raw);
    }
    const mayanChain = relay ? 'base' : chain;
    const mayanSource = relay ? SOURCES.base.USDC[0] : source[0];
    const query = new URLSearchParams({ fromChain: mayanChain, fromToken: mayanSource, toChain: 'sui', toToken: target, amountIn64: relay ? relay.minimumRaw : raw, slippageBps: '100', swift: 'true', mctp: 'true', fastMctp: 'true', wormhole: 'true', gasless: 'false', sdkVersion: '15_2_2', referrerBps: '0' });
    const upstream = await fetch(`https://price-api.mayan.finance/v3/quote?${query}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!upstream.ok) return reply({ error: 'Mayan has no available quote for this selection right now. Try another amount or settlement asset.' }, 502);
    const body = await upstream.json();
    const now = Date.now();
    const quotes = (Array.isArray(body.quotes) ? body.quotes : []).map(q => summarizeQuote(q, mayanChain, mayanSource, target, now)).filter(Boolean);
    if (relay) for (const q of quotes) q.expiresAt = Math.min(q.expiresAt, startedAt + 30_000);
    quotes.sort((a, b) => Number(b.expectedAmountOut) - Number(a.expectedAmountOut));
    const treeSwap = destination === TREE && quotes.length ? await estimateTree(target, quotes[0]) : null;
    if (treeSwap?.status === 'ok') quotes[0].expiresAt = Math.min(quotes[0].expiresAt, treeSwap.expiresAt);
    return reply({ status: quotes.length ? 'ok' : 'no-route', fetchedAt: new Date(now).toISOString(), executionEnabled: false, destination, settlement: target, requiresTreeSwap: destination === TREE, treeSwap, gatewayFeeBps: 25, gatewayFeeIncluded: false, slippageBps: 100, routeKind: relay ? 'via-base' : 'direct', relay, indicativeOnly: Boolean(relay) || destination === TREE, quotes });
  } catch { return reply({ error: 'Route quote service is temporarily unavailable. Please retry.' }, 502); }
}
export const config = { path: '/api/tree-gateway-quote' };
