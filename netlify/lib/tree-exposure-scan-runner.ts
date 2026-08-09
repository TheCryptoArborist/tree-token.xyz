import { TREE_DECIMALS, TREE_TOTAL_SUPPLY_RAW } from './leaderboard-provider.ts';
import { readSuiGraphqlBackgroundConfig } from './sui-graphql-background-config.ts';
import {
  scanSuiGraphqlLeaderboard,
  type ScanOptions,
} from './sui-graphql-leaderboard-provider.ts';
import { scanSuiDexV2TreeLp } from './suidex-v2-tree-lp-provider.ts';
import { scanSuiDexV3TreeLp } from './suidex-v3-tree-lp-provider.ts';
import { scanTurbosTreeLp } from './turbos-tree-lp-provider.ts';
import {
  buildVerifiedExposureSnapshot,
  type ExposureSnapshot,
} from './tree-exposure-aggregator.ts';
import {
  EXPOSURE_SNAPSHOT_PROVIDER,
  validateCompleteExposureSnapshot,
  type CompleteExposureSnapshot,
  type ExposureSourceSummary,
  type ExposureVenueSourceSummary,
} from './tree-exposure-cache.ts';
import {
  LP_MAXI_BADGE,
  LP_PROVIDER_BADGE,
  type ExposureVenue,
  type ExposureVenueResult,
} from './tree-exposure-types.ts';
import {
  resolveDefaultSuinsNames,
  type SuinsResolutionResult,
} from './suins-name-resolver.ts';

export type ExposureScanStage = 'direct-tree' | 'suidex-v2' | 'suidex-v3' | 'turbos' | 'aggregate' | 'suins' | 'complete' | 'failed';

export type ExposureScanProgress = {
  stage: ExposureScanStage;
  message: string;
  directPagesScanned: number;
  directObjectsScanned: number;
  directUniqueOwners: number;
  venueOutcomes: Record<ExposureVenue, 'pending' | 'complete' | 'verification-incomplete' | 'error'>;
};

export type CompleteExposureScanResult = {
  outcome: 'complete' | 'verification-incomplete' | 'error';
  stage: ExposureScanStage;
  snapshot: CompleteExposureSnapshot | null;
  warnings: string[];
};

export type ExposureScanRunnerDependencies = {
  getEnv?: (name: string) => string | undefined;
  directScan?: typeof scanSuiGraphqlLeaderboard;
  suiDexV2Scan?: typeof scanSuiDexV2TreeLp;
  suiDexV3Scan?: typeof scanSuiDexV3TreeLp;
  turbosScan?: typeof scanTurbosTreeLp;
  resolveSuins?: typeof resolveDefaultSuinsNames;
  directOptions?: ScanOptions;
  onProgress?: (progress: ExposureScanProgress) => Promise<void> | void;
  now?: () => number;
};

function venueSummary(result: ExposureVenueResult): ExposureVenueSourceSummary {
  return {
    outcome: 'complete',
    walletCount: result.positions.length,
    positionCount: result.positions.reduce((sum, position) => sum + position.positionCount, 0),
    principalTreeRaw: result.positions.reduce((sum, position) => sum + BigInt(position.lpTreeRaw), 0n).toString(),
    coverage: result.coverage,
    warnings: [...result.warnings],
  };
}

function failed(
  outcome: 'verification-incomplete' | 'error',
  stage: ExposureScanStage,
  warnings: string[],
): CompleteExposureScanResult {
  return { outcome, stage, snapshot: null, warnings };
}

export async function runCompleteTreeExposureScan(
  dependencies: ExposureScanRunnerDependencies = {},
): Promise<CompleteExposureScanResult> {
  const getEnv = dependencies.getEnv ?? ((name) => Netlify.env.get(name));
  const directScan = dependencies.directScan ?? scanSuiGraphqlLeaderboard;
  const suiDexV2Scan = dependencies.suiDexV2Scan ?? scanSuiDexV2TreeLp;
  const suiDexV3Scan = dependencies.suiDexV3Scan ?? scanSuiDexV3TreeLp;
  const turbosScan = dependencies.turbosScan ?? scanTurbosTreeLp;
  const resolveSuins = dependencies.resolveSuins ?? resolveDefaultSuinsNames;
  const now = dependencies.now ?? Date.now;
  const venueOutcomes: ExposureScanProgress['venueOutcomes'] = {
    suiDexV2: 'pending',
    suiDexV3: 'pending',
    turbos: 'pending',
  };
  let directPagesScanned = 0;
  let directObjectsScanned = 0;
  let directUniqueOwners = 0;

  const emit = async (stage: ExposureScanStage, message: string) => {
    await dependencies.onProgress?.({
      stage,
      message,
      directPagesScanned,
      directObjectsScanned,
      directUniqueOwners,
      venueOutcomes: { ...venueOutcomes },
    });
  };

  try {
    await emit('direct-tree', 'Scanning the complete address-owned Coin<TREE> set.');
    const backgroundConfig = readSuiGraphqlBackgroundConfig(getEnv);
    const callerProgress = dependencies.directOptions?.onProgress;
    const direct = await directScan({
      ...backgroundConfig,
      ...dependencies.directOptions,
      includeExposureCandidates: true,
      onProgress: async (progress) => {
        directPagesScanned = progress.pagesScanned;
        directObjectsScanned = progress.objectsScanned;
        directUniqueOwners = progress.uniqueAddressOwners;
        await callerProgress?.(progress);
        await emit('direct-tree', 'Scanning the complete address-owned Coin<TREE> set.');
      },
    });
    directPagesScanned = direct.coverage.pagesScanned;
    directObjectsScanned = direct.coverage.objectsScanned;
    directUniqueOwners = direct.coverage.uniqueAddressOwners;
    if (direct.outcome !== 'complete' || !direct.exposureCandidates
      || direct.verifiedAddressOwners === null || direct.eligibleRankedOwners === null) {
      return failed(
        direct.outcome === 'error' ? 'error' : 'verification-incomplete',
        'direct-tree',
        [...direct.warnings, 'The total-exposure run stopped because direct TREE verification was incomplete.'],
      );
    }

    await emit('suidex-v2', 'Scanning SuiDex V2 direct and farm-staked TREE LP.');
    const suiDexV2 = await suiDexV2Scan();
    venueOutcomes.suiDexV2 = suiDexV2.outcome;
    await emit('suidex-v2', `SuiDex V2 scan ${suiDexV2.outcome}.`);
    if (suiDexV2.outcome !== 'complete') {
      return failed(
        suiDexV2.outcome === 'error' ? 'error' : 'verification-incomplete',
        'suidex-v2',
        [...suiDexV2.warnings, 'The total-exposure run stopped because SuiDex V2 verification was incomplete.'],
      );
    }

    await emit('suidex-v3', 'Scanning SuiDex V3 TREE concentrated-liquidity positions.');
    const suiDexV3 = await suiDexV3Scan();
    venueOutcomes.suiDexV3 = suiDexV3.outcome;
    await emit('suidex-v3', `SuiDex V3 scan ${suiDexV3.outcome}.`);
    if (suiDexV3.outcome !== 'complete') {
      return failed(
        suiDexV3.outcome === 'error' ? 'error' : 'verification-incomplete',
        'suidex-v3',
        [...suiDexV3.warnings, 'The total-exposure run stopped because SuiDex V3 verification was incomplete.'],
      );
    }

    await emit('turbos', 'Scanning the complete Turbos position-NFT set for TREE positions.');
    const turbos = await turbosScan();
    venueOutcomes.turbos = turbos.outcome;
    await emit('turbos', `Turbos scan ${turbos.outcome}.`);
    if (turbos.outcome !== 'complete') {
      return failed(
        turbos.outcome === 'error' ? 'error' : 'verification-incomplete',
        'turbos',
        [...turbos.warnings, 'The total-exposure run stopped because Turbos verification was incomplete.'],
      );
    }

    await emit('aggregate', 'Combining Liquid TREE and verified LP principal.');
    const venueResults: Record<ExposureVenue, ExposureVenueResult> = { suiDexV2, suiDexV3, turbos };
    const aggregate: ExposureSnapshot = buildVerifiedExposureSnapshot({
      directEntries: direct.exposureCandidates,
      directTreeComplete: true,
      venueResults,
      generatedAt: new Date(now()).toISOString(),
      limit: 50,
    });
    if (aggregate.outcome !== 'complete' || aggregate.entries.length !== 50 || aggregate.eligibleOwnerCount === null) {
      return failed(
        'verification-incomplete',
        'aggregate',
        [...aggregate.warnings, 'The complete exposure aggregate did not produce exactly 50 verified entries.'],
      );
    }


    await emit('suins', 'Resolving verified default SuiNS names for the final Top 50.');
    let suins: SuinsResolutionResult;
    try {
      suins = await resolveSuins(aggregate.entries.map((entry) => entry.wallet));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SuiNS resolution failed.';
      suins = {
        names: Object.fromEntries(aggregate.entries.map((entry) => [entry.wallet, null])),
        requestedCount: aggregate.entries.length,
        resolvedCount: 0,
        complete: false,
        graphqlErrors: [message],
        networkError: message,
        generatedAt: new Date(now()).toISOString(),
      };
    }
    const suinsWarnings = suins.complete
      ? []
      : ['Some verified default SuiNS names could not be resolved; wallet exposure remains complete.'];
    const entries = aggregate.entries.map((entry) => ({
      ...entry,
      suinsName: suins.names[entry.wallet] || null,
    }));

    const source: ExposureSourceSummary = {
      direct: {
        outcome: 'complete',
        pagesScanned: direct.coverage.pagesScanned,
        objectsScanned: direct.coverage.objectsScanned,
        verifiedAddressOwners: direct.verifiedAddressOwners,
        eligibleDirectOwners: direct.eligibleRankedOwners,
        exposureCandidateCount: direct.exposureCandidates.length,
        addressOwnedRaw: direct.reconciliation.addressOwnedRaw,
      },
      venues: {
        suiDexV2: venueSummary(suiDexV2),
        suiDexV3: venueSummary(suiDexV3),
        turbos: venueSummary(turbos),
      },
      suins: {
        requestedCount: suins.requestedCount,
        resolvedCount: suins.resolvedCount,
        complete: suins.complete,
        generatedAt: suins.generatedAt,
        warnings: suinsWarnings,
      },
    };

    const top50TotalRaw = entries.reduce((sum, entry) => sum + BigInt(entry.totalExposureRaw), 0n);
    const top50LiquidRaw = entries.reduce((sum, entry) => sum + BigInt(entry.liquidTreeRaw), 0n);
    const top50LpRaw = entries.reduce((sum, entry) => sum + BigInt(entry.lpTreeRaw), 0n);
    const snapshot: CompleteExposureSnapshot = {
      ...aggregate,
      outcome: 'complete',
      provider: EXPOSURE_SNAPSHOT_PROVIDER,
      coinSymbol: 'TREE',
      coinDecimals: TREE_DECIMALS,
      totalSupplyRaw: TREE_TOTAL_SUPPLY_RAW.toString(),
      displayedCount: 50,
      entries,
      warnings: [...aggregate.warnings, ...suinsWarnings],
      source,
      summary: {
        top50TotalRaw: top50TotalRaw.toString(),
        top50LiquidRaw: top50LiquidRaw.toString(),
        top50LpRaw: top50LpRaw.toString(),
        rank50CutoffRaw: entries[49].totalExposureRaw,
        badgeCounts: {
          lpProvider: entries.filter((entry) => entry.badges.includes(LP_PROVIDER_BADGE)).length,
          lpMaxi: entries.filter((entry) => entry.badges.includes(LP_MAXI_BADGE)).length,
        },
      },
    };

    if (!validateCompleteExposureSnapshot(snapshot)) {
      return failed('verification-incomplete', 'aggregate', [
        ...snapshot.warnings,
        'The complete exposure snapshot failed final cache-integrity validation.',
      ]);
    }
    await emit('complete', 'A complete verified TREE exposure snapshot is ready.');
    return { outcome: 'complete', stage: 'complete', snapshot, warnings: snapshot.warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TREE exposure scan failed.';
    await emit('failed', 'The TREE exposure scan failed without publishing partial rankings.');
    return failed('error', 'failed', [message, 'No partial exposure ranking was published.']);
  }
}
