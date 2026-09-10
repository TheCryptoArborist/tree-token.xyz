import handler from '../netlify/functions/tree-swap-quote.ts';
import { SUI_TYPE, TREE_TYPE } from '../netlify/lib/tree-swap-route.ts';

const requests = [
  { label: 'SUI_TO_TREE', tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '1000000000' },
  { label: 'TREE_TO_SUI', tokenIn: TREE_TYPE, tokenOut: SUI_TYPE, amountIn: '10000000000' },
];
const results = [];

for (const input of requests) {
  const query = new URLSearchParams({ tokenIn: input.tokenIn, tokenOut: input.tokenOut, amountIn: input.amountIn, slippageBps: '100' });
  const response = await handler(new Request(`https://tree-token.test/api/tree-swap-quote?${query}`));
  const payload = await response.json();
  if (!response.ok || payload.status !== 'ok' || !Array.isArray(payload.routes) || !payload.selectedRoute) {
    throw new Error(`${input.label} aggregator check failed: ${JSON.stringify(payload)}`);
  }
  if (!payload.routes.some((route) => route.executionKind === 'turbos-direct')) throw new Error(`${input.label} did not include the allowlisted Turbos route.`);
  if (!payload.routes.some((route) => route.executionKind === 'suidex-v2-direct' || route.executionKind === 'suidex-v3-direct')) throw new Error(`${input.label} did not include a SuiDex route.`);
  const maximumProtectedOutput = payload.routes.reduce((maximum, route) => BigInt(route.minAmountOut) > maximum ? BigInt(route.minAmountOut) : maximum, 0n);
  if (BigInt(payload.selectedRoute.minAmountOut) !== maximumProtectedOutput) throw new Error(`${input.label} did not select the highest protected output.`);
  results.push({
    direction: input.label,
    selected: payload.selectedRoute.venueLabel,
    selectedMinAmountOut: payload.selectedRoute.minAmountOut,
    compared: payload.routes.map((route) => route.venueLabel),
    warnings: payload.warnings,
  });
}

console.log(JSON.stringify({ classification: 'TREE_MULTI_VENUE_SWAP_AGGREGATOR_VALID', results }, null, 2));
