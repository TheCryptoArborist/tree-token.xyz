import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUI_TYPE, SUIDEX_V2_TREE_POOL, SUIDEX_V3_TREE_POOL, TREE_TYPE,
  TURBOS_SUI_TREE_FEE_TYPE, TURBOS_SUI_TREE_POOL,
} from '../netlify/lib/tree-swap-route.ts';
import { fetchFinalizedTreeBuy, verifyFinalizedTreeBuyNode } from '../netlify/lib/tree-raffle-buy-verifier.ts';

const DIGEST = '8tpE6r1DwhuNztu48WmZu8GjLH3kDCXuruWbBbxsvc5';
const BUYER = `0x${'18'.repeat(32)}`;
const V2 = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
const V3 = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
const TURBOS = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';
const TURBOS_EVENT = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';

function node(route: 'suidex-v2' | 'suidex-v3' | 'turbos') {
  const input = '2500000000';
  const output = '88412615496';
  const setup = route === 'suidex-v2' ? {
    pool: SUIDEX_V2_TREE_POOL,
    call: { package: V2, module: 'router', function: 'swap_exact_tokens0_for_tokens1', typeArguments: [SUI_TYPE, TREE_TYPE] },
    event: { sender: { address: BUYER }, contents: { type: { repr: `${V2}::pair::Swap<${SUI_TYPE}, ${TREE_TYPE}>` }, json: { sender: BUYER, amount0_in: input, amount1_in: '0', amount0_out: '0', amount1_out: output } } },
  } : route === 'suidex-v3' ? {
    pool: SUIDEX_V3_TREE_POOL,
    call: { package: V3, module: 'trade', function: 'flash_swap', typeArguments: [SUI_TYPE, TREE_TYPE] },
    event: { sender: { address: BUYER }, contents: { type: { repr: `${V3}::trade::SwapEvent` }, json: { pool_id: SUIDEX_V3_TREE_POOL, sender: BUYER, x_for_y: true, amount_x: input, amount_y: output } } },
  } : {
    pool: TURBOS_SUI_TREE_POOL,
    call: { package: TURBOS, module: 'swap_router', function: 'swap_b_a', typeArguments: [TREE_TYPE, SUI_TYPE, TURBOS_SUI_TREE_FEE_TYPE] },
    event: { sender: { address: BUYER }, contents: { type: { repr: `${TURBOS_EVENT}::pool::SwapEvent` }, json: { pool: TURBOS_SUI_TREE_POOL, recipient: BUYER, a_to_b: false, is_exact_in: true, amount_a: output, amount_b: input } } },
  };
  return {
    digest: DIGEST,
    sender: { address: BUYER },
    transactionJson: { inputs: [setup.pool], commands: [{ MoveCall: setup.call }] },
    effects: {
      status: 'SUCCESS', timestamp: '2026-08-17T04:30:00.000Z', checkpoint: { sequenceNumber: '123456' },
      events: { pageInfo: { hasNextPage: false }, nodes: [setup.event] },
      balanceChanges: { pageInfo: { hasNextPage: false }, nodes: [
        { owner: { address: BUYER }, coinType: { repr: SUI_TYPE }, amount: '-2501234567' },
        { owner: { address: BUYER }, coinType: { repr: TREE_TYPE }, amount: output },
      ] },
    },
  };
}

for (const route of ['suidex-v2', 'suidex-v3', 'turbos'] as const) {
  test(`accepts one finalized direct ${route} SUI-to-TREE buy`, () => {
    assert.deepEqual(verifyFinalizedTreeBuyNode(node(route), DIGEST), {
      txDigest: DIGEST, buyer: BUYER, route, suiSpentRaw: '2500000000', treeAmountRaw: '88412615496',
      finalizedCheckpoint: 123456, finalizedAt: '2026-08-17T04:30:00.000Z', raffleDate: '2026-08-17',
    });
  });
}

test('rejects a V3 zap even though it contains a valid internal swap', () => {
  const zap = node('suidex-v3');
  zap.transactionJson.commands.push({ MoveCall: { package: V3, module: 'liquidity', function: 'add_liquidity', typeArguments: [SUI_TYPE, TREE_TYPE] } });
  zap.effects.events.nodes.push({ sender: { address: BUYER }, contents: { type: { repr: `${V3}::liquidity::AddLiquidityEvent` }, json: {} } });
  assert.throws(() => verifyFinalizedTreeBuyNode(zap), /Liquidity, zap/);
});

test('rejects V2 LP minting, multi-route calls, incomplete pages, and failed transactions', () => {
  const mint = node('suidex-v2');
  mint.effects.events.nodes.push({ contents: { type: { repr: `${V2}::pair::LPMint` }, json: {} } });
  assert.throws(() => verifyFinalizedTreeBuyNode(mint), /Liquidity, zap/);

  const multi = node('suidex-v3');
  multi.transactionJson.commands.push({ MoveCall: { package: V2, module: 'router', function: 'swap_exact_tokens0_for_tokens1', typeArguments: [SUI_TYPE, TREE_TYPE] } });
  assert.throws(() => verifyFinalizedTreeBuyNode(multi), /exactly one/);

  const paged = node('turbos');
  paged.effects.events.pageInfo.hasNextPage = true;
  assert.throws(() => verifyFinalizedTreeBuyNode(paged), /page limit/);

  const failed = node('suidex-v3');
  failed.effects.status = 'FAILURE';
  assert.throws(() => verifyFinalizedTreeBuyNode(failed), /successful finalized/);
});

test('rejects wrong pools and unreconciled sender balances', () => {
  const wrongPool = node('suidex-v2');
  wrongPool.transactionJson.inputs = [`0x${'0'.repeat(64)}`];
  assert.throws(() => verifyFinalizedTreeBuyNode(wrongPool), /exact allowlisted/);
  const wrongBalance = node('suidex-v3');
  wrongBalance.effects.balanceChanges.nodes[1].amount = '1';
  assert.throws(() => verifyFinalizedTreeBuyNode(wrongBalance), /do not reconcile/);
});

test('fetcher sends only the digest and verifies the independently fetched transaction', async () => {
  let body = '';
  const result = await fetchFinalizedTreeBuy(DIGEST, { fetchImpl: (async (_url, init) => {
    body = String(init?.body);
    return Response.json({ data: { transaction: node('suidex-v3') } });
  }) as typeof fetch });
  assert.equal(JSON.parse(body).variables.digest, DIGEST);
  assert.equal(result.route, 'suidex-v3');
});
