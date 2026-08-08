export type JsonRecord = Record<string, unknown>;

export type LiveFields = {
  price: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  priceChange7d: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
  fdv: number | null;
  holderCount: number | null;
  sourceUpdatedAt: string | null;
};

export function emptyLive(): LiveFields {
  return {
    price: null,
    priceChange1h: null,
    priceChange24h: null,
    priceChange7d: null,
    volume24h: null,
    liquidity: null,
    marketCap: null,
    fdv: null,
    holderCount: null,
    sourceUpdatedAt: null,
  };
}

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

export function numberFrom(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function stringFrom(...values: unknown[]): string | null {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof value === 'string' ? value : null;
}

export function normalizeNoodlesCoinDetails(payload: unknown): LiveFields {
  const root = record(payload);
  const data = record(root.data ?? root);
  const coin = record(data.coin ?? data.market ?? data);
  const changes = record(data.changes ?? coin.changes ?? data.price_change ?? coin.price_change ?? coin.priceChange);
  return {
    price: numberFrom(changes.price, coin.price, data.price, coin.price_usd, coin.priceUsd),
    priceChange1h: numberFrom(changes.price_change_1h, changes.h1, changes['1h'], coin.price_change_1h, coin.priceChange1h),
    priceChange24h: numberFrom(changes.price_change_1d, changes.price_change_24h, changes.h24, changes['24h'], changes.d1, coin.price_change_24h, coin.priceChange24h),
    priceChange7d: numberFrom(changes.price_change_7d, changes.d7, changes['7d'], coin.price_change_7d, coin.priceChange7d),
    volume24h: numberFrom(coin.volume_24h, coin.volume24h, coin.volume_usd_24h, data.volume24h),
    liquidity: numberFrom(coin.liquidity, coin.liquidity_usd, data.liquidity),
    marketCap: numberFrom(coin.market_cap, coin.marketCap, coin.market_cap_usd, data.marketCap),
    fdv: numberFrom(coin.fdv, coin.fully_diluted_valuation, coin.fullyDilutedValuation, data.fdv),
    holderCount: numberFrom(coin.holders, coin.holder_count, coin.holderCount, data.holderCount),
    sourceUpdatedAt: stringFrom(coin.updated_at, coin.updatedAt, data.updated_at, data.updatedAt, root.updatedAt),
  };
}

export function normalizeNoodlesPriceVolume(payload: unknown): Pick<LiveFields, 'price' | 'priceChange24h' | 'volume24h'> {
  const root = record(payload);
  const data = record(root.data ?? root);
  return {
    price: numberFrom(data.price, root.price),
    priceChange24h: numberFrom(data.price_change_24h, root.price_change_24h),
    volume24h: numberFrom(data.volume_24h, root.volume_24h),
  };
}

export function mergeNoodlesFields(details: LiveFields | null, priceVolume: ReturnType<typeof normalizeNoodlesPriceVolume> | null): LiveFields {
  const merged = details ? { ...details } : emptyLive();
  if (priceVolume) {
    merged.price = merged.price ?? priceVolume.price;
    merged.priceChange24h = merged.priceChange24h ?? priceVolume.priceChange24h;
    merged.volume24h = priceVolume.volume24h ?? merged.volume24h;
  }
  return merged;
}
