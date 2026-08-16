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
  verified: true;
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
  tickSpacing: number;
  tvlUsdEstimate: number | null;
  tvlSource: 'onchain-reserves-plus-coingecko' | 'unavailable';
};

export type TreeV3RewardAprView = {
  coinType: string;
  symbol: string;
  decimals: number;
  perDayRaw: string;
  perDay: number;
  priceUsd: number;
  dailyUsd: number;
  aprPercent: number;
  endsAt: string;
};

export type TreeV3AnalyticsView = {
  source: 'suidex-v3-pools-enriched';
  tvlUsd: number;
  volume24hUsd: number;
  fees24hUsd: number;
  feeAprPercent: number;
  rewardAprPercent: number;
  aprPercent: number;
  rewards: TreeV3RewardAprView[];
  status: 'verified';
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
  const nested = record(value).bits;
  if (nested !== undefined) return parseSignedI32(nested);
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isInteger(numeric) || numeric < -2147483648 || numeric > 4294967295) return null;
  return numeric > 2147483647 ? numeric - 4294967296 : numeric;
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
  const tickSpacing = Number(json.tick_spacing);
  const swapFeeRate = Number(json.swap_fee_rate);
  if (poolId !== TREE_V3_POOL_ID || !tokenX || !tokenY || currentTick === null || sqrtPrice === null || sqrtPrice <= 0n || liquidity === null || reserveX === null || reserveY === null || tickSpacing !== 60 || swapFeeRate !== 2500) return null;
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
    verified: true,
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
    tickSpacing,
    tvlUsdEstimate: Number.isFinite(tvlUsdEstimate) ? tvlUsdEstimate : null,
    tvlSource: Number.isFinite(tvlUsdEstimate) ? 'onchain-reserves-plus-coingecko' : 'unavailable',
  };
}

function finiteNonNegative(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function approximatelyEqual(left: number, right: number, absoluteTolerance = 0.1, relativeTolerance = 0.03) {
  return Math.abs(left - right) <= Math.max(absoluteTolerance, Math.max(Math.abs(left), Math.abs(right)) * relativeTolerance);
}

export function parseSuiDexV3Analytics(
  payloadValue: unknown,
  pool: TreeV3PoolView,
  nowSeconds = Math.floor(Date.now() / 1000),
): TreeV3AnalyticsView | null {
  const payload = record(payloadValue);
  const pools = Array.isArray(payload.pools) ? payload.pools : [];
  const sourcePool = pools.map(record).find((item) => normalizeSuiAddress(item.pool_id) === pool.poolId);
  if (!sourcePool || sourcePool.approved !== true) return null;
  const tokenX = normalizeCoinType(sourcePool.token_x_type);
  const tokenY = normalizeCoinType(sourcePool.token_y_type);
  if (tokenX !== pool.tokenX || tokenY !== pool.tokenY
    || Number(sourcePool.fee_rate) !== 2500
    || Number(sourcePool.tick_spacing) !== 60) return null;

  const tvlUsd = finiteNonNegative(sourcePool.tvl_usd);
  const volume24hUsd = finiteNonNegative(sourcePool.volume_24h_usd);
  const fees24hUsd = finiteNonNegative(sourcePool.fees_24h_usd);
  if (tvlUsd === null || tvlUsd <= 0 || volume24hUsd === null || fees24hUsd === null) return null;
  if (pool.tvlUsdEstimate !== null
    && !approximatelyEqual(tvlUsd, pool.tvlUsdEstimate, 1, 0.15)) return null;
  const expectedFees24h = volume24hUsd * pool.feePercent / 100;
  if (!approximatelyEqual(fees24hUsd, expectedFees24h, 0.02, 0.1)) return null;

  const tokenPrices = record(payload.tokenPrices);
  const rewards: TreeV3RewardAprView[] = [];
  const seenRewards = new Set<string>();
  for (const rewardValue of Array.isArray(sourcePool.rewards) ? sourcePool.rewards : []) {
    const reward = record(rewardValue);
    const coinType = normalizeCoinType(reward.coin_type);
    const symbolValue = typeof reward.symbol === 'string' ? reward.symbol.replace(/_TOKEN$/i, '').trim() : '';
    const decimals = Number(reward.decimals);
    const perDayRaw = parseUnsigned(reward.per_day);
    const priceUsd = finiteNonNegative(reward.price_usd);
    const endsAt = Number(reward.ended_at);
    if (!coinType || seenRewards.has(coinType) || !/^[A-Za-z0-9._-]{1,24}$/.test(symbolValue)
      || !Number.isInteger(decimals) || decimals < 0 || decimals > 18
      || perDayRaw === null || priceUsd === null || priceUsd <= 0
      || !Number.isSafeInteger(endsAt) || endsAt <= nowSeconds) continue;
    const listedPrice = finiteNonNegative(tokenPrices[String(reward.coin_type)] ?? tokenPrices[coinType]);
    if (listedPrice === null || !approximatelyEqual(priceUsd, listedPrice, 1e-12, 0.02)) continue;
    const perDay = Number(formatRawAmount(perDayRaw, decimals));
    if (!Number.isFinite(perDay) || perDay <= 0) continue;
    const dailyUsd = perDay * priceUsd;
    const aprPercent = dailyUsd * 365 / tvlUsd * 100;
    seenRewards.add(coinType);
    rewards.push({
      coinType, symbol: symbolValue, decimals, perDayRaw: perDayRaw.toString(), perDay,
      priceUsd, dailyUsd, aprPercent, endsAt: new Date(endsAt * 1000).toISOString(),
    });
  }
  const feeAprPercent = fees24hUsd * 365 / tvlUsd * 100;
  const rewardAprPercent = rewards.reduce((sum, reward) => sum + reward.aprPercent, 0);
  const aprPercent = feeAprPercent + rewardAprPercent;
  const publishedFeeApr = finiteNonNegative(sourcePool.fee_apr);
  const publishedRewardApr = finiteNonNegative(sourcePool.reward_apr);
  const publishedTotalApr = finiteNonNegative(sourcePool.total_apr);
  if (publishedFeeApr === null || publishedRewardApr === null || publishedTotalApr === null
    || !approximatelyEqual(feeAprPercent, publishedFeeApr)
    || !approximatelyEqual(rewardAprPercent, publishedRewardApr)
    || !approximatelyEqual(aprPercent, publishedTotalApr)) return null;
  return {
    source: 'suidex-v3-pools-enriched', tvlUsd, volume24hUsd, fees24hUsd,
    feeAprPercent, rewardAprPercent, aprPercent, rewards, status: 'verified',
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
