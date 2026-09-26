import { coinKey, simulateRoute, type SimulationRoute } from './tree-route-simulation.ts';
// Remote service clocks may lead the local clock slightly. This does not extend
// the maximum age for old quotes; larger future timestamps still fail closed.
export const QUOTE_CLOCK_SKEW_MS = 1_000;

export type BridgeQuote = {
  venue: string; poolId: string; coinIn: string; coinOut: string;
  amountIn: string; amountOut: string; timestamp: string;
  source: 'suidex-route-api'; executionVerified: false;
};

// Strictly bind service estimates to the requested exact input and pair. These
// are research evidence, never an execution allowlist or proof of pool health.
export function parseBridgeQuotes(payload: any, request: {coinIn:string;coinOut:string;amountIn:string}, now:number, maxAgeMs:number): BridgeQuote[] {
  const age = now - Date.parse(payload?.timestamp);
  if (!Number.isFinite(age) || age < -QUOTE_CLOCK_SKEW_MS || age > maxAgeMs) throw new Error('stale-or-missing-bridge-timestamp');
  if (!/^\d+$/.test(request.amountIn) || BigInt(request.amountIn) <= 0n) throw new Error('invalid-bridge-input');
  if (coinKey(payload.tokenIn) !== coinKey(request.coinIn) || coinKey(payload.tokenOut) !== coinKey(request.coinOut) || payload.amountIn !== request.amountIn) throw new Error('bridge-response-mismatch');
  const quotes = new Map<string,BridgeQuote>();
  for (const route of [...(Array.isArray(payload.directRoutes) ? payload.directRoutes : []),payload.bestRoute]) {
    try {
      if (route?.type !== 'direct' || route.hops?.length !== 1) continue;
      const hop = route.hops[0];
      if (!['suidex','v3','cetus','turbos','aftermath','flowx'].includes(hop.venue) || !/^0x[0-9a-f]{64}$/i.test(hop.pairId)) continue;
      if (coinKey(hop.tokenIn) !== coinKey(request.coinIn) || coinKey(hop.tokenOut) !== coinKey(request.coinOut)) continue;
      if (hop.amountIn !== request.amountIn || route.totalAmountIn !== request.amountIn || hop.amountOut !== route.totalAmountOut || !/^\d+$/.test(hop.amountOut) || BigInt(hop.amountOut) <= 0n) continue;
      quotes.set(`${hop.venue}:${hop.pairId.toLowerCase()}`, {venue:hop.venue,poolId:hop.pairId.toLowerCase(),coinIn:hop.tokenIn,coinOut:hop.tokenOut,amountIn:hop.amountIn,amountOut:hop.amountOut,timestamp:payload.timestamp,source:'suidex-route-api',executionVerified:false});
    } catch { /* malformed individual routes cannot invalidate other venues */ }
  }
  return [...quotes.values()];
}

export async function simulateBridgedRoute(bridge: BridgeQuote, tail: SimulationRoute, options:{now:number;maxAgeMs:number}) {
  const age = options.now - Date.parse(bridge.timestamp);
  if (!Number.isFinite(age) || age < -QUOTE_CLOCK_SKEW_MS || age > options.maxAgeMs) throw new Error('stale-bridge');
  if (tail.length < 1 || tail.length > 2 || coinKey(bridge.coinOut) !== coinKey(tail[0].coinIn)
    || tail.some(h=>h.pool.poolId.toLowerCase()===bridge.poolId.toLowerCase() || coinKey(h.coinOut)===coinKey(bridge.coinIn))) throw new Error('invalid-bridge-tail');
  const result = await simulateRoute(tail,BigInt(bridge.amountOut),options);
  return {...result,amountIn:bridge.amountIn,hops:[bridge,...result.hops],executionVerified:false};
}
