import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';

export const TREE_V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
export const TREE_V3_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
export const TREE_V3_POSITION_TYPE = `${TREE_V3_PACKAGE}::position::Position`;
export const SUI_COIN_TYPE = '0x2::sui::SUI';
export const TREE_V3_FEE_PERCENT = 0.25;
export const TREE_DECIMALS = 6;
export const SUI_DECIMALS = 9;

export type JsonRecord = Record<string, unknown>;

export type TreeV3PoolView = {
  poolId: string;
  tokenX: string;
  tokenY: string;
  currentTick: number;
  sqrtPriceRaw: string;
  liquidityRaw: string;
  reserveSuiRaw: string;
  reserveTreeRaw: string;
  reserveSui: string;
  reserveTree: string;
  priceSuiPerTree: string;
  priceTreePerSui: string;
  feePercent: number;
  tvlUsdEstimate: number | null;
  tvlSource: 'onchain-reserves-plus-coingecko' | 'unavailable';
};

export type TreeV3PositionView = {
  objectId: string;
  poolId: string;
  liquidityRaw: string;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  inRange: boolean;
  owedSuiRaw: string;
  owedTreeRaw: string;
};

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

export function normalizeCoinType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/\s+/g, '');
  const parts = compact.split('::');
  if (parts.length !== 3 || !/^(0x)?[0-9a-f]+$/.test(parts[0]) || !parts[1] || !parts[2]) return null;
  const address = parts[0].replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${address}::${parts[1]}::${parts[2]}`;
}

export function parseUnsigned(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  try { return BigInt(value.trim()); } catch { return null; }
}

export function parseSignedI32(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) return value;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= -2147483648 && numeric <= 2147483647 ? numeric : null;
}

export function formatRawAmount(raw: bigint, decimals: number, maximumFractionDigits = decimals): string {
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, maximumFractionDigits);
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

function rationalToDecimal(numerator: bigint, denominator: bigint, digits = 14): string {
  if (denominator <= 0n || numerator < 0n) return '0';
  const whole = numerator / denominator;
  let remainder = numerator % denominator;
  let fraction = '';
  for (let index = 0; index < digits && remainder > 0n; index += 1) {
    remainder *= 10n;
    fraction += (remainder / denominator).toString();
    remainder %= denominator;
  }
  fraction = fraction.replace(/0+$/, '');
  return `${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

function ownerAddress(node: JsonRecord): string | null {
  const owner = record(node.owner);
  if (owner.__typename !== 'AddressOwner') return null;
  const addressValue = owner.address;
  return normalizeSuiAddress(typeof addressValue === 'string' ? addressValue : record(addressValue).address);
}

const NORMALIZED_TREE = normalizeCoinType(TREE_COIN_TYPE)!;
const NORMALIZED_SUI = normalizeCoinType(SUI_COIN_TYPE)!;

export function parseTreeV3Pool(jsonValue: unknown, prices?: { suiUsd?: number | null; treeUsd?: number | null }): TreeV3PoolView | null {
  const json = record(jsonValue);
  const poolId = normalizeSuiAddress(json.id);
  const tokenX = normalizeCoinType(json.type_x);
  const tokenY = normalizeCoinType(json.type_y);
  const currentTick = parseSignedI32(json.tick_index);
  const sqrtPrice = parseUnsigned(json.sqrt_price);
  const liquidity = parseUnsigned(json.liquidity);
  const reserveX = parseUnsigned(json.reserve_x);
  const reserveY = parseUnsigned(json.reserve_y);
  if (poolId !== TREE_V3_POOL_ID || !tokenX || !tokenY || currentTick === null || sqrtPrice === null || sqrtPrice <= 0n || liquidity === null || reserveX === null || reserveY === null) return null;
  const pair = new Set([tokenX, tokenY]);
  if (!pair.has(NORMALIZED_TREE) || !pair.has(NORMALIZED_SUI) || pair.size !== 2) return null;

  const reserveSuiRaw = tokenX === NORMALIZED_SUI ? reserveX : reserveY;
  const reserveTreeRaw = tokenX === NORMALIZED_TREE ? reserveX : reserveY;
  const q128 = 1n << 128n;
  const rawYPerXNumerator = sqrtPrice * sqrtPrice;
  let suiPerTreeNumerator: bigint;
  let suiPerTreeDenominator: bigint;
  if (tokenX === NORMALIZED_TREE && tokenY === NORMALIZED_SUI) {
    suiPerTreeNumerator = rawYPerXNumerator * (10n ** BigInt(TREE_DECIMALS));
    suiPerTreeDenominator = q128 * (10n ** BigInt(SUI_DECIMALS));
  } else {
    suiPerTreeNumerator = q128 * (10n ** BigInt(TREE_DECIMALS));
    suiPerTreeDenominator = rawYPerXNumerator * (10n ** BigInt(SUI_DECIMALS));
  }
  if (suiPerTreeNumerator <= 0n || suiPerTreeDenominator <= 0n) return null;
  const treePerSuiNumerator = suiPerTreeDenominator;
  const treePerSuiDenominator = suiPerTreeNumerator;

  const suiUsd = Number(prices?.suiUsd);
  const treeUsd = Number(prices?.treeUsd);
  const reserveSui = Number(formatRawAmount(reserveSuiRaw, SUI_DECIMALS));
  const reserveTree = Number(formatRawAmount(reserveTreeRaw, TREE_DECIMALS));
  const tvlUsdEstimate = Number.isFinite(suiUsd) && suiUsd > 0 && Number.isFinite(treeUsd) && treeUsd > 0
    ? reserveSui * suiUsd + reserveTree * treeUsd
    : null;

  return {
    poolId,
    tokenX,
    tokenY,
    currentTick,
    sqrtPriceRaw: sqrtPrice.toString(),
    liquidityRaw: liquidity.toString(),
    reserveSuiRaw: reserveSuiRaw.toString(),
    reserveTreeRaw: reserveTreeRaw.toString(),
    reserveSui: formatRawAmount(reserveSuiRaw, SUI_DECIMALS, 6),
    reserveTree: formatRawAmount(reserveTreeRaw, TREE_DECIMALS, 2),
    priceSuiPerTree: rationalToDecimal(suiPerTreeNumerator, suiPerTreeDenominator, 12),
    priceTreePerSui: rationalToDecimal(treePerSuiNumerator, treePerSuiDenominator, 6),
    feePercent: TREE_V3_FEE_PERCENT,
    tvlUsdEstimate: Number.isFinite(tvlUsdEstimate) ? tvlUsdEstimate : null,
    tvlSource: Number.isFinite(tvlUsdEstimate) ? 'onchain-reserves-plus-coingecko' : 'unavailable',
  };
}

export function parseTreeV3Position(nodeValue: unknown, owner: string, pool: TreeV3PoolView): TreeV3PositionView | null {
  const node = record(nodeValue);
  const objectId = normalizeSuiAddress(node.address);
  const normalizedOwner = normalizeSuiAddress(owner);
  if (!objectId || !normalizedOwner || ownerAddress(node) !== normalizedOwner) return null;
  const json = record(record(record(node.asMoveObject).contents).json);
  const poolId = normalizeSuiAddress(json.pool_id);
  const tokenX = normalizeCoinType(json.type_x);
  const tokenY = normalizeCoinType(json.type_y);
  const liquidity = parseUnsigned(json.liquidity);
  const tickLower = parseSignedI32(json.tick_lower_index);
  const tickUpper = parseSignedI32(json.tick_upper_index);
  if (poolId !== pool.poolId || tokenX !== pool.tokenX || tokenY !== pool.tokenY || liquidity === null || tickLower === null || tickUpper === null || tickLower >= tickUpper) return null;
  const owedX = parseUnsigned(json.owed_coin_x) ?? 0n;
  const owedY = parseUnsigned(json.owed_coin_y) ?? 0n;
  const treeIsX = tokenX === NORMALIZED_TREE;
  return {
    objectId,
    poolId,
    liquidityRaw: liquidity.toString(),
    tickLower,
    tickUpper,
    currentTick: pool.currentTick,
    inRange: pool.currentTick >= tickLower && pool.currentTick < tickUpper,
    owedSuiRaw: (treeIsX ? owedY : owedX).toString(),
    owedTreeRaw: (treeIsX ? owedX : owedY).toString(),
  };
}
