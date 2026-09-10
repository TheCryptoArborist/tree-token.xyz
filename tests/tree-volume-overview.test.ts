import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVolumeTransaction, TREE_VOLUME_SOURCES, TURBOS_EVENT_PACKAGE } from '../netlify/lib/tree-volume-overview.ts';
import { SUIDEX_V2_PACKAGE } from '../netlify/lib/suidex-v2-tree-lp-provider.ts';
import { SUIDEX_V3_PACKAGE } from '../netlify/lib/suidex-v3-tree-lp-provider.ts';

const now = Date.parse('2026-08-18T20:00:00Z');
const prices = { suiUsd: 0.5, usdcUsd: 1, wbtcUsd: 60_000 };
const node = (type: string, json: object) => ({ effects: { status: 'SUCCESS', timestamp: '2026-08-18T19:00:00Z', events: { pageInfo: { hasNextPage: false }, nodes: [{ contents: { type: { repr: type }, json } }] } } });

test('values SuiDex V2 SUI/TREE swap events from the SUI side', () => {
  const source = TREE_VOLUME_SOURCES[0];
  const result = parseVolumeTransaction(node(`${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>`, { amount0_in: '3000000000', amount0_out: '0' }), source, prices, now - 86_400_000, now);
  assert.deepEqual(result, { timestamp: Date.parse('2026-08-18T19:00:00Z'), volumeUsd: 1.5, swaps: 1 });
});

test('values SuiDex V3 and Turbos events without mixing pools', () => {
  const v3 = TREE_VOLUME_SOURCES[1];
  assert.equal(parseVolumeTransaction(node(`${SUIDEX_V3_PACKAGE}::trade::SwapEvent`, { pool_id: v3.poolId, amount_x: '2000000000' }), v3, prices, now - 86_400_000, now)?.volumeUsd, 1);
  const turbos = TREE_VOLUME_SOURCES[3];
  assert.equal(parseVolumeTransaction(node(`${TURBOS_EVENT_PACKAGE}::pool::SwapEvent`, { pool: turbos.poolId, amount_b: '4000000000' }), turbos, prices, now - 86_400_000, now)?.volumeUsd, 2);
  assert.equal(parseVolumeTransaction(node(`${TURBOS_EVENT_PACKAGE}::pool::SwapEvent`, { pool: TREE_VOLUME_SOURCES[2].poolId, amount_b: '4000000000' }), turbos, prices, now - 86_400_000, now), null);
});

test('rejects failed and out-of-window transactions', () => {
  const source = TREE_VOLUME_SOURCES[0];
  const failed = node(`${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>`, { amount0_in: '1', amount0_out: '0' });
  failed.effects.status = 'FAILURE';
  assert.equal(parseVolumeTransaction(failed, source, prices, now - 86_400_000, now), null);
  assert.equal(parseVolumeTransaction(node(`${SUIDEX_V2_PACKAGE}::pair::Swap<0x2::sui::SUI,0x6c5::tree::TREE>`, { amount0_in: '1', amount0_out: '0' }), source, prices, now, now + 1), null);
});
