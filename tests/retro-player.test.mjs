import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { ENGINE, MAX_ROM_BYTES, inspectRom, sha256, makeBackup, readBackup } from '../play/retro/core.js';
import { retroPreviewFiles } from '../scripts/retro-preview-files.mjs';

const root = new URL('../', import.meta.url);
const rom = new Uint8Array(readFileSync(new URL('play/retro/games/falling.nes', root)));
const catalog = JSON.parse(readFileSync(new URL('play/retro/catalog.json', root)));

test('the distributed test game matches its recorded identity and declared ROM size', async () => {
  assert.equal(await sha256(rom), catalog.games[0].sha256);
  assert.equal(inspectRom(rom).mapper, 0);
  assert.equal(inspectRom(rom).nes2, false);
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

test('preview inventory includes every shipped retro file and pinned third-party bytes', async () => {
  const dir = new URL('play/retro/', root);
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => 'play/retro/' + e.parentPath.split('/play/retro/')[1] + '/' + e.name).map(s => s.replace('undefined/', '').replace('play/retro//','play/retro/')).sort();
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
