import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('the eight recovered PNG atlases contain all 112 manifest rectangles', async () => {
  let count = 0;
  for (const [name, expectedWidth, expectedHeight] of [['animations', 1024, 1536], ['combat', 1254, 1254]]) {
    const url = new URL(`../assets/hero-sprites/${name}.json`, import.meta.url);
    const manifest = JSON.parse(await readFile(url, 'utf8'));
    for (const direction of Object.values(manifest.directions)) {
      const bytes = await readFile(new URL(direction.file, url));
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), expectedWidth);
      assert.equal(bytes.readUInt32BE(20), expectedHeight);
      for (const frame of direction.frames) {
        assert(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= expectedWidth && frame.y + frame.height <= expectedHeight);
        count++;
      }
    }
  }
  assert.equal(count, 112);
});

// Exercise the real viewer event handlers with deterministic time and DOM doubles.
// These are automated checks, not browser or physical-device certification.
async function viewer({ reduced = false, width = 901 } = {}) {
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.listeners = {}; this.attributes = {}; this.parentElement = { style: {} }; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, data = {}) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, ...data }); }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() {}
    setPointerCapture() {}
    getBoundingClientRect() { return { width: this.small ? 304 : width, height: this.small ? parseFloat(this.parentElement.style.height || 166) : 340 }; }
    getContext() {
      return new Proxy({}, { get: (_, name) => name === 'drawImage' ? (...args) => { this.draw = args; } : () => {} });
    }
  }
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  nodes['actual-canvas'].small = true;
  const groups = Object.fromEntries(['animation', 'direction', 'move', 'speed'].map(key => [key,
    [...html.matchAll(new RegExp(`data-${key}="([^"]+)"`, 'g'))].map(m => new Element({ [key]: m[1] }))]));
  const document = new Element();
  document.hidden = false;
  document.querySelector = selector => nodes[selector.slice(1)];
  document.querySelectorAll = selector => groups[selector.match(/data-(\w+)/)[1]];
  const motion = new Element(); motion.matches = reduced;
  const window = new Element(); window.devicePixelRatio = 1; window.matchMedia = () => motion;
  let callback, time = 1;
  class Image {
    set src(value) {
      if (!value) return;
      this.naturalWidth = value.includes('-combat') ? 1254 : 1024;
      this.naturalHeight = value.includes('-combat') ? 1254 : 1536;
      queueMicrotask(() => this.onload?.());
    }
  }
  const context = vm.createContext({ document, window, Image, URL, AbortController, DOMException,
    setTimeout, clearTimeout, ResizeObserver: class { observe() {} },
    requestAnimationFrame: fn => { callback = fn; return 1; }, cancelAnimationFrame() {},
    fetch: async url => ({ ok: true, json: async () => JSON.parse(await readFile(url, 'utf8')) }) });
  const source = (await readFile(new URL('./viewer.mjs', import.meta.url), 'utf8'))
    .replaceAll('export function ', 'function ')
    .replaceAll('import.meta.url', JSON.stringify(new URL('./viewer.mjs', import.meta.url).href));
  vm.runInContext(source, context);
  for (let i = 0; i < 200 && !nodes['loading-panel'].hidden; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(nodes['error-panel'].hidden, true, nodes['error-message'].textContent);
  assert.equal(nodes['loading-panel'].hidden, true);
  return { nodes, window, document, motion,
    choose: (key, value) => groups[key].find(e => e.dataset[key] === value).emit('click'),
    pad: direction => groups.move.find(e => e.dataset.move === direction),
    advance: (frames = 30) => { for (let i = 0; i < frames; i++) { time += 50; callback(time); } },
    state: () => nodes['stage-state'].textContent,
    stop: () => window.emit('pagehide') };
}

test('reduced motion stays paused across selections and resumes only on explicit playback', async () => {
  const v = await viewer({ reduced: true });
  assert.equal(v.nodes['play-button'].textContent, 'Play');
  v.choose('animation', 'cast'); v.choose('direction', 'north'); v.advance();
  assert.equal(v.nodes['frame-label'].textContent, 'Frame 1 / 4');
  v.nodes['replay-button'].emit('click'); v.advance();
  assert.equal(v.nodes['playback-label'].textContent, 'Final pose held');
  v.choose('animation', 'walk'); v.advance();
  assert.equal(v.nodes['frame-label'].textContent, 'Frame 1 / 8');
  v.stop();
});

test('real keyboard handlers ignore held repeats and stale release after an action', async () => {
  const v = await viewer(); const canvas = v.nodes['detail-canvas'];
  canvas.emit('keydown', { key: 'D', repeat: false });
  assert.equal(v.state(), 'East · Walking');
  canvas.emit('keydown', { key: 'j', repeat: false });
  canvas.emit('keydown', { key: 'd', repeat: true });
  v.window.emit('keyup', { key: 'D' });
  assert.equal(v.state(), 'East · Strike');
  canvas.emit('keydown', { key: 'd', repeat: false });
  v.window.emit('keyup', { key: 'D' });
  assert.equal(v.state(), 'East · Idle');
  v.stop();
});

test('pointer release, cancellation, lost capture and window blur clear movement', async () => {
  const v = await viewer(); const pad = v.pad('west');
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    pad.emit('pointerdown', { button: 0, pointerId: 7 });
    assert.equal(v.state(), 'West · Walking');
    pad.emit(event, { pointerId: 7 });
    assert.equal(v.state(), 'West · Idle');
  }
  pad.emit('pointerdown', { button: 0, pointerId: 7 });
  v.choose('animation', 'defeat'); pad.emit('pointerup', { pointerId: 7 });
  assert.equal(v.state(), 'West · Defeat');
  pad.emit('pointerdown', { button: 0, pointerId: 8 }); v.window.emit('blur');
  assert.equal(v.state(), 'West · Idle');
  v.stop();
});

test('turning during a stride preserves its phase while explicit review selection restarts it', async () => {
  const v = await viewer(); const canvas = v.nodes['detail-canvas'];
  canvas.emit('keydown', { key: 'd', repeat: false }); v.advance(7);
  const phase = v.nodes['frame-label'].textContent;
  assert.notEqual(phase, 'Frame 1 / 8');
  canvas.emit('keydown', { key: 'w', repeat: false });
  assert.equal(v.state(), 'North · Walking');
  assert.equal(v.nodes['frame-label'].textContent, phase);
  v.window.emit('keyup', { key: 'w' });
  assert.equal(v.state(), 'East · Walking');
  assert.equal(v.nodes['frame-label'].textContent, phase);
  v.choose('direction', 'south');
  assert.equal(v.nodes['frame-label'].textContent, 'Frame 1 / 8');
  v.stop();
});

test('feet stop cycling when movement is blocked or opposing inputs cancel', async () => {
  const v = await viewer(); const canvas = v.nodes['detail-canvas'];
  canvas.emit('keydown', { key: 'd', repeat: false }); v.advance(7);
  canvas.emit('keydown', { key: 'a', repeat: false });
  const phase = v.nodes['frame-label'].textContent;
  v.advance(20);
  assert.equal(v.nodes['frame-label'].textContent, phase);
  v.window.emit('keyup', { key: 'a' });
  v.advance(200);
  const edgePhase = v.nodes['frame-label'].textContent;
  const edgeDraw = canvas.draw.slice(5);
  v.advance(17);
  assert.equal(v.nodes['frame-label'].textContent, edgePhase);
  assert.deepEqual(canvas.draw.slice(5), edgeDraw);
  v.window.emit('keyup', { key: 'd' });
  assert.equal(v.state(), 'East · Idle');
  // A deliberately selected walk-in-place remains a usable animation review.
  v.choose('animation', 'walk'); v.advance(7);
  assert.notEqual(v.nodes['frame-label'].textContent, 'Frame 1 / 8');
  v.stop();
});

test('all 112 frame rectangles stay inside both canvases at desktop and phone widths', async () => {
  for (const width of [901, 330]) {
    const v = await viewer({ width, reduced: true });
    for (const direction of ['north', 'east', 'south', 'west']) {
      v.choose('direction', direction);
      for (const action of ['idle', 'walk', 'strike', 'cast', 'hit', 'defeat']) {
        v.choose('animation', action);
        for (let frame = 0; frame < (action === 'walk' ? 8 : 4); frame++) {
          for (const name of ['detail-canvas', 'actual-canvas']) {
            const canvas = v.nodes[name], [, , , , , x, y, w, h] = canvas.draw;
            const box = canvas.getBoundingClientRect();
            assert(x >= 0 && y >= 0 && x + w <= box.width && y + h <= box.height,
              `${width}/${direction}/${action}/${frame}/${name}: clipped draw rectangle`);
          }
          v.nodes['step-button'].emit('click');
        }
      }
    }
    v.stop();
  }
});
