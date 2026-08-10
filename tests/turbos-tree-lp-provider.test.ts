import assert from 'node:assert/strict';
import {
  CLMM_Q64,
  amountsForLiquidityQ64,
  tickToSqrtPriceQ64,
} from '../netlify/lib/clmm-q64.ts';
import {
  TURBOS_PACKAGE,
  TURBOS_POOL_POSITION_VALUE_TYPE,
  TURBOS_POSITION_TYPE,
  TURBOS_TREE_POOL_IDS,
  scanTurbosTreeLp,
} from '../netlify/lib/turbos-tree-lp-provider.ts';

const tree = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const sui = '0x2::sui::SUI';
const fee = `${TURBOS_PACKAGE}::fee10000bps::FEE10000BPS`;
assert.equal(TURBOS_TREE_POOL_IDS.length, 5);
assert.equal(new Set(TURBOS_TREE_POOL_IDS).size, 5);
assert.equal(TURBOS_POOL_POSITION_VALUE_TYPE, `${TURBOS_PACKAGE}::pool::Position`);

const poolId = `0x${'9'.repeat(64)}`;
const walletA = `0x${'a'.repeat(64)}`;
const zero = `0x${'0'.repeat(64)}`;

const toBits = (value: number) => value < 0 ? String(0x1_0000_0000 + value) : String(value);

function nftNode(options: {
  nftId: string;
  positionId: string;
  owner?: string;
  ownerKind?: string;
  tokenA?: string;
  tokenB?: string;
}) {
  return {
    address: options.nftId,
    owner: {
      __typename: options.ownerKind ?? 'AddressOwner',
      address: { address: options.owner ?? walletA },
    },
    asMoveObject: {
      contents: {
        json: {
          id: options.nftId,
          pool_id: poolId,
          position_id: options.positionId,
          coin_type_a: options.tokenA ?? tree,
          coin_type_b: options.tokenB ?? sui,
          fee_type: fee,
        },
      },
    },
  };
}

function positionObject(options: {
  positionId: string;
  liquidity: string;
  tickLower?: number;
  tickUpper?: number;
  owedTree?: string;
}) {
  return {
    type: TURBOS_POSITION_TYPE,
    json: {
      id: options.positionId,
      liquidity: options.liquidity,
      tick_lower_index: { bits: toBits(options.tickLower ?? -100) },
      tick_upper_index: { bits: toBits(options.tickUpper ?? 100) },
      tokens_owed_a: options.owedTree ?? '0',
      tokens_owed_b: '0',
    },
  };
}

const poolObject = {
  type: `${TURBOS_PACKAGE}::pool::Pool<${tree},${sui},${fee}>`,
  json: {
    id: poolId,
    sqrt_price: CLMM_Q64.toString(),
    tick_current_index: { bits: '0' },
    liquidity: '999999999999999999999999',
    coin_a: '999999999999999999999999',
    coin_b: '999999999999999999999999',
  },
};

const positionA1 = `0x${'1'.repeat(64)}`;
const positionA2 = `0x${'2'.repeat(64)}`;
const positionZero = `0x${'3'.repeat(64)}`;
const nodeA1 = nftNode({ nftId: `0x${'4'.repeat(64)}`, positionId: positionA1 });
const nodeA2 = nftNode({ nftId: `0x${'5'.repeat(64)}`, positionId: positionA2 });
const nodeZero = nftNode({ nftId: `0x${'6'.repeat(64)}`, positionId: positionZero, owner: zero });

const positionObjects = new Map([
  [positionA1, positionObject({ positionId: positionA1, liquidity: '1000000', owedTree: '7' })],
  [positionA2, positionObject({ positionId: positionA2, liquidity: '500000', tickLower: -50, tickUpper: 150 })],
  [positionZero, positionObject({ positionId: positionZero, liquidity: '250000', owedTree: '2' })],
]);

const result = await scanTurbosTreeLp({
  generatedAt: '2026-08-09T00:00:00.000Z',
  scanNfts: async () => ({
    treeNodes: [nodeA1, nodeA2, nodeZero],
    reachedEnd: true,
    pages: 1,
    objectsScanned: 3,
    malformedTypeObjects: 0,
    malformedObjectIds: 0,
    duplicateObjectIds: 0,
  }),
  getPoolObject: async (id) => {
    assert.equal(id, poolId);
    return poolObject;
  },
  getPositionObject: async (id) => positionObjects.get(id) || {},
});

assert.equal(result.outcome, 'complete');
assert.equal(result.positions.length, 1);
assert.equal(result.coverage.objectsScanned, 3);
assert.equal(result.coverage.treePositionNfts, 3);
assert.equal(result.coverage.addressOwnedTreePositions, 3);
assert.equal(result.coverage.nonAddressOwnedTreePositions, 0);
assert.equal(result.coverage.uniquePools, 1);
assert.equal(result.coverage.verifiedPools, 1);
assert.equal(result.coverage.verifiedPositions, 3);
assert.equal(result.coverage.excludedObjects, 1);
assert.equal(result.coverage.unclaimedTreeRawExcluded, '9');
assert.equal(result.coverage.reconciliationFailures, 0);

const expectedA1 = amountsForLiquidityQ64(
  CLMM_Q64,
  tickToSqrtPriceQ64(-100),
  tickToSqrtPriceQ64(100),
  1_000_000n,
).amountX;
const expectedA2 = amountsForLiquidityQ64(
  CLMM_Q64,
  tickToSqrtPriceQ64(-50),
  tickToSqrtPriceQ64(150),
  500_000n,
).amountX;
const expectedZero = amountsForLiquidityQ64(
  CLMM_Q64,
  tickToSqrtPriceQ64(-100),
  tickToSqrtPriceQ64(100),
  250_000n,
).amountX;

const wallet = result.positions[0];
assert.equal(wallet.wallet, walletA);
assert.equal(wallet.lpTreeRaw, (expectedA1 + expectedA2).toString());
assert.equal(wallet.positionCount, 2);
assert.equal(wallet.metadata?.principalOnly, true);
assert.equal(wallet.metadata?.unclaimedTreeRawExcluded, '7');
assert.equal(result.coverage.excludedPrincipalTreeRaw, expectedZero.toString());
assert.equal(result.coverage.aggregatePrincipalTreeRaw, (expectedA1 + expectedA2 + expectedZero).toString());

const malformedPositionId = `0x${'7'.repeat(64)}`;
const malformed = await scanTurbosTreeLp({
  scanNfts: async () => ({
    treeNodes: [nftNode({ nftId: `0x${'8'.repeat(64)}`, positionId: malformedPositionId })],
    reachedEnd: true,
    pages: 1,
    objectsScanned: 1,
    malformedTypeObjects: 0,
    malformedObjectIds: 0,
    duplicateObjectIds: 0,
  }),
  getPoolObject: async () => poolObject,
  getPositionObject: async () => positionObject({ positionId: malformedPositionId, liquidity: 'not-a-number' }),
});
assert.equal(malformed.outcome, 'verification-incomplete');
assert.equal(malformed.positions.length, 0);
assert.equal(malformed.coverage.malformedObjects, 1);

const incomplete = await scanTurbosTreeLp({
  scanNfts: async () => ({
    treeNodes: [nodeA1],
    reachedEnd: false,
    pages: 2_000,
    objectsScanned: 100_000,
    malformedTypeObjects: 0,
    malformedObjectIds: 0,
    duplicateObjectIds: 0,
  }),
  getPoolObject: async () => poolObject,
  getPositionObject: async () => positionObjects.get(positionA1)!,
});
assert.equal(incomplete.outcome, 'verification-incomplete');
assert.equal(incomplete.positions.length, 0);
assert.equal(incomplete.coverage.reachedEnd, false);

const objectOwnedPositionId = `0x${'b'.repeat(64)}`;
const objectOwned = await scanTurbosTreeLp({
  scanNfts: async () => ({
    treeNodes: [nftNode({
      nftId: `0x${'c'.repeat(64)}`,
      positionId: objectOwnedPositionId,
      ownerKind: 'ObjectOwner',
    })],
    reachedEnd: true,
    pages: 1,
    objectsScanned: 1,
    malformedTypeObjects: 0,
    malformedObjectIds: 0,
    duplicateObjectIds: 0,
  }),
  getPoolObject: async () => poolObject,
  getPositionObject: async () => positionObject({ positionId: objectOwnedPositionId, liquidity: '1000' }),
});
assert.equal(objectOwned.outcome, 'verification-incomplete');
assert.equal(objectOwned.positions.length, 0);
assert.equal(objectOwned.coverage.nonAddressOwnedTreePositions, 1);

const lowReservePositionId = `0x${'d'.repeat(64)}`;
const lowReserve = await scanTurbosTreeLp({
  scanNfts: async () => ({
    treeNodes: [nftNode({ nftId: `0x${'e'.repeat(64)}`, positionId: lowReservePositionId })],
    reachedEnd: true,
    pages: 1,
    objectsScanned: 1,
    malformedTypeObjects: 0,
    malformedObjectIds: 0,
    duplicateObjectIds: 0,
  }),
  getPoolObject: async () => ({
    ...poolObject,
    json: { ...poolObject.json, coin_a: '1', coin_b: '1' },
  }),
  getPositionObject: async () => positionObject({ positionId: lowReservePositionId, liquidity: '1000000' }),
});
assert.equal(lowReserve.outcome, 'verification-incomplete');
assert.equal(lowReserve.positions.length, 0);
assert.equal(lowReserve.coverage.reconciliationFailures, 1);

console.log('Turbos TREE LP provider: PASS (full NFT attribution, exact Q64 principal math, exclusions, reconciliation, fail closed)');
