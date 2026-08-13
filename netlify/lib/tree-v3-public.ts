import { SuiGrpcClient } from '@mysten/sui/grpc';
import { parseSignedI32 } from './clmm-q64.ts';
import {
  SUI_TYPE,
  TREE_TYPE,
  SUIDEX_V3_TREE_POOL,
  normalizeMoveType,
  normalizeTreeSwapQuote,
} from './tree-swap-route.ts';

export const SUIDEX_V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
export const SUIDEX_V3_POSITION_TYPE = `${SUIDEX_V3_PACKAGE}::position::Position`;
export const SUIDEX_V3_POOL_PAGE = `https://dex.suidex.org/pools/v3/${SUIDEX_V3_TREE_POOL}/add`;
export const SUIDEX_V3_ANALYTICS_PAGE = 'https://dex.suidex.org/pools/v3/analytics';
export const SUIDEX_V3_ROUTE_URL = 'https://dex.suidex.org/api/v3/route';
export const SUI_MAINNET_GRAPHQL = 'https://graphql.mainnet.sui.io/graphql';
export const SUI_MAINNET_GRPC = 'https://fullnode.mainnet.sui.io:443';

const POSITION_SCAN_QUERY = `query ScanSuiDexV3Positions($first: Int!, $after: String, $type: String!) {
  objects(first: $first, after: $after, filter: { type: $type }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      address
      owner {
        __typename
        ... on AddressOwner { address { address } }
        ... on ObjectOwner { address { address } }
      }
      asMoveObject { contents { json } }
    }
  }
}`;

export type TreeV3Reward = {
  token: string;
  amountPerDay: string;
};

export type TreeV3PageStats = {
  tvlUsd: number | null;
  volume24hUsd: number | null;
  fees24hUsd: number | null;
  swaps24h: number | null;
  aprPercent: number | null;
  feeAprPercent: number | null;
  rewardAprPercent: number | null;
  currentPriceSuiPerTree: number | null;
  feePercent: number | null;
  rewards: TreeV3Reward[];
};

export type TreeV3Position = {
  objectId: string;
  owner: string;
  poolId: string;
  liquidityRaw: string;
  tickLower: number;
  tickUpper: number;
  currentTick: number | null;
  inRange: boolean | null;
  treeSide: 'x' | 'y';
  owedTreeRaw: string;
  owedSuiRaw: string;
};

export type TreeV3PositionScan = {
  positions: TreeV3Position[];
  coverage: {
    pagesScanned: number;
    objectsScanned: number;
    matchedPoolPositions: number;
    activePoolPositions: number;
    uniqueOwners: number;
    reachedEnd: boolean;
    malformedObjects: number;
  };
};

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unsignedText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  try { return BigInt(text).toString(); } catch { return null; }
}

export function normalizeSuiAddress(value: unknown): string | null {
  const body = String(value ?? '').trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(body)) return null;
  return `0x${body.padStart(64, '0')}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/');
}

export function visibleTextFromHtml(html: string): string {
  return decodeHtml(String(html || ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCompactNumber(value: unknown): number | null {
  const text = String(value ?? '').trim().replace(/[$,%\s]/g, '').replace(/,/g, '');
  const match = text.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const scale = ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 } as Record<string, number>)[String(match[2] || '').toUpperCase()] || 1;
  return number * scale;
}

function firstCapture(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

export function parseSuiDexPoolPage(input: string): Partial<TreeV3PageStats> {
  const text = input.includes('<') ? visibleTextFromHtml(input) : input.replace(/\s+/g, ' ').trim();
  const tvl = firstCapture(text, /\bTVL\s+\$([\d,.]+(?:[KMBT])?)/i);
  const volume = firstCapture(text, /\bVolume\s*24H\s+\$([\d,.]+(?:[KMBT])?)/i);
  const fees = firstCapture(text, /\bFees\s*24H\s+\$([\d,.]+(?:[KMBT])?)/i);
  const apr = firstCapture(text, /\bPool\s+APR\s+([\d,.]+)%/i);
  const feeApr = firstCapture(text, /\bFees\s+([\d,.]+)%\s+Rewards\b/i);
  const rewardApr = firstCapture(text, /\bRewards\s+([\d,.]+)%/i);
  const price = firstCapture(text, /\bCurrent:\s*([\d.]+)\s*SUI\s+per\s+(?:Tree|TREE)\b/i);
  const rewards: TreeV3Reward[] = [];
  const rewardPattern = /Farm\s+rewards:\s*([A-Z][A-Z0-9 _-]*?)\s*\(([^)]+?)\/day\)/gi;
  for (const match of text.matchAll(rewardPattern)) {
    const token = String(match[1] || '').trim().replace(/\s+/g, ' ');
    const amountPerDay = String(match[2] || '').trim();
    if (token && amountPerDay && !rewards.some((reward) => reward.token === token && reward.amountPerDay === amountPerDay)) {
      rewards.push({ token, amountPerDay });
    }
  }
  return {
    tvlUsd: parseCompactNumber(tvl),
    volume24hUsd: parseCompactNumber(volume),
    fees24hUsd: parseCompactNumber(fees),
    aprPercent: parseCompactNumber(apr),
    feeAprPercent: parseCompactNumber(feeApr),
    rewardAprPercent: parseCompactNumber(rewardApr),
    currentPriceSuiPerTree: finiteNumber(price),
    rewards,
  };
}

export function parseSuiDexAnalyticsPage(input: string): Partial<TreeV3PageStats> {
  const text = input.includes('<') ? visibleTextFromHtml(input) : input.replace(/\s+/g, ' ').trim();
  const row = text.match(/SUI\s*\/\s*(?:Tree|TREE)\s+([\d.]+)%\s+\$([\d,.]+(?:[KMBT])?)\s+\$([\d,.]+(?:[KMBT])?)\s+\$([\d,.]+(?:[KMBT])?)\s+([\d,]+)/i);
  if (!row) return {};
  return {
    feePercent: parseCompactNumber(row[1]),
    tvlUsd: parseCompactNumber(row[2]),
    volume24hUsd: parseCompactNumber(row[3]),
    fees24hUsd: parseCompactNumber(row[4]),
    swaps24h: parseCompactNumber(row[5]),
  };
}

export function mergeTreeV3PageStats(
  poolPage: Partial<TreeV3PageStats>,
  analyticsPage: Partial<TreeV3PageStats>,
): TreeV3PageStats {
  return {
    tvlUsd: analyticsPage.tvlUsd ?? poolPage.tvlUsd ?? null,
    volume24hUsd: analyticsPage.volume24hUsd ?? poolPage.volume24hUsd ?? null,
    fees24hUsd: analyticsPage.fees24hUsd ?? poolPage.fees24hUsd ?? null,
    swaps24h: analyticsPage.swaps24h ?? poolPage.swaps24h ?? null,
    aprPercent: poolPage.aprPercent ?? analyticsPage.aprPercent ?? null,
    feeAprPercent: poolPage.feeAprPercent ?? analyticsPage.feeAprPercent ?? null,
    rewardAprPercent: poolPage.rewardAprPercent ?? analyticsPage.rewardAprPercent ?? null,
    currentPriceSuiPerTree: poolPage.currentPriceSuiPerTree ?? analyticsPage.currentPriceSuiPerTree ?? null,
    feePercent: analyticsPage.feePercent ?? poolPage.feePercent ?? 0.25,
    rewards: poolPage.rewards || analyticsPage.rewards || [],
  };
}

async function fetchText(url: string, fetchImpl: FetchLike, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'TREE-Command-Center/1.0' },
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getSuiDexV3PageStats(fetchImpl: FetchLike = fetch): Promise<{
  stats: TreeV3PageStats;
  sources: { poolPage: boolean; analyticsPage: boolean };
  warnings: string[];
}> {
  const warnings: string[] = [];
  const [poolResult, analyticsResult] = await Promise.allSettled([
    fetchText(SUIDEX_V3_POOL_PAGE, fetchImpl),
    fetchText(SUIDEX_V3_ANALYTICS_PAGE, fetchImpl),
  ]);
  const poolPage = poolResult.status === 'fulfilled' ? parseSuiDexPoolPage(poolResult.value) : {};
  const analyticsPage = analyticsResult.status === 'fulfilled' ? parseSuiDexAnalyticsPage(analyticsResult.value) : {};
  if (poolResult.status === 'rejected') warnings.push('The SuiDex V3 pool detail page was temporarily unavailable.');
  if (analyticsResult.status === 'rejected') warnings.push('The SuiDex V3 analytics page was temporarily unavailable.');
  const stats = mergeTreeV3PageStats(poolPage, analyticsPage);
  if (stats.currentPriceSuiPerTree === null) warnings.push('The SuiDex pool page did not expose a current SUI-per-TREE reference price.');
  return {
    stats,
    sources: { poolPage: poolResult.status === 'fulfilled', analyticsPage: analyticsResult.status === 'fulfilled' },
    warnings,
  };
}

export async function getSuiDexV3Quote(fetchImpl: FetchLike = fetch) {
  const upstream = new URL(SUIDEX_V3_ROUTE_URL);
  upstream.searchParams.set('tokenIn', SUI_TYPE);
  upstream.searchParams.set('tokenOut', TREE_TYPE);
  upstream.searchParams.set('amountIn', '1000000000');
  upstream.searchParams.set('slippageBps', '100');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(upstream, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'TREE-Command-Center/1.0' },
    });
    if (!response.ok) throw new Error(`SuiDex route service returned HTTP ${response.status}`);
    const normalized = normalizeTreeSwapQuote(await response.json(), {
      tokenIn: SUI_TYPE,
      tokenOut: TREE_TYPE,
      amountIn: '1000000000',
      slippageBps: 100,
      generatedAt: new Date().toISOString(),
    });
    const route = normalized.routes.find((candidate) => candidate.venue === 'v3') || null;
    if (!route) throw new Error('The SuiDex route service did not return the allowlisted SUI/TREE V3 route.');
    return route;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSuiDexV3PoolObject() {
  const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: SUI_MAINNET_GRPC });
  const { object } = await client.core.getObject({ objectId: SUIDEX_V3_TREE_POOL, include: { json: true } });
  if (!object) throw new Error('The allowlisted SuiDex V3 SUI/TREE pool object was not returned.');
  const json = record(object.json);
  const objectId = normalizeSuiAddress(json.id) || normalizeSuiAddress(object.objectId) || SUIDEX_V3_TREE_POOL;
  const currentTick = parseSignedI32(json.tick_index);
  const liquidityRaw = unsignedText(json.liquidity);
  const reserveXRaw = unsignedText(json.reserve_x);
  const reserveYRaw = unsignedText(json.reserve_y);
  const tokenX = typeof json.type_x === 'string' ? normalizeMoveType(json.type_x) : null;
  const tokenY = typeof json.type_y === 'string' ? normalizeMoveType(json.type_y) : null;
  if (objectId !== SUIDEX_V3_TREE_POOL || currentTick === null || !liquidityRaw || !reserveXRaw || !reserveYRaw) {
    throw new Error('The allowlisted SuiDex V3 pool object failed integrity validation.');
  }
  if (!tokenX || !tokenY || ![tokenX, tokenY].includes(normalizeMoveType(TREE_TYPE)) || ![tokenX, tokenY].includes(normalizeMoveType(SUI_TYPE))) {
    throw new Error('The allowlisted SuiDex V3 pool no longer resolves to the exact SUI/TREE pair.');
  }
  return { objectId, currentTick, liquidityRaw, reserveXRaw, reserveYRaw, tokenX, tokenY };
}

function parseOwner(node: JsonRecord): { kind: string; address: string | null } {
  const owner = record(node.owner);
  const addressValue = owner.address;
  const raw = typeof addressValue === 'string' ? addressValue : record(addressValue).address;
  return {
    kind: typeof owner.__typename === 'string' ? owner.__typename : 'Unknown',
    address: normalizeSuiAddress(raw),
  };
}

export function parseTreeV3PositionNode(node: unknown, currentTick: number | null): TreeV3Position | null {
  const source = record(node);
  const objectId = normalizeSuiAddress(source.address);
  const owner = parseOwner(source);
  const json = record(record(record(source.asMoveObject).contents).json);
  const poolId = normalizeSuiAddress(json.pool_id);
  const tokenX = typeof json.type_x === 'string' ? normalizeMoveType(json.type_x) : null;
  const tokenY = typeof json.type_y === 'string' ? normalizeMoveType(json.type_y) : null;
  const tree = normalizeMoveType(TREE_TYPE);
  const sui = normalizeMoveType(SUI_TYPE);
  const treeSide = tokenX === tree ? 'x' : tokenY === tree ? 'y' : null;
  const tickLower = parseSignedI32(json.tick_lower_index);
  const tickUpper = parseSignedI32(json.tick_upper_index);
  const liquidityRaw = unsignedText(json.liquidity);
  const owedX = unsignedText(json.owed_coin_x) || '0';
  const owedY = unsignedText(json.owed_coin_y) || '0';
  if (!objectId
    || owner.kind !== 'AddressOwner'
    || !owner.address
    || poolId !== SUIDEX_V3_TREE_POOL
    || !treeSide
    || !tokenX
    || !tokenY
    || ![tokenX, tokenY].includes(sui)
    || tickLower === null
    || tickUpper === null
    || tickLower >= tickUpper
    || liquidityRaw === null) return null;
  const suiSide = tokenX === sui ? 'x' : 'y';
  return {
    objectId,
    owner: owner.address,
    poolId,
    liquidityRaw,
    tickLower,
    tickUpper,
    currentTick,
    inRange: currentTick === null ? null : currentTick >= tickLower && currentTick < tickUpper,
    treeSide,
    owedTreeRaw: treeSide === 'x' ? owedX : owedY,
    owedSuiRaw: suiSide === 'x' ? owedX : owedY,
  };
}

export async function scanTreeV3Positions(options: {
  fetchImpl?: FetchLike;
  currentTick?: number | null;
  maxPages?: number;
  pageSize?: number;
} = {}): Promise<TreeV3PositionScan> {
  const fetchImpl = options.fetchImpl || fetch;
  const pageSize = Math.max(1, Math.min(50, Math.trunc(options.pageSize ?? 50)));
  const maxPages = Math.max(1, Math.min(40, Math.trunc(options.maxPages ?? 20)));
  const positions: TreeV3Position[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  let pagesScanned = 0;
  let objectsScanned = 0;
  let malformedObjects = 0;
  let reachedEnd = false;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchImpl(SUI_MAINNET_GRAPHQL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'TREE-Command-Center/1.0' },
      body: JSON.stringify({
        query: POSITION_SCAN_QUERY,
        variables: { first: pageSize, after, type: SUIDEX_V3_POSITION_TYPE },
      }),
    });
    if (!response.ok) throw new Error(`Sui GraphQL returned HTTP ${response.status}`);
    const payload = record(await response.json());
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (errors.length) throw new Error(errors.map((item) => String(record(item).message || 'GraphQL error')).join(' | '));
    const connection = record(record(payload.data).objects);
    const pageInfo = record(connection.pageInfo);
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
    pagesScanned = page + 1;
    objectsScanned += nodes.length;
    for (const node of nodes) {
      const objectId = normalizeSuiAddress(record(node).address);
      if (!objectId || seen.has(objectId)) {
        malformedObjects += 1;
        continue;
      }
      seen.add(objectId);
      const position = parseTreeV3PositionNode(node, options.currentTick ?? null);
      if (position) positions.push(position);
    }
    if (pageInfo.hasNextPage !== true) {
      reachedEnd = true;
      break;
    }
    if (typeof pageInfo.endCursor !== 'string' || !pageInfo.endCursor) break;
    after = pageInfo.endCursor;
  }

  const activePoolPositions = positions.filter((position) => BigInt(position.liquidityRaw) > 0n).length;
  return {
    positions,
    coverage: {
      pagesScanned,
      objectsScanned,
      matchedPoolPositions: positions.length,
      activePoolPositions,
      uniqueOwners: new Set(positions.map((position) => position.owner)).size,
      reachedEnd,
      malformedObjects,
    },
  };
}
