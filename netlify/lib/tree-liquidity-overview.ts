import { TREE_COIN_TYPE, normalizeSuiAddress } from './leaderboard-provider.ts';
import { CETUS_CLMM_PACKAGE, CETUS_TREE_POOL_ID } from './cetus-tree-constants.ts';
import { SUIDEX_V2_TREE_POOL_ID } from './suidex-v2-tree-lp-provider.ts';
import { TURBOS_PACKAGE, TURBOS_TREE_POOL_IDS } from './turbos-tree-lp-provider.ts';
import { SUI_COIN_TYPE, TREE_V3_POOL_ID, normalizeCoinType, parseTreeV3Pool, record } from './tree-v3-overview.ts';

export const USDC_COIN_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
export const WBTC_COIN_TYPE = '0xaafb102dd0902f5055cadecd687fb5b71ca82ef0e0285d90afde828ec58ca96b::btc::BTC';

export type LiquidityPrices = { suiUsd: number; treeUsd: number; usdcUsd: number; wbtcUsd: number };
export type ChainPoolObject = { address?: unknown; type?: unknown; json?: unknown };

const decimals = new Map([
  [normalizeCoinType(SUI_COIN_TYPE)!, 9],
  [normalizeCoinType(TREE_COIN_TYPE)!, 6],
  [normalizeCoinType(USDC_COIN_TYPE)!, 6],
  [normalizeCoinType(WBTC_COIN_TYPE)!, 8],
]);
const Q64 = 18_446_744_073_709_551_616;

function finitePrice(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function priceFor(type: string, prices: LiquidityPrices): number | null {
  const normalized = normalizeCoinType(type);
  if (normalized === normalizeCoinType(SUI_COIN_TYPE)) return finitePrice(prices.suiUsd);
  if (normalized === normalizeCoinType(TREE_COIN_TYPE)) return finitePrice(prices.treeUsd);
  if (normalized === normalizeCoinType(USDC_COIN_TYPE)) return finitePrice(prices.usdcUsd);
  if (normalized === normalizeCoinType(WBTC_COIN_TYPE)) return finitePrice(prices.wbtcUsd);
  return null;
}

function unsigned(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

function usdValue(raw: bigint, type: string, prices: LiquidityPrices): number | null {
  const normalized = normalizeCoinType(type);
  const tokenDecimals = normalized ? decimals.get(normalized) : undefined;
  const price = priceFor(type, prices);
  if (tokenDecimals === undefined || price === null) return null;
  return Number(raw) / 10 ** tokenDecimals * price;
}

function genericTypes(type: unknown): string[] {
  if (typeof type !== 'string') return [];
  const start = type.indexOf('<');
  const end = type.lastIndexOf('>');
  if (start < 0 || end <= start) return [];
  const values: string[] = [];
  let depth = 0;
  let token = '';
  for (const character of type.slice(start + 1, end)) {
    if (character === '<') depth += 1;
    if (character === '>') depth -= 1;
    if (character === ',' && depth === 0) { values.push(token.trim()); token = ''; }
    else token += character;
  }
  if (token.trim()) values.push(token.trim());
  return values;
}

function pairIsTree(typeA: string, typeB: string) {
  const pair = new Set([normalizeCoinType(typeA), normalizeCoinType(typeB)]);
  return pair.has(normalizeCoinType(TREE_COIN_TYPE));
}

function valuePair(rawA: bigint, typeA: string, rawB: bigint, typeB: string, prices: LiquidityPrices): number | null {
  const valueA = usdValue(rawA, typeA, prices);
  const valueB = usdValue(rawB, typeB, prices);
  return valueA === null || valueB === null ? null : valueA + valueB;
}

function spotSuiPerTree(sqrtPrice: bigint, typeA: string, typeB: string): number | null {
  const decimalsA = decimals.get(normalizeCoinType(typeA)!);
  const decimalsB = decimals.get(normalizeCoinType(typeB)!);
  if (decimalsA === undefined || decimalsB === undefined || sqrtPrice <= 0n) return null;
  const rawBPerA = (Number(sqrtPrice) / Q64) ** 2;
  const humanBPerA = rawBPerA * 10 ** (decimalsA - decimalsB);
  if (!Number.isFinite(humanBPerA) || humanBPerA <= 0) return null;
  if (normalizeCoinType(typeA) === normalizeCoinType(TREE_COIN_TYPE) && normalizeCoinType(typeB) === normalizeCoinType(SUI_COIN_TYPE)) return humanBPerA;
  if (normalizeCoinType(typeA) === normalizeCoinType(SUI_COIN_TYPE) && normalizeCoinType(typeB) === normalizeCoinType(TREE_COIN_TYPE)) return 1 / humanBPerA;
  return null;
}

export function calculateTreeLiquidity(objects: ChainPoolObject[], prices: LiquidityPrices) {
  const byId = new Map(objects.map((object) => [normalizeSuiAddress(object.address ?? record(object.json).id), object]));
  const v2 = byId.get(SUIDEX_V2_TREE_POOL_ID);
  const v3 = byId.get(TREE_V3_POOL_ID);
  const cetus = byId.get(CETUS_TREE_POOL_ID);
  if (!v2 || !v3 || !cetus) return null;

  const v2Types = genericTypes(v2.type);
  const v2Json = record(v2.json);
  const reserve0 = unsigned(v2Json.reserve0);
  const reserve1 = unsigned(v2Json.reserve1);
  if (v2Types.length !== 2 || !pairIsTree(v2Types[0], v2Types[1]) || reserve0 === null || reserve1 === null) return null;
  const suiDexV2TvlUsd = valuePair(reserve0, v2Types[0], reserve1, v2Types[1], prices);

  const v3Pool = parseTreeV3Pool(v3.json, prices);
  const suiDexV3TvlUsd = v3Pool?.tvlUsdEstimate ?? null;
  if (suiDexV2TvlUsd === null || suiDexV3TvlUsd === null) return null;

  const cetusTypes = genericTypes(cetus.type);
  const cetusJson = record(cetus.json);
  const cetusCoinA = unsigned(cetusJson.coin_a);
  const cetusCoinB = unsigned(cetusJson.coin_b);
  const cetusFeesA = unsigned(cetusJson.fee_protocol_coin_a);
  const cetusFeesB = unsigned(cetusJson.fee_protocol_coin_b);
  const cetusLiquidity = unsigned(cetusJson.liquidity);
  const cetusSqrtPrice = unsigned(cetusJson.current_sqrt_price);
  const cetusFeeRate = Number(cetusJson.fee_rate);
  if (cetusTypes.length !== 2 || !String(cetus.type).toLowerCase().startsWith(`${CETUS_CLMM_PACKAGE}::pool::pool<`)
    || normalizeCoinType(cetusTypes[0]) !== normalizeCoinType(TREE_COIN_TYPE)
    || normalizeCoinType(cetusTypes[1]) !== normalizeCoinType(SUI_COIN_TYPE)
    || cetusCoinA === null || cetusCoinB === null || cetusFeesA === null || cetusFeesB === null
    || cetusCoinA < cetusFeesA || cetusCoinB < cetusFeesB || cetusLiquidity === null || cetusLiquidity === 0n
    || cetusSqrtPrice === null || !Number.isFinite(cetusFeeRate) || cetusFeeRate <= 0) return null;
  const cetusTvlUsd = valuePair(cetusCoinA - cetusFeesA, cetusTypes[0], cetusCoinB - cetusFeesB, cetusTypes[1], prices);
  const cetusPriceSuiPerTree = spotSuiPerTree(cetusSqrtPrice, cetusTypes[0], cetusTypes[1]);
  if (cetusTvlUsd === null || cetusPriceSuiPerTree === null) return null;
  const cetusPool = {
    poolId: CETUS_TREE_POOL_ID,
    tvlUsd: cetusTvlUsd,
    active: true,
    coinTypeA: cetusTypes[0],
    coinTypeB: cetusTypes[1],
    feePercent: cetusFeeRate / 10_000,
    priceSuiPerTree: cetusPriceSuiPerTree,
  };

  let turbosTvlUsd = 0;
  let activeTurbosPools = 0;
  const turbosPools: { poolId: string; tvlUsd: number; active: boolean; coinTypeA: string; coinTypeB: string; feePercent: number | null; priceSuiPerTree: number | null }[] = [];
  for (const poolId of TURBOS_TREE_POOL_IDS) {
    const pool = byId.get(poolId);
    if (!pool) return null;
    const types = genericTypes(pool.type);
    const json = record(pool.json);
    const coinA = unsigned(json.coin_a);
    const coinB = unsigned(json.coin_b);
    const feesA = unsigned(json.protocol_fees_a);
    const feesB = unsigned(json.protocol_fees_b);
    const liquidity = unsigned(json.liquidity);
    const sqrtPrice = unsigned(json.sqrt_price);
    const feeRaw = Number(json.fee);
    if (types.length !== 3 || !String(pool.type).toLowerCase().startsWith(`${TURBOS_PACKAGE}::pool::pool<`)
      || !pairIsTree(types[0], types[1]) || coinA === null || coinB === null || feesA === null || feesB === null
      || coinA < feesA || coinB < feesB || liquidity === null) return null;
    const value = liquidity === 0n ? 0 : valuePair(coinA - feesA, types[0], coinB - feesB, types[1], prices);
    if (value === null) return null;
    const priceSuiPerTree = sqrtPrice ? spotSuiPerTree(sqrtPrice, types[0], types[1]) : null;
    const feePercent = Number.isFinite(feeRaw) && feeRaw > 0 ? feeRaw / 10_000 : null;
    const isActiveSuiTree = liquidity > 0n && new Set([normalizeCoinType(types[0]), normalizeCoinType(types[1])]).has(normalizeCoinType(SUI_COIN_TYPE));
    if (isActiveSuiTree && (priceSuiPerTree === null || feePercent === null)) return null;
    turbosPools.push({ poolId, tvlUsd: value, active: liquidity > 0n, coinTypeA: types[0], coinTypeB: types[1], feePercent, priceSuiPerTree });
    if (liquidity === 0n) continue;
    turbosTvlUsd += value;
    activeTurbosPools += 1;
  }

  return {
    recognizedLiquidityUsd: suiDexV2TvlUsd + suiDexV3TvlUsd + turbosTvlUsd + cetusTvlUsd,
    suiDexV2TvlUsd,
    suiDexV3TvlUsd,
    turbosTvlUsd,
    cetusTvlUsd,
    cetusPool,
    activeTurbosPools,
    turbosPools,
  };
}
