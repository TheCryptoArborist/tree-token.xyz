import { ENGINE, MAX_ROM_BYTES, MAX_STATE_BYTES, inspectRom, sha256, cleanName, makeBackup, readBackup } from './core.js';
import { readSave, writeSave } from './storage.js';

const $ = id => document.getElementById(id);
const actionIds = ['pause', 'save', 'resume', 'export', 'import'];
const pending = new Map();
let active, launching = false, requestId = 0, launchId = 0, sourceId = 0;

function notice(message, error = false) {
  $('notice').textContent = message;
  $('notice').dataset.error = String(error);
}
function saveStatus(message) { $('save-status').textContent = message; }
function errorMessage(error) { return error?.message || 'Something went wrong. Please try again.'; }
function controls(ready) { for (const id of actionIds) $(id).disabled = !ready; }
function enableLaunch(enabled) {
  launching = !enabled;
  for (const button of document.querySelectorAll('[data-launch], #choose-rom')) button.disabled = !enabled;
}
function send(command, extra = {}, timeout = 12000) {
  if (!active?.frame.contentWindow) return Promise.reject(new Error('Start a game first.'));
  const id = ++requestId;
  const session = active.session;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The player did not respond. Try again or reopen the game.')); }, timeout);
    pending.set(id, { resolve, reject, timer, session });
    active.frame.contentWindow.postMessage({ type: 'TREE_RETRO_COMMAND', command, id, session, ...extra }, location.origin);
  });
}
function clearPlayer() {
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('The player was closed.')); }
  pending.clear();
  active?.frame.remove();
  active = null;
  controls(false);
  $('player-section').hidden = true;
  $('pause').textContent = 'Pause';
}
async function storeState(bytes, game = active) {
  if (!game || !bytes?.byteLength || bytes.byteLength > MAX_STATE_BYTES) throw new Error('The player returned an invalid save.');
  await writeSave({ romHash: game.hash, title: game.title, engine: ENGINE, updatedAt: new Date().toISOString(), bytes });
  if (active === game) {
    game.hasSave = true;
    $('resume').disabled = false;
    saveStatus(`Saved on this device at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Export a backup to keep a copy.`);
  }
}
async function snapshot() {
  const game = active;
  if (!game?.started) return;
  const result = await send('snapshot');
  if (game !== active) return;
  await storeState(result.bytes, game);
  return result.bytes;
}
async function launch(bytes, title, expectedHash) {
  if (launching) return;
  const token = ++launchId;
  enableLaunch(false);
  notice('Preparing your game…');
  try {
    inspectRom(bytes);
    const hash = await sha256(bytes);
    if (expectedHash && hash !== expectedHash) throw new Error('The library game failed its file check. Please try again later.');
    if (token !== launchId) return;
    if (active?.started) await send('pause');
    clearPlayer();
    const frame = document.createElement('iframe');
    frame.title = `${cleanName(title)} — NES player`;
    frame.src = './player.html';
    frame.allow = 'autoplay; fullscreen; gamepad';
    frame.setAttribute('allowfullscreen', '');
    frame.referrerPolicy = 'no-referrer';
    const session = crypto.randomUUID();
    active = { frame, hash, title: cleanName(title), session, started: false, hasSave: false };
    frame.addEventListener('load', () => {
      if (active?.session !== session) return;
      const rom = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      frame.contentWindow.postMessage({ type: 'TREE_RETRO_INIT', session, hash, title: cleanName(title), rom }, location.origin, [rom]);
    }, { once: true });
    $('now-playing').textContent = active.title;
    $('player-section').hidden = false;
    $('player-shell').append(frame);
    saveStatus('Press Start Game in the player. Use the on-screen buttons, keyboard, or a gamepad.');
    notice('Your game is ready. Press Start Game in the player.');
    $('player-section').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (error) { notice(errorMessage(error), true); }
  finally { enableLaunch(true); }
}

window.addEventListener('message', async event => {
  const game = active;
  if (!game || event.origin !== location.origin || event.source !== game.frame.contentWindow || event.data?.session !== game.session) return;
  const data = event.data;
  if (data.type === 'TREE_RETRO_REPLY') {
    const item = pending.get(data.id);
    if (!item || item.session !== game.session) return;
    clearTimeout(item.timer); pending.delete(data.id);
    if (data.error) item.reject(new Error(data.error)); else item.resolve(data);
  } else if (data.type === 'TREE_RETRO_STARTED') {
    game.started = true;
    controls(true);
    $('resume').disabled = true;
    notice(`Now playing ${game.title}.`);
    try {
      const saved = await readSave(game.hash);
      if (active !== game) return;
      game.hasSave = saved?.engine === ENGINE;
      $('resume').disabled = !game.hasSave;
      saveStatus(game.hasSave ? `A save from ${new Date(saved.updatedAt).toLocaleString()} is available. Choose Resume saved to continue.` : 'Choose Save progress to keep your place. Saves stay in this browser; export a backup for another device.');
    } catch (error) { saveStatus(errorMessage(error)); }
  } else if (data.type === 'TREE_RETRO_ERROR') {
    notice(data.error || 'The emulator could not start this game. Try another ROM.', true);
  } else if (data.type === 'TREE_RETRO_PAUSED') {
    $('pause').textContent = data.paused ? 'Continue' : 'Pause';
  }
});

$('choose-rom').addEventListener('click', () => $('rom-file').click());
$('rom-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || launching) return;
  const source = ++sourceId;
  if (!/\.nes$/i.test(file.name) || file.size > MAX_ROM_BYTES) return notice('Choose an uncompressed .nes file up to 16 MB.', true);
  try { const bytes = new Uint8Array(await file.arrayBuffer()); if (source === sourceId) await launch(bytes, file.name); }
  catch (error) { notice(errorMessage(error), true); }
});
$('save').addEventListener('click', () => snapshot().catch(error => notice(errorMessage(error), true)));
$('pause').addEventListener('click', () => send('togglePause').catch(error => notice(errorMessage(error), true)));
$('resume').addEventListener('click', async () => {
  const game = active;
  try {
    const saved = await readSave(game.hash);
    if (game !== active) return;
    if (!saved || saved.engine !== ENGINE) throw new Error('No compatible save was found. Try importing a backup.');
    await send('load', { bytes: saved.bytes });
    saveStatus('Saved progress restored. Click or tap inside the game to continue playing.');
    game.frame.focus();
  } catch (error) { notice(errorMessage(error), true); }
});
$('export').addEventListener('click', async () => {
  const game = active;
  try {
    // Export remains available even if IndexedDB is blocked or full.
    const result = await send('snapshot');
    const backup = await makeBackup(result.bytes, game.hash, game.title);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${game.title.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}.tree-save.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    saveStatus('Save exported. Keep the backup with the matching ROM.');
  } catch (error) { notice(errorMessage(error), true); }
});
$('import').addEventListener('click', () => $('save-file').click());
$('save-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  const game = active;
  if (!file || !game?.started) return;
  try {
    if (file.size > MAX_STATE_BYTES * 1.4 + 4096) throw new Error('This save file is too large.');
    const bytes = await readBackup(await file.text(), game.hash);
    if (active !== game) return;
    await send('load', { bytes });
    try { await storeState(bytes, game); saveStatus('Backup imported and saved on this device.'); }
    catch (error) { saveStatus(`Backup loaded. ${errorMessage(error)}`); }
    game.frame.focus();
  } catch (error) { notice(errorMessage(error), true); }
});
$('close-player').addEventListener('click', async () => {
  if (active?.started) {
    try { await send('pause'); } catch { /* A failed player can still be closed. */ }
    // Explicit saves are kept until the player chooses to replace them.
  }
  ++launchId;
  clearPlayer();
  notice('Choose a game for your next round.');
  $('library').scrollIntoView({ block: 'start' });
});
$('fullscreen').addEventListener('click', async () => {
  const shell = $('player-shell');
  if (!active) return;
  if (shell.requestFullscreen) {
    try { await shell.requestFullscreen(); return; } catch { /* Use the expanded player on browsers without native support. */ }
  }
  shell.classList.add('expanded');
  const exit = document.createElement('button'); exit.className = 'button expanded-close'; exit.textContent = 'Exit fullscreen';
  document.body.append(exit);
  const close = () => { shell.classList.remove('expanded'); exit.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  exit.addEventListener('click', close); document.addEventListener('keydown', onKey);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active?.started) send('pause').catch(() => {});
});

async function loadCatalog() {
  try {
    const response = await fetch('./catalog.json', { credentials: 'omit' });
    if (!response.ok) throw new Error('The game library could not load. You can still choose a ROM from your device.');
    const catalog = await response.json();
    $('game-list').replaceChildren();
    for (const game of catalog.games) {
      const card = document.createElement('article'); card.className = 'game-card';
      card.innerHTML = '<div class="game-art" aria-hidden="true"><span class="pixel">↓ · ↓</span><strong>FALLING</strong><small>A LITTLE LEAP OF FAITH.</small></div><div class="game-info"><div class="game-meta"><span>NES</span><span>HOME BREW</span></div><h3></h3><p></p><button class="button primary" data-launch>Play game <span aria-hidden="true">↗</span></button></div>';
      card.querySelector('h3').textContent = game.title;
      card.querySelector('p').textContent = game.description;
      const button = card.querySelector('button');
      button.addEventListener('click', async () => {
        if (launching) return;
        const source = ++sourceId;
        button.disabled = true;
        notice('Loading your game…');
        try {
          const url = new URL(game.rom, location.href);
          const root = new URL('./', location.href);
          if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname + 'games/')) throw new Error('Invalid library game path.');
          const response = await fetch(url, { credentials: 'omit' });
          if (!response.ok) throw new Error('This game could not load. Please try again.');
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (source === sourceId) await launch(bytes, game.title, game.sha256);
        } catch (error) { notice(errorMessage(error), true); }
        finally { button.disabled = false; }
      });
      $('game-list').append(card);
    }
  } catch (error) { $('game-list').textContent = errorMessage(error); notice(errorMessage(error), true); }
}
loadCatalog();
