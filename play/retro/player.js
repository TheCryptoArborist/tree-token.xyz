import { ENGINE, MAX_STATE_BYTES, inspectRom, sha256 } from './core.js';
let session, rom, started = false, paused = false, browser;
const $ = id => document.getElementById(id);
const reply = (type, extra = {}) => parent.postMessage({ type, session, ...extra }, location.origin);
const pressed = new Map();
function releaseAll() {
  if (!browser) return;
  for (let i = 0; i < 8; i++) browser.nes.buttonUp(1, i);
  pressed.clear();
  document.querySelectorAll('.held').forEach(button => button.classList.remove('held'));
}
function pause(value) {
  if (!started) return;
  if (value !== paused) { value ? browser.stop() : browser.start(); paused = value; }
  if (value) releaseAll();
  reply('TREE_RETRO_PAUSED', { paused });
  $('playback-status').textContent = paused ? 'Paused · choose Continue below to play' : 'Playing · click or tap the game for keyboard control';
}
function failed(message) {
  browser?.stop();
  $('loading').hidden = false;
  $('loading-message').textContent = message;
  $('start-game').hidden = true;
  reply('TREE_RETRO_ERROR', { error: message });
}
$('start-game').addEventListener('click', () => {
  try {
    browser = new window.jsnes.Browser({ container: $('screen'), onError: error => failed(error.message || 'This ROM could not run. Try another game.') });
    browser.nes.opts.emulateSound = $('sound').checked;
    browser.loadROM(rom);
    started = true;
    $('loading').hidden = true;
    for (const button of document.querySelectorAll('[data-button], #restart')) button.disabled = false;
    $('screen').focus();
    reply('TREE_RETRO_STARTED', { engine: ENGINE });
  } catch (error) { browser?.destroy(); browser = null; failed(error.message || 'This game could not start.'); }
});
$('restart').addEventListener('click', () => {
  if (!started) return;
  browser.nes.reloadROM();
  pause(false);
  $('screen').focus();
});
$('sound').addEventListener('change', event => {
  if (browser) browser.nes.opts.emulateSound = event.target.checked;
});
for (const button of document.querySelectorAll('[data-button]')) {
  const number = Number(button.dataset.button);
  button.addEventListener('pointerdown', event => {
    if (!started) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (!pressed.has(number)) pressed.set(number, new Set());
    pressed.get(number).add(event.pointerId);
    browser.nes.buttonDown(1, number);
    button.classList.add('held');
  });
  const up = event => {
    const pointers = pressed.get(number);
    pointers?.delete(event.pointerId);
    if (!pointers?.size) { pressed.delete(number); browser?.nes.buttonUp(1, number); button.classList.remove('held'); }
  };
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, up);
  button.addEventListener('keydown', event => { if (['Enter',' '].includes(event.key) && started) { event.preventDefault(); browser.nes.buttonDown(1, number); } });
  button.addEventListener('keyup', event => { if (['Enter',' '].includes(event.key) && started) { event.preventDefault(); browser.nes.buttonUp(1, number); } });
}
window.addEventListener('blur', releaseAll);
window.addEventListener('resize', () => browser?.fitInParent());
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== parent || parent === window) return;
  const data = event.data;
  if (data?.type === 'TREE_RETRO_INIT' && !session) {
    session = data.session;
    try {
      rom = inspectRom(data.rom).bytes;
      if (await sha256(rom) !== data.hash) throw new Error('The ROM could not be verified. Please reopen it.');
      $('loading-message').textContent = 'Your NES game is ready.';
      $('start-game').disabled = false;
    } catch (error) { failed(error.message); }
  } else if (data?.type === 'TREE_RETRO_COMMAND' && data.session === session) {
    try {
      if (!started || !browser) throw new Error('Press Start Game before using save controls.');
      const result = { id: data.id };
      if (data.command === 'snapshot') {
        result.bytes = new TextEncoder().encode(JSON.stringify(browser.nes.toJSON()));
        if (!result.bytes.length || result.bytes.length > MAX_STATE_BYTES) throw new Error('The game could not be saved.');
      } else if (data.command === 'load') {
        const bytes = new Uint8Array(data.bytes);
        if (!bytes.length || bytes.length > MAX_STATE_BYTES) throw new Error('This save file is invalid.');
        const state = JSON.parse(new TextDecoder().decode(bytes));
        for (const key of ['cpu','ppu','papu','mmap']) if (!state[key] || typeof state[key] !== 'object') throw new Error('This save does not contain a valid NES state.');
        const previous = browser.nes.toJSON();
        const wasPaused = paused;
        pause(true);
        try { browser.nes.fromJSON(state); }
        catch { browser.nes.fromJSON(previous); pause(wasPaused); throw new Error('This save could not be restored. Your current game was kept.'); }
        pause(false);
      } else if (data.command === 'togglePause') pause(!paused);
      else if (data.command === 'pause') pause(true);
      else throw new Error('Unknown player control.');
      reply('TREE_RETRO_REPLY', result);
    } catch (error) { reply('TREE_RETRO_REPLY', { id: data.id, error: error.message }); }
  }
});
