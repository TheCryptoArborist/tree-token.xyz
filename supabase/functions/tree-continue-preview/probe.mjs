/** Fixed read-only mainnet probe. This is NOT a checkout receipt verifier. */
export const ENDPOINT = 'https://fullnode.mainnet.sui.io:443';
export const GENESIS = '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
export const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const check = (ok) => { if (!ok) throw Error('invalid-mainnet-probe'); };
export function validateProbe(info, coin, now = Date.now()) {
  check(info?.chain === 'mainnet' && info.chainId === GENESIS);
  const seconds = info.timestamp?.seconds, nanos = info.timestamp?.nanos;
  check((typeof seconds === 'bigint' || typeof seconds === 'string') && /^\d+$/.test(String(seconds)) && Number.isInteger(nanos) && nanos >= 0 && nanos < 1e9);
  const stamp = Number(BigInt(seconds) * 1000n) + Math.floor(nanos / 1e6);
  check(Number.isSafeInteger(stamp) && stamp <= now + 30000 && now - stamp <= 180000);
  check((typeof info.checkpointHeight === 'bigint' || typeof info.checkpointHeight === 'string') && /^\d+$/.test(String(info.checkpointHeight)));
  check(coin?.coinType === TREE_TYPE && coin.metadata?.decimals === 6 &&
    typeof coin.metadata.name === 'string' && coin.metadata.name.length <= 256 &&
    typeof coin.metadata.symbol === 'string' && coin.metadata.symbol.length <= 64);
  return { ready: true, network: 'sui:mainnet', chainIdentifier: '35834a8a',
    checkpointHeight: String(info.checkpointHeight), checkpointTimestampMs: stamp, observedAtMs: now,
    coinType: TREE_TYPE, decimals: 6, name: coin.metadata.name, symbol: coin.metadata.symbol,
    paymentAmountRaw: '20000000000', source: 'sui-grpc', receiptVerificationConfigured: false };
}
export function createProbe(client, now = Date.now) {
  let cache = null, running = null;
  return async () => {
    if (cache && now() >= cache.observedAtMs && now() - cache.observedAtMs < 15000) return cache;
    if (running) return running;
    running = (async () => {
      const options = { abort: AbortSignal.timeout(10000) };
      const [info, coin] = await Promise.all([
        client.ledgerService.getServiceInfo({}, options),
        client.stateService.getCoinInfo({ coinType: TREE_TYPE }, options),
      ]);
      cache = validateProbe(info.response, coin.response, now()); return cache;
    })();
    try { return await running; } finally { running = null; }
  };
}
