import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chooseFrame, animationFinished, nextFrame, drawHeroFrame, validateManifest, acceptMovementKey } from './viewer.mjs';

test('an action cancelling movement cannot be interrupted by a still-held key repeat', () => {
  for (const [held, key] of [
    [new Set(['ArrowRight']), 'ArrowRight'],
    [new Set(['d']), 'd'],
    [new Map([['keyboard-east', 'east']]), 'keyboard-east']
  ]) {
    assert.equal(acceptMovementKey(held, key, true), true, 'an active movement key may keep repeating');
    held.clear(); // Selecting Strike/Roots clears both canvas and D-pad held inputs.
    assert.equal(acceptMovementKey(held, key, true), false, 'a cancelled physical hold must not restart movement');
    assert.equal(acceptMovementKey(held, key, false), true, 'releasing and pressing again intentionally cancels the action');
  }
});

test('existing movement loops while one-shot actions hold their final frame', () => {
  const walk = { frames: [4, 5, 6, 7], fps: 8 };
  const strike = { frames: [0, 1, 2, 3], fps: 10, loop: false };
  assert.equal(chooseFrame(walk, .5), 4);
  assert.equal(chooseFrame(strike, .2), 2);
  assert.equal(chooseFrame(strike, .1, 2), 2);
  assert.equal(chooseFrame(strike, 100), 3);
  assert.equal(animationFinished(strike, .3), false, 'the final frame must have its own display time');
  assert.equal(animationFinished(strike, .4), true);
  assert.equal(animationFinished(walk, 100), false);
  assert.equal(chooseFrame(strike, 0), 0, 'resetting elapsed time replays from the first frame');
});

test('stepping preserves a final reaction pose and wraps a movement loop', () => {
  const hit = { frames: [8, 9, 10, 11], fps: 8, loop: false };
  assert.equal(nextFrame(hit, 9), 10);
  assert.equal(nextFrame(hit, 11), 11);
  assert.equal(nextFrame({ ...hit, loop: true }, 11), 8);
});

test('the original movement manifest remains loadable without combat frame indices', async () => {
  const raw = JSON.parse(await readFile(new URL('../assets/hero-sprites/animations.json', import.meta.url), 'utf8'));
  const manifest = validateManifest(raw);
  assert.equal(manifest.animations.idle.loop, true);
  assert.equal(manifest.animations.walk.loop, true);
  for (const direction of ['north', 'east', 'south', 'west']) {
    assert.equal(manifest.directions[direction].frames.length, 12);
    assert.equal(manifest.directions[direction].imageURL.pathname.endsWith(`hero-${direction}.png`), true);
  }
});

function combatFixture() {
  const frames = Array.from({ length: 16 }, (_, index) => ({ x: index % 4 * 320, y: Math.floor(index / 4) * 400, width: 320, height: 400, pivot: { x: 160, y: 350 } }));
  return {
    cell: { width: 320, height: 400 },
    animations: {
      strike: { frames: [0, 1, 2, 3], fps: 10, loop: false },
      cast: { frames: [4, 5, 6, 7], fps: 7, loop: false },
      hit: { frames: [8, 9, 10, 11], fps: 8, loop: false },
      defeat: { frames: [12, 13, 14, 15], fps: 5, loop: false }
    },
    directions: Object.fromEntries(['north', 'east', 'south', 'west'].map(name => [name, { file: `hero-${name}-combat.png`, bodyHeight: 350, scale: .95, frames }]))
  };
}
const combatURL = new URL('https://example.test/play/forestkingdoms/test/assets/hero-sprites/combat.json');
const actions = ['strike', 'cast', 'hit', 'defeat'];

test('combat keeps its own sheet, frame map, ground pivot, and scale', () => {
  const manifest = validateManifest(combatFixture(), combatURL, actions);
  const direction = manifest.directions.south;
  assert.equal(direction.imageURL.href, 'https://example.test/play/forestkingdoms/test/assets/hero-sprites/hero-south-combat.png');
  assert.equal(direction.bodyHeight, 350);
  assert.equal(direction.scale, .95);
  assert.equal(direction.frames.length, 16);
  assert.equal(manifest.animations.defeat.loop, false);
  assert.equal(chooseFrame(manifest.animations.defeat, 20), 15);
  let args;
  const image = { name: 'combat-sheet' };
  const frame = direction.frames[15];
  const bounds = drawHeroFrame({ drawImage(...input) { args = input; } }, image, frame, { x: 200, y: 300, height: 88, bodyHeight: direction.bodyHeight, scale: direction.scale });
  assert.equal(args[0], image);
  assert.deepEqual(args.slice(1, 5), [960, 1200, 320, 400]);
  assert.equal(bounds.pivotX, 200);
  assert.equal(bounds.pivotY, 300);
  assert.ok(Math.abs(bounds.height - 400 * 88 / 350 * .95) < 1e-9);
});

test('missing combat frames and artwork outside the asset directory are rejected', () => {
  const missing = combatFixture();
  missing.animations.defeat.frames.push(16);
  assert.throws(() => validateManifest(missing, combatURL, actions), /does not include every animation frame/);
  const escaped = combatFixture();
  escaped.directions.south.file = '../other.png';
  assert.throws(() => validateManifest(escaped, combatURL, actions), /must be included/);
});
