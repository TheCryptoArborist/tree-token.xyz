import assert from 'node:assert/strict';
import { buildTreeLiquidityGraph, TREE_PARTNER_TYPES } from '../netlify/lib/tree-liquidity-graph.ts';

const now = '2026-09-18T00:00:00.000Z';
const graph = buildTreeLiquidityGraph([
  { venue: 'aftermath', poolId: '0xboomtree', coinTypes: [TREE_PARTNER_TYPES.BOOM, TREE_PARTNER_TYPES.TREE], healthy: true, verifiedAt: now, source: 'on-chain' },
  { venue: 'suidex', poolId: '0xsuitree', coinTypes: [TREE_PARTNER_TYPES.SUI, TREE_PARTNER_TYPES.TREE], healthy: true, verifiedAt: now, source: 'on-chain' },
  { venue: 'turbos', poolId: '0xdrained', coinTypes: [TREE_PARTNER_TYPES.SUI, TREE_PARTNER_TYPES.TREE], healthy: false, verifiedAt: now, source: 'on-chain' },
]);
assert.equal(graph.maxRouteHops, 3);
assert.equal(graph.pools.length, 2);
assert.equal(graph.pools.some((pool) => pool.poolId === '0xdrained'), false);
assert.equal(graph.pools.some((pool) => pool.coinTypes.includes(TREE_PARTNER_TYPES.BOOM)), true);
console.log('TREE liquidity graph foundation: PASS');
