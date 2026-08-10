import { normalizeSuiAddress, TREE_TOTAL_SUPPLY_RAW } from './leaderboard-provider.ts';
import {
  LP_MAXI_BADGE,
  LP_PROVIDER_BADGE,
  TREE_EXPOSURE_METHODOLOGY_VERSION,
  type DirectExposureCandidate,
  type ExposureVenue,
  type ExposureVenueResult,
  type VerifiedExposureEntry,
  formatTreeRaw,
  formatTreeSupplyPercent,
  parseUnsignedRaw,
} from './tree-exposure-types.ts';

export type ExposureSnapshot = {
  outcome: 'complete' | 'verification-incomplete';
  generatedAt: string;
  methodologyVersion: typeof TREE_EXPOSURE_METHODOLOGY_VERSION;
  entries: VerifiedExposureEntry[];
  eligibleOwnerCount: number | null;
  coverage: {
    directTreeComplete: boolean;
    suiDexV2Complete: boolean;
    suiDexV3Complete: boolean;
    turbosComplete: boolean;
    totalExposureComplete: boolean;
  };
  warnings: string[];
};

export type ExposureAggregationInput = {
  directEntries: DirectExposureCandidate[];
  directTreeComplete: boolean;
  venueResults: Record<ExposureVenue, ExposureVenueResult>;
  generatedAt?: string;
  limit?: number;
};

type Aggregate = {
  wallet: string;
  suinsName: string | null;
  liquidRaw: bigint;
  coinObjectCount: number;
  lpRaw: Record<ExposureVenue, bigint>;
  lpPositionCount: number;
};

export function buildVerifiedExposureSnapshot(input: ExposureAggregationInput): ExposureSnapshot {
  const coverage = {
    directTreeComplete: input.directTreeComplete,
    suiDexV2Complete: input.venueResults.suiDexV2.outcome === 'complete',
    suiDexV3Complete: input.venueResults.suiDexV3.outcome === 'complete',
    turbosComplete: input.venueResults.turbos.outcome === 'complete',
    totalExposureComplete: false,
  };
  coverage.totalExposureComplete = coverage.directTreeComplete
    && coverage.suiDexV2Complete
    && coverage.suiDexV3Complete
    && coverage.turbosComplete;
  const warnings = [
    ...Object.values(input.venueResults).flatMap((result) => result.warnings || []),
  ];
  if (!coverage.totalExposureComplete) {
    warnings.push('Total verified TREE exposure is incomplete; partial exposure rankings were not published.');
    return {
      outcome: 'verification-incomplete', generatedAt: input.generatedAt || new Date().toISOString(),
      methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION, entries: [], eligibleOwnerCount: null, coverage, warnings,
    };
  }

  const aggregates = new Map<string, Aggregate>();
  const ensure = (walletValue: unknown) => {
    const wallet = normalizeSuiAddress(walletValue);
    if (!wallet) return null;
    const prior = aggregates.get(wallet);
    if (prior) return prior;
    const created: Aggregate = {
      wallet, suinsName: null, liquidRaw: 0n, coinObjectCount: 0,
      lpRaw: { suiDexV2: 0n, suiDexV3: 0n, turbos: 0n }, lpPositionCount: 0,
    };
    aggregates.set(wallet, created);
    return created;
  };

  for (const entry of input.directEntries) {
    const aggregate = ensure(entry.wallet);
    const raw = parseUnsignedRaw(entry.directTreeRaw);
    if (!aggregate || raw === null) continue;
    aggregate.liquidRaw += raw;
    aggregate.coinObjectCount += Number(entry.coinObjectCount) || 0;
    if (!aggregate.suinsName && typeof entry.suinsName === 'string' && entry.suinsName.trim()) aggregate.suinsName = entry.suinsName.trim();
  }
  for (const [venue, result] of Object.entries(input.venueResults) as Array<[ExposureVenue, ExposureVenueResult]>) {
    for (const position of result.positions) {
      const aggregate = ensure(position.wallet);
      const raw = parseUnsignedRaw(position.lpTreeRaw);
      if (!aggregate || raw === null) continue;
      aggregate.lpRaw[venue] += raw;
      aggregate.lpPositionCount += Number(position.positionCount) || 0;
    }
  }

  const limit = Math.max(1, Math.min(500, Math.trunc(input.limit ?? 50)));
  const entries = [...aggregates.values()]
    .map((aggregate) => {
      const lpRaw = aggregate.lpRaw.suiDexV2 + aggregate.lpRaw.suiDexV3 + aggregate.lpRaw.turbos;
      const totalRaw = aggregate.liquidRaw + lpRaw;
      return { aggregate, lpRaw, totalRaw };
    })
    .filter(({ totalRaw }) => totalRaw > 0n && totalRaw <= TREE_TOTAL_SUPPLY_RAW)
    .sort((left, right) => left.totalRaw > right.totalRaw ? -1
      : left.totalRaw < right.totalRaw ? 1
        : left.aggregate.liquidRaw > right.aggregate.liquidRaw ? -1
          : left.aggregate.liquidRaw < right.aggregate.liquidRaw ? 1
            : left.aggregate.wallet.localeCompare(right.aggregate.wallet))
    .slice(0, limit)
    .map(({ aggregate, lpRaw, totalRaw }, index): VerifiedExposureEntry => {
      const badges: string[] = [];
      if (lpRaw > 0n) badges.push(LP_PROVIDER_BADGE);
      if (lpRaw > aggregate.liquidRaw && lpRaw > 0n) badges.push(LP_MAXI_BADGE);
      return {
        rank: index + 1,
        wallet: aggregate.wallet,
        suinsName: aggregate.suinsName,
        liquidTreeRaw: aggregate.liquidRaw.toString(),
        liquidTree: formatTreeRaw(aggregate.liquidRaw),
        lpTreeRaw: lpRaw.toString(),
        lpTree: formatTreeRaw(lpRaw),
        totalExposureRaw: totalRaw.toString(),
        totalExposure: formatTreeRaw(totalRaw),
        supplyPercent: formatTreeSupplyPercent(totalRaw),
        liquidCoinObjectCount: aggregate.coinObjectCount,
        lpPositionCount: aggregate.lpPositionCount,
        lpBreakdown: {
          suiDexV2Raw: aggregate.lpRaw.suiDexV2.toString(),
          suiDexV2: formatTreeRaw(aggregate.lpRaw.suiDexV2),
          suiDexV3Raw: aggregate.lpRaw.suiDexV3.toString(),
          suiDexV3: formatTreeRaw(aggregate.lpRaw.suiDexV3),
          turbosRaw: aggregate.lpRaw.turbos.toString(),
          turbos: formatTreeRaw(aggregate.lpRaw.turbos),
        },
        badges,
      };
    });

  return {
    outcome: 'complete', generatedAt: input.generatedAt || new Date().toISOString(),
    methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION, entries,
    eligibleOwnerCount: aggregates.size, coverage, warnings,
  };
}
