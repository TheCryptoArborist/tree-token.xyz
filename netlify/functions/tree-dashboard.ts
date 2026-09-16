import snapshot from '../../data/tree-project-snapshot.json';
import seedMarket from '../../data/tree-market-last-verified.json';
import {
  hasCoreMarketFields,
  mergeLiveFields,
  readCachedTreeMarket,
  validCachedTreeMarket,
  writeCachedTreeMarket,
  type CachedTreeMarket,
} from '../lib/tree-dashboard-cache.ts';
import {
  emptyLive,
  mergeNoodlesFields,
  normalizeNoodlesCoinDetails,
  normalizeNoodlesPriceVolume,
  numberFrom,
  record,
  stringFrom,
  type LiveFields,
} from '../lib/tree-dashboard-normalizer.ts';

type SourceStatus = 'ok' | 'not-configured' | 'error';
type LiveStatus = 'ok' | 'fallback' | 'not-configured' | 'error';

const noodlesHeaders = (apiKey: string) => ({ Accept: 'application/json', 'x-api-key': apiKey, 'x-chain': 'sui' });

async function requestJson(url: string, apiKey: string, label: string) {
  const response = await fetch(url, { headers: noodlesHeaders(apiKey) });
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return response.json();
}

function coinIdFromDetailsUrl(apiUrl: string): string | null {
  try {
    return new URL(apiUrl).searchParams.get('coin_id');
  } catch {
    return null;
  }
}

function priceVolumeUrl(coinId: string) {
  const url = new URL('https://api.noodles.fi/api/v1/partner/coin-price-volume');
  url.searchParams.set('coin_id', coinId);
  return url.href;
}

async function getCoinGecko(apiKey: string, plan: string): Promise<LiveFields> {
  const pro = plan.toLowerCase() === 'pro';
  const base = pro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
  const keyHeader = pro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key';
  const url = `${base}/coins/thickquidity?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  const response = await fetch(url, { headers: { Accept: 'application/json', [keyHeader]: apiKey } });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
  const payload = record(await response.json());
  const market = record(payload.market_data);
  return {
    ...emptyLive(),
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
  const coinId = noodlesUrl ? coinIdFromDetailsUrl(noodlesUrl) : null;
  const warnings: string[] = [];
  let details: LiveFields | null = null;
  let volume: ReturnType<typeof normalizeNoodlesPriceVolume> | null = null;
  let crossCheck: LiveFields | null = null;
  let detailsStatus: SourceStatus = 'not-configured';
  let volumeStatus: SourceStatus = 'not-configured';
  let coinGeckoStatus: SourceStatus = 'not-configured';

  const detailsTask = noodlesKey && noodlesUrl
    ? requestJson(noodlesUrl, noodlesKey, 'Noodles Coin Details')
        .then((payload) => { details = normalizeNoodlesCoinDetails(payload); detailsStatus = 'ok'; })
        .catch((error) => { detailsStatus = 'error'; warnings.push('Noodles Coin Details is temporarily unavailable.'); console.error(error); })
    : Promise.resolve(warnings.push('Noodles Coin Details is not configured.')).then(() => undefined);
  const volumeTask = noodlesKey && coinId
    ? requestJson(priceVolumeUrl(coinId), noodlesKey, 'Noodles Coin Price Volume')
        .then((payload) => { volume = normalizeNoodlesPriceVolume(payload); volumeStatus = 'ok'; })
        .catch((error) => { volumeStatus = 'error'; warnings.push('Noodles Coin Price Volume is temporarily unavailable.'); console.error(error); })
    : Promise.resolve(warnings.push(noodlesKey ? 'Noodles Coin Price Volume could not derive coin_id from NOODLES_API_URL.' : 'Noodles Coin Price Volume is not configured.')).then(() => undefined);
  const coinGeckoTask = coinGeckoKey
    ? getCoinGecko(coinGeckoKey, coinGeckoPlan)
        .then((value) => { crossCheck = value; coinGeckoStatus = 'ok'; })
        .catch((error) => { coinGeckoStatus = 'error'; warnings.push('CoinGecko cross-check is temporarily unavailable.'); console.error(error); })
    : Promise.resolve();
  await Promise.all([detailsTask, volumeTask, coinGeckoTask]);

  const noodlesSucceeded = detailsStatus === 'ok' || volumeStatus === 'ok';
  const noodlesData = mergeNoodlesFields(details, volume);
  const seededMarket = validCachedTreeMarket(seedMarket) ? seedMarket as CachedTreeMarket : null;
  let cachedMarket: CachedTreeMarket | null = null;
  try {
    cachedMarket = await readCachedTreeMarket();
  } catch (error) {
    warnings.push('The durable market cache is temporarily unavailable.');
    console.error(error);
  }
  const lastVerified = cachedMarket ?? seededMarket;
  let status: LiveStatus;
  let source: 'Noodles.fi' | 'CoinGecko' | null;
  let liveData: LiveFields | null;
  let verifiedAt: string | null = lastVerified?.generatedAt ?? null;
  if (noodlesSucceeded && hasCoreMarketFields(noodlesData)) {
    status = 'ok'; source = 'Noodles.fi'; liveData = noodlesData; verifiedAt = generatedAt;
    try {
      await writeCachedTreeMarket({ generatedAt, source: 'Noodles.fi', data: noodlesData });
    } catch (error) {
      warnings.push('The latest verified market snapshot could not be saved.');
      console.error(error);
    }
  } else if (noodlesSucceeded && lastVerified) {
    status = 'fallback'; source = 'Noodles.fi'; liveData = mergeLiveFields(noodlesData, lastVerified.data);
    warnings.push('Displaying available live Noodles fields with the last verified market snapshot.');
  } else if (coinGeckoStatus === 'ok' && crossCheck) {
    status = 'fallback'; source = 'CoinGecko'; liveData = lastVerified ? mergeLiveFields(crossCheck, lastVerified.data) : crossCheck;
    warnings.push(lastVerified
      ? 'Displaying current CoinGecko fields with the last verified Noodles market snapshot.'
      : 'Displaying CoinGecko fallback fields; holder count and recognized protocol liquidity are unavailable.');
  } else if (lastVerified) {
    status = 'fallback'; source = 'Noodles.fi'; liveData = lastVerified.data;
    warnings.push(`Displaying the last verified market snapshot from ${lastVerified.generatedAt} because the live provider is temporarily unavailable.`);
  } else {
    const anyConfigured = Boolean(noodlesKey || coinGeckoKey);
    status = anyConfigured ? 'error' : 'not-configured'; source = null; liveData = null;
    verifiedAt = null;
  }

  if (noodlesData.price !== null && crossCheck?.price !== null && crossCheck?.price !== undefined) {
    const difference = Math.abs(noodlesData.price - crossCheck.price) / Math.max(noodlesData.price, crossCheck.price) * 100;
    if (difference > 3) warnings.push(`Noodles and CoinGecko prices differ by ${difference.toFixed(2)}%.`);
  }

  const coverageFor = (data: Partial<LiveFields> | null, fields: Array<keyof LiveFields>) =>
    Object.fromEntries(fields.map((field) => [field, data?.[field] !== null && data?.[field] !== undefined]));
  const sourceWarnings = (statusValue: SourceStatus, missing: string, failed: string) =>
    statusValue === 'not-configured' ? [missing] : statusValue === 'error' ? [failed] : [];

  return Response.json({
    generatedAt,
    live: { status, source, data: liveData, verifiedAt },
    snapshot,
    sources: {
      displayed: { name: source, status },
      noodlesCoinDetails: {
        name: 'Noodles.fi Coin Details', status: detailsStatus,
        coverage: coverageFor(details, ['price', 'priceChange1h', 'priceChange24h', 'priceChange7d', 'liquidity', 'marketCap', 'fdv', 'holderCount', 'sourceUpdatedAt']),
        warnings: sourceWarnings(detailsStatus, 'Noodles Coin Details is not configured.', 'Noodles Coin Details is temporarily unavailable.'),
      },
      noodlesPriceVolume: {
        name: 'Noodles.fi Coin Price Volume', status: volumeStatus,
        coverage: coverageFor(volume, ['price', 'priceChange24h', 'volume24h']),
        warnings: sourceWarnings(volumeStatus, 'Noodles Coin Price Volume is not configured.', 'Noodles Coin Price Volume is temporarily unavailable.'),
      },
      crossCheck: {
        name: 'CoinGecko', status: coinGeckoStatus, data: crossCheck,
        coverage: coverageFor(crossCheck, ['price', 'priceChange24h', 'volume24h', 'marketCap', 'fdv', 'sourceUpdatedAt']),
        warnings: sourceWarnings(coinGeckoStatus, 'CoinGecko cross-check is not configured.', 'CoinGecko cross-check is temporarily unavailable.'),
      },
    },
    coverage: Object.fromEntries(Object.entries(liveData ?? emptyLive()).map(([field, value]) => [field, value !== null])),
    warnings,
  }, {
    headers: { 'Cache-Control': status === 'ok' || status === 'fallback' ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' : 'no-store' },
  });
};

export const config = { path: '/api/tree-dashboard' };
