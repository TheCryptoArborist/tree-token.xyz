const PRICE_SCALE = 100_000_000n;
const SUI_BASE_UNITS = 1_000_000_000n;
const CENTS_PER_DOLLAR = 100n;

function scaledDecimal(value: unknown): bigint | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 10_000) return null;
  const fixed = number.toFixed(8);
  const [whole, fraction = ''] = fixed.split('.');
  return BigInt(whole) * PRICE_SCALE + BigInt(fraction.padEnd(8, '0'));
}

export async function fetchSuiUsdPriceScaled(fetchImpl: typeof fetch = fetch): Promise<bigint> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetchImpl(
      'https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd',
      { headers: { Accept: 'application/json', 'User-Agent': 'TREE-Command-Center-Raffle/1.0' }, signal: controller.signal },
    );
    if (!response.ok) throw new Error(`SUI price verification returned ${response.status}.`);
    const payload = await response.json() as { sui?: { usd?: unknown } };
    const price = scaledDecimal(payload.sui?.usd);
    if (!price) throw new Error('SUI price verification returned no usable USD price.');
    return price;
  } finally {
    clearTimeout(timeout);
  }
}

export function qualifyingUsdCentsFromSuiRaw(suiRaw: string, priceScaled: bigint): number {
  if (!/^[1-9][0-9]*$/.test(suiRaw) || priceScaled <= 0n) throw new Error('Verified SUI value is invalid.');
  const cents = BigInt(suiRaw) * priceScaled * CENTS_PER_DOLLAR / (SUI_BASE_UNITS * PRICE_SCALE);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Verified USD value exceeds the supported range.');
  return Number(cents);
}
