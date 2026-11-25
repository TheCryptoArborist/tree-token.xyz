import test from 'node:test';
import assert from 'node:assert/strict';
import { RIBBONS, ribbonDimensions, drawRibbon } from '../scripts/profile-ribbons.js';

test('all six requested ribbons preserve their exact messages', () => {
  assert.deepEqual(RIBBONS.map(({ id, label, secondary }) => ({ id, label, ...(secondary ? { secondary } : {}) })), [
    { id: 'christmas', label: 'Merry Christmas' },
    { id: 'thanksgiving', label: 'Happy Thanksgiving' },
    { id: 'holidays', label: 'Happy Holidays' },
    { id: 'website', label: 'Tree-Token.xyz' },
    { id: 'buy-tree', label: 'Buy Tree' },
    { id: 'nftrees', label: 'NFTrees', secondary: 'Grow Your Grove' },
  ]);
  assert.equal(new Set(RIBBONS.map(ribbon => ribbon.id)).size, 6);
  assert(RIBBONS.every(ribbon => ['oak', 'evergreen'].includes(ribbon.tree)), 'every design has an illustrated tree style');
});

test('the full size-control range retains a wide readable ribbon aspect ratio', () => {
  for (const width of [420, 500, 650, 740, 820]) {
    const dimensions = ribbonDimensions(width);
    assert.equal(dimensions.w, width);
    assert(Number.isFinite(dimensions.h) && dimensions.h > 0);
    assert(dimensions.w / dimensions.h >= 4.6 && dimensions.w / dimensions.h <= 5);
  }
  assert.deepEqual(ribbonDimensions(), ribbonDimensions(650));
});

test('small gallery render sizes and invalid sizing inputs stay finite', () => {
  assert.equal(ribbonDimensions(240).w, 240);
  for (const width of [NaN, Infinity, -100, 0, undefined, 'invalid']) {
    assert.deepEqual(ribbonDimensions(width), ribbonDimensions(650));
  }
});

test('unknown designs and invalid bounds do not touch the drawing context', () => {
  const context = new Proxy({}, { get() { throw Error('invalid render touched the canvas'); } });
  assert.equal(drawRibbon(context, 'missing', { x: 0, y: 0, w: 650, h: 130 }), false);
  for (const placement of [null, { x: NaN, y: 0, w: 650, h: 130 }, { x: 0, y: 0, w: 0, h: 130 }, { x: 0, y: 0, w: 650, h: Infinity }]) {
    assert.equal(drawRibbon(context, 'website', placement), false);
  }
});
