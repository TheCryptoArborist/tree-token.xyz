import { ChannelCredentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { TREE_COIN_TYPE, TREE_DECIMALS, TREE_TOTAL_SUPPLY_RAW } from '../lib/leaderboard-provider.ts';
import { SUI_ZERO_ADDRESS } from '../lib/tree-burn-index.ts';

function formatRaw(raw: bigint) {
  const base = 10n ** BigInt(TREE_DECIMALS);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(TREE_DECIMALS, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function burnOverviewFromRaw(rawValue: string) {
  if (!/^\d+$/.test(rawValue)) throw new Error('Invalid TREE balance.');
  const zeroAddressBalanceRaw = BigInt(rawValue);
  if (zeroAddressBalanceRaw > TREE_TOTAL_SUPPLY_RAW) throw new Error('TREE balance exceeds verified supply.');
  const effectiveSupplyRaw = TREE_TOTAL_SUPPLY_RAW - zeroAddressBalanceRaw;
  const removalPercentage = Number(zeroAddressBalanceRaw * 100_000_000n / TREE_TOTAL_SUPPLY_RAW) / 1_000_000;
  return {
    coinType: TREE_COIN_TYPE,
    zeroAddress: SUI_ZERO_ADDRESS,
    totalSupplyRaw: TREE_TOTAL_SUPPLY_RAW.toString(),
    totalSupply: formatRaw(TREE_TOTAL_SUPPLY_RAW),
    zeroAddressBalanceRaw: zeroAddressBalanceRaw.toString(),
    zeroAddressBalance: formatRaw(zeroAddressBalanceRaw),
    effectiveSupplyRaw: effectiveSupplyRaw.toString(),
    effectiveSupply: formatRaw(effectiveSupplyRaw),
    removalPercentage,
  };
}

async function liveZeroAddressBalance() {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: 'fullnode.mainnet.sui.io:443',
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      client.core.getBalance({ owner: SUI_ZERO_ADDRESS, coinType: TREE_COIN_TYPE }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Sui gRPC balance lookup timed out.')), 8_000); }),
    ]);
    return result.balance.balance;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default async (request: Request) => {
  if (request.method !== 'GET') {
    return Response.json({ status: 'error', error: 'method-not-allowed' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  }
  const generatedAt = new Date().toISOString();
  try {
    const overview = burnOverviewFromRaw(await liveZeroAddressBalance());
    return Response.json({ status: 'ok', generatedAt, network: 'sui-mainnet', source: 'Sui Mainnet gRPC', ...overview, warnings: [] }, {
      headers: { 'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('TREE burn overview failed', error);
    return Response.json({ status: 'error', generatedAt, error: 'burn-overview-unavailable', warnings: ['Live Sui burn data is temporarily unavailable.'] }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
};

export const config = { path: '/api/tree-burn-overview' };
