import { Game, WORLD, SAVE_KEY } from './engine.mjs';
import { Renderer } from './renderer.mjs';

const $ = id => document.getElementById(id);
const canvas = $('world');
let saved = null;
let storageOK = true;
try { saved = localStorage.getItem(SAVE_KEY); } catch { storageOK = false; }
let game = new Game(saved);
let renderer = new Renderer(canvas);
let mode = 'title';
let held = new Set();
let touch = { x: 0, y: 0 };
let attackHeld = false;
let path = [];
let lastFrame = 0;
let lastSave = 0;
let lastHUD = 0;
let storyQueue = [];
let pendingVictory = false;
let resultMode = 'victory';
let toastTimer;
let audioContext;
let muted = true;
const dialogs = ['story-dialog', 'pause-dialog', 'help-dialog', 'journal-dialog', 'result-dialog'].map($);
const isDialogOpen = () => dialogs.some(d => d.open);
const canPlay = () => mode === 'play' && !isDialogOpen();
const stageOrder = ['meet', 'defend', 'repair', 'cross', 'plant', 'restore', 'complete'];

function toast(text, duration = 3500) {
  if (!text) return;
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), duration);
}

function clearInput() {
  held.clear(); touch = { x: 0, y: 0 }; attackHeld = false; path = [];
  $('stick-knob').style.transform = '';
}

function save() {
  if (mode !== 'play') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
    saved = localStorage.getItem(SAVE_KEY);
    storageOK = true;
  } catch { storageOK = false; }
  $('save-status').textContent = storageOK ? 'Saved on this device' : 'Saving unavailable in this browser';
}

function playSound(type) {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const pitch = { attack: 180, snare: 320, hit: 90, stage: 560, complete: 740, save: 0 }[type] || 0;
    if (!pitch) return;
    osc.type = type === 'attack' || type === 'hit' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * (type === 'hit' ? 0.5 : 1.4), now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.065, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(now + 0.21);
  } catch { /* Audio is optional. */ }
}

function openDialog(id) { clearInput(); $(id).showModal(); }
function closeDialogs() { dialogs.forEach(d => { if (d.open) d.close(); }); }

function presentNextStory() {
  if (isDialogOpen() || mode !== 'play') return;
  if (!storyQueue.length) {
    if (pendingVictory) { pendingVictory = false; showResult('victory'); }
    return;
  }
  const event = storyQueue.shift();
  const parts = (event.speaker || 'The forest').split('·').map(s => s.trim());
  $('speaker-name').textContent = parts[0];
  $('speaker-role').textContent = parts[1] || (parts[0] === 'Bram' ? 'BEAVER ENGINEER' : 'WILLOWMERE');
  $('speaker-badge').textContent = parts[0].slice(0, 1);
  $('story-text').textContent = event.text;
  openDialog('story-dialog');
}

function processEvents() {
  for (const event of game.drainEvents()) {
    if (event.type === 'message') toast(event.text);
    if (event.type === 'story') storyQueue.push(event);
    if (event.type === 'stage') { path = []; save(); }
    if (event.type === 'save') save();
    if (event.type === 'complete') pendingVictory = true;
    playSound(event.type);
  }
  if (game.state.status === 'down' && !isDialogOpen()) showResult('down');
  else presentNextStory();
}

function updateHUD() {
  const state = game.state;
  $('food-value').textContent = state.resources.food;
  $('materials-value').textContent = state.resources.materials;
  $('seeds-value').textContent = state.resources.seeds;
  $('hp-number').textContent = Math.ceil(state.hero.hp);
  $('hp-fill').style.width = `${state.hero.hp}%`;
  const objective = game.getObjective();
  $('objective-title').textContent = objective.title;
  $('objective-hint').textContent = objective.hint;
  $('objective-step').textContent = state.stage === 'complete' ? 'PROLOGUE COMPLETE' : `EXPEDITION · ${objective.step} OF ${objective.total}`;
  $('objective-progress').style.width = `${state.stage === 'complete' ? 100 : (objective.step - 1) / objective.total * 100}%`;
  const interaction = game.getInteraction();
  $('interact-button').classList.toggle('ready', Boolean(interaction?.enabled));
  $('interact-label').textContent = interaction ? ({ talk: 'Talk to Bram', bridge: 'Repair crossing', cache: 'Collect supplies', grove: 'Plant grove', workshop: 'Restore workshop', recruit: 'Recruit guard' }[interaction.id] || 'Interact') : 'Interact';
  $('interaction-hint').classList.toggle('visible', Boolean(interaction));
  $('interaction-hint').textContent = interaction ? (interaction.enabled ? interaction.label : interaction.reason) : '';
  const cooldown = state.hero.snareCooldown;
  $('root-label').textContent = cooldown > 0 ? `Roots · ${Math.ceil(cooldown)}s` : 'Root snare';
  $('root-button').disabled = cooldown > 0 || state.status !== 'playing';
  $('attack-button').disabled = state.status !== 'playing';
  $('location-label').textContent = state.hero.x < 740 ? 'WILLOWMERE · WEST BANK' : state.hero.x < 900 ? 'THE RIVER CROSSING' : 'WILLOWMERE · ANCESTRAL OUTPOST';
}

function start(continuing = false) {
  closeDialogs(); clearInput(); storyQueue = []; pendingVictory = false;
  game = new Game(continuing ? saved : null);
  mode = 'play'; document.body.dataset.mode = 'play';
  canvas.focus({ preventScroll: true }); updateHUD(); save();
  if (!continuing) {
    storyQueue.push({ speaker: 'Tree Hero', text: 'The river road has gone silent. There are families stranded at the crossing—and someone is keeping them there. Find Bram beside the caravan. He will know what happened.' });
    presentNextStory();
  } else if (game.state.status === 'down') showResult('down');
  else toast('Welcome back, guardian. Your forest remembers.', 2500);
}

function title() {
  save(); clearInput(); closeDialogs(); storyQueue = []; pendingVictory = false;
  mode = 'title'; document.body.dataset.mode = 'title';
  $('continue-button').hidden = !saved;
  $('start-button').textContent = saved ? 'Start a new adventure' : 'Begin the prologue';
}

function showResult(type) {
  resultMode = type;
  $('result-kicker').textContent = type === 'down' ? 'THE GUARDIAN WILL RISE' : 'A NEW BEGINNING';
  $('result-title').textContent = type === 'down' ? 'The caravan still needs you.' : 'Willowmere lives again.';
  $('result-description').textContent = type === 'down' ? 'Return to the battle checkpoint with full health. Keep the patrol close, then use your root snare and strike.' : 'The crossing is open. Your grove is growing. The Beaver Guild stands with you.';
  $('result-stats').hidden = type === 'down';
  $('next-chapter').hidden = type === 'down';
  $('result-journal').hidden = type === 'down';
  $('result-action').textContent = type === 'down' ? 'Return to checkpoint' : 'Explore your outpost';
  $('rescued-total').textContent = game.state.metrics.rescued;
  openDialog('result-dialog'); save();
}

function renderJournal() {
  const state = game.state;
  const progress = stageOrder.indexOf(state.stage);
  const entries = [ ['Meet Bram and the stranded caravan', progress > 0], ['Drive off the raiding patrol', progress > 1], ['Repair the river crossing', state.world.bridge], ['Bring the three families home', state.metrics.rescued === 3], ['Plant the first food grove', state.world.grove], ['Restore the ancestral workshop', state.world.workshop] ];
  $('journal-list').replaceChildren(...entries.map(([label, done]) => {
    const li = document.createElement('li'); li.textContent = label; if (done) li.classList.add('done'); return li;
  }));
  $('faction-status').textContent = state.world.bonus ? (state.world.recruit ? 'A beaver guard has joined your outpost. Your ancestral recruitment discount is active.' : 'Ancestral home restored. Beaver recruits cost 20% fewer materials: 8 instead of 10.') : 'Restore the ancestral workshop to earn their allegiance.';
  $('recruit-button').hidden = !state.world.bonus || state.world.recruit;
  $('recruit-button').textContent = 'Recruit a guard · 8 materials + 4 food';
  $('recruit-button').disabled = state.resources.materials < 8 || state.resources.food < 4;
}

$('start-button').addEventListener('click', () => {
  if (saved && !window.confirm('Start a new adventure? This replaces the saved prologue on this browser.')) return;
  start(false);
});
$('continue-button').addEventListener('click', () => start(true));
$('home-button').addEventListener('click', title);
$('return-title').addEventListener('click', title);
$('story-next').addEventListener('click', () => { $('story-dialog').close(); presentNextStory(); canvas.focus({ preventScroll: true }); });
$('pause-button').addEventListener('click', () => { if (mode === 'play' && !isDialogOpen()) { save(); openDialog('pause-dialog'); } });
$('resume-button').addEventListener('click', () => { $('pause-dialog').close(); canvas.focus({ preventScroll: true }); });
function help() { if (mode !== 'play') return; closeDialogs(); openDialog('help-dialog'); }
$('help-button').addEventListener('click', help);
$('pause-help').addEventListener('click', help);
$('close-help').addEventListener('click', () => $('help-dialog').close());
function journal() { if (mode !== 'play') return; closeDialogs(); renderJournal(); openDialog('journal-dialog'); }
$('journal-button').addEventListener('click', journal);
$('result-journal').addEventListener('click', journal);
$('close-journal').addEventListener('click', () => $('journal-dialog').close());
$('recruit-button').addEventListener('click', () => { game.recruit(); processEvents(); renderJournal(); updateHUD(); });
$('result-action').addEventListener('click', () => {
  $('result-dialog').close();
  if (resultMode === 'down') { game.restartCheckpoint(); processEvents(); }
  updateHUD(); canvas.focus({ preventScroll: true });
});
$('sound-button').addEventListener('click', () => {
  muted = !muted;
  $('sound-button').setAttribute('aria-pressed', String(!muted));
  $('sound-button').setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  $('sound-button').style.color = muted ? '' : '#bce58a';
  playSound('stage');
});

function interaction() {
  if (!canPlay()) return;
  if (!game.getInteraction()) toast('Move closer to the glowing objective, then interact.', 2000);
  else { game.interact(); processEvents(); updateHUD(); }
}
$('interact-button').addEventListener('click', interaction);
$('root-button').addEventListener('click', () => { if (canPlay()) { game.snare(); processEvents(); updateHUD(); } });
const attackButton = $('attack-button');
attackButton.addEventListener('pointerdown', event => {
  if (!canPlay()) return;
  attackHeld = true; attackButton.setPointerCapture(event.pointerId); game.attack(); processEvents();
});
attackButton.addEventListener('pointerup', () => { attackHeld = false; });
attackButton.addEventListener('pointercancel', () => { attackHeld = false; });
attackButton.addEventListener('lostpointercapture', () => { attackHeld = false; });
attackButton.addEventListener('click', () => { if (canPlay()) { game.attack(); processEvents(); } });

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
document.addEventListener('keydown', event => {
  if (mode !== 'play') return;
  if (event.code === 'Escape') {
    if (isDialogOpen()) return;
    event.preventDefault(); save(); openDialog('pause-dialog'); return;
  }
  if (!canPlay()) return;
  if (movementCodes.has(event.code) || ['Space', 'KeyQ', 'KeyE', 'KeyJ'].includes(event.code)) event.preventDefault();
  if (movementCodes.has(event.code)) { held.add(event.code); path = []; }
  if (event.code === 'Space') held.add('Space');
  if (event.code === 'KeyQ' && !event.repeat) { game.snare(); processEvents(); }
  if (event.code === 'KeyE' && !event.repeat) interaction();
  if (event.code === 'KeyJ' && !event.repeat) journal();
});
document.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', () => { clearInput(); if (canPlay()) { save(); openDialog('pause-dialog'); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (canPlay()) { save(); openDialog('pause-dialog'); } } });
window.addEventListener('pagehide', save);
dialogs.forEach(d => d.addEventListener('cancel', event => {
  clearInput();
  if (d.id === 'story-dialog' || d.id === 'result-dialog') event.preventDefault();
}));

canvas.addEventListener('pointerdown', event => {
  if (!canPlay()) return;
  const point = renderer.screenToWorld(event.clientX, event.clientY);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const target = { x: Math.max(65, Math.min(1535, point.x)), y: Math.max(65, Math.min(935, point.y)) };
  const hero = game.state.hero;
  const across = (hero.x < 744 && target.x > 876) || (hero.x > 876 && target.x < 744);
  if (across && !game.state.world.bridge) { toast('The crossing is broken. Help Bram repair it first.', 2400); return; }
  path = across ? (hero.x < 744 ? [{ x: 704, y: 517 }, { x: 914, y: 517 }, target] : [{ x: 914, y: 517 }, { x: 704, y: 517 }, target]) : [target];
  canvas.focus({ preventScroll: true });
});

const stick = $('touch-stick');
let stickPointer = null;
function moveStick(event) {
  const rect = stick.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy); const max = rect.width * 0.29;
  const scale = length > max ? max / length : 1;
  const x = dx * scale; const y = dy * scale;
  touch = length < 6 ? { x: 0, y: 0 } : { x: x / max, y: y / max };
  $('stick-knob').style.transform = `translate(${x}px,${y}px)`;
}
stick.addEventListener('pointerdown', event => { if (!canPlay()) return; stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); path = []; moveStick(event); });
stick.addEventListener('pointermove', event => { if (event.pointerId === stickPointer) moveStick(event); });
function resetStick(event) { if (event.pointerId === stickPointer) { stickPointer = null; touch = { x: 0, y: 0 }; $('stick-knob').style.transform = ''; } }
stick.addEventListener('pointerup', resetStick); stick.addEventListener('pointercancel', resetStick); stick.addEventListener('lostpointercapture', resetStick);

function frame(now) {
  const elapsed = Math.min(0.25, Math.max(0, (now - (lastFrame || now)) / 1000)); lastFrame = now;
  // Catch up in small simulation steps when a device drops frames. The cap
  // prevents a suspended tab from jumping the player through an encounter.
  let remaining = elapsed;
  while (canPlay() && remaining > 0) {
    const dt = Math.min(0.025, remaining);
    remaining -= dt;
    let dx = touch.x + Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
    let dy = touch.y + Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp'));
    if (!dx && !dy && path.length) {
      const target = path[0]; const distance = Math.hypot(target.x - game.state.hero.x, target.y - game.state.hero.y);
      if (distance < 9) path.shift();
      else { dx = (target.x - game.state.hero.x) / distance; dy = (target.y - game.state.hero.y) / distance; }
    }
    game.update(dt, { dx, dy, attack: attackHeld || held.has('Space') });
    processEvents();
  }
  if (canPlay() && now - lastSave > 5000) { save(); lastSave = now; }
  renderer.render(game.state, Math.min(elapsed, 0.08));
  if (now - lastHUD > 90) { updateHUD(); lastHUD = now; }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => renderer.resize());
$('continue-button').hidden = !saved;
if (saved) $('start-button').textContent = 'Start a new adventure';
updateHUD(); requestAnimationFrame(frame);
