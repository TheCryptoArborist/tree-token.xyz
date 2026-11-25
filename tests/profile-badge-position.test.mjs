import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeDimensions, defaultBadgePosition, constrainBadgePosition } from '../scripts/profile-badge-position.js';

const close = (actual, expected, tolerance = 1e-7) => assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
function assertCornersInside(position, w, h, radius = 490) {
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const corner = { x: position.x + sx * w / 2, y: position.y + sy * h / 2 };
    assert(Math.hypot(corner.x, corner.y) <= radius + 1e-7, 'an artwork corner escapes the social crop');
  }
}

test('artwork retains its aspect ratio while medallions retain a square drawing area', () => {
  assert.deepEqual(badgeDimensions(320, 320, 280), { w: 280, h: 280, size: 280 });
  assert.deepEqual(badgeDimensions(1200, 600, 340), { w: 340, h: 170, size: 340 });
  assert.deepEqual(badgeDimensions(200, 400, 200), { w: 100, h: 200, size: 200 });
  assert.deepEqual(badgeDimensions(600, 1200, 280, true), { w: 280, h: 280, size: 280 });
});

test('reset preserves the existing bottom position and per-artwork lift', () => {
  const standard = defaultBadgePosition({ w: 280, h: 280 });
  close(standard.x, 0);
  close(standard.y, 319.5742752749558);
  const lifted = defaultBadgePosition({ w: 280, h: 280, lift: 72 });
  close(lifted.y, 247.5742752749558);
  assertCornersInside(standard, 280, 280);
  assertCornersInside(lifted, 280, 280);
});

test('an already visible badge stays exactly where the user placed it', () => {
  const options = { x: 85.25, y: -47.75, w: 200, h: 280 };
  assert.deepEqual(constrainBadgePosition(options), { x: options.x, y: options.y });
  assert.deepEqual(options, { x: 85.25, y: -47.75, w: 200, h: 280 });
});

test('dragging rectangular artwork toward any edge keeps every corner visible', () => {
  for (const [w, h] of [[200, 200], [340, 340], [340, 170], [95, 340]]) {
    for (const [x, y] of [[900, 0], [-900, 0], [0, 900], [0, -900], [800, 800], [-800, 800], [-800, -800], [800, -800], [100, 2000]]) {
      const actual = constrainBadgePosition({ x, y, w, h });
      assertCornersInside(actual, w, h);
      close(actual.x * y - actual.y * x, 0, 1e-6);
      assert(actual.x * x + actual.y * y > 0, 'projection stays in the requested direction');
      const farthest = Math.max(...[-1, 1].flatMap(sx => [-1, 1].map(sy => Math.hypot(actual.x + sx * w / 2, actual.y + sy * h / 2))));
      assert(farthest > 489.999, 'clamping should use the available space');
    }
  }
});

test('circular medallions can approach the rim without clipping their circle', () => {
  for (const size of [200, 280, 340]) {
    for (const [x, y] of [[1000, 0], [-1000, 0], [0, 1000], [0, -1000], [1000, 1000]]) {
      const actual = constrainBadgePosition({ x, y, w: size, h: size, medallion: true });
      assert(Math.hypot(actual.x, actual.y) + size / 2 <= 490 + 1e-7);
      close(Math.hypot(actual.x, actual.y) + size / 2, 490);
    }
  }
  const circle = constrainBadgePosition({ x: 1000, y: 1000, w: 280, h: 280, medallion: true });
  const artwork = constrainBadgePosition({ x: 1000, y: 1000, w: 280, h: 280 });
  assert(Math.hypot(circle.x, circle.y) > Math.hypot(artwork.x, artwork.y), 'a medallion does not reserve invisible square corners');
});

test('enlarging a badge at the rim moves only its center inward enough to fit', () => {
  const small = constrainBadgePosition({ x: -1000, y: 700, w: 200, h: 120 });
  const resized = constrainBadgePosition({ ...small, w: 340, h: 204 });
  assertCornersInside(resized, 340, 204);
  assert(Math.hypot(resized.x, resized.y) < Math.hypot(small.x, small.y));
  close(resized.x * small.y - resized.y * small.x, 0);
  assert.deepEqual(constrainBadgePosition({ ...resized, w: 340, h: 204 }), resized, 'repeated renders do not move a clamped badge');
});

test('custom crop radii and extreme finite pointer positions remain safe', () => {
  for (const radius of [300, 450, 496]) {
    const actual = constrainBadgePosition({ x: Number.MAX_VALUE, y: -Number.MAX_VALUE, w: 280, h: 200, radius });
    assert(Number.isFinite(actual.x) && Number.isFinite(actual.y));
    assertCornersInside(actual, 280, 200, radius);
  }
});

test('invalid input and impossible sizes never produce NaN or infinite positions', () => {
  for (const options of [
    { x: NaN, y: Infinity, w: 280, h: 280 },
    { x: 1000, y: 500, w: NaN, h: Infinity, radius: NaN },
    { x: 10, y: 20, w: 2000, h: 2000 },
    { x: 0, y: 0, w: -1, h: -1 },
  ]) {
    const actual = constrainBadgePosition(options);
    assert(Number.isFinite(actual.x) && Number.isFinite(actual.y));
  }
  const reset = defaultBadgePosition({ w: 280, h: 280, lift: Number.MAX_VALUE });
  assertCornersInside(reset, 280, 280);
  for (const value of Object.values(badgeDimensions(NaN, Infinity, NaN))) assert(Number.isFinite(value));
});
