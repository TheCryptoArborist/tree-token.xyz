/**
 * Forest Kingdoms — FK-02 movement study.
 * Atlas coordinates and frame pivots are supplied by animations.json.
 * No game state, wallet code, remote library, or rendering engine is imported.
 */

const DIRECTIONS = ['north', 'east', 'south', 'west'];
const MANIFEST_URL = new URL('../assets/hero-sprites/animations.json', import.meta.url);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Return an atlas frame index from a named animation definition and time. */
export function chooseFrame(animation, elapsedSeconds = 0, speed = 1) {
  if (!animation || !Array.isArray(animation.frames) || !animation.frames.length) return 0;
  const fps = Math.max(0, finite(animation.fps, 4));
  const tick = Math.floor(Math.max(0, finite(elapsedSeconds)) * Math.max(0, finite(speed, 1)) * fps);
  return animation.frames[tick % animation.frames.length];
}

/**
 * Draw one unchanged atlas rectangle about a ground-contact pivot.
 * frame.pivot is relative to the source rectangle, including for trimmed frames.
 * bodyHeight is a common body measurement for the direction, not a per-frame fit.
 * Returned CSS-pixel bounds support later scene ordering and inspection overlays.
 */
export function drawHeroFrame(ctx, image, frame, options = {}) {
  if (!ctx || !image || !frame) return null;
  const height = Math.max(1, finite(options.height, 220));
  const bodyHeight = Math.max(1, finite(options.bodyHeight, frame.height));
  const scale = height / bodyHeight * Math.max(.01, finite(options.scale, 1));
  const pivot = frame.pivot || { x: frame.width / 2, y: frame.height };
  const x = finite(options.x) - finite(pivot.x, frame.width / 2) * scale;
  const y = finite(options.y) - finite(pivot.y, frame.height) * scale;
  const width = frame.width * scale;
  const drawnHeight = frame.height * scale;
  ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, x, y, width, drawnHeight);
  return { x, y, width, height: drawnHeight, pivotX: finite(options.x), pivotY: finite(options.y) };
}

function validateManifest(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('The animation list is unavailable.');
  const cell = { width: finite(raw.cell?.width, 256), height: finite(raw.cell?.height, 512) };
  if (cell.width <= 0 || cell.height <= 0) throw new Error('The animation cell size is invalid.');
  cell.pivot = raw.cell?.pivot || { x: cell.width / 2, y: cell.height - 40 };
  const animations = {};
  for (const name of ['idle', 'walk']) {
    const entry = raw.animations?.[name];
    if (!entry || !Array.isArray(entry.frames) || !entry.frames.length || entry.frames.some(i => !Number.isInteger(i) || i < 0)) {
      throw new Error(`The ${name} animation is not ready to view.`);
    }
    animations[name] = { frames: entry.frames, fps: clamp(finite(entry.fps, name === 'walk' ? 8 : 4), .1, 60) };
  }
  const directions = {};
  for (const name of DIRECTIONS) {
    const entry = raw.directions?.[name];
    if (!entry || typeof entry.file !== 'string') throw new Error(`The ${name} artwork is missing from the animation list.`);
    const imageURL = new URL(entry.file, MANIFEST_URL);
    if (imageURL.origin !== MANIFEST_URL.origin || !imageURL.pathname.startsWith(new URL('.', MANIFEST_URL).pathname)) {
      throw new Error('The artwork must be included with this movement study.');
    }
    const frames = entry.frames || Array.from({ length: 12 }, (_, index) => ({
      x: index % 4 * cell.width, y: Math.floor(index / 4) * cell.height,
      width: cell.width, height: cell.height, pivot: cell.pivot
    }));
    if (!Array.isArray(frames) || !frames.length) throw new Error(`The ${name} frame list is missing.`);
    const normalizedFrames = frames.map(frame => {
      const result = {
        x: finite(frame.x, -1), y: finite(frame.y, -1),
        width: finite(frame.width, -1), height: finite(frame.height, -1),
        pivot: frame.pivot || cell.pivot
      };
      if (result.x < 0 || result.y < 0 || result.width <= 0 || result.height <= 0 || !Number.isFinite(Number(result.pivot.x)) || !Number.isFinite(Number(result.pivot.y))) {
        throw new Error(`A ${name} animation frame has invalid dimensions.`);
      }
      return result;
    });
    if (Object.values(animations).some(a => a.frames.some(index => !normalizedFrames[index]))) {
      throw new Error(`The ${name} artwork does not include every animation frame.`);
    }
    directions[name] = {
      imageURL, frames: normalizedFrames,
      bodyHeight: Math.max(1, finite(entry.bodyHeight, cell.height)),
      scale: clamp(finite(entry.scale, 1), .1, 4)
    };
  }
  return { cell, animations, directions, display: {
    detailHeight: clamp(finite(raw.display?.detailHeight, 220), 180, 240), actualHeight: 88
  } };
}

function loadImage(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const clear = () => { img.onload = null; img.onerror = null; signal?.removeEventListener('abort', abort); };
    const abort = () => { clear(); img.src = ''; reject(new DOMException('Loading stopped', 'AbortError')); };
    img.decoding = 'async';
    img.onload = () => { clear(); resolve(img); };
    img.onerror = () => { clear(); reject(new Error('One of the character sheets could not load. Please try again.')); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    img.src = url.href;
  });
}

function bootViewer() {
  const $ = selector => document.querySelector(selector);
  const detail = $('#detail-canvas'), actual = $('#actual-canvas');
  if (!detail || !actual) return;
  const canvases = [detail, actual];
  const contexts = canvases.map(canvas => canvas.getContext('2d'));
  const controls = $('#animation-controls');
  const loading = $('#loading-panel'), errorPanel = $('#error-panel');
  const status = $('#study-status');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    ready: false, direction: 'south', animation: 'idle', elapsed: 0, speed: 1,
    paused: motionPreference.matches, guides: false, position: null, images: {},
    keys: new Set(), held: new Map(), manifest: null, lastTime: 0, frameId: 0,
    resumeAfterVisibility: false, controller: null, manualFrame: null
  };
  const sizes = [{ width: 1, height: 1, dpr: 1 }, { width: 1, height: 1, dpr: 1 }];

  function announce(text) { status.textContent = text; }
  function resetClock() { state.elapsed = 0; state.manualFrame = null; }
  function setAnimation(name, announceChange = false) {
    if (!state.ready || !state.manifest.animations[name]) return;
    if (state.animation !== name) { state.animation = name; resetClock(); }
    updateControls(); draw();
    if (announceChange) announce(`${name === 'walk' ? 'Walking' : 'Idle'} animation, facing ${state.direction}.`);
  }
  function setDirection(name, announceChange = false) {
    if (!state.ready || !DIRECTIONS.includes(name)) return;
    if (state.direction !== name) { state.direction = name; resetClock(); }
    updateControls(); draw();
    if (announceChange) announce(`Facing ${name}.`);
  }
  function setPaused(value, announceChange = false) {
    state.paused = value;
    state.lastTime = 0;
    if (value) clearMovement(false);
    updateControls(); draw();
    if (announceChange) announce(value ? 'Animation paused.' : 'Animation playing.');
  }
  function updateControls() {
    document.querySelectorAll('[data-animation]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.animation === state.animation)));
    document.querySelectorAll('[data-direction]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === state.direction)));
    document.querySelectorAll('[data-speed]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed)));
    $('#play-button').textContent = state.paused ? 'Play' : 'Pause';
    $('#play-button').setAttribute('aria-pressed', String(state.paused));
    $('#play-button').setAttribute('aria-label', state.paused ? 'Play the animation' : 'Pause the animation');
    if (state.ready) {
      $('#stage-state').textContent = `${state.direction[0].toUpperCase() + state.direction.slice(1)} · ${state.animation === 'walk' ? 'Walking' : 'Idle'}`;
      $('#playback-label').textContent = state.paused ? 'Paused' : `${state.speed}× playback`;
    }
  }
  function currentFrameIndex() {
    if (state.manualFrame !== null) return state.manualFrame;
    return chooseFrame(state.manifest.animations[state.animation], state.elapsed);
  }
  function bodyHeightFor(canvasIndex) {
    const target = canvasIndex ? 88 : state.manifest.display.detailHeight;
    if (canvasIndex) return target;
    const bounds = extents(target), size = sizes[0];
    const fit = Math.min(1, (size.width - 42) / Math.max(1, bounds.left + bounds.right), (size.height - 62) / Math.max(1, bounds.up + bounds.down));
    return Math.max(1, target * fit);
  }
  function extents(height) {
    const bounds = { left: 0, right: 0, up: 0, down: 0 };
    for (const direction of Object.values(state.manifest.directions)) {
      const scale = height / direction.bodyHeight * direction.scale;
      for (const frame of direction.frames) {
        bounds.left = Math.max(bounds.left, frame.pivot.x * scale);
        bounds.right = Math.max(bounds.right, (frame.width - frame.pivot.x) * scale);
        bounds.up = Math.max(bounds.up, frame.pivot.y * scale);
        bounds.down = Math.max(bounds.down, (frame.height - frame.pivot.y) * scale);
      }
    }
    return bounds;
  }
  function clampPosition() {
    if (!state.ready) return;
    const size = sizes[0], bounds = extents(bodyHeightFor(0));
    const minX = Math.min(size.width / 2, bounds.left + 18), maxX = Math.max(size.width / 2, size.width - bounds.right - 18);
    const minY = bounds.up + 22, maxY = Math.max(minY, size.height - bounds.down - 36);
    if (!state.position) state.position = { x: size.width / 2, y: Math.min(maxY, size.height * .78) };
    state.position.x = clamp(state.position.x, minX, maxX);
    state.position.y = clamp(state.position.y, minY, maxY);
  }
  function resize() {
    canvases.forEach((canvas, index) => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      sizes[index] = { width: Math.max(1, box.width), height: Math.max(1, box.height), dpr };
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
    });
    clampPosition(); draw();
  }
  function drawGuides(ctx, size, x, y, scale) {
    ctx.save(); ctx.lineWidth = 1;
    ctx.strokeStyle = '#b9cf9620';
    for (let gx = x % 32; gx < size.width; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, size.height); ctx.stroke(); }
    for (let gy = y % 32; gy < size.height; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(size.width, gy); ctx.stroke(); }
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#f0cb83a6';
    ctx.beginPath(); ctx.moveTo(x - scale * .65, y); ctx.lineTo(x + scale * .65, y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#edce8c'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function draw() {
    contexts.forEach((ctx, index) => {
      if (!ctx) return;
      const size = sizes[index]; ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); ctx.clearRect(0, 0, size.width, size.height);
      if (!state.ready || !state.manifest) return;
      const direction = state.manifest.directions[state.direction];
      const frameIndex = currentFrameIndex();
      const frame = direction.frames[frameIndex];
      const height = bodyHeightFor(index);
      const x = index ? size.width / 2 : state.position?.x ?? size.width / 2;
      const y = index ? size.height - 20 : state.position?.y ?? size.height * .78;
      ctx.save(); ctx.fillStyle = '#08180d50'; ctx.beginPath(); ctx.ellipse(x, y + 2, height * .2, height * .045, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (state.guides) drawGuides(ctx, size, x, y, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawHeroFrame(ctx, state.images[state.direction], frame, { x, y, height, bodyHeight: direction.bodyHeight, scale: direction.scale });
      if (!index) {
        const frames = state.manifest.animations[state.animation].frames;
        $('#frame-label').textContent = `Frame ${frames.indexOf(frameIndex) + 1} / ${frames.length}`;
        $('#detail-size').textContent = `Detail view · ${Math.round(height)} px`;
      }
    });
  }
  const normalizeKey = key => key.length === 1 ? key.toLowerCase() : key;
  const keyDirection = key => ({ ArrowUp: 'north', ArrowRight: 'east', ArrowDown: 'south', ArrowLeft: 'west', w: 'north', d: 'east', s: 'south', a: 'west' })[normalizeKey(key)];
  function activeDirections() {
    return [...state.keys].map(keyDirection).concat([...state.held.values()]).filter(Boolean);
  }
  function clearMovement(returnToIdle = true) {
    const wasMoving = state.keys.size || state.held.size;
    state.keys.clear(); state.held.clear();
    document.querySelectorAll('[data-move]').forEach(button => { delete button.dataset.held; });
    if (returnToIdle && wasMoving && state.ready) setAnimation('idle');
  }
  function beginMovement(direction) {
    if (!state.ready) return;
    setDirection(direction); setAnimation('walk');
    if (state.paused) setPaused(false);
  }
  function tick(time) {
    state.frameId = requestAnimationFrame(tick);
    const dt = state.lastTime ? Math.min(.05, Math.max(0, (time - state.lastTime) / 1000)) : 0;
    state.lastTime = time;
    if (!state.ready || state.paused || document.hidden) return;
    state.manualFrame = null;
    const directions = activeDirections();
    if (directions.length) {
      const dx = Number(directions.includes('east')) - Number(directions.includes('west'));
      const dy = Number(directions.includes('south')) - Number(directions.includes('north'));
      if (dx || dy) {
        const length = Math.hypot(dx, dy), distance = 78 * dt * state.speed;
        state.position.x += dx / length * distance; state.position.y += dy / length * distance;
        clampPosition();
      }
    }
    state.elapsed += dt * state.speed;
    draw();
  }

  document.querySelectorAll('[data-animation]').forEach(button => button.addEventListener('click', () => { clearMovement(false); resetClock(); setAnimation(button.dataset.animation, true); }));
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => { clearMovement(false); resetClock(); setDirection(button.dataset.direction, true); }));
  document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => { state.speed = Number(button.dataset.speed); updateControls(); }));
  $('#play-button').addEventListener('click', () => setPaused(!state.paused, true));
  $('#step-button').addEventListener('click', () => {
    if (!state.ready) return;
    const frames = state.manifest.animations[state.animation].frames;
    const next = (frames.indexOf(currentFrameIndex()) + 1) % frames.length;
    setPaused(true); state.manualFrame = frames[next];
    state.elapsed = next / state.manifest.animations[state.animation].fps;
    draw(); announce(`Frame ${next + 1} of ${frames.length}.`);
  });
  $('#show-guides').addEventListener('change', event => { state.guides = event.target.checked; draw(); });
  detail.addEventListener('keydown', event => {
    const key = normalizeKey(event.key), direction = keyDirection(key);
    if (!direction || !state.ready || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); state.keys.add(key); beginMovement(direction);
  });
  window.addEventListener('keyup', event => {
    const key = normalizeKey(event.key);
    if (!state.keys.has(key)) return;
    state.keys.delete(key);
    const active = activeDirections();
    if (!active.length) setAnimation('idle'); else setDirection(active.at(-1));
  });
  detail.addEventListener('blur', () => clearMovement());
  detail.addEventListener('pointerdown', () => detail.focus({ preventScroll: true }));
  document.querySelectorAll('[data-move]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (!state.ready || event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      state.held.set(event.pointerId, button.dataset.move); button.dataset.held = 'true'; beginMovement(button.dataset.move);
    });
    const release = event => {
      if (!state.held.has(event.pointerId)) return;
      state.held.delete(event.pointerId); delete button.dataset.held;
      const active = activeDirections();
      if (!active.length) setAnimation('idle'); else setDirection(active.at(-1));
    };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    button.addEventListener('keydown', event => {
      if (![' ', 'Enter'].includes(event.key) || !state.ready) return;
      event.preventDefault(); state.held.set(`keyboard-${button.dataset.move}`, button.dataset.move); button.dataset.held = 'true'; beginMovement(button.dataset.move);
    });
    button.addEventListener('keyup', event => {
      if (![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); state.held.delete(`keyboard-${button.dataset.move}`); delete button.dataset.held;
      if (!activeDirections().length) setAnimation('idle');
    });
    button.addEventListener('blur', () => {
      let clearedHeldInput = false;
      for (const [input, direction] of state.held) {
        if (direction !== button.dataset.move) continue;
        state.held.delete(input);
        clearedHeldInput = true;
      }
      if (!clearedHeldInput) return;
      delete button.dataset.held;
      if (!activeDirections().length && state.ready && !state.paused) setAnimation('idle');
    });
  });
  window.addEventListener('blur', () => { clearMovement(); state.lastTime = 0; });
  document.addEventListener('visibilitychange', () => {
    clearMovement(); state.lastTime = 0;
    if (document.hidden) { state.resumeAfterVisibility = !state.paused; setPaused(true); }
    else if (state.resumeAfterVisibility) { state.resumeAfterVisibility = false; setPaused(false); }
  });
  motionPreference.addEventListener?.('change', event => { if (event.matches) { setPaused(true); announce('Animation paused for reduced motion. Use Play when you are ready.'); } });
  window.addEventListener('pagehide', () => { state.controller?.abort(); clearMovement(); cancelAnimationFrame(state.frameId); });
  window.addEventListener('pageshow', event => { if (event.persisted) { state.lastTime = 0; state.frameId = requestAnimationFrame(tick); } });

  async function loadArtwork() {
    state.controller?.abort(); const controller = new AbortController(); state.controller = controller;
    state.ready = false; state.images = {}; state.position = null; clearMovement(false); resetClock();
    controls.disabled = true;
    document.querySelectorAll('[data-move]').forEach(button => { button.disabled = true; });
    loading.hidden = false; errorPanel.hidden = true; $('#stage-state').textContent = 'Loading artwork';
    $('#retry-button').disabled = true; announce('Loading the movement artwork.');
    const timeout = setTimeout(() => controller.abort(new Error('Loading the artwork took too long. Please try again.')), 25000);
    try {
      if (contexts.some(ctx => !ctx)) throw new Error('This browser cannot display the animation canvas.');
      const response = await fetch(MANIFEST_URL, { signal: controller.signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('The movement artwork is not available here yet. Please try again.');
      const manifest = validateManifest(await response.json());
      const imageEntries = await Promise.all(DIRECTIONS.map(async name => [name, await loadImage(manifest.directions[name].imageURL, controller.signal)]));
      if (controller.signal.aborted || state.controller !== controller) return;
      for (const [name, img] of imageEntries) {
        if (!img.naturalWidth || !img.naturalHeight || manifest.directions[name].frames.some(f => f.x + f.width > img.naturalWidth || f.y + f.height > img.naturalHeight)) {
          throw new Error(`The ${name} frame map does not fit its artwork.`);
        }
      }
      state.manifest = manifest; state.images = Object.fromEntries(imageEntries); state.ready = true;
      controls.disabled = false;
      document.querySelectorAll('[data-move]').forEach(button => { button.disabled = false; });
      loading.hidden = true; resize(); updateControls();
      announce(state.paused ? 'Artwork ready. Animation is paused; use Play or step through the frames.' : 'Artwork ready. Choose an animation and direction, or move in the clearing.');
    } catch (error) {
      if (state.controller !== controller) return;
      loading.hidden = true; errorPanel.hidden = false;
      $('#error-message').textContent = controller.signal.aborted ? 'Loading the artwork took too long. Please try again.' : error.message;
      $('#stage-state').textContent = 'Artwork unavailable'; $('#playback-label').textContent = 'Waiting for artwork';
      $('#frame-label').textContent = 'Frame —'; $('#retry-button').disabled = false;
      announce('The artwork could not load. Use Try again to retry.'); draw();
    } finally { clearTimeout(timeout); }
  }
  $('#retry-button').addEventListener('click', loadArtwork);
  const observer = new ResizeObserver(resize); canvases.forEach(canvas => observer.observe(canvas));
  window.addEventListener('resize', resize, { passive: true });
  updateControls(); resize(); loadArtwork(); state.frameId = requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') bootViewer();
