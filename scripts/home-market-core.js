export const HOME_MARKET_FIELDS = ['price', 'priceChange24h', 'marketCap', 'liquidity', 'holderCount'];

const compactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});
const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function validMarketValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  const digits = number < 0.0001 ? 10 : number < 0.01 ? 7 : 4;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  }).format(number);
}

export function formatMarket(field, value) {
  if (!validMarketValue(value)) return 'Unavailable';
  const number = Number(value);
  if (field === 'price') return formatPrice(number);
  if (field === 'priceChange24h') return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  if (field === 'holderCount') return wholeNumber.format(number);
  return compactMoney.format(number);
}

export function resolveHomeMarket(payload, cached) {
  const live = payload?.live?.data || {};
  const totalSupply = Number(payload?.snapshot?.tree?.totalSupply);
  const resolved = {};
  for (const field of HOME_MARKET_FIELDS) resolved[field] = validMarketValue(live[field]) ? Number(live[field]) : validMarketValue(cached?.[field]) ? Number(cached[field]) : null;
  if (!validMarketValue(resolved.marketCap) && validMarketValue(resolved.price) && Number.isFinite(totalSupply) && totalSupply > 0) resolved.marketCap = resolved.price * totalSupply;
  return resolved;
}
