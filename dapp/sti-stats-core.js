import {STI,TREE,POOL,normalize} from './sti-purchase-core.js';

export const PRICE_ENDPOINT = 'https://graphql.mainnet.sui.io/graphql';
export const DATA_TTL = 5 * 60_000;
const MAINNET = '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
const POOL_TYPE = `0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::Pool<${STI},${normalize('0x2')}::sui::SUI>`;
export const PRICE_QUERY = `query StiPrice { chainIdentifier checkpoint { timestamp } object(address: "${POOL}") { address asMoveObject { contents { type { repr } json } } } }`;

export function requireFresh(at, now = Date.now()) {
  if (!Number.isSafeInteger(at) || at <= 0 || at > now + 60_000 || now - at > DATA_TTL) throw Error('STI data is unavailable or out of date.');
}
function positiveInteger(value, bits = 64) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,38}$/.test(value)) throw Error('Invalid STI statistic.');
  const n = BigInt(value);
  if (n >= 1n << BigInt(bits)) throw Error('STI statistic is out of range.');
  return n;
}

// Informational only. Neither this price nor any feed value authorizes a purchase.
export function parsePoolPrice(response, now = Date.now()) {
  const data = response?.data, object = data?.object, content = object?.asMoveObject?.contents;
  const at = Date.parse(data?.checkpoint?.timestamp);
  requireFresh(at, now);
  if (response.errors?.length || data.chainIdentifier !== MAINNET || object.address !== POOL || content?.type?.repr !== POOL_TYPE) throw Error('STI price source could not be verified.');
  const fields = content.json;
  if (fields?.id !== POOL || fields.is_pause !== false || fields.fee_rate !== '2500') throw Error('STI pool is unavailable.');
  positiveInteger(fields.liquidity, 128);
  const sqrt = positiveInteger(fields.current_sqrt_price, 128);
  // Both STI and SUI use 9 decimals. The pool quotes SUI per STI as sqrtPriceX64² / 2¹²⁸.
  const priceMist = sqrt * sqrt * 1_000_000_000n / (1n << 128n);
  if (priceMist <= 0n || priceMist >= 1n << 64n) throw Error('STI pool price is out of range.');
  return {priceMist, at};
}

export function parseNav(data, now = Date.now()) {
  requireFresh(data?.at, now);
  const navMist = positiveInteger(data.navMist), supply = positiveInteger(data.supply), priceMist = positiveInteger(data.perSti);
  if (navMist * 1_000_000_000n / supply !== priceMist) throw Error('STI backing per token could not be verified.');
  return {priceMist, at:data.at};
}

export function parseBasket(data, now = Date.now()) {
  requireFresh(data?.at, now);
  if (!Array.isArray(data.coins) || !data.coins.length || data.coins.length > 100) throw Error('STI basket is unavailable.');
  const seen = new Set();
  const parts = data.coins.map(coin => {
    if (typeof coin?.type !== 'string' || !/^0x[0-9a-f]{64}::[A-Za-z_][A-Za-z_0-9]*::[A-Za-z_][A-Za-z_0-9]*$/.test(coin.type) || seen.has(coin.type) || !Number.isFinite(coin.share) || coin.share < 0 || coin.share > 1) throw Error('Invalid STI basket composition.');
    seen.add(coin.type);
    const symbol = typeof coin.symbol === 'string' && /^[A-Za-z0-9 _.-]{1,24}$/.test(coin.symbol) ? coin.symbol : 'Basket token';
    return {tree:coin.type === TREE && !coin.retiring, share:coin.share, symbol};
  });
  if (Math.abs(parts.reduce((sum, part) => sum + part.share, 0) - 1) > 0.0001) throw Error('Incomplete STI basket composition.');
  return parts.filter(part => part.share > 0).sort((a,b) => b.share - a.share);
}
