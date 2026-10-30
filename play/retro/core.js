export const ENGINE = 'emulatorjs-4.2.3-fceumm';
export const MAX_ROM_BYTES = 16 * 1024 * 1024;
export const MAX_STATE_BYTES = 8 * 1024 * 1024;

export function inspectRom(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > MAX_ROM_BYTES) throw new Error('Choose an NES ROM smaller than 16 MB.');
  if (bytes.length < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
    throw new Error('This is not an NES ROM. Choose an uncompressed .nes file.');
  }
  const nes2 = (bytes[7] & 12) === 8;
  const size = (low, high, unit) => high === 15 ? 2 ** (low >> 2) * ((low & 3) * 2 + 1) : (low + (high << 8)) * unit;
  const prg = size(bytes[4], nes2 ? bytes[9] & 15 : 0, 16384);
  const chr = size(bytes[5], nes2 ? bytes[9] >> 4 : 0, 8192);
  const expected = 16 + ((bytes[6] & 4) ? 512 : 0) + prg + chr;
  if (!prg || !Number.isSafeInteger(expected) || expected > MAX_ROM_BYTES || bytes.length < expected) {
    throw new Error('This ROM is incomplete or its NES header is invalid. Choose a complete .nes file.');
  }
  return { bytes, mapper: (bytes[6] >> 4) | (bytes[7] & 0xf0) | (nes2 ? (bytes[8] & 15) << 8 : 0), nes2 };
}

export async function sha256(bytes) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2, '0')).join('');
}

export function cleanName(name) {
  return String(name).replace(/\.nes$/i, '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || 'My NES game';
}

export async function makeBackup(bytes, romHash, title) {
  const state = new Uint8Array(bytes);
  if (!state.length || state.length > MAX_STATE_BYTES) throw new Error('The save could not be exported. Try saving again.');
  const parts = [];
  for (let i = 0; i < state.length; i += 32768) parts.push(String.fromCharCode(...state.subarray(i, i + 32768)));
  return { format: 'TREE_RETRO_SAVE', version: 1, engine: ENGINE, romHash, title: cleanName(title), savedAt: new Date().toISOString(), stateHash: await sha256(state), state: btoa(parts.join('')) };
}

export async function readBackup(text, romHash) {
  if (text.length > MAX_STATE_BYTES * 1.4 + 4096) throw new Error('This save file is too large.');
  let save;
  try { save = JSON.parse(text); } catch { throw new Error('Choose a TREE save exported from this arcade.'); }
  if (save?.format !== 'TREE_RETRO_SAVE' || save.version !== 1 || save.engine !== ENGINE) throw new Error('This save uses a different emulator version. Choose a save from this arcade preview.');
  if (save.romHash !== romHash) throw new Error('This save belongs to a different game or ROM version. Load the matching ROM first.');
  if (typeof save.state !== 'string' || !save.state.length || save.state.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(save.state)) throw new Error('The save file is damaged.');
  let bytes;
  try { bytes = Uint8Array.from(atob(save.state), c => c.charCodeAt(0)); } catch { throw new Error('The save file is damaged.'); }
  if (!bytes.length || bytes.length > MAX_STATE_BYTES || await sha256(bytes) !== save.stateHash) throw new Error('The save file is damaged or incomplete.');
  return bytes;
}
