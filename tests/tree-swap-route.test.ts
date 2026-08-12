import assert from 'node:assert/strict';
import { SUI_TYPE, TREE_TYPE, normalizeTreeSwapQuote, validateSwapRequest } from '../netlify/lib/tree-swap-route.ts';

const v2 = (amountIn: string, amountOut: string, impact: number) => ({ type: 'direct', hops: [{ venue: 'suidex', pairId: '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc', tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn, amountOut, priceImpact: impact }], totalAmountIn: amountIn, totalAmountOut: amountOut, totalPriceImpact: impact, priceImpactTier: 'low', gasEstimate: '60000000' });
const v3 = (tokenIn: string, tokenOut: string, amountIn: string, amountOut: string, impact: number) => ({ type: 'direct', hops: [{ venue: 'v3', pairId: '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf', tokenIn, tokenOut, amountIn, amountOut, priceImpact: impact, feeRate: 2500, coinAType: SUI_TYPE, coinBType: TREE_TYPE }], totalAmountIn: amountIn, totalAmountOut: amountOut, totalPriceImpact: impact, priceImpactTier: 'low', gasEstimate: '50000000' });

const buyRequest = validateSwapRequest({ tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '1000000000', slippageBps: 100 });
const buyV2 = v2('1000000000', '35406066115', 0.37);
const buyV3 = v3(SUI_TYPE, TREE_TYPE, '1000000000', '35348077555', 0.25);
const buy = normalizeTreeSwapQuote({ bestRoute: buyV2, directRoutes: [buyV2, buyV3], buildMetadata: { hops: [{ pairId: buyV2.hops[0].pairId, minAmountOut: '35052005454' }] } }, { ...buyRequest, generatedAt: '2026-08-12T20:58:46.137Z' });
assert.equal(buy.selectedRoute.venue, 'suidex');
assert.equal(buy.selectedRoute.amountOut, '35406066115');
assert.equal(buy.selectedRoute.minAmountOut, '35052005454');
assert.equal(buy.decimalsIn, 9);
assert.equal(buy.decimalsOut, 6);
assert.equal(buy.routes.length, 2);

const sellRequest = validateSwapRequest({ tokenIn: TREE_TYPE, tokenOut: SUI_TYPE, amountIn: '100000000000', slippageBps: 100 });
const sellV2 = { ...v2('100000000000', '2799915752', 0.49), hops: [{ ...v2('1','1',0).hops[0], tokenIn: TREE_TYPE, tokenOut: SUI_TYPE, amountIn: '100000000000', amountOut: '2799915752', priceImpact: 0.49 }] };
const sellV3 = v3(TREE_TYPE, SUI_TYPE, '100000000000', '2814690528', 0.25);
const sell = normalizeTreeSwapQuote({ bestRoute: sellV3, directRoutes: [sellV2, sellV3], buildMetadata: { hops: [{ pairId: sellV3.hops[0].pairId, minAmountOut: '2786543623' }] } }, { ...sellRequest, generatedAt: '2026-08-12T20:58:47.300Z' });
assert.equal(sell.selectedRoute.venue, 'v3');
assert.equal(sell.selectedRoute.amountOut, '2814690528');
assert.equal(sell.decimalsIn, 6);
assert.equal(sell.decimalsOut, 9);

assert.throws(() => validateSwapRequest({ tokenIn: SUI_TYPE, tokenOut: '0x2::coin::COIN', amountIn: '1', slippageBps: 100 }), /SUI\/TREE/);
assert.throws(() => validateSwapRequest({ tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '1.5', slippageBps: 100 }), /unsigned/);
assert.throws(() => validateSwapRequest({ tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '1', slippageBps: 900 }), /10 to 500/);
assert.throws(() => normalizeTreeSwapQuote({ directRoutes: [{ ...buyV2, type: 'split' }] }, buyRequest), /No allowlisted/);
console.log('TREE best-route quote normalization: PASS (V2 buy, V3 sell, exact 9/6 decimals, allowlisted direct routes only)');
