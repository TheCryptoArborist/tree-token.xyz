import exclusions from '../../data/tree-leaderboard-exclusions.json';

export const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const METHODOLOGY_VERSION = 'direct-tree-phase-2.1';
export const LEADERBOARD_COVERAGE = {
  directTree: true,
  moonbagsLocks: false,
  suiDexV2: false,
  suiDexV3: false,
  turbos: false,
  nftreeCount: false,
} as const;

const MAX_PAGES = 10;
const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const exclusionMap = new Map(exclusions.map((item) => [item.address.toLowerCase(), item]));

export type BlockVisionHolder = { address?: unknown; quantity?: unknown; percentage?: unknown };
type Candidate = { wallet: string; directTree: string; directTreeNumber: number; supplyPercent: number | null };

export type DirectTreeEntry = {
  rank: number;
  wallet: string;
  directTree: string;
  supplyPercent: number | null;
  tier: string;
  moonbagsLocks: null;
  suiDexV2: null;
  suiDexV3: null;
  turbos: null;
  nftreeCount: null;
};

function tierForRank(rank: number) {
  if (rank <= 5) return 'Ancient Grove';
  if (rank <= 10) return 'Giant Sequoia';
  if (rank <= 20) return 'Heritage Oak';
  if (rank <= 30) return 'Canopy Guardian';
  return 'Forest Keeper';
}

export function normalizeSuiAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return SUI_ADDRESS.test(normalized) ? normalized : null;
}

export function buildDirectTreeLeaderboard(rows: BlockVisionHolder[], limit = 50) {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  let excludedCount = 0;
  for (const row of rows) {
    const wallet = normalizeSuiAddress(row.address);
    if (!wallet) {
      excludedCount += 1;
      categoryCounts.malformed = (categoryCounts.malformed || 0) + 1;
      continue;
    }
    const excluded = exclusionMap.get(wallet);
    if (excluded) {
      excludedCount += 1;
      categoryCounts[excluded.category] = (categoryCounts[excluded.category] || 0) + 1;
      continue;
    }
    if (seen.has(wallet)) {
      excludedCount += 1;
      categoryCounts.duplicate = (categoryCounts.duplicate || 0) + 1;
      continue;
    }
    const directTree = typeof row.quantity === 'string' || typeof row.quantity === 'number' ? String(row.quantity) : '';
    const directTreeNumber = Number(directTree.replace(/,/g, ''));
    if (!directTree || !Number.isFinite(directTreeNumber) || directTreeNumber < 0) {
      excludedCount += 1;
      categoryCounts.invalidBalance = (categoryCounts.invalidBalance || 0) + 1;
      continue;
    }
    const percentage = Number(row.percentage);
    seen.add(wallet);
    candidates.push({ wallet, directTree, directTreeNumber, supplyPercent: Number.isFinite(percentage) ? percentage : null });
  }
  candidates.sort((a, b) => b.directTreeNumber - a.directTreeNumber || a.wallet.localeCompare(b.wallet));
  const entries: DirectTreeEntry[] = candidates.slice(0, limit).map((candidate, index) => ({
    rank: index + 1,
    wallet: candidate.wallet,
    directTree: candidate.directTree,
    supplyPercent: candidate.supplyPercent,
    tier: tierForRank(index + 1),
    moonbagsLocks: null,
    suiDexV2: null,
    suiDexV3: null,
    turbos: null,
    nftreeCount: null,
  }));
  const sharedProtocolExcludedCount = categoryCounts['shared-protocol-object'] || 0;
  return { entries, displayedCount: entries.length, excludedCount, sharedProtocolExcludedCount, categoryCounts };
}

function pageData(payload: unknown) {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const candidate = root.result ?? root.data ?? root;
  const container = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate as Record<string, unknown> : root;
  const rows = Array.isArray(container.data) ? container.data : Array.isArray(container.items) ? container.items : Array.isArray(root.data) ? root.data : [];
  const next = container.nextPageCursor ?? root.nextPageCursor;
  const total = Number(container.total ?? root.total);
  return { rows: rows as BlockVisionHolder[], nextPageCursor: typeof next === 'string' && next ? next : null, total: Number.isFinite(total) ? total : null };
}

export async function fetchDirectTreeLeaderboard(apiKey: string) {
  const rows: BlockVisionHolder[] = [];
  let cursor: string | null = null;
  let holderCount: number | null = null;
  let pagesScanned = 0;
  let preview = buildDirectTreeLeaderboard(rows);
  do {
    const url = new URL('https://api.blockvision.org/v2/sui/coin/holders');
    url.searchParams.set('coinType', TREE_COIN_TYPE);
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, { headers: { Accept: 'application/json', 'x-api-key': apiKey } });
    if (!response.ok) throw new Error(`BlockVision returned ${response.status}`);
    const page = pageData(await response.json());
    rows.push(...page.rows);
    holderCount = page.total ?? holderCount;
    cursor = page.nextPageCursor;
    pagesScanned += 1;
    preview = buildDirectTreeLeaderboard(rows);
  } while (preview.displayedCount < 50 && cursor && pagesScanned < MAX_PAGES);

  const warnings = ['Phase 2.1 ranks direct wallet-held TREE only. Other exposure is not yet covered.'];
  if (preview.excludedCount) warnings.push(`${preview.excludedCount} malformed, duplicate, system, or shared-protocol holder entries were excluded before ranking.`);
  if (cursor && pagesScanned >= MAX_PAGES && preview.displayedCount < 50) warnings.push('The conservative BlockVision page limit was reached before 50 displayable wallets were found.');
  return {
    ...preview,
    holderCount,
    exclusionCoverage: {
      configuredEntries: exclusions.length,
      categories: [...new Set(exclusions.map((item) => item.category))],
      excludedByCategory: preview.categoryCounts,
      addressValidation: '0x followed by 64 hexadecimal characters',
      pagesScanned,
    },
    warnings,
  };
}
