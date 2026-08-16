import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';
import { CLMM_Q64, amountsForLiquidityQ64, tickToSqrtPriceQ64 } from './clmm-q64.ts';

export const TREE_V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
export const TREE_V3_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
export const TREE_V3_POSITION_TYPE = `${TREE_V3_PACKAGE}::position::Position`;
export const SUI_COIN_TYPE = '0x2::sui::SUI';
export const TREE_V3_FEE_PERCENT = 0.25;
export const TREE_DECIMALS = 6;
export const SUI_DECIMALS = 9;
export const TREE_V3_REWARD_TOKENS = Object.freeze([
  Object.freeze({ coinType: '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::victory_token::VICTORY_TOKEN', symbol: 'VICTORY', decimals: 6 }),
  Object.freeze({ coinType: TREE_COIN_TYPE, symbol: 'TREE', decimals: TREE_DECIMALS }),
  Object.freeze({ coinType: '0xaafb102dd0902f5055cadecd687fb5b71ca82ef0e0285d90afde828ec58ca96b::btc::BTC', symbol: 'wBTC', decimals: 8 }),
]);

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
  principalSuiRaw: string;
  principalTreeRaw: string;
  principalSui: string;
  principalTree: string;
  principalSuiUsd: number | null;
  principalTreeUsd: number | null;
  valueUsd: number | null;
  pendingFeeSuiRaw: string | null;
  pendingFeeTreeRaw: string | null;
  pendingFeeSui: string | null;
  pendingFeeTree: string | null;
  pendingFeesUsd: number | null;
  rewards: TreeV3PositionRewardView[] | null;
  accountingStatus: 'verified' | 'unavailable';
};

export type TreeV3PositionRewardView = {
  coinType: string;
  symbol: string;
  decimals: number;
  amountRaw: string;
  amount: string;
  priceUsd: number | null;
  valueUsd: number | null;
  active: boolean;
};

export type TreeV3PositionState = Omit<TreeV3PositionView,
  'principalSuiRaw' | 'principalTreeRaw' | 'principalSui' | 'principalTree'
  | 'principalSuiUsd' | 'principalTreeUsd' | 'valueUsd'
  | 'pendingFeeSuiRaw' | 'pendingFeeTreeRaw' | 'pendingFeeSui' | 'pendingFeeTree'
  | 'pendingFeesUsd' | 'rewards' | 'accountingStatus'> & {
  feeGrowthInsideSuiLastRaw: string;
  feeGrowthInsideTreeLastRaw: string;
  rewardStates: Array<{ growthInsideLastRaw: string; owedRaw: string }>;
};

export type TreeV3TickState = {
  tick: number;
  feeGrowthOutsideXRaw: string;
  feeGrowthOutsideYRaw: string;
  rewardGrowthsOutsideRaw: string[];
};

export type TreeV3PoolAccounting = {
  ticksTableId: string;
  feeGrowthGlobalXRaw: string;
  feeGrowthGlobalYRaw: string;
  rewards: Array<{
    coinType: string;
    rewardGrowthGlobalRaw: string;
    rewardPerSecondX64Raw: string;
    lastUpdateSeconds: number;
    endsAtSeconds: number;
  }>;
};

export type TreeV3ValuationPrices = {
  suiUsd: number | null;
  treeUsd: number | null;
  rewardsUsd: Record<string, number>;
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

export function parseTreeV3Position(nodeValue: unknown, owner: string, pool: TreeV3PoolView): TreeV3PositionState | null {
  const node = record(nodeValue);
  const objectId = normalizeSuiAddress(node.address);
  const normalizedOwner = normalizeSuiAddress(owner);
  if (!objectId || !normalizedOwner || ownerAddress(node) !== normalizedOwner) return null;
  const json = record(record(node.contents ?? record(node.asMoveObject).contents).json);
  const poolId = normalizeSuiAddress(json.pool_id);
  const tokenX = normalizeCoinType(json.type_x);
  const tokenY = normalizeCoinType(json.type_y);
  const liquidity = parseUnsigned(json.liquidity);
  const tickLower = parseSignedI32(json.tick_lower_index);
  const tickUpper = parseSignedI32(json.tick_upper_index);
  if (poolId !== pool.poolId || tokenX !== pool.tokenX || tokenY !== pool.tokenY || liquidity === null || tickLower === null || tickUpper === null || tickLower >= tickUpper) return null;
  const owedX = parseUnsigned(json.owed_coin_x) ?? 0n;
  const owedY = parseUnsigned(json.owed_coin_y) ?? 0n;
  const feeGrowthXLast = parseUnsigned(json.fee_growth_inside_x_last);
  const feeGrowthYLast = parseUnsigned(json.fee_growth_inside_y_last);
  const rewardStates = Array.isArray(json.reward_infos) ? json.reward_infos.map((value) => {
    const reward = record(value);
    const growthInsideLast = parseUnsigned(reward.reward_growth_inside_last);
    const owed = parseUnsigned(reward.coins_owed_reward);
    return growthInsideLast === null || owed === null ? null : {
      growthInsideLastRaw: growthInsideLast.toString(), owedRaw: owed.toString(),
    };
  }) : [];
  if (feeGrowthXLast === null || feeGrowthYLast === null || rewardStates.some((value) => value === null)) return null;
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
    feeGrowthInsideSuiLastRaw: (treeIsX ? feeGrowthYLast : feeGrowthXLast).toString(),
    feeGrowthInsideTreeLastRaw: (treeIsX ? feeGrowthXLast : feeGrowthYLast).toString(),
    rewardStates: rewardStates as Array<{ growthInsideLastRaw: string; owedRaw: string }>,
  };
}

export function parseTreeV3PoolAccounting(jsonValue: unknown, pool: TreeV3PoolView): TreeV3PoolAccounting | null {
  const json = record(jsonValue);
  if (normalizeSuiAddress(json.id) !== pool.poolId) return null;
  const ticksTableId = normalizeSuiAddress(record(json.ticks).id);
  const feeGrowthGlobalX = parseUnsigned(json.fee_growth_global_x);
  const feeGrowthGlobalY = parseUnsigned(json.fee_growth_global_y);
  if (!ticksTableId || feeGrowthGlobalX === null || feeGrowthGlobalY === null) return null;
  const rewards = [];
  for (const value of Array.isArray(json.reward_infos) ? json.reward_infos : []) {
    const reward = record(value);
    const coinType = normalizeCoinType(reward.reward_coin_type);
    const rewardGrowthGlobal = parseUnsigned(reward.reward_growth_global);
    const rewardPerSecondX64 = parseUnsigned(reward.reward_per_seconds);
    const lastUpdateSeconds = Number(reward.last_update_time);
    const endsAtSeconds = Number(reward.ended_at_seconds);
    if (!coinType || rewardGrowthGlobal === null || rewardPerSecondX64 === null
      || !Number.isSafeInteger(lastUpdateSeconds) || lastUpdateSeconds < 0
      || !Number.isSafeInteger(endsAtSeconds) || endsAtSeconds < 0) return null;
    rewards.push({
      coinType,
      rewardGrowthGlobalRaw: rewardGrowthGlobal.toString(),
      rewardPerSecondX64Raw: rewardPerSecondX64.toString(),
      lastUpdateSeconds,
      endsAtSeconds,
    });
  }
  return {
    ticksTableId,
    feeGrowthGlobalXRaw: feeGrowthGlobalX.toString(),
    feeGrowthGlobalYRaw: feeGrowthGlobalY.toString(),
    rewards,
  };
}

export function parseTreeV3TickState(nameValue: unknown, valueValue: unknown): TreeV3TickState | null {
  const tick = parseSignedI32(nameValue);
  const value = record(valueValue);
  const feeGrowthOutsideX = parseUnsigned(value.fee_growth_outside_x);
  const feeGrowthOutsideY = parseUnsigned(value.fee_growth_outside_y);
  if (tick === null || feeGrowthOutsideX === null || feeGrowthOutsideY === null) return null;
  const rewardGrowthsOutsideRaw = [];
  for (const growthValue of Array.isArray(value.reward_growths_outside) ? value.reward_growths_outside : []) {
    const growth = parseUnsigned(growthValue);
    if (growth === null) return null;
    rewardGrowthsOutsideRaw.push(growth.toString());
  }
  return {
    tick,
    feeGrowthOutsideXRaw: feeGrowthOutsideX.toString(),
    feeGrowthOutsideYRaw: feeGrowthOutsideY.toString(),
    rewardGrowthsOutsideRaw,
  };
}

const U128_MODULUS = 1n << 128n;

function subtractU128(left: bigint, right: bigint): bigint {
  return (left - right + U128_MODULUS) % U128_MODULUS;
}

function growthInsideQ64(
  global: bigint,
  lowerOutside: bigint,
  upperOutside: bigint,
  currentTick: number,
  lowerTick: number,
  upperTick: number,
): bigint {
  const below = currentTick >= lowerTick ? lowerOutside : subtractU128(global, lowerOutside);
  const above = currentTick < upperTick ? upperOutside : subtractU128(global, upperOutside);
  return subtractU128(subtractU128(global, below), above);
}

function amountUsd(raw: bigint, decimals: number, priceUsd: number | null): number | null {
  if (priceUsd === null || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const amount = Number(formatRawAmount(raw, decimals));
  const value = amount * priceUsd;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function valueTreeV3Position(
  state: TreeV3PositionState,
  pool: TreeV3PoolView,
  accounting: TreeV3PoolAccounting | null,
  tickStates: Map<number, TreeV3TickState>,
  prices: TreeV3ValuationPrices,
  nowSeconds = Math.floor(Date.now() / 1000),
): TreeV3PositionView {
  const liquidity = parseUnsigned(state.liquidityRaw) ?? 0n;
  const amounts = amountsForLiquidityQ64(
    BigInt(pool.sqrtPriceRaw),
    tickToSqrtPriceQ64(state.tickLower),
    tickToSqrtPriceQ64(state.tickUpper),
    liquidity,
  );
  const treeIsX = pool.tokenX === NORMALIZED_TREE;
  const principalSuiRaw = treeIsX ? amounts.amountY : amounts.amountX;
  const principalTreeRaw = treeIsX ? amounts.amountX : amounts.amountY;
  const principalSuiUsd = amountUsd(principalSuiRaw, SUI_DECIMALS, prices.suiUsd);
  const principalTreeUsd = amountUsd(principalTreeRaw, TREE_DECIMALS, prices.treeUsd);
  const base = {
    objectId: state.objectId,
    poolId: state.poolId,
    liquidityRaw: state.liquidityRaw,
    tickLower: state.tickLower,
    tickUpper: state.tickUpper,
    currentTick: state.currentTick,
    inRange: state.inRange,
    owedSuiRaw: state.owedSuiRaw,
    owedTreeRaw: state.owedTreeRaw,
    principalSuiRaw: principalSuiRaw.toString(),
    principalTreeRaw: principalTreeRaw.toString(),
    principalSui: formatRawAmount(principalSuiRaw, SUI_DECIMALS),
    principalTree: formatRawAmount(principalTreeRaw, TREE_DECIMALS),
    principalSuiUsd,
    principalTreeUsd,
    valueUsd: principalSuiUsd !== null && principalTreeUsd !== null ? principalSuiUsd + principalTreeUsd : null,
  };
  const unavailable = {
    ...base,
    pendingFeeSuiRaw: null,
    pendingFeeTreeRaw: null,
    pendingFeeSui: null,
    pendingFeeTree: null,
    pendingFeesUsd: null,
    rewards: null,
    accountingStatus: 'unavailable' as const,
  };
  const lower = tickStates.get(state.tickLower);
  const upper = tickStates.get(state.tickUpper);
  if (!accounting || !lower || !upper || accounting.rewards.length !== state.rewardStates.length) return unavailable;

  const globalX = BigInt(accounting.feeGrowthGlobalXRaw);
  const globalY = BigInt(accounting.feeGrowthGlobalYRaw);
  const insideX = growthInsideQ64(globalX, BigInt(lower.feeGrowthOutsideXRaw), BigInt(upper.feeGrowthOutsideXRaw), state.currentTick, state.tickLower, state.tickUpper);
  const insideY = growthInsideQ64(globalY, BigInt(lower.feeGrowthOutsideYRaw), BigInt(upper.feeGrowthOutsideYRaw), state.currentTick, state.tickLower, state.tickUpper);
  const insideSui = treeIsX ? insideY : insideX;
  const insideTree = treeIsX ? insideX : insideY;
  const pendingFeeSuiRaw = BigInt(state.owedSuiRaw) + liquidity * subtractU128(insideSui, BigInt(state.feeGrowthInsideSuiLastRaw)) / CLMM_Q64;
  const pendingFeeTreeRaw = BigInt(state.owedTreeRaw) + liquidity * subtractU128(insideTree, BigInt(state.feeGrowthInsideTreeLastRaw)) / CLMM_Q64;
  const pendingFeeSuiUsd = amountUsd(pendingFeeSuiRaw, SUI_DECIMALS, prices.suiUsd);
  const pendingFeeTreeUsd = amountUsd(pendingFeeTreeRaw, TREE_DECIMALS, prices.treeUsd);

  const tokenRegistry = new Map(TREE_V3_REWARD_TOKENS.map((token) => [normalizeCoinType(token.coinType), token]));
  const rewards: TreeV3PositionRewardView[] = [];
  for (let index = 0; index < accounting.rewards.length; index += 1) {
    const poolReward = accounting.rewards[index];
    const token = tokenRegistry.get(poolReward.coinType);
    if (!token) return unavailable;
    let globalGrowth = BigInt(poolReward.rewardGrowthGlobalRaw);
    const updateUntil = Math.min(nowSeconds, poolReward.endsAtSeconds);
    if (updateUntil > poolReward.lastUpdateSeconds && liquidity >= 0n) {
      const poolLiquidity = BigInt(pool.liquidityRaw);
      if (poolLiquidity <= 0n) return unavailable;
      globalGrowth += BigInt(poolReward.rewardPerSecondX64Raw) * BigInt(updateUntil - poolReward.lastUpdateSeconds) / poolLiquidity;
    }
    const lowerOutside = BigInt(lower.rewardGrowthsOutsideRaw[index] ?? '0');
    const upperOutside = BigInt(upper.rewardGrowthsOutsideRaw[index] ?? '0');
    const inside = growthInsideQ64(globalGrowth, lowerOutside, upperOutside, state.currentTick, state.tickLower, state.tickUpper);
    const positionReward = state.rewardStates[index];
    const amountRaw = BigInt(positionReward.owedRaw) + liquidity * subtractU128(inside, BigInt(positionReward.growthInsideLastRaw)) / CLMM_Q64;
    const priceUsd = prices.rewardsUsd[poolReward.coinType] ?? null;
    rewards.push({
      coinType: poolReward.coinType,
      symbol: token.symbol,
      decimals: token.decimals,
      amountRaw: amountRaw.toString(),
      amount: formatRawAmount(amountRaw, token.decimals),
      priceUsd,
      valueUsd: amountUsd(amountRaw, token.decimals, priceUsd),
      active: poolReward.endsAtSeconds > nowSeconds,
    });
  }

  return {
    ...base,
    pendingFeeSuiRaw: pendingFeeSuiRaw.toString(),
    pendingFeeTreeRaw: pendingFeeTreeRaw.toString(),
    pendingFeeSui: formatRawAmount(pendingFeeSuiRaw, SUI_DECIMALS),
    pendingFeeTree: formatRawAmount(pendingFeeTreeRaw, TREE_DECIMALS),
    pendingFeesUsd: pendingFeeSuiUsd !== null && pendingFeeTreeUsd !== null ? pendingFeeSuiUsd + pendingFeeTreeUsd : null,
    rewards,
    accountingStatus: 'verified',
  };
}
