import type { CompleteExposureSnapshot } from './tree-exposure-cache.ts';
import { summarizeTreeActivity, validateTreeActivityIndex, type TreeActivityIndex } from './tree-activity-index.ts';
import { burnEvidenceForWallet, validateTreeBurnIndex, type TreeBurnIndex } from './tree-burn-index.ts';
import { validateCompleteTreeBadgeSnapshot } from './tree-badge-cache.ts';
import {
  TREE_BADGE_METHODOLOGY_VERSION,
  TREE_BADGE_SNAPSHOT_PROVIDER,
  expectedBehaviorBadges,
  type CompleteTreeBadgeSnapshot,
  type TreeBehaviorBadgeEntry,
} from './tree-badge-types.ts';

export type BuildTreeBadgeSnapshotInput = {
  exposure: CompleteExposureSnapshot;
  activityIndex: TreeActivityIndex;
  burnIndex: TreeBurnIndex;
  activityWarnings?: string[];
  burnWarnings?: string[];
  generatedAt?: string;
};

export function buildCompleteTreeBadgeSnapshot(
  input: BuildTreeBadgeSnapshotInput,
): CompleteTreeBadgeSnapshot | null {
  if (!validateTreeActivityIndex(input.activityIndex)
    || !validateTreeBurnIndex(input.burnIndex)
    || input.exposure.outcome !== 'complete'
    || input.exposure.entries.length !== 50
    || input.exposure.displayedCount !== 50) return null;

  const wallets = input.exposure.entries.map((entry) => entry.wallet);
  const activity = summarizeTreeActivity(input.activityIndex, wallets);
  const entries: TreeBehaviorBadgeEntry[] = [];

  for (const exposureEntry of input.exposure.entries) {
    const activitySummary = activity[exposureEntry.wallet];
    const burnEvidence = burnEvidenceForWallet(input.burnIndex, exposureEntry.wallet);
    if (!activitySummary || !burnEvidence) return null;
    const activityEvidence = {
      windowStart: input.activityIndex.windowStart,
      windowEnd: input.activityIndex.windowEnd,
      ...activitySummary,
    };
    const burn = {
      burnedTreeRaw: burnEvidence.burnedTreeRaw,
      burnedTree: burnEvidence.burnedTree,
      indexedThroughCheckpoint: burnEvidence.indexedThroughCheckpoint,
    };
    const badges = expectedBehaviorBadges(activityEvidence, burn);
    if (!badges) return null;
    entries.push({
      rank: exposureEntry.rank,
      wallet: exposureEntry.wallet,
      activity30d: activityEvidence,
      burn,
      badges,
    });
  }

  const snapshot: CompleteTreeBadgeSnapshot = {
    outcome: 'complete',
    provider: TREE_BADGE_SNAPSHOT_PROVIDER,
    methodologyVersion: TREE_BADGE_METHODOLOGY_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    exposureSnapshotGeneratedAt: input.exposure.generatedAt,
    displayedCount: 50,
    entries,
    source: {
      activity: {
        outcome: 'complete',
        methodologyVersion: input.activityIndex.methodologyVersion,
        generatedAt: input.activityIndex.generatedAt,
        windowStart: input.activityIndex.windowStart,
        windowEnd: input.activityIndex.windowEnd,
        poolCount: Object.keys(input.activityIndex.pools).length,
        transactionCount: Object.keys(input.activityIndex.transactions).length,
        warnings: [...(input.activityWarnings || [])],
      },
      burns: {
        outcome: 'complete',
        methodologyVersion: input.burnIndex.methodologyVersion,
        generatedAt: input.burnIndex.generatedAt,
        indexedThroughCheckpoint: input.burnIndex.indexedThroughCheckpoint,
        walletCount: wallets.length,
        warnings: [...(input.burnWarnings || [])],
      },
    },
    summary: {
      diamondHands: entries.filter((entry) => entry.badges.includes('diamond-hands')).length,
      paperHands: entries.filter((entry) => entry.badges.includes('paper-hands')).length,
      accumulator: entries.filter((entry) => entry.badges.includes('accumulator')).length,
      burned: entries.filter((entry) => entry.badges.includes('burned')).length,
    },
    warnings: [...(input.activityWarnings || []), ...(input.burnWarnings || [])],
  };

  return validateCompleteTreeBadgeSnapshot(snapshot) ? snapshot : null;
}
