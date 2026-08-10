import assert from 'node:assert/strict';
import {
  COMPLETE_TREE_BADGE_SNAPSHOT_KEY,
  readCompleteTreeBadgeSnapshot,
  validateCompleteTreeBadgeSnapshot,
  writeCompleteTreeBadgeSnapshot,
  type TreeBadgeStore,
} from '../netlify/lib/tree-badge-cache.ts';
import { buildCompleteTreeBadgeSnapshot } from '../netlify/lib/tree-badge-snapshot-builder.ts';
import { TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION, type TreeActivityIndex } from '../netlify/lib/tree-activity-index.ts';
import {
  TREE_BURN_INDEX_METHODOLOGY_VERSION,
  TREE_TOKEN_CREATION_CHECKPOINT,
  type TreeBurnIndex,
} from '../netlify/lib/tree-burn-index.ts';
import { makeCompleteExposureSnapshot } from './fixtures/tree-exposure-fixture.ts';

class MemoryStore implements TreeBadgeStore {
  values = new Map<string, unknown>();
  async get(key: string, _options: { type: 'json' }) { return this.values.get(key) ?? null; }
  async setJSON(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
  async delete(key: string) { this.values.delete(key); }
}

const exposure = makeCompleteExposureSnapshot();
const pool = `0x${'f'.repeat(64)}`;
const indexedCheckpoint = '200000000';
const activityWallets = exposure.entries.map((entry) => entry.wallet).sort();
const activity: TreeActivityIndex = {
  methodologyVersion: TREE_ACTIVITY_INDEX_METHODOLOGY_VERSION,
  generatedAt: '2026-08-09T13:00:00.000Z',
  windowStart: '2026-07-10T13:00:00.000Z',
  windowEnd: '2026-08-09T13:00:00.000Z',
  windowStartCheckpoint: '190000000',
  indexedThroughCheckpoint: indexedCheckpoint,
  wallets: activityWallets,
  pools: {
    [pool]: {
      protocol: 'fixture',
      indexedThroughMs: Date.parse('2026-08-09T13:00:00.000Z'),
      indexedThroughCheckpoint: indexedCheckpoint,
      rangeStartCheckpoint: indexedCheckpoint,
      rangeEndCheckpoint: indexedCheckpoint,
      nextCursor: null,
      inProgress: false,
    },
  },
  transactions: {},
};
for (let index = 0; index < 10; index += 1) {
  const wallet = exposure.entries[0].wallet;
  activity.transactions[`${wallet}:buy-${index}`] = {
    wallet,
    digest: `buy-${index}`,
    timestamp: Date.parse('2026-08-01T00:00:00.000Z') + index,
    checkpoint: String(195000000 + index),
    source: pool,
    legs: { [pool]: '20000000000' },
  };
}
const paperWallet = exposure.entries[1].wallet;
activity.transactions[`${paperWallet}:sell`] = {
  wallet: paperWallet,
  digest: 'sell',
  timestamp: Date.parse('2026-08-02T00:00:00.000Z'),
  checkpoint: '196000000',
  source: pool,
  legs: { [pool]: '-150000000000' },
};
activity.transactions[`${paperWallet}:buy`] = {
  wallet: paperWallet,
  digest: 'buy',
  timestamp: Date.parse('2026-08-03T00:00:00.000Z'),
  checkpoint: '197000000',
  source: pool,
  legs: { [pool]: '10000000000' },
};

const burns: TreeBurnIndex = {
  methodologyVersion: TREE_BURN_INDEX_METHODOLOGY_VERSION,
  generatedAt: '2026-08-09T13:00:00.000Z',
  indexedThroughCheckpoint: indexedCheckpoint,
  creationCheckpoint: TREE_TOKEN_CREATION_CHECKPOINT,
  wallets: Object.fromEntries(exposure.entries.map((entry, index) => [entry.wallet, {
    burnedTreeRaw: index === 0 ? '500000000000' : '0',
    indexedThroughCheckpoint: indexedCheckpoint,
    completeBackfill: true,
    progress: null,
  }])),
};

const snapshot = buildCompleteTreeBadgeSnapshot({ exposure, activityIndex: activity, burnIndex: burns });
assert.ok(snapshot);
assert.equal(validateCompleteTreeBadgeSnapshot(snapshot), true);
assert.deepEqual(snapshot.entries[0].badges, ['diamond-hands', 'accumulator', 'burned']);
assert.deepEqual(snapshot.entries[1].badges, ['paper-hands']);
assert.deepEqual(snapshot.entries[2].badges, ['diamond-hands']);
assert.deepEqual(snapshot.summary, { diamondHands: 49, paperHands: 1, accumulator: 1, burned: 1 });

const store = new MemoryStore();
assert.equal(await writeCompleteTreeBadgeSnapshot(snapshot, { store }), true);
assert.deepEqual(await readCompleteTreeBadgeSnapshot({ store }), snapshot);
const invalid = structuredClone(snapshot);
invalid.entries[0].badges = [];
assert.equal(validateCompleteTreeBadgeSnapshot(invalid), false);
assert.equal(await writeCompleteTreeBadgeSnapshot(invalid, { store }), false);
assert.deepEqual(store.values.get(COMPLETE_TREE_BADGE_SNAPSHOT_KEY), snapshot);
console.log('TREE badge snapshot: PASS (evidence validation, deterministic badge order, and complete-only writes)');
