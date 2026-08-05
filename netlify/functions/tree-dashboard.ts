import snapshot from '../../data/tree-project-snapshot.json';

type JsonRecord = Record<string, unknown>;
type LiveFields = {
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

const emptyLive = (): LiveFields => ({
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
});

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

function numberFrom(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function stringFrom(...values: unknown[]): string | null {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof value === 'string' ? value : null;
}

function normalizeNoodles(payload: unknown): LiveFields {
  const root = record(payload);
  const data = record(root.data ?? root);
  const coin = record(data.coin ?? data.market ?? data);
  const changes = record(data.price_change ?? coin.price_change ?? coin.priceChange);
  return {
    price: numberFrom(coin.price_usd, coin.priceUsd, coin.price, data.price),
    priceChange1h: numberFrom(changes.h1, changes['1h'], coin.price_change_1h, coin.priceChange1h),
    priceChange24h: numberFrom(changes.h24, changes['24h'], changes.d1, coin.price_change_24h, coin.priceChange24h),
    priceChange7d: numberFrom(changes.d7, changes['7d'], coin.price_change_7d, coin.priceChange7d),
    volume24h: numberFrom(coin.volume_24h, coin.volume24h, coin.volume_usd_24h, data.volume24h),
    liquidity: numberFrom(coin.liquidity_usd, coin.liquidity, data.liquidity),
    marketCap: numberFrom(coin.market_cap, coin.marketCap, coin.market_cap_usd, data.marketCap),
    fdv: numberFrom(coin.fdv, coin.fully_diluted_valuation, coin.fullyDilutedValuation, data.fdv),
    holderCount: numberFrom(coin.holder_count, coin.holders, coin.holderCount, data.holderCount),
    sourceUpdatedAt: stringFrom(coin.updated_at, coin.updatedAt, data.updated_at, data.updatedAt, root.updatedAt),
  };
}

async function getNoodles(apiKey: string, apiUrl: string) {
  const response = await fetch(apiUrl, {
    headers: { Accept: 'application/json', 'x-api-key': apiKey, 'x-chain': 'sui' },
  });
  if (!response.ok) throw new Error(`Noodles returned ${response.status}`);
  return normalizeNoodles(await response.json());
}

async function getCoinGecko(apiKey: string, plan: string) {
  const pro = plan.toLowerCase() === 'pro';
  const base = pro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
  const keyHeader = pro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key';
  const url = `${base}/coins/thickquidity?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  const response = await fetch(url, { headers: { Accept: 'application/json', [keyHeader]: apiKey } });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
  const payload = record(await response.json());
  const market = record(payload.market_data);
  return {
    price: numberFrom(record(market.current_price).usd),
    priceChange24h: numberFrom(market.price_change_percentage_24h),
    volume24h: numberFrom(record(market.total_volume).usd),
    marketCap: numberFrom(record(market.market_cap).usd),
    fdv: numberFrom(record(market.fully_diluted_valuation).usd),
    sourceUpdatedAt: stringFrom(market.last_updated, payload.last_updated),
  };
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json({ error: 'method-not-allowed' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  }

  const generatedAt = new Date().toISOString();
  const noodlesKey = Netlify.env.get('NOODLES_API_KEY') || '';
  const noodlesUrl = Netlify.env.get('NOODLES_API_URL') || '';
  const coinGeckoKey = Netlify.env.get('COINGECKO_API_KEY') || '';
  const coinGeckoPlan = Netlify.env.get('COINGECKO_API_PLAN') || 'demo';
  const warnings: string[] = [];
  let live = emptyLive();
  let noodlesStatus: 'ok' | 'not-configured' | 'error' = 'not-configured';
  let coinGeckoStatus: 'ok' | 'not-configured' | 'error' = 'not-configured';
  let crossCheck: Awaited<ReturnType<typeof getCoinGecko>> | null = null;

  const noodlesTask = noodlesKey && noodlesUrl
    ? getNoodles(noodlesKey, noodlesUrl).then((value) => { live = value; noodlesStatus = 'ok'; }).catch((error) => {
        noodlesStatus = 'error';
        warnings.push('Noodles market data is temporarily unavailable.');
        console.error('TREE dashboard Noodles request failed', error);
      })
    : Promise.resolve(warnings.push('Noodles market data is not configured.')).then(() => undefined);
  const coinGeckoTask = coinGeckoKey
    ? getCoinGecko(coinGeckoKey, coinGeckoPlan).then((value) => { crossCheck = value; coinGeckoStatus = 'ok'; }).catch((error) => {
        coinGeckoStatus = 'error';
        warnings.push('CoinGecko cross-check is temporarily unavailable.');
        console.error('TREE dashboard CoinGecko request failed', error);
      })
    : Promise.resolve();
  await Promise.all([noodlesTask, coinGeckoTask]);

  if (live.price !== null && crossCheck?.price !== null && crossCheck?.price !== undefined) {
    const difference = Math.abs(live.price - crossCheck.price) / Math.max(live.price, crossCheck.price) * 100;
    if (difference > 3) warnings.push(`Noodles and CoinGecko prices differ by ${difference.toFixed(2)}%.`);
  }

  const body = {
    generatedAt,
    live: { status: noodlesStatus, data: noodlesStatus === 'ok' ? live : null },
    snapshot,
    sources: {
      primary: { name: 'Noodles.fi', status: noodlesStatus },
      crossCheck: { name: 'CoinGecko', status: coinGeckoStatus, data: crossCheck },
    },
    coverage: Object.fromEntries(Object.entries(live).map(([field, value]) => [field, value !== null])),
    warnings,
  };
  return Response.json(body, {
    headers: { 'Cache-Control': noodlesStatus === 'ok' ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' : 'no-store' },
  });
};

export const config = { path: '/api/tree-dashboard' };
