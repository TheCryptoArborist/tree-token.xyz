import { getStore } from '@netlify/blobs';
import { emptyLive, type LiveFields } from './tree-dashboard-normalizer.ts';

export const TREE_DASHBOARD_STORE_NAME = 'tree-dashboard-market';
export const TREE_DASHBOARD_LAST_VERIFIED_KEY = 'last-verified-v1';
export const CORE_MARKET_FIELDS: Array<keyof LiveFields> = ['price', 'marketCap', 'liquidity', 'holderCount'];

export type CachedTreeMarket = {
  generatedAt: string;
  source: 'Noodles.fi';
  data: LiveFields;
};

export type TreeDashboardStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
};

function defaultStore(): TreeDashboardStore {
  return getStore(TREE_DASHBOARD_STORE_NAME, { consistency: 'strong' }) as TreeDashboardStore;
}

export function hasCoreMarketFields(data: Partial<LiveFields> | null | undefined): data is LiveFields {
  return CORE_MARKET_FIELDS.every((field) => data?.[field] !== null && data?.[field] !== undefined && Number.isFinite(Number(data[field])));
}

export function mergeLiveFields(primary: Partial<LiveFields> | null | undefined, fallback: Partial<LiveFields> | null | undefined): LiveFields {
  const merged = emptyLive();
  for (const field of Object.keys(merged) as Array<keyof LiveFields>) {
    const value = primary?.[field];
    merged[field] = (value !== null && value !== undefined ? value : fallback?.[field] ?? null) as never;
  }
  return merged;
}

export function validCachedTreeMarket(value: unknown): value is CachedTreeMarket {
  if (!value || typeof value !== 'object') return false;
  const cached = value as CachedTreeMarket;
  return cached.source === 'Noodles.fi' && Number.isFinite(Date.parse(cached.generatedAt)) && hasCoreMarketFields(cached.data);
}

export async function readCachedTreeMarket(store: TreeDashboardStore = defaultStore()): Promise<CachedTreeMarket | null> {
  const value = await store.get(TREE_DASHBOARD_LAST_VERIFIED_KEY, { type: 'json' });
  return validCachedTreeMarket(value) ? value : null;
}

export async function writeCachedTreeMarket(snapshot: CachedTreeMarket, store: TreeDashboardStore = defaultStore()): Promise<boolean> {
  if (!validCachedTreeMarket(snapshot)) return false;
  await store.setJSON(TREE_DASHBOARD_LAST_VERIFIED_KEY, snapshot);
  return true;
}
