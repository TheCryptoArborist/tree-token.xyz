import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RIBBONS, ribbonDimensions, defaultRibbonPosition,
  constrainRibbonPosition, drawRibbon,
} from '../scripts/profile-ribbons-v2.js';

// Independently sample the actual painted sector in design coordinates. The
// renderer clips all strokes, tails, leaves and lettering to these curved
// edges; checking the rectangular corners would reject valid rim placements.
function sampledDistance(position, width, direction, samples = 880) {
  const scale = width / 960;
  let greatest = 0;
  for (let index = 0; index <= samples; index++) {
    const angle = (-55 + 110 * index / samples) * Math.PI / 180;
    for (const radius of [480, 502.5, 525, 547.5, 570]) {
      const localX = radius * Math.sin(angle);
      const localY = 420 - radius * Math.cos(angle);
      const x = position.x + localX * scale;
      const y = position.y + (direction === 'bottom' ? -localY : localY) * scale;
      greatest = Math.max(greatest, Math.hypot(x, y));
    }
  }
  return greatest;
}

test('the six designs retain the exact requested messages', () => {
  assert.deepEqual(RIBBONS.map(({ id, label, secondary }) => ({ id, label, ...(secondary ? { secondary } : {}) })), [
    { id: 'christmas', label: 'Merry Christmas' },
    { id: 'thanksgiving', label: 'Happy Thanksgiving' },
    { id: 'holidays', label: 'Happy Holidays' },
    { id: 'website', label: 'Tree-Token.xyz' },
    { id: 'buy-tree', label: 'Buy Tree' },
    { id: 'nftrees', label: 'NFTrees', secondary: 'Grow Your Grove' },
  ]);
  assert.equal(new Set(RIBBONS.map(ribbon => ribbon.id)).size, 6);
});

test('the default aligns the annulus with the profile circle at every supported width', () => {
  assert.deepEqual(ribbonDimensions(), { w: 760, h: 285 });
  assert.deepEqual(defaultRibbonPosition(), { x: 0, y: -332.5 });
  assert.deepEqual(defaultRibbonPosition({ direction: 'bottom' }), { x: 0, y: 332.5 });
  for (let width = 420; width <= 820; width += 20) {
    for (const direction of ['top', 'bottom']) {
      const position = defaultRibbonPosition({ width, direction });
      const greatest = sampledDistance(position, width, direction);
      assert(Math.abs(greatest - 570 * width / 960) < 1e-8);
      assert(greatest <= 490);
      assert.deepEqual(constrainRibbonPosition({ ...position, width, direction }), position);
    }
  }
  const { w, h } = ribbonDimensions();
  const position = defaultRibbonPosition();
  assert(Math.hypot(w / 2, position.y - h / 2) > 490,
    'transparent box corners must be allowed outside the circular crop');
});

test('free movement is constrained by dense curved edges at all supported widths', () => {
  const requests = [
    [1400, 0], [-1400, 0], [0, 1400], [0, -1400],
    [1400, 1400], [-1400, 1400], [1400, -1400], [-1400, -1400],
    [600, 90], [-600, 90], [90, -600], [-90, -600],
    [230, -400], [-230, 400],
  ];
  for (let width = 420; width <= 820; width += 20) {
    for (const direction of ['top', 'bottom']) {
      for (const [x, y] of requests) {
        const position = constrainRibbonPosition({ x, y, width, direction });
        const greatest = sampledDistance(position, width, direction);
        assert(greatest <= 490 + 1e-8, `${width}/${direction}/${x},${y}: ${greatest}`);
        assert(Number.isFinite(position.x) && Number.isFinite(position.y));
        assert(Math.abs(position.x * y - position.y * x) < 1e-7,
          'a constrained drag should retain its direction from the center');
        assert.deepEqual(constrainRibbonPosition({ ...position, width, direction }), position);
        if (position.x !== x || position.y !== y) {
          assert(greatest > 489.99, 'a clamped position reaches the painted edge, without a box-sized gap');
        }
      }
    }
  }
});

test('feasible edits stay unchanged and top/bottom movement is reflected exactly', () => {
  for (const width of [420, 650, 760, 820]) {
    for (const [x, y] of [[0, 0], [70, 0], [-70, 0], [0, 100], [0, -100]]) {
      assert(sampledDistance({ x, y }, width, 'top') < 490);
      assert.deepEqual(constrainRibbonPosition({ x, y, width }), { x, y });
    }
    for (const [x, y] of [[900, 80], [-300, -900], [70, 100], [0, -400]]) {
      const top = constrainRibbonPosition({ x, y, width, direction: 'top' });
      const bottom = constrainRibbonPosition({ x, y: -y, width, direction: 'bottom' });
      assert.equal(top.x, bottom.x);
      assert(Math.abs(top.y + bottom.y) < 1e-10);
    }
  }
});

test('smaller custom crops use the curved sector when a centered box is not feasible', () => {
  for (const direction of ['top', 'bottom']) {
    const position = constrainRibbonPosition({ x: 180, y: 700, width: 820, direction, radius: 400 });
    assert(sampledDistance(position, 820, direction) <= 400 + 1e-8);
    assert.deepEqual(constrainRibbonPosition({ ...position, width: 820, direction, radius: 400 }), position);
  }
});

test('invalid and extreme numeric inputs produce finite geometry', () => {
  for (const width of [NaN, Infinity, -100, 0, 'invalid', undefined]) {
    assert.deepEqual(ribbonDimensions(width), ribbonDimensions(760));
    assert.deepEqual(defaultRibbonPosition({ width }), defaultRibbonPosition());
  }
  assert.deepEqual(ribbonDimensions(240), { w: 240, h: 90 });
  for (const x of [NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE, 0]) {
    for (const y of [NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE, 0]) {
      const position = constrainRibbonPosition({ x, y, width: 820 });
      assert(Number.isFinite(position.x) && Number.isFinite(position.y));
      assert(sampledDistance(position, 820, 'top', 220) <= 490 + 1e-8);
    }
  }
  for (const width of [Number.MIN_VALUE, Number.MAX_VALUE]) {
    const position = constrainRibbonPosition({ x: 100, y: -100, width });
    assert(Number.isFinite(position.x) && Number.isFinite(position.y));
  }
});

test('invalid drawing inputs do not touch the canvas', () => {
  const context = new Proxy({}, { get() { throw Error('invalid render touched the canvas'); } });
  assert.equal(drawRibbon(context, 'missing', { x: 0, y: 0, w: 760, h: 285 }), false);
  for (const placement of [null, { x: NaN, y: 0, w: 760, h: 285 }, { x: 0, y: 0, w: 0, h: 285 }, { x: 0, y: 0, w: 760, h: Infinity }]) {
    assert.equal(drawRibbon(context, 'website', placement), false);
  }
});
