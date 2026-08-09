import assert from 'node:assert/strict';
import {
  CLMM_Q64,
  amountsForLiquidityQ64,
  parseSignedI32,
  tickToSqrtPriceQ64,
} from '../netlify/lib/clmm-q64.ts';
import {
  SUIDEX_V3_PACKAGE,
  scanSuiDexV3TreeLp,
} from '../netlify/lib/suidex-v3-tree-lp-provider.ts';

const tree = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const sui = '0x2::sui::SUI';
const poolId = `0x${'9'.repeat(64)}`;
const walletA = `0x${'a'.repeat(64)}`;
const zero = `0x${'0'.repeat(64)}`;

assert.equal(tickToSqrtPriceQ64(0), CLMM_Q64);
assert.ok(tickToSqrtPriceQ64(1) > CLMM_Q64);
assert.ok(tickToSqrtPriceQ64(-1) < CLMM_Q64);
assert.equal(parseSignedI32({ bits: '4294967196' }), -100);
assert.equal(parseSignedI32({ bits: 100 }), 100);
assert.equal(parseSignedI32({ bits: '4294967296' }), null);

const within = amountsForLiquidityQ64(CLMM_Q64 * 2n, CLMM_Q64, CLMM_Q64 * 4n, 1_000n);
assert.deepEqual(within, { amountX: 250n, amountY: 1_000n });
const below = amountsForLiquidityQ64(CLMM_Q64 / 2n, CLMM_Q64, CLMM_Q64 * 4n, 1_000n);
assert.deepEqual(below, { amountX: 750n, amountY: 0n });
const above = amountsForLiquidityQ64(CLMM_Q64 * 5n, CLMM_Q64, CLMM_Q64 * 4n, 1_000n);
assert.deepEqual(above, { amountX: 0n, amountY: 3_000n });

function positionNode(options: {
  id: string;
  owner?: string;
  ownerKind?: string;
  liquidity: string;
  tickLower?: number;
  tickUpper?: number;
  tokenX?: string;
  tokenY?: string;
  owedTree?: string;
}) {
  const tickLower = options.tickLower ?? -100;
  const tickUpper = options.tickUpper ?? 100;
  const toBits = (value: number) => value < 0 ? String(0x1_0000_0000 + value) : String(value);
  return {
    address: options.id,
    owner: {
      __typename: options.ownerKind ?? 'AddressOwner',
      address: { address: options.owner ?? walletA },
    },
    asMoveObject: {
      contents: {
        json: {
          id: options.id,
          pool_id: poolId,
          type_x: options.tokenX ?? sui,
          type_y: options.tokenY ?? tree,
          tick_lower_index: { bits: toBits(tickLower) },
          tick_upper_index: { bits: toBits(tickUpper) },
          liquidity: options.liquidity,
          owed_coin_x: '0',
          owed_coin_y: options.owedTree ?? '0',
        },
      },
    },
  };
}

const poolObject = {
  type: `${SUIDEX_V3_PACKAGE}::pool::Pool<${sui},${tree}>`,
  json: {
    id: poolId,
    type_x: sui,
    type_y: tree,
    sqrt_price: CLMM_Q64.toString(),
    tick_index: { bits: '0' },
    liquidity: '999999999999999999999999',
    reserve_x: '999999999999999999999999',
    reserve_y: '999999999999999999999999',
  },
};

const nodeA1 = positionNode({ id: `0x${'1'.repeat(64)}`, liquidity: '1000000', owedTree: '7' });
const nodeA2 = positionNode({ id: `0x${'2'.repeat(64)}`, liquidity: '500000', tickLower: -50, tickUpper: 150 });
const nodeZero = positionNode({ id: `0x${'3'.repeat(64)}`, owner: zero, liquidity: '250000', owedTree: '2' });
const nonTreeNode = positionNode({
  id: `0x${'4'.repeat(64)}`,
  liquidity: '1000000',
  tokenY: `0x${'b'.repeat(64)}::other::OTHER`,
});

const result = await scanSuiDexV3TreeLp({
  generatedAt: '2026-08-09T00:00:00.000Z',
  scanPositions: async () => ({ reachedEnd: true, pages: 1, nodes: [nodeA1, nodeA2, nodeZero, nonTreeNode] }),
  getPoolObject: async (id) => {
    assert.equal(id, poolId);
    return poolObject;
  },
});
assert.equal(result.outcome, 'complete');
assert.equal(result.positions.length, 1);
assert.equal(result.coverage.objectsScanned, 4);
assert.equal(result.coverage.treePositionObjects, 3);
assert.equal(result.coverage.addressOwnedTreePositions, 3);
assert.equal(result.coverage.excludedObjects, 1);
assert.equal(result.coverage.uniquePools, 1);
assert.equal(result.coverage.verifiedPools, 1);
assert.equal(result.coverage.unclaimedTreeRawExcluded, '9');

const expectedA1 = amountsForLiquidityQ64(
  CLMM_Q64,
  tickToSqrtPriceQ64(-100),
  tickToSqrtPriceQ64(100),
  1_000_000n,
).amountY;
const expectedA2 = amountsForLiquidityQ64(
  CLMM_Q64,
  tickToSqrtPriceQ64(-50),
  tickToSqrtPriceQ64(150),
  500_000n,
).amountY;
const expectedZero = amountsForLiquidityQ64(
  CLMM_Q64,
  tickToSqrtPriceQ64(-100),
  tickToSqrtPriceQ64(100),
  250_000n,
).amountY;
const wallet = result.positions[0];
assert.equal(wallet.wallet, walletA);
assert.equal(wallet.lpTreeRaw, (expectedA1 + expectedA2).toString());
assert.equal(wallet.positionCount, 2);
assert.equal(wallet.metadata?.principalOnly, true);
assert.equal(wallet.metadata?.unclaimedTreeRawExcluded, '7');
assert.equal(result.coverage.excludedPrincipalTreeRaw, expectedZero.toString());
assert.equal(result.coverage.aggregatePrincipalTreeRaw, (expectedA1 + expectedA2 + expectedZero).toString());

const malformed = await scanSuiDexV3TreeLp({
  scanPositions: async () => ({
    reachedEnd: true,
    pages: 1,
    nodes: [positionNode({ id: `0x${'5'.repeat(64)}`, liquidity: 'not-a-number' })],
  }),
  getPoolObject: async () => poolObject,
});
assert.equal(malformed.outcome, 'verification-incomplete');
assert.equal(malformed.positions.length, 0);
assert.equal(malformed.coverage.malformedObjects, 1);

const incomplete = await scanSuiDexV3TreeLp({
  scanPositions: async () => ({ reachedEnd: false, pages: 100, nodes: [nodeA1] }),
  getPoolObject: async () => poolObject,
});
assert.equal(incomplete.outcome, 'verification-incomplete');
assert.equal(incomplete.positions.length, 0);
assert.equal(incomplete.coverage.reachedEnd, false);

const objectOwned = await scanSuiDexV3TreeLp({
  scanPositions: async () => ({
    reachedEnd: true,
    pages: 1,
    nodes: [positionNode({ id: `0x${'6'.repeat(64)}`, ownerKind: 'ObjectOwner', liquidity: '1000' })],
  }),
  getPoolObject: async () => poolObject,
});
assert.equal(objectOwned.outcome, 'verification-incomplete');
assert.equal(objectOwned.positions.length, 0);
assert.equal(objectOwned.coverage.nonAddressOwnedTreePositions, 1);

console.log('SuiDex V3 TREE LP provider: PASS (Q64 principal math, global filtering, exclusions, reconciliation, fail closed)');
