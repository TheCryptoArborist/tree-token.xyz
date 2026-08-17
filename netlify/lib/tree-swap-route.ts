export const SUI_TYPE = '0x2::sui::SUI';
export const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const SUI_DECIMALS = 9;
export const TREE_DECIMALS = 6;
export const SUIDEX_V2_TREE_POOL = '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';
export const SUIDEX_V3_TREE_POOL = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';

const ROUTE_MAX_AGE_MS = 30_000;
const MAX_TREE_RAW = 1_000_000_000n * 1_000_000n;
const MAX_SUI_RAW = 1_000_000_000n * 1_000_000_000n;

type RecordValue = Record<string, unknown>;

export type SwapQuoteRequest = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps: number;
  generatedAt?: string;
};

export type SafeTreeRoute = {
  type: 'direct';
  venue: 'suidex' | 'v3';
  venueLabel: 'SuiDex V2' | 'SuiDex V3';
  executionKind: 'suidex-v2-direct' | 'suidex-v3-direct';
  pairId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  minAmountOut: string;
  priceImpactPercent: number;
  priceImpactTier: string;
  gasEstimate: string;
  feePercent: number;
  coinAType: string | null;
  coinBType: string | null;
};

export function normalizeMoveType(type: unknown): string {
  const parts = String(type || '').trim().split('::');
  if (parts.length < 3) return String(type || '').trim().toLowerCase();
  const rawAddress = parts.shift() || '';
  const addressBody = rawAddress.toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${addressBody}::${parts.join('::')}`.toLowerCase();
}

export function isTreeSwapPair(tokenIn: unknown, tokenOut: unknown): boolean {
  const input = normalizeMoveType(tokenIn);
  const output = normalizeMoveType(tokenOut);
  const sui = normalizeMoveType(SUI_TYPE);
  const tree = normalizeMoveType(TREE_TYPE);
  return (input === sui && output === tree) || (input === tree && output === sui);
}

export function validateSwapRequest(input: Partial<SwapQuoteRequest>): SwapQuoteRequest {
  const tokenIn = String(input.tokenIn || '');
  const tokenOut = String(input.tokenOut || '');
  if (!isTreeSwapPair(tokenIn, tokenOut)) throw new Error('Only the SUI/TREE pair is supported.');

  const amountText = String(input.amountIn || '');
  if (!/^\d+$/.test(amountText)) throw new Error('amountIn must be an unsigned base-unit integer.');
  const amount = BigInt(amountText);
  if (amount <= 0n) throw new Error('amountIn must be greater than zero.');
  const max = normalizeMoveType(tokenIn) === normalizeMoveType(SUI_TYPE) ? MAX_SUI_RAW : MAX_TREE_RAW;
  if (amount > max) throw new Error('amountIn exceeds the supported safety bound.');

  const slippageBps = Number(input.slippageBps);
  if (!Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 500) {
    throw new Error('slippageBps must be an integer from 10 to 500.');
  }
  return { tokenIn: normalizeMoveType(tokenIn) === normalizeMoveType(SUI_TYPE) ? SUI_TYPE : TREE_TYPE, tokenOut: normalizeMoveType(tokenOut) === normalizeMoveType(SUI_TYPE) ? SUI_TYPE : TREE_TYPE, amountIn: amount.toString(), slippageBps };
}

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' ? value as RecordValue : {};
}

function unsigned(value: unknown): string | null {
  const text = String(value ?? '');
  if (!/^\d+$/.test(text)) return null;
  try { return BigInt(text) > 0n ? BigInt(text).toString() : null; } catch { return null; }
}

function finite(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function minOutForRoute(root: RecordValue, route: RecordValue, pairId: string, amountOut: string, slippageBps: number): string {
  const metadata = record(root.buildMetadata);
  const metadataHops = Array.isArray(metadata.hops) ? metadata.hops : [];
  const match = metadataHops.map(record).find((hop) => String(hop.pairId || '') === pairId);
  const fromMetadata = unsigned(match?.minAmountOut);
  if (fromMetadata) return fromMetadata;
  const expected = BigInt(amountOut);
  return (expected - expected * BigInt(slippageBps) / 10_000n).toString();
}

function sanitizeRoute(root: RecordValue, routeValue: unknown, request: SwapQuoteRequest): SafeTreeRoute | null {
  const route = record(routeValue);
  if (route.type !== 'direct') return null;
  const hops = Array.isArray(route.hops) ? route.hops : [];
  if (hops.length !== 1) return null;
  const hop = record(hops[0]);
  const venue = String(hop.venue || '').toLowerCase();
  if (venue !== 'suidex' && venue !== 'v3') return null;
  const pairId = String(hop.pairId || '').toLowerCase();
  const expectedPair = venue === 'suidex' ? SUIDEX_V2_TREE_POOL : SUIDEX_V3_TREE_POOL;
  if (pairId !== expectedPair) return null;
  if (!isTreeSwapPair(hop.tokenIn, hop.tokenOut)) return null;
  if (normalizeMoveType(hop.tokenIn) !== normalizeMoveType(request.tokenIn) || normalizeMoveType(hop.tokenOut) !== normalizeMoveType(request.tokenOut)) return null;
  const amountIn = unsigned(hop.amountIn || route.totalAmountIn);
  const amountOut = unsigned(hop.amountOut || route.totalAmountOut);
  if (!amountIn || !amountOut || amountIn !== request.amountIn) return null;

  let coinAType: string | null = null;
  let coinBType: string | null = null;
  if (venue === 'v3') {
    coinAType = String(hop.coinAType || '');
    coinBType = String(hop.coinBType || '');
    if (!isTreeSwapPair(coinAType, coinBType)) return null;
  }

  const priceImpactPercent = finite(route.totalPriceImpact ?? hop.priceImpact, 0);
  if (priceImpactPercent < 0 || priceImpactPercent > 100) return null;
  const rawFee = finite(hop.feeRate, 0);
  const feePercent = venue === 'v3' && rawFee > 0 ? rawFee / 10_000 : 0.3;
  return {
    type: 'direct',
    venue: venue as 'suidex' | 'v3',
    venueLabel: venue === 'suidex' ? 'SuiDex V2' : 'SuiDex V3',
    executionKind: venue === 'suidex' ? 'suidex-v2-direct' : 'suidex-v3-direct',
    pairId,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    amountIn,
    amountOut,
    minAmountOut: minOutForRoute(root, route, pairId, amountOut, request.slippageBps),
    priceImpactPercent,
    priceImpactTier: String(route.priceImpactTier || 'unknown'),
    gasEstimate: unsigned(route.gasEstimate) || '0',
    feePercent,
    coinAType,
    coinBType,
  };
}

export function normalizeTreeSwapQuote(payload: unknown, requestInput: SwapQuoteRequest) {
  const request = validateSwapRequest(requestInput);
  const root = record(payload);
  const routeValues = [root.bestRoute, ...(Array.isArray(root.directRoutes) ? root.directRoutes : [])].filter(Boolean);
  const deduped = new Map<string, SafeTreeRoute>();
  for (const value of routeValues) {
    const route = sanitizeRoute(root, value, request);
    if (!route) continue;
    const key = `${route.venue}:${route.pairId}:${route.amountOut}`;
    deduped.set(key, route);
  }
  const routes = [...deduped.values()].sort((left, right) => {
    const amountOrder = BigInt(right.amountOut) > BigInt(left.amountOut) ? 1 : BigInt(right.amountOut) < BigInt(left.amountOut) ? -1 : 0;
    if (amountOrder) return amountOrder;
    return BigInt(left.gasEstimate || '0') < BigInt(right.gasEstimate || '0') ? -1 : 1;
  });
  if (!routes.length) throw new Error('No allowlisted direct SuiDex V2 or V3 route was returned.');
  const generatedAt = requestInput.generatedAt || new Date().toISOString();
  const generatedMs = Date.parse(generatedAt);
  const expiresAt = new Date((Number.isFinite(generatedMs) ? generatedMs : Date.now()) + ROUTE_MAX_AGE_MS).toISOString();
  return {
    status: 'ok' as const,
    generatedAt,
    expiresAt,
    source: 'SuiDex route service',
    executionScope: 'Direct SuiDex V2 and SuiDex V3 TREE routes',
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    decimalsIn: normalizeMoveType(request.tokenIn) === normalizeMoveType(SUI_TYPE) ? SUI_DECIMALS : TREE_DECIMALS,
    decimalsOut: normalizeMoveType(request.tokenOut) === normalizeMoveType(SUI_TYPE) ? SUI_DECIMALS : TREE_DECIMALS,
    amountIn: request.amountIn,
    slippageBps: request.slippageBps,
    selectedRoute: routes[0],
    routes,
    warnings: routes.length < 2 ? ['Only one allowlisted TREE route was available for this amount.'] : [],
  };
}
