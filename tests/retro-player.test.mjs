import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE, MAX_ROM_BYTES, inspectRom, sha256, makeBackup, readBackup } from '../play/retro/core.js';
import { retroPreviewFiles } from '../scripts/retro-preview-files.mjs';

const root = new URL('../', import.meta.url);
const rom = new Uint8Array(readFileSync(new URL('play/retro/games/falling.nes', root)));
const catalog = JSON.parse(readFileSync(new URL('play/retro/catalog.json', root)));

test('every library ROM has a distinct identity, valid size, artwork, controls, and license', async () => {
  assert.equal(new Set(catalog.games.map(game => game.id)).size, catalog.games.length);
  assert.equal(new Set(catalog.games.map(game => game.sha256)).size, catalog.games.length, 'each game uses a separate save identity');
  const credits = readFileSync(new URL('play/retro/credits.html', root), 'utf8');
  for (const game of catalog.games) {
    const bytes = new Uint8Array(readFileSync(new URL(`play/retro/${game.rom.slice(2)}`, root)));
    assert.equal(await sha256(bytes), game.sha256, game.title);
    assert.ok([0, 1].includes(inspectRom(bytes).mapper), game.title);
    assert.match(game.controls, /Start/);
    assert.ok(game.source.includes(game.sourceCommit));
    assert.ok(readFileSync(new URL(`play/retro/${game.licenseFile.slice(2)}`, root)).length > 500);
    const artwork = readFileSync(new URL(`play/retro/${game.artwork.slice(2)}`, root));
    assert.equal(artwork.subarray(1, 4).toString(), 'PNG');
    assert.ok(credits.includes(`id="${game.id}"`), `${game.title} has visible attribution`);
  }
  assert.equal(await sha256(new Uint8Array(rom)), await sha256(rom), 'same bytes from either source keep one save identity');
});

test('bad, truncated, and oversized ROMs fail before entering the emulator', () => {
  assert.throws(() => inspectRom(new Uint8Array(0)), /not an NES/);
  assert.throws(() => inspectRom(new TextEncoder().encode('<html>not a game</html>')), /not an NES/);
  assert.throws(() => inspectRom(rom.slice(0, 30)), /incomplete/);
  assert.throws(() => inspectRom(new Uint8Array(MAX_ROM_BYTES + 1)), /16 MB/);
  const noPrg = new Uint8Array(rom); noPrg[4] = 0;
  assert.throws(() => inspectRom(noPrg), /invalid/);
});

test('NES 2.0 exponent sizes are bounded and trainer length is checked', () => {
  const small = new Uint8Array(16 + 16384); small.set([0x4e,0x45,0x53,0x1a]); small[4] = 56; small[7] = 8; small[9] = 15;
  assert.equal(inspectRom(small).nes2, true);
  small[6] = 4;
  assert.throws(() => inspectRom(small), /incomplete/);
  small[4] = 255;
  assert.throws(() => inspectRom(small), /invalid/);
});

test('backups round-trip exact state bytes with identity and checksum protection', async () => {
  const hash = await sha256(rom);
  const state = Uint8Array.from({ length: 135001 }, (_, i) => i % 256);
  const save = await makeBackup(state, hash, 'Falling');
  assert.equal(save.engine, ENGINE);
  assert.deepEqual(await readBackup(JSON.stringify(save), hash), state);
  await assert.rejects(readBackup(JSON.stringify(save), '0'.repeat(64)), /different game/);
  await assert.rejects(readBackup(JSON.stringify({ ...save, engine: 'other-engine' }), hash), /different emulator/);
  await assert.rejects(readBackup(JSON.stringify({ ...save, stateHash: '0'.repeat(64) }), hash), /damaged/);
  await assert.rejects(readBackup(JSON.stringify({ ...save, state: '***=' }), hash), /damaged/);
  await assert.rejects(readBackup('{}', hash), /different emulator/);
  await assert.rejects(readBackup('not JSON', hash), /TREE save/);
});

test('every library game runs, accepts input, and restores its exported state deterministically', async t => {
  const context = { module: { exports: {} }, exports: {}, console };
  runInNewContext(readFileSync(new URL('play/retro/vendor/jsnes-2.1.0/jsnes.min.js', root), 'utf8'), context);
  const { NES } = context.module.exports;
  for (const game of catalog.games) await t.test(game.title, async () => {
  const gameRom = new Uint8Array(readFileSync(new URL(`play/retro/${game.rom.slice(2)}`, root)));
  let frame;
  const nes = new NES({ emulateSound: false, onFrame: pixels => { frame = pixels; } });
  nes.loadROM(gameRom);
  for (let i = 0; i < 120; i++) nes.frame();
  nes.buttonDown(1, 3); nes.frame(); nes.buttonUp(1, 3);
  for (let i = 0; i < 60; i++) nes.frame();
  nes.buttonDown(1, 7); nes.buttonDown(1, 0);
  for (let i = 0; i < 12; i++) nes.frame();
  nes.buttonUp(1, 7); nes.buttonUp(1, 0);
  assert.ok(new Set(frame).size > 3, 'game renders a populated frame');
  const state = new TextEncoder().encode(JSON.stringify(nes.toJSON()));
  const hash = await sha256(gameRom);
  const backup = await makeBackup(state, hash, game.title);
  for (let i = 0; i < 12; i++) nes.frame();
  const expected = await sha256(new TextEncoder().encode(JSON.stringify(nes.toJSON())));
  const restored = new NES({ emulateSound: false });
  restored.loadROM(gameRom);
  restored.fromJSON(JSON.parse(new TextDecoder().decode(await readBackup(JSON.stringify(backup), hash))));
  for (let i = 0; i < 12; i++) restored.frame();
  assert.equal(await sha256(new TextEncoder().encode(JSON.stringify(restored.toJSON()))), expected);
  });
});

test('a long file dialog cannot create an unbounded frame catch-up queue', () => {
  const source = readFileSync(new URL('play/retro/vendor/jsnes-2.1.0/jsnes.min.js', root), 'utf8');
  const anchor = source.indexOf('this.lastFrameTime=!1');
  const start = source.lastIndexOf('class ', anchor);
  const end = source.indexOf('const St=', anchor);
  assert.ok(start >= 0 && end > start, 'the pinned runtime frame timer can be inspected');
  const queued = [];
  const context = { window: { requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} }, setTimeout: fn => queued.push(fn), console };
  runInNewContext(`const yt = false; this.Timer = ${source.slice(start, end)}`, context);
  let frames = 0;
  const timer = new context.Timer({ onGenerateFrame: () => frames++, onWriteFrame: () => {} });
  timer.start();
  timer.onAnimationFrame(100);
  timer.onAnimationFrame(10 * 60 * 1000);
  assert.equal(frames, 1);
  assert.ok(queued.length <= 2, 'at most two additional frames follow a long pause');
  for (const callback of queued) callback();
  assert.equal(frames, 3);
  timer.stop();
  timer.generateFrame();
  timer.onAnimationFrame(20 * 60 * 1000);
  assert.equal(frames, 3, 'paused callbacks do not change the saved game');
});

test('preview inventory includes every shipped retro file and pinned third-party bytes', async () => {
  const dir = new URL('play/retro/', root);
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => relative(fileURLToPath(root), join(e.parentPath, e.name))).sort();
  assert.deepEqual([...retroPreviewFiles].sort(), files);
  assert.equal(new Set(retroPreviewFiles).size, retroPreviewFiles.length);
  for (const path of retroPreviewFiles) assert.ok(path.startsWith('play/retro/') && !path.includes('..'));
  const thirdParty = JSON.parse(readFileSync(new URL('play/retro/third-party.json', root)));
  for (const entry of thirdParty.files) {
    const bytes = readFileSync(new URL(`play/retro/${entry.path}`, root));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(await sha256(bytes), entry.sha256, entry.path);
  }
});
