import assert from 'node:assert/strict';
import test from 'node:test';
import { collectVolumeEventPages, parseVolumeTransaction, TREE_VOLUME_SOURCES, TURBOS_EVENT_PACKAGE } from '../netlify/lib/tree-volume-overview.ts';
import { SUIDEX_V2_PACKAGE } from '../netlify/lib/suidex-v2-tree-lp-provider.ts';
import { SUIDEX_V3_PACKAGE } from '../netlify/lib/suidex-v3-tree-lp-provider.ts';
import { CETUS_CLMM_PACKAGE } from '../netlify/lib/cetus-tree-constants.ts';

const now = Date.parse('2026-08-18T20:00:00Z');
const prices = { suiUsd: 0.5, usdcUsd: 1, wbtcUsd: 60_000 };
const node = (type: string, json: object) => ({ effects: { status: 'SUCCESS', timestamp: '2026-08-18T19:00:00Z', events: { pageInfo: { hasNextPage: false }, nodes: [{ contents: { type: { repr: type }, json } }] } } });

test('values SuiDex V2 SUI/TREE swap events from the SUI side', () => {
  const source = TREE_VOLUME_SOURCES.find((item) => item.venue === 'suiDexV2')!;
  const result = parseVolumeTransaction(node(`${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>`, { amount0_in: '3000000000', amount0_out: '0' }), source, prices, now - 86_400_000, now);
  assert.deepEqual(result, { timestamp: Date.parse('2026-08-18T19:00:00Z'), volumeUsd: 1.5, swaps: 1 });
});

test('values SuiDex V3 and Turbos events without mixing pools', () => {
  const v3 = TREE_VOLUME_SOURCES.find((item) => item.venue === 'suiDexV3')!;
  assert.equal(parseVolumeTransaction(node(`${SUIDEX_V3_PACKAGE}::trade::SwapEvent`, { pool_id: v3.poolId, amount_x: '2000000000' }), v3, prices, now - 86_400_000, now)?.volumeUsd, 1);
  const turbos = TREE_VOLUME_SOURCES.find((item) => item.venue === 'turbos' && item.quote === 'sui')!;
  assert.equal(parseVolumeTransaction(node(`${TURBOS_EVENT_PACKAGE}::pool::SwapEvent`, { pool: turbos.poolId, amount_b: '4000000000' }), turbos, prices, now - 86_400_000, now)?.volumeUsd, 2);
  const otherPool = TREE_VOLUME_SOURCES.find((item) => item.venue === 'turbos' && item.poolId !== turbos.poolId)!;
  assert.equal(parseVolumeTransaction(node(`${TURBOS_EVENT_PACKAGE}::pool::SwapEvent`, { pool: otherPool.poolId, amount_b: '4000000000' }), turbos, prices, now - 86_400_000, now), null);
});

test('values Cetus TREE/SUI events from the SUI side in either direction', () => {
  const cetus = TREE_VOLUME_SOURCES.find((item) => item.venue === 'cetus')!;
  assert.equal(parseVolumeTransaction(node(`${CETUS_CLMM_PACKAGE}::pool::SwapEvent`, { pool: cetus.poolId, atob: false, amount_in: '6000000000', amount_out: '1' }), cetus, prices, now - 86_400_000, now)?.volumeUsd, 3);
  assert.equal(parseVolumeTransaction(node(`${CETUS_CLMM_PACKAGE}::pool::SwapEvent`, { pool: cetus.poolId, atob: true, amount_in: '1', amount_out: '8000000000' }), cetus, prices, now - 86_400_000, now)?.volumeUsd, 4);
});

test('rejects failed and out-of-window transactions', () => {
  const source = TREE_VOLUME_SOURCES.find((item) => item.venue === 'suiDexV2')!;
  const failed = node(`${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>`, { amount0_in: '1', amount0_out: '0' });
  failed.effects.status = 'FAILURE';
  assert.equal(parseVolumeTransaction(failed, source, prices, now - 86_400_000, now), null);
  assert.equal(parseVolumeTransaction(node(`${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>`, { amount0_in: '1', amount0_out: '0' }), source, prices, now, now + 1), null);
});

test('paginates beyond 50 transaction events before calculating volume', async () => {
  const source = TREE_VOLUME_SOURCES.find((item) => item.venue === 'suiDexV2')!;
  const filler = Array.from({ length: 50 }, (_, index) => ({ contents: { type: { repr: `0x2::unrelated::Event${index}` }, json: {} } }));
  const swap = { contents: { type: { repr: `${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>` }, json: { amount0_in: '7000000000', amount0_out: '0' } } };
  const cursors: string[] = [];
  const complete = await collectVolumeEventPages({ nodes: filler, pageInfo: { hasNextPage: true, endCursor: 'event-50' } }, async (after) => {
    cursors.push(after);
    return { nodes: [swap], pageInfo: { hasNextPage: false, endCursor: 'event-51' } };
  });
  assert.deepEqual(cursors, ['event-50']);
  assert.equal(complete.pages, 2);
  assert.equal(complete.nodes.length, 51);
  const result = parseVolumeTransaction({ effects: { status: 'SUCCESS', timestamp: '2026-08-18T19:00:00Z', events: { nodes: complete.nodes, pageInfo: { hasNextPage: false } } } }, source, prices, now - 86_400_000, now);
  assert.deepEqual(result, { timestamp: Date.parse('2026-08-18T19:00:00Z'), volumeUsd: 3.5, swaps: 1 });
});

test('fails closed when an event cursor repeats', async () => {
  await assert.rejects(
    collectVolumeEventPages({ nodes: [], pageInfo: { hasNextPage: true, endCursor: 'repeat' } }, async () => ({ nodes: [], pageInfo: { hasNextPage: true, endCursor: 'repeat' } })),
    /cursor was missing or repeated/,
  );
});
