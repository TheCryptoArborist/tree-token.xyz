// Research-only graph and exact-input quotes. No wallet, signing or execution API.
import { normalizeMoveType } from './tree-swap-route.ts';

export type SimulationPool = {
  venue: string;
  poolId: string;
  coinTypes: string[];
  reserves: Record<string, string>;
  verifiedAt: string;
  stateError?: string;
  quote: (coinIn: string, coinOut: string, amountIn: bigint) => bigint | Promise<bigint>;
};
export type SimulationHop = { pool: SimulationPool; coinIn: string; coinOut: string };
export type SimulationRoute = SimulationHop[];
export type Eligibility = { eligible: boolean; reason: string };

// Unlike the legacy discovery normalizer, preserve Move identifier case and only
// canonicalize the address. Distinct case-sensitive coin types must never merge.
export function coinKey(type: string): string {
  const [address, module, name, ...rest] = type.trim().split('::');
  if (!/^0x[0-9a-f]+$/i.test(address) || !module || !name || rest.length) throw new Error('Unsupported coin type');
  return `${normalizeMoveType(address)}::${module}::${name}`.replace(/^0x0+([0-9a-f])/, '0x$1');
}

export function poolEligibility(pool: SimulationPool, now: number, maxAgeMs: number): Eligibility {
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) throw new Error('Invalid freshness policy');
  if (pool.stateError) return { eligible: false, reason: pool.stateError };
  const age = now - Date.parse(pool.verifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return { eligible: false, reason: 'stale-or-missing-state' };
  try {
    const keys = pool.coinTypes.map(coinKey);
    if (!pool.poolId || keys.length < 2 || new Set(keys).size !== keys.length) throw new Error();
    for (const type of pool.coinTypes) {
      if (!/^\d+$/.test(pool.reserves[type] ?? '') || BigInt(pool.reserves[type]) <= 0n) throw new Error();
    }
  } catch { return { eligible: false, reason: 'invalid-coins-or-empty-reserves' }; }
  return { eligible: true, reason: 'state-valid-quote-required' };
}

// A pool cannot return more TREE than its whole reserve. This strict upper
// bound safely prunes dust for a full-size quote without USD prices or a TVL
// cutoff. It deliberately says nothing about future split-order usefulness.
export function terminalReserveEligibility(pool: SimulationPool, target: string, bestOutput: bigint): Eligibility {
  const type = pool.coinTypes.find(c => coinKey(c) === coinKey(target));
  if (!type || bestOutput <= 0n) return { eligible: true, reason: 'no-terminal-bound' };
  if (BigInt(pool.reserves[type]) <= bestOutput) return { eligible: false, reason: 'terminal-reserve-cannot-beat-baseline' };
  return { eligible: true, reason: 'terminal-reserve-above-baseline' };
}

export function enumerateRoutes(pools: SimulationPool[], source: string, target: string, options: {
  maxHops?: number; maxRoutes?: number; preferredIntermediates?: string[];
} = {}): { routes: SimulationRoute[]; truncated: boolean } {
  const maxHops = options.maxHops ?? 3, maxRoutes = options.maxRoutes ?? 2000;
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 3 || !Number.isInteger(maxRoutes) || maxRoutes < 1) throw new Error('Invalid enumeration limits');
  const from = coinKey(source), to = coinKey(target);
  const preferred = (options.preferredIntermediates ?? []).map(coinKey);
  const adjacency = new Map<string, SimulationHop[]>();
  const seenPools = new Set<string>();
  for (const pool of [...pools].sort((a,b) => `${a.venue}:${a.poolId}`.localeCompare(`${b.venue}:${b.poolId}`))) {
    const id = `${pool.venue}:${pool.poolId.toLowerCase()}`;
    if (seenPools.has(id)) continue;
    seenPools.add(id);
    for (const coinIn of pool.coinTypes) for (const coinOut of pool.coinTypes) {
      if (coinKey(coinIn) === coinKey(coinOut)) continue;
      const list = adjacency.get(coinKey(coinIn)) ?? [];
      list.push({ pool, coinIn, coinOut }); adjacency.set(coinKey(coinIn), list);
    }
  }
  const rank = (key: string) => key === to ? -1 : preferred.includes(key) ? preferred.indexOf(key) : preferred.length;
  for (const hops of adjacency.values()) hops.sort((a,b) => rank(coinKey(a.coinOut)) - rank(coinKey(b.coinOut)));
  const routes: SimulationRoute[] = [];
  let truncated = false;
  // Iterative depth limits guarantee direct and two-hop paths precede three-hop
  // paths even if the explicitly reported route cap is reached.
  function visit(current: string, path: SimulationRoute, coins: Set<string>, used: Set<string>, depth: number) {
    for (const hop of adjacency.get(current) ?? []) {
      const next = coinKey(hop.coinOut), id = `${hop.pool.venue}:${hop.pool.poolId.toLowerCase()}`;
      if (coins.has(next) || used.has(id)) continue;
      const candidate = [...path, hop];
      if (next === to) {
        if (candidate.length !== depth) continue;
        if (routes.length >= maxRoutes) { truncated = true; return; }
        routes.push(candidate);
      } else if (candidate.length < depth) {
        visit(next, candidate, new Set([...coins,next]), new Set([...used,id]), depth);
        if (truncated) return;
      }
    }
  }
  if (from !== to) for (let depth = 1; depth <= maxHops && !truncated; depth++) visit(from, [], new Set([from]), new Set(), depth);
  return { routes, truncated };
}

export async function simulateRoute(route: SimulationRoute, amountIn: bigint, options: { now: number; maxAgeMs: number }) {
  if (amountIn <= 0n || route.length < 1 || route.length > 3) throw new Error('Invalid simulation request');
  let amount = amountIn;
  const hops: Array<{ venue: string; poolId: string; coinIn: string; coinOut: string; amountIn: string; amountOut: string }> = [];
  const used = new Set<string>(), coins = new Set<string>([coinKey(route[0].coinIn)]);
  for (const hop of route) {
    const fail = (reason: string) => ({ status: 'rejected' as const, amountIn: amountIn.toString(), amountOut: null, reason, failedPoolId: hop.pool.poolId, hops });
    const eligibility = poolEligibility(hop.pool, options.now, options.maxAgeMs);
    if (!eligibility.eligible) return fail(eligibility.reason);
    const id = `${hop.pool.venue}:${hop.pool.poolId.toLowerCase()}`;
    const next = coinKey(hop.coinOut);
    if (used.has(id) || coins.has(next) || (hops.length && coinKey(hops.at(-1)!.coinOut) !== coinKey(hop.coinIn)) || !hop.pool.coinTypes.includes(hop.coinIn) || !hop.pool.coinTypes.includes(hop.coinOut)) return fail('invalid-or-repeated-hop');
    used.add(id); coins.add(next);
    try {
      const output = await hop.pool.quote(hop.coinIn, hop.coinOut, amount);
      if (typeof output !== 'bigint' || output <= 0n || output >= BigInt(hop.pool.reserves[hop.coinOut])) return fail('invalid-or-reserve-exhausting-output');
      hops.push({ venue: hop.pool.venue, poolId: hop.pool.poolId, coinIn: hop.coinIn, coinOut: hop.coinOut, amountIn: amount.toString(), amountOut: output.toString() });
      amount = output;
    } catch (error) { return fail(error instanceof Error ? error.message : 'quote-failed'); }
  }
  return { status: 'quoted' as const, amountIn: amountIn.toString(), amountOut: amount.toString(), reason: null, hops };
}
