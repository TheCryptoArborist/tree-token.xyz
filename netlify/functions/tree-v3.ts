import {
  SUIDEX_V3_ANALYTICS_PAGE,
  SUIDEX_V3_PACKAGE,
  SUIDEX_V3_POOL_PAGE,
  SUIDEX_V3_POSITION_TYPE,
  getSuiDexV3PageStats,
  getSuiDexV3PoolObject,
  getSuiDexV3Quote,
  normalizeSuiAddress,
  scanTreeV3Positions,
} from '../lib/tree-v3-public.ts';
import { SUIDEX_V3_TREE_POOL } from '../lib/tree-swap-route.ts';

function json(body: unknown, status = 200, cacheControl = 'no-store') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function decimalFromRaw(raw: string, decimals: number): string {
  const value = BigInt(raw || '0');
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ status: 'error', error: 'method-not-allowed' }, 405);
  const url = new URL(request.url);
  const ownerInput = url.searchParams.get('owner');
  const owner = ownerInput ? normalizeSuiAddress(ownerInput) : null;
  if (ownerInput && !owner) {
    return json({ status: 'error', error: 'invalid-owner', message: 'owner must be a valid Sui address.' }, 400);
  }

  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];

  const poolResult = await Promise.allSettled([
    getSuiDexV3PoolObject(),
    getSuiDexV3PageStats(),
    getSuiDexV3Quote(),
  ]);

  const poolObject = poolResult[0].status === 'fulfilled' ? poolResult[0].value : null;
  const pageData = poolResult[1].status === 'fulfilled' ? poolResult[1].value : null;
  const quote = poolResult[2].status === 'fulfilled' ? poolResult[2].value : null;

  if (!poolObject) warnings.push(`On-chain pool verification failed: ${message(poolResult[0].status === 'rejected' ? poolResult[0].reason : '')}`);
  if (!pageData) warnings.push(`SuiDex public pool statistics failed: ${message(poolResult[1].status === 'rejected' ? poolResult[1].reason : '')}`);
  else warnings.push(...pageData.warnings);
  if (!quote) warnings.push(`The live SuiDex V3 reference quote failed: ${message(poolResult[2].status === 'rejected' ? poolResult[2].reason : '')}`);

  let positionScan = null;
  if (poolObject) {
    try {
      positionScan = await scanTreeV3Positions({ currentTick: poolObject.currentTick, maxPages: 20, pageSize: 50 });
      if (!positionScan.coverage.reachedEnd) warnings.push('The public SuiDex V3 position scan reached its safety limit; aggregate position counts are incomplete.');
    } catch (error) {
      warnings.push(`The public SuiDex V3 position scan failed: ${message(error)}`);
    }
  }

  const v3TreePerSui = quote ? Number(decimalFromRaw(quote.amountOut, 6)) : null;
  const quotePriceSuiPerTree = v3TreePerSui && Number.isFinite(v3TreePerSui) && v3TreePerSui > 0
    ? 1 / v3TreePerSui
    : null;
  const publicPrice = pageData?.stats.currentPriceSuiPerTree ?? quotePriceSuiPerTree;
  const positions = positionScan?.positions || [];
  const walletPositions = owner ? positions.filter((position) => position.owner === owner) : [];
  const sourcesAvailable = [Boolean(poolObject), Boolean(pageData), Boolean(quote), Boolean(positionScan)].filter(Boolean).length;
  const status = sourcesAvailable === 4 && positionScan?.coverage.reachedEnd ? 'ok' : sourcesAvailable > 0 ? 'partial' : 'error';

  return json({
    status,
    provider: 'tree-suidex-v3-readonly-v1',
    generatedAt,
    transactionMode: 'read-only',
    pool: {
      id: SUIDEX_V3_TREE_POOL,
      packageId: SUIDEX_V3_PACKAGE,
      positionType: SUIDEX_V3_POSITION_TYPE,
      pair: 'SUI/TREE',
      feePercent: pageData?.stats.feePercent ?? quote?.feePercent ?? 0.25,
      currentPriceSuiPerTree: publicPrice,
      treePerSui: v3TreePerSui,
      priceImpactPercentForOneSui: quote?.priceImpactPercent ?? null,
      gasEstimateForOneSuiRaw: quote?.gasEstimate ?? null,
      tvlUsd: pageData?.stats.tvlUsd ?? null,
      volume24hUsd: pageData?.stats.volume24hUsd ?? null,
      fees24hUsd: pageData?.stats.fees24hUsd ?? null,
      swaps24h: pageData?.stats.swaps24h ?? null,
      aprPercent: pageData?.stats.aprPercent ?? null,
      feeAprPercent: pageData?.stats.feeAprPercent ?? null,
      rewardAprPercent: pageData?.stats.rewardAprPercent ?? null,
      rewards: pageData?.stats.rewards ?? [],
      currentTick: poolObject?.currentTick ?? null,
      liquidityRaw: poolObject?.liquidityRaw ?? null,
      reserveXRaw: poolObject?.reserveXRaw ?? null,
      reserveYRaw: poolObject?.reserveYRaw ?? null,
      tokenX: poolObject?.tokenX ?? null,
      tokenY: poolObject?.tokenY ?? null,
      positionCoverage: positionScan?.coverage ?? null,
    },
    wallet: owner ? {
      address: owner,
      positionCount: walletPositions.length,
      positions: walletPositions.map((position) => ({
        objectId: position.objectId,
        poolId: position.poolId,
        liquidityRaw: position.liquidityRaw,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        currentTick: position.currentTick,
        inRange: position.inRange,
        treeSide: position.treeSide,
        owedTreeRaw: position.owedTreeRaw,
        owedTree: decimalFromRaw(position.owedTreeRaw, 6),
        owedSuiRaw: position.owedSuiRaw,
        owedSui: decimalFromRaw(position.owedSuiRaw, 9),
      })),
    } : null,
    sources: {
      onChainPool: { name: 'Sui Mainnet gRPC', available: Boolean(poolObject) },
      onChainPositions: { name: 'Sui Mainnet GraphQL', available: Boolean(positionScan), complete: positionScan?.coverage.reachedEnd ?? false },
      routeQuote: { name: 'SuiDex route service', available: Boolean(quote) },
      poolPage: { name: 'SuiDex V3 SUI/TREE pool page', url: SUIDEX_V3_POOL_PAGE, available: pageData?.sources.poolPage ?? false },
      analyticsPage: { name: 'SuiDex V3 analytics', url: SUIDEX_V3_ANALYTICS_PAGE, available: pageData?.sources.analyticsPage ?? false },
    },
    warnings,
  }, status === 'error' ? 502 : 200, owner ? 'no-store' : 'public, max-age=20, s-maxage=30, stale-while-revalidate=60');
};

export const config = { path: '/api/tree-v3' };
