import { ENGINE, MAX_STATE_BYTES, inspectRom, sha256 } from './core.js';
let session, started = false;
const reply = (type, extra = {}) => parent.postMessage({ type, session, ...extra }, location.origin);
function failed(message) {
  document.getElementById('loading').hidden = false;
  document.getElementById('loading').textContent = message;
  reply('TREE_RETRO_ERROR', { error: message });
}
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== parent || parent === window) return;
  const data = event.data;
  if (data?.type === 'TREE_RETRO_INIT' && !session) {
    session = data.session;
    try {
      const { bytes } = inspectRom(data.rom);
      if (await sha256(bytes) !== data.hash) throw new Error('The ROM could not be verified. Please reopen it.');
      const romUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      Object.assign(window, {
        EJS_player: '#game', EJS_core: 'fceumm', EJS_gameUrl: romUrl,
        EJS_gameName: `tree-${data.hash}`, EJS_gameID: parseInt(data.hash.slice(0, 12), 16),
        EJS_pathtodata: './vendor/emulatorjs-4.2.3/data/',
        EJS_color: '#83ad54', EJS_backgroundColor: '#07110c', EJS_startButtonName: 'START GAME',
        EJS_threads: false, EJS_startOnLoaded: false, EJS_forceLegacyCores: false,
        EJS_language: 'en-US', EJS_disableAutoLang: false,
        EJS_Buttons: { saveState: false, loadState: false, netplay: false, screenRecord: false, saveSavFiles: false, loadSavFiles: false },
        EJS_defaultOptions: { 'save-state-location': 'browser', webgl2Enabled: 'enabled' },
        EJS_ready: () => { document.getElementById('loading').hidden = true; },
        EJS_onGameStart: () => { started = true; document.getElementById('loading').hidden = true; reply('TREE_RETRO_STARTED', { engine: ENGINE }); }
      });
      const script = document.createElement('script');
      script.src = './vendor/emulatorjs-4.2.3/data/loader.js';
      script.onload = () => { document.getElementById('loading').hidden = true; };
      script.onerror = () => failed('The emulator could not load. Please reopen the game.');
      document.head.append(script);
      // Loading failures can occur after the loader script itself has succeeded.
      const watch = setInterval(() => {
        if (window.EJS_emulator) window.EJS_emulator.debug = true;
        if (window.EJS_emulator?.failedToStart) { clearInterval(watch); failed('This game could not start on this device. Try another ROM or browser.'); }
        if (started) clearInterval(watch);
      }, 1000);
      setTimeout(() => clearInterval(watch), 120000);
    } catch (error) { failed(error.message); }
  } else if (data?.type === 'TREE_RETRO_COMMAND' && data.session === session) {
    try {
      const emulator = window.EJS_emulator;
      if (!started || !emulator?.gameManager) throw new Error('Press Start Game before using save controls.');
      const result = { id: data.id };
      if (data.command === 'snapshot') {
        result.bytes = emulator.gameManager.getState();
        if (!result.bytes?.byteLength || result.bytes.byteLength > MAX_STATE_BYTES) throw new Error('The game could not be saved.');
      } else if (data.command === 'load') {
        const bytes = new Uint8Array(data.bytes);
        if (!bytes.length || bytes.length > MAX_STATE_BYTES) throw new Error('This save file is invalid.');
        emulator.gameManager.loadState(bytes);
      } else if (data.command === 'togglePause') emulator.paused ? emulator.play() : emulator.pause();
      else if (data.command === 'pause') emulator.pause();
      else throw new Error('Unknown player control.');
      reply('TREE_RETRO_REPLY', result);
      reply('TREE_RETRO_PAUSED', { paused: !!emulator.paused });
    } catch (error) { reply('TREE_RETRO_REPLY', { id: data.id, error: error.message }); }
  }
});
