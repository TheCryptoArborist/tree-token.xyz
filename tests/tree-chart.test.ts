import test from 'node:test';
import assert from 'node:assert/strict';
import treeChart, { normalizeCoinGeckoCandles, sampleChartCandles } from '../netlify/functions/tree-chart.ts';

test('CoinGecko TREE history normalizes into chart candles with matched volume', () => {
  const candles = normalizeCoinGeckoCandles({
    prices: [[1000, 0.00001], [2000, 0.00002]],
    total_volumes: [[1000, 12], [2000, 34]],
  }, 10);
  assert.deepEqual(candles, [
    { timestamp: 1000, open: 0.00001, high: 0.00001, low: 0.00001, close: 0.00001, volume: 12 },
    { timestamp: 2000, open: 0.00002, high: 0.00002, low: 0.00002, close: 0.00002, volume: 34 },
  ]);
});

test('chart sampling remains bounded and preserves the newest price', () => {
  const candles = Array.from({ length: 12 }, (_, index) => ({
    timestamp: index,
    open: index + 1,
    high: index + 1,
    low: index + 1,
    close: index + 1,
    volume: index,
  }));
  const sampled = sampleChartCandles(candles, 4);
  assert.ok(sampled.length <= 4);
  assert.equal(sampled.at(-1)?.timestamp, 11);
});

test('chart endpoint falls back to CoinGecko when Noodles OHLCV fails', async () => {
  const originalFetch = globalThis.fetch;
  const originalNetlify = Reflect.get(globalThis, 'Netlify');
  let calls = 0;
  Reflect.set(globalThis, 'Netlify', { env: { get: (key: string) => key === 'NOODLES_API_KEY' ? 'test-key' : 'https://api.noodles.fi/coin?coin_id=tree' } });
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response('upstream unavailable', { status: 503 })
      : Response.json({ prices: [[1000, 0.00001], [2000, 0.00002]], total_volumes: [[1000, 12], [2000, 34]] });
  };
  try {
    const response = await treeChart(new Request('https://tree-token.xyz/api/tree-chart?range=24h'));
    const payload = await response.json();
    assert.equal(payload.status, 'ok');
    assert.equal(payload.source, 'CoinGecko');
    assert.equal(payload.candles.length, 2);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNetlify === undefined) Reflect.deleteProperty(globalThis, 'Netlify');
    else Reflect.set(globalThis, 'Netlify', originalNetlify);
  }
});
