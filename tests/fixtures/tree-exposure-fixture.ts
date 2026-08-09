import {
  EXPOSURE_SNAPSHOT_PROVIDER,
  type CompleteExposureSnapshot,
} from '../../netlify/lib/tree-exposure-cache.ts';
import {
  LP_MAXI_BADGE,
  LP_PROVIDER_BADGE,
  TREE_EXPOSURE_METHODOLOGY_VERSION,
  formatTreeRaw,
  formatTreeSupplyPercent,
  type VerifiedExposureEntry,
} from '../../netlify/lib/tree-exposure-types.ts';

export function fixtureAddress(index: number): string {
  return `0x${BigInt(index).toString(16).padStart(64, '0')}`;
}

function entryForRank(rank: number): VerifiedExposureEntry {
  let liquidRaw = 100_000_000_000n - BigInt(rank) * 1_000_000_000n;
  let suiDexV2Raw = 0n;
  let suiDexV3Raw = 0n;
  const turbosRaw = 0n;
  if (rank === 1) {
    liquidRaw = 40_000_000_000n;
    suiDexV3Raw = 61_000_000_000n;
  } else if (rank === 2) {
    liquidRaw = 99_000_000_000n;
  } else if (rank === 3) {
    liquidRaw = 96_000_000_000n;
    suiDexV2Raw = 1_000_000_000n;
  }
  const lpRaw = suiDexV2Raw + suiDexV3Raw + turbosRaw;
  const totalRaw = liquidRaw + lpRaw;
  const badges: string[] = [];
  if (lpRaw > 0n) badges.push(LP_PROVIDER_BADGE);
  if (lpRaw > liquidRaw && lpRaw > 0n) badges.push(LP_MAXI_BADGE);
  return {
    rank,
    wallet: fixtureAddress(rank),
    suinsName: rank === 1 ? 'leader.sui' : null,
    liquidTreeRaw: liquidRaw.toString(),
    liquidTree: formatTreeRaw(liquidRaw),
    lpTreeRaw: lpRaw.toString(),
    lpTree: formatTreeRaw(lpRaw),
    totalExposureRaw: totalRaw.toString(),
    totalExposure: formatTreeRaw(totalRaw),
    supplyPercent: formatTreeSupplyPercent(totalRaw),
    liquidCoinObjectCount: 1,
    lpPositionCount: lpRaw > 0n ? 1 : 0,
    lpBreakdown: {
      suiDexV2Raw: suiDexV2Raw.toString(),
      suiDexV2: formatTreeRaw(suiDexV2Raw),
      suiDexV3Raw: suiDexV3Raw.toString(),
      suiDexV3: formatTreeRaw(suiDexV3Raw),
      turbosRaw: turbosRaw.toString(),
      turbos: formatTreeRaw(turbosRaw),
    },
    badges,
  };
}

export function makeCompleteExposureSnapshot(): CompleteExposureSnapshot {
  const entries = Array.from({ length: 50 }, (_, index) => entryForRank(index + 1));
  const top50TotalRaw = entries.reduce((sum, entry) => sum + BigInt(entry.totalExposureRaw), 0n);
  const top50LiquidRaw = entries.reduce((sum, entry) => sum + BigInt(entry.liquidTreeRaw), 0n);
  const top50LpRaw = entries.reduce((sum, entry) => sum + BigInt(entry.lpTreeRaw), 0n);
  return {
    outcome: 'complete',
    provider: EXPOSURE_SNAPSHOT_PROVIDER,
    generatedAt: '2026-08-09T04:45:09.542Z',
    methodologyVersion: TREE_EXPOSURE_METHODOLOGY_VERSION,
    coinSymbol: 'TREE',
    coinDecimals: 6,
    totalSupplyRaw: '1000000000000000',
    coverage: {
      directTreeComplete: true,
      suiDexV2Complete: true,
      suiDexV3Complete: true,
      turbosComplete: true,
      totalExposureComplete: true,
    },
    eligibleOwnerCount: 60,
    displayedCount: 50,
    entries,
    warnings: [
      'SuiDex V3 exposure includes current principal liquidity only; unclaimed fees and incentive rewards are excluded.',
      'Turbos exposure includes current principal liquidity only; unclaimed fees and incentive rewards are excluded.',
    ],
    source: {
      direct: {
        outcome: 'complete',
        pagesScanned: 2,
        objectsScanned: 50,
        verifiedAddressOwners: 50,
        eligibleDirectOwners: 50,
        exposureCandidateCount: 50,
        addressOwnedRaw: top50LiquidRaw.toString(),
      },
      venues: {
        suiDexV2: {
          outcome: 'complete',
          walletCount: 1,
          positionCount: 1,
          principalTreeRaw: '1000000000',
          coverage: { scanComplete: true },
          warnings: [],
        },
        suiDexV3: {
          outcome: 'complete',
          walletCount: 1,
          positionCount: 1,
          principalTreeRaw: '61000000000',
          coverage: { scanComplete: true },
          warnings: ['Principal only.'],
        },
        turbos: {
          outcome: 'complete',
          walletCount: 0,
          positionCount: 0,
          principalTreeRaw: '0',
          coverage: { scanComplete: true },
          warnings: ['Principal only.'],
        },
      },
      suins: {
        requestedCount: 50,
        resolvedCount: 1,
        complete: true,
        generatedAt: '2026-08-09T04:45:10.000Z',
        warnings: [],
      },
    },
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
}
