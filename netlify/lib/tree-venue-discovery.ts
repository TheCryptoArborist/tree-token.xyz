import { TREE_TYPE, normalizeMoveType } from './tree-swap-route.ts';
import type { TreeLiquidityVenue } from './tree-liquidity-graph.ts';

export type DiscoveredPoolCandidate = {
  venue: TreeLiquidityVenue;
  poolId: string;
  coinTypes: string[];
  discoverySource: string;
};

export type VenueDiscoveryAdapter = {
  venue: TreeLiquidityVenue;
  discover: () => Promise<DiscoveredPoolCandidate[]>;
};

export function containsTree(candidate: DiscoveredPoolCandidate): boolean {
  return candidate.coinTypes.some((type) => normalizeMoveType(type) === normalizeMoveType(TREE_TYPE));
}

export function mergeDiscoveredCandidates(groups: DiscoveredPoolCandidate[][]): DiscoveredPoolCandidate[] {
  const unique = new Map<string, DiscoveredPoolCandidate>();
  for (const candidate of groups.flat()) {
    if (!containsTree(candidate)) continue;
    const key = `${candidate.venue}:${candidate.poolId.toLowerCase()}`;
    unique.set(key, { ...candidate, poolId: candidate.poolId.toLowerCase() });
  }
  return [...unique.values()];
}

export async function discoverAcrossVenues(adapters: VenueDiscoveryAdapter[]) {
  const results = await Promise.allSettled(adapters.map((adapter) => adapter.discover()));
  const discovered: DiscoveredPoolCandidate[][] = [];
  const failures: Array<{ venue: TreeLiquidityVenue; reason: string }> = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') discovered.push(result.value);
    else failures.push({
      venue: adapters[index].venue,
      reason: result.reason instanceof Error ? result.reason.message : 'Venue discovery failed.',
    });
  });
  return { candidates: mergeDiscoveredCandidates(discovered), failures };
}

// Venue-wide discovery is adapter driven so a single DEX outage cannot prevent
// the hourly TREE graph rebuild. Candidates still require on-chain verification
// before they are admitted to the executable routing graph.
export const TREE_DISCOVERY_VENUES: TreeLiquidityVenue[] = [
  'suidex',
  'turbos',
  'aftermath',
  'cetus',
  'flowx',
];
