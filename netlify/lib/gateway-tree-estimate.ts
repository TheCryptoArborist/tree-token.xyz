import { SUI, TREE, amountToRaw } from '../../gateway/options.js';

const POOLS = {
  suidex: '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc',
  v3: '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf',
  turbos: '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
};
const LABELS = { suidex: 'SuiDex V2', v3: 'SuiDex V3', turbos: 'Turbos' };
function units(raw: string, decimals: number) {
  const text = raw.padStart(decimals + 1, '0');
  return `${text.slice(0, -decimals)}.${text.slice(-decimals)}`;
}
export function summarizeTree(body: any, raw: string, bridgeExpiry: number, now = Date.now()) {
  const route = body?.selectedRoute;
  const positive = (value: unknown) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
  const generated = Date.parse(body?.generatedAt);
  const expiry = Math.min(Date.parse(body?.expiresAt), generated + 30_000, bridgeExpiry);
  if (body?.status !== 'ok' || body.tokenIn !== SUI || body.tokenOut !== TREE || body.amountIn !== raw || body.decimalsIn !== 9 || body.decimalsOut !== 6 || body.slippageBps !== 100 ||
      !Number.isFinite(generated) || generated > now + 5_000 || !Number.isFinite(expiry) || expiry <= now ||
      route?.type !== 'direct' || !Object.hasOwn(POOLS, route.venue) || route.pairId !== POOLS[route.venue] ||
      route.tokenIn !== SUI || route.tokenOut !== TREE || route.amountIn !== raw ||
      !positive(route.amountOut) || !positive(route.minAmountOut) || BigInt(route.minAmountOut) > BigInt(route.amountOut) ||
      typeof route.priceImpactPercent !== 'number' || !Number.isFinite(route.priceImpactPercent) || route.priceImpactPercent < 0 || route.priceImpactPercent > 100 ||
      typeof route.feePercent !== 'number' || !Number.isFinite(route.feePercent) || route.feePercent < 0 || route.feePercent > 10) throw Error('Invalid TREE estimate');
  return { status: 'ok', provider: LABELS[route.venue], inputAmount: units(raw, 9), expectedAmountOut: units(route.amountOut, 6), minAmountOut: units(route.minAmountOut, 6), priceImpactPercent: route.priceImpactPercent, feePercent: route.feePercent, expiresAt: expiry };
}
export async function estimateTree(settlement: string, bridge: any) {
  if (settlement !== SUI) return { status: 'unsupported', message: 'USDC → TREE is not connected. Choose SUI settlement for a final TREE estimate.' };
  try {
    // Feed the bridge minimum, never its optimistic output, into the onward quote.
    const raw = amountToRaw(bridge.minAmountOut, 9);
    const params = new URLSearchParams({ tokenIn: SUI, tokenOut: TREE, amountIn: raw, slippageBps: '100' });
    const response = await fetch(`https://tree-token.xyz/api/tree-swap-quote?${params}`, {
      method: 'GET', credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw Error('TREE quote unavailable');
    return summarizeTree(await response.json(), raw, bridge.expiresAt);
  } catch { return { status: 'unavailable', message: 'Final TREE quote unavailable. Only the bridge arrival is estimated. Retry for a complete route estimate.' }; }
}
