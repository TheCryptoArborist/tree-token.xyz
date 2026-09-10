import { normalizeSuiAddress } from './leaderboard-provider.ts';
import { SUIDEX_V2_PACKAGE, SUIDEX_V2_TREE_POOL_ID } from './suidex-v2-tree-lp-provider.ts';
import { SUIDEX_V3_PACKAGE } from './suidex-v3-tree-lp-provider.ts';
import { TURBOS_TREE_POOL_IDS } from './turbos-tree-lp-provider.ts';
import { TREE_V3_POOL_ID } from './tree-v3-overview.ts';

export const TURBOS_EVENT_PACKAGE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
export type VolumeVenue = 'suiDexV2' | 'suiDexV3' | 'turbos';
export type QuoteKind = 'sui' | 'usdc' | 'wbtc';
export type VolumeSource = { poolId: string; venue: VolumeVenue; quote: QuoteKind };

export const TREE_VOLUME_SOURCES: readonly VolumeSource[] = [
  { poolId: SUIDEX_V2_TREE_POOL_ID, venue: 'suiDexV2', quote: 'sui' },
  { poolId: TREE_V3_POOL_ID, venue: 'suiDexV3', quote: 'sui' },
  { poolId: TURBOS_TREE_POOL_IDS[0], venue: 'turbos', quote: 'usdc' },
  { poolId: TURBOS_TREE_POOL_IDS[1], venue: 'turbos', quote: 'sui' },
  { poolId: TURBOS_TREE_POOL_IDS[2], venue: 'turbos', quote: 'usdc' },
  { poolId: TURBOS_TREE_POOL_IDS[3], venue: 'turbos', quote: 'sui' },
  { poolId: TURBOS_TREE_POOL_IDS[4], venue: 'turbos', quote: 'wbtc' },
];

type JsonRecord = Record<string, unknown>;
export type VolumePrices = { suiUsd: number; usdcUsd: number; wbtcUsd: number };

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function unsigned(value: unknown): bigint | null {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

function normalizedEventType(value: unknown) {
  return typeof value === 'string' ? value.toLowerCase().replace(/0x0+/g, '0x') : '';
}

function amountUsd(raw: bigint, quote: QuoteKind, prices: VolumePrices) {
  const decimals = quote === 'sui' ? 9 : quote === 'usdc' ? 6 : 8;
  const price = quote === 'sui' ? prices.suiUsd : quote === 'usdc' ? prices.usdcUsd : prices.wbtcUsd;
  return Number(raw) / 10 ** decimals * price;
}

export type ParsedVolumeTransaction = { timestamp: number; volumeUsd: number; swaps: number };

export function parseVolumeTransaction(
  nodeValue: unknown,
  source: VolumeSource,
  prices: VolumePrices,
  windowStartMs: number,
  windowEndMs: number,
): ParsedVolumeTransaction | null {
  const node = record(nodeValue);
  const effects = record(node.effects);
  const timestamp = Date.parse(String(effects.timestamp || ''));
  if (effects.status !== 'SUCCESS' || !Number.isFinite(timestamp) || timestamp < windowStartMs || timestamp > windowEndMs) return null;
  const events = record(effects.events);
  if (record(events.pageInfo).hasNextPage === true) throw new Error('Transaction events exceeded the verified page bound.');
  let volumeUsd = 0;
  let swaps = 0;
  for (const eventValue of Array.isArray(events.nodes) ? events.nodes : []) {
    const contents = record(record(eventValue).contents);
    const type = normalizedEventType(record(contents.type).repr);
    const json = record(contents.json);
    let raw: bigint | null = null;
    if (source.venue === 'suiDexV2'
      && type.startsWith(`${SUIDEX_V2_PACKAGE}::pair::swap<`)
      && type.includes('::sui::sui') && type.includes('::tree::tree')) {
      const input = unsigned(json.amount0_in);
      const output = unsigned(json.amount0_out);
      if (input !== null && output !== null && (input > 0n) !== (output > 0n)) raw = input > 0n ? input : output;
    } else if (source.venue === 'suiDexV3'
      && type === `${SUIDEX_V3_PACKAGE}::trade::swapevent`
      && normalizeSuiAddress(json.pool_id) === source.poolId) {
      raw = unsigned(json.amount_x);
    } else if (source.venue === 'turbos'
      && type === `${TURBOS_EVENT_PACKAGE}::pool::swapevent`
      && normalizeSuiAddress(json.pool) === source.poolId) {
      raw = unsigned(json.amount_b);
    }
    if (raw !== null && raw > 0n) { volumeUsd += amountUsd(raw, source.quote, prices); swaps += 1; }
  }
  return swaps ? { timestamp, volumeUsd, swaps } : null;
}
