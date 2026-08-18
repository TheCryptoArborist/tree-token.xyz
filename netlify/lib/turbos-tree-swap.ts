import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Network, TurbosSdk } from 'turbos-clmm-sdk';
import {
  SUI_TYPE,
  TREE_TYPE,
  TURBOS_SUI_TREE_POOL,
  TURBOS_SUI_TREE_FEE_TYPE,
  type SafeTreeRoute,
  type SwapQuoteRequest,
  normalizeMoveType,
  validateSwapRequest,
} from './tree-swap-route.ts';

const QUOTE_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000001';
const Q64 = 18_446_744_073_709_551_616;
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
const sdk = new TurbosSdk(Network.mainnet, client);

function priceImpactPercent(inputRaw: bigint, outputRaw: bigint, aToB: boolean, sqrtPrice: string): number {
  const sqrt = Number(sqrtPrice);
  if (!Number.isFinite(sqrt) || sqrt <= 0 || inputRaw <= 0n || outputRaw <= 0n) return 0;
  const rawBPerA = (sqrt / Q64) ** 2;
  const idealOutput = aToB ? Number(inputRaw) * rawBPerA : Number(inputRaw) / rawBPerA;
  if (!Number.isFinite(idealOutput) || idealOutput <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - Number(outputRaw) / idealOutput) * 100));
}

export async function quoteTurbosTreeSwap(requestInput: SwapQuoteRequest): Promise<SafeTreeRoute> {
  const request = validateSwapRequest(requestInput);
  const pool = await sdk.pool.getPool(TURBOS_SUI_TREE_POOL);
  const [coinAType, coinBType] = pool.types;
  const feeType = pool.types[2];
  const expected = new Set([normalizeMoveType(SUI_TYPE), normalizeMoveType(TREE_TYPE)]);
  if (!expected.has(normalizeMoveType(coinAType)) || !expected.has(normalizeMoveType(coinBType))) throw new Error('The allowlisted Turbos pool no longer contains SUI/TREE.');
  if (normalizeMoveType(feeType) !== normalizeMoveType(TURBOS_SUI_TREE_FEE_TYPE)) throw new Error('The allowlisted Turbos pool fee type changed.');
  const aToB = normalizeMoveType(request.tokenIn) === normalizeMoveType(coinAType);
  const [result] = await sdk.trade.computeSwapResult({
    pools: [{ pool: TURBOS_SUI_TREE_POOL, a2b: aToB }],
    address: QUOTE_SENDER,
    amountSpecified: request.amountIn,
    amountSpecifiedIsInput: true,
  });
  if (!result || result.pool.toLowerCase() !== TURBOS_SUI_TREE_POOL || result.a_to_b !== aToB || result.is_exact_in !== true) throw new Error('Turbos returned an invalid route result.');
  const resultInput = BigInt(aToB ? result.amount_a : result.amount_b);
  const amountOut = BigInt(aToB ? result.amount_b : result.amount_a);
  if (resultInput !== BigInt(request.amountIn) || amountOut <= 0n) throw new Error('Turbos returned no executable output for this amount.');
  const minAmountOut = amountOut - amountOut * BigInt(request.slippageBps) / 10_000n;
  const impact = priceImpactPercent(resultInput, amountOut, aToB, pool.sqrt_price);
  return {
    type: 'direct', venue: 'turbos', venueLabel: 'Turbos', executionKind: 'turbos-direct',
    pairId: TURBOS_SUI_TREE_POOL, tokenIn: request.tokenIn, tokenOut: request.tokenOut,
    amountIn: resultInput.toString(), amountOut: amountOut.toString(), minAmountOut: minAmountOut.toString(),
    priceImpactPercent: impact, priceImpactTier: impact > 5 ? 'high' : impact > 1 ? 'medium' : 'low',
    gasEstimate: '0', feePercent: Number(pool.fee) / 10_000,
    coinAType, coinBType, feeType, aToB, nextTickIndex: sdk.math.bitsToNumber(result.tick_current_index.bits),
  };
}
