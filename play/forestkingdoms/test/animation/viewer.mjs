/**
 * Forest Kingdoms — FK-02 character animation study.
 * Movement and combat keep their own atlas coordinates, pivots, and body scale.
 * No game state, wallet code, remote library, or rendering engine is imported.
 */

const DIRECTIONS = ['north', 'east', 'south', 'west'];
const MANIFEST_URL = new URL('../assets/hero-sprites/animations.json', import.meta.url);
const MANIFESTS = [
  { name: 'movement', url: MANIFEST_URL, animations: ['idle', 'walk'] },
  { name: 'combat', url: new URL('../assets/hero-sprites/combat.json', import.meta.url), animations: ['strike', 'cast', 'hit', 'defeat'] }
];
const LABELS = { idle: 'Idle', walk: 'Walking', strike: 'Strike', cast: 'Root cast', hit: 'Hit reaction', defeat: 'Defeat' };
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Return an atlas frame index from a named animation definition and time. */
export function chooseFrame(animation, elapsedSeconds = 0, speed = 1) {
  if (!animation || !Array.isArray(animation.frames) || !animation.frames.length) return 0;
  const fps = Math.max(0, finite(animation.fps, 4));
  const tick = Math.floor(Math.max(0, finite(elapsedSeconds)) * Math.max(0, finite(speed, 1)) * fps);
  const index = animation.loop === false ? Math.min(tick, animation.frames.length - 1) : tick % animation.frames.length;
  return animation.frames[index];
}

/** A one-shot action keeps its final pose after every frame has had screen time. */
export function animationFinished(animation, elapsedSeconds = 0) {
  if (animation?.loop !== false || !animation.frames?.length) return false;
  const fps = Math.max(0, finite(animation.fps, 4));
  return fps > 0 && Math.max(0, finite(elapsedSeconds)) >= animation.frames.length / fps;
}

/** Frame stepping wraps movement loops, but never silently restarts a reaction. */
export function nextFrame(animation, currentIndex) {
  const frames = animation?.frames;
  if (!Array.isArray(frames) || !frames.length) return 0;
  const next = Math.max(0, frames.indexOf(currentIndex) + 1);
  return frames[animation.loop === false ? Math.min(next, frames.length - 1) : next % frames.length];
}

/** An action cancels held movement; OS repeats cannot revive it without a fresh press. */
export function acceptMovementKey(heldInputs, key, repeated = false) {
  return !repeated || heldInputs.has(key);
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

export function validateManifest(raw, manifestURL = MANIFEST_URL, requiredAnimations = ['idle', 'walk']) {
  if (!raw || typeof raw !== 'object') throw new Error('The animation list is unavailable.');
  const cell = { width: finite(raw.cell?.width, 256), height: finite(raw.cell?.height, 512) };
  if (cell.width <= 0 || cell.height <= 0) throw new Error('The animation cell size is invalid.');
  cell.pivot = raw.cell?.pivot || { x: cell.width / 2, y: cell.height - 40 };
  const animations = {};
  for (const name of requiredAnimations) {
    const entry = raw.animations?.[name];
    if (!entry || !Array.isArray(entry.frames) || !entry.frames.length || entry.frames.some(i => !Number.isInteger(i) || i < 0)) {
      throw new Error(`The ${name} animation is not ready to view.`);
    }
    animations[name] = { frames: entry.frames, fps: clamp(finite(entry.fps, name === 'walk' ? 8 : 4), .1, 60), loop: entry.loop !== false };
  }
  const directions = {};
  for (const name of DIRECTIONS) {
    const entry = raw.directions?.[name];
    if (!entry || typeof entry.file !== 'string') throw new Error(`The ${name} artwork is missing from the animation list.`);
    const imageURL = new URL(entry.file, manifestURL);
    if (imageURL.origin !== manifestURL.origin || !imageURL.pathname.startsWith(new URL('.', manifestURL).pathname)) {
      throw new Error('The artwork must be included with this animation study.');
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
  const actionControls = $('#action-controls');
  const loading = $('#loading-panel'), errorPanel = $('#error-panel');
  const status = $('#study-status');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    ready: false, direction: 'south', animation: 'idle', elapsed: 0, speed: 1,
    paused: motionPreference.matches, guides: false, position: null, sources: {},
    keys: new Set(), held: new Map(), animations: {}, display: null, lastTime: 0, frameId: 0,
    resumeAfterVisibility: false, controller: null, manualFrame: null
  };
  const sizes = [{ width: 1, height: 1, dpr: 1 }, { width: 1, height: 1, dpr: 1 }];

  function announce(text) { status.textContent = text; }
  function resetClock() { state.elapsed = 0; state.manualFrame = null; state.lastTime = 0; }
  function currentAnimation() { return state.animations[state.animation]; }
  function currentArtwork() { return state.sources[currentAnimation().source]; }
  function setAnimation(name, announceChange = false) {
    if (!state.ready || !state.animations[name]) return;
    if (state.animation !== name) { state.animation = name; resetClock(); }
    updateControls(); draw();
    if (announceChange) announce(`${LABELS[name]} animation, facing ${state.direction}.${state.paused ? ' Paused; use Play or Step to review.' : ''}`);
  }
  function setDirection(name, announceChange = false) {
    if (!state.ready || !DIRECTIONS.includes(name)) return;
    // A turn changes the view of the current step, not which foot is planted.
    // Explicit direction buttons reset the clock in their own review handler.
    if (state.direction !== name) {
      state.direction = name;
      if (state.animation !== 'walk') resetClock();
    }
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
  function replay() {
    if (!state.ready) return;
    clearMovement(false); resetClock(); setPaused(false);
    announce(`${LABELS[state.animation]} playing from the first frame, facing ${state.direction}.`);
  }
  function updateControls() {
    document.querySelectorAll('[data-animation]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.animation === state.animation)));
    document.querySelectorAll('[data-direction]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === state.direction)));
    document.querySelectorAll('[data-speed]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed)));
    const finished = state.ready && animationFinished(currentAnimation(), state.elapsed);
    $('#play-button').textContent = finished ? 'Replay' : state.paused ? 'Play' : 'Pause';
    $('#play-button').setAttribute('aria-pressed', String(state.paused));
    $('#play-button').setAttribute('aria-label', finished ? 'Replay the animation from the first frame' : state.paused ? 'Play the animation' : 'Pause the animation');
    if (state.ready) {
      $('#stage-state').textContent = `${state.direction[0].toUpperCase() + state.direction.slice(1)} · ${LABELS[state.animation]}`;
      $('#playback-label').textContent = finished ? 'Final pose held' : state.paused ? 'Paused' : `${state.speed}× playback`;
      $('#action-status').textContent = finished ? `${LABELS[state.animation]} complete. Replay to start again, or move to return to walking.` : currentAnimation().loop ? 'Choose an action to review its full sequence.' : state.paused ? `${LABELS[state.animation]} is paused. Use Play or Step to review the sequence.` : `${LABELS[state.animation]} plays once, then holds the final pose.`;
    }
  }
  function currentFrameIndex() {
    if (state.manualFrame !== null) return state.manualFrame;
    return chooseFrame(currentAnimation(), state.elapsed);
  }
  function bodyHeightFor(canvasIndex) {
    const target = canvasIndex ? 88 : state.display.detailHeight;
    if (canvasIndex) return target;
    const bounds = extents(target), size = sizes[0];
    const fit = Math.min(1, (size.width - 42) / Math.max(1, bounds.left + bounds.right), (size.height - 62) / Math.max(1, bounds.up + bounds.down));
    return Math.max(1, target * fit);
  }
  function extents(height) {
    const bounds = { left: 0, right: 0, up: 0, down: 0 };
    for (const source of Object.values(state.sources)) {
      for (const direction of Object.values(source.manifest.directions)) {
        const scale = height / direction.bodyHeight * direction.scale;
        for (const frame of direction.frames) {
          bounds.left = Math.max(bounds.left, frame.pivot.x * scale);
          bounds.right = Math.max(bounds.right, (frame.width - frame.pivot.x) * scale);
          bounds.up = Math.max(bounds.up, frame.pivot.y * scale);
          bounds.down = Math.max(bounds.down, (frame.height - frame.pivot.y) * scale);
        }
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
    if (state.ready) {
      const bounds = extents(88);
      actual.parentElement.style.height = `${Math.max(166, Math.ceil(bounds.up + bounds.down + 32))}px`;
    }
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
      if (!state.ready) return;
      const artwork = currentArtwork();
      const direction = artwork.manifest.directions[state.direction];
      const frameIndex = currentFrameIndex();
      const frame = direction.frames[frameIndex];
      const height = bodyHeightFor(index);
      const x = index ? size.width / 2 : state.position?.x ?? size.width / 2;
      const y = index ? size.height - extents(height).down - 16 : state.position?.y ?? size.height * .78;
      ctx.save(); ctx.fillStyle = '#08180d50'; ctx.beginPath(); ctx.ellipse(x, y + 2, height * .2, height * .045, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (state.guides) drawGuides(ctx, size, x, y, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawHeroFrame(ctx, artwork.images[state.direction], frame, { x, y, height, bodyHeight: direction.bodyHeight, scale: direction.scale });
      if (!index) {
        const frames = currentAnimation().frames;
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
    if (!state.ready || state.paused || document.hidden || animationFinished(currentAnimation(), state.elapsed)) return;
    state.manualFrame = null;
    const directions = activeDirections();
    let elapsedStep = dt * state.speed;
    if (directions.length) {
      const previous = { ...state.position };
      const dx = Number(directions.includes('east')) - Number(directions.includes('west'));
      const dy = Number(directions.includes('south')) - Number(directions.includes('north'));
      if (dx || dy) {
        const length = Math.hypot(dx, dy), distance = 78 * dt * state.speed;
        state.position.x += dx / length * distance; state.position.y += dy / length * distance;
        clampPosition();
      }
      // Only advance a moving stride by distance actually covered. Opposing
      // inputs and a clamped stage edge must not keep cycling the feet.
      elapsedStep = Math.hypot(state.position.x - previous.x, state.position.y - previous.y) / 78;
    }
    state.elapsed += elapsedStep;
    if (animationFinished(currentAnimation(), state.elapsed)) {
      state.elapsed = currentAnimation().frames.length / currentAnimation().fps;
      updateControls();
      announce(`${LABELS[state.animation]} complete. Final pose held. Use Replay to see it again.`);
    }
    draw();
  }

  function selectAnimation(name) {
    if (!state.ready) return;
    clearMovement(false); resetClock();
    if (motionPreference.matches) state.paused = true;
    setAnimation(name, true);
  }
  document.querySelectorAll('[data-animation]').forEach(button => button.addEventListener('click', () => selectAnimation(button.dataset.animation)));
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
    clearMovement(false); resetClock();
    if (motionPreference.matches) state.paused = true;
    setDirection(button.dataset.direction, true);
  }));
  document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => { state.speed = Number(button.dataset.speed); updateControls(); }));
  $('#play-button').addEventListener('click', () => {
    if (state.ready && animationFinished(currentAnimation(), state.elapsed)) replay();
    else setPaused(!state.paused, true);
  });
  $('#replay-button').addEventListener('click', replay);
  $('#step-button').addEventListener('click', () => {
    if (!state.ready) return;
    const animation = currentAnimation(), frame = nextFrame(animation, currentFrameIndex());
    const index = animation.frames.indexOf(frame);
    setPaused(true); state.manualFrame = frame; state.elapsed = index / animation.fps;
    updateControls(); draw(); announce(`Frame ${index + 1} of ${animation.frames.length}.${animation.loop === false && index === animation.frames.length - 1 ? ' Final pose; use Replay to start again.' : ''}`);
  });
  $('#show-guides').addEventListener('change', event => { state.guides = event.target.checked; draw(); });
  detail.addEventListener('keydown', event => {
    const key = normalizeKey(event.key), direction = keyDirection(key);
    if (!state.ready || event.altKey || event.ctrlKey || event.metaKey) return;
    if (direction) {
      event.preventDefault();
      if (!acceptMovementKey(state.keys, key, event.repeat)) return;
      state.keys.add(key); beginMovement(direction);
      return;
    }
    const action = { j: 'strike', k: 'cast', h: 'hit', x: 'defeat' }[key];
    if (!action && key !== 'r') return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === 'r') replay(); else selectAnimation(action);
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
      event.preventDefault();
      const input = `keyboard-${button.dataset.move}`;
      if (!acceptMovementKey(state.held, input, event.repeat)) return;
      state.held.set(input, button.dataset.move); button.dataset.held = 'true'; beginMovement(button.dataset.move);
    });
    button.addEventListener('keyup', event => {
      if (![' ', 'Enter'].includes(event.key)) return;
      if (!state.held.has(`keyboard-${button.dataset.move}`)) return;
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
  motionPreference.addEventListener?.('change', event => { if (event.matches) { state.resumeAfterVisibility = false; setPaused(true); announce('Animation paused for reduced motion. Use Play when you are ready.'); } });
  window.addEventListener('pagehide', () => { state.controller?.abort(); clearMovement(); cancelAnimationFrame(state.frameId); });
  window.addEventListener('pageshow', event => { if (event.persisted) { state.lastTime = 0; state.frameId = requestAnimationFrame(tick); } });

  async function loadArtwork() {
    state.controller?.abort(); const controller = new AbortController(); state.controller = controller;
    state.ready = false; state.sources = {}; state.animations = {}; state.position = null; clearMovement(false); resetClock();
    controls.disabled = true; actionControls.disabled = true;
    document.querySelectorAll('[data-move]').forEach(button => { button.disabled = true; });
    loading.hidden = false; errorPanel.hidden = true; $('#stage-state').textContent = 'Loading artwork';
    $('#retry-button').disabled = true; announce('Loading the movement and combat artwork.');
    const timeout = setTimeout(() => controller.abort(new Error('Loading the artwork took too long. Please try again.')), 25000);
    try {
      if (contexts.some(ctx => !ctx)) throw new Error('This browser cannot display the animation canvas.');
      const sources = await Promise.all(MANIFESTS.map(async source => {
        const response = await fetch(source.url, { signal: controller.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error(`The ${source.name} artwork is not available here yet. Please try again.`);
        const manifest = validateManifest(await response.json(), source.url, source.animations);
        const imageEntries = await Promise.all(DIRECTIONS.map(async name => [name, await loadImage(manifest.directions[name].imageURL, controller.signal)]));
        for (const [name, img] of imageEntries) {
          if (!img.naturalWidth || !img.naturalHeight || manifest.directions[name].frames.some(f => f.x + f.width > img.naturalWidth || f.y + f.height > img.naturalHeight)) {
            throw new Error(`The ${name} ${source.name} frame map does not fit its artwork.`);
          }
        }
        return [source.name, { manifest, images: Object.fromEntries(imageEntries) }];
      }));
      if (controller.signal.aborted || state.controller !== controller) return;
      state.sources = Object.fromEntries(sources);
      for (const [source, artwork] of sources) {
        for (const [name, animation] of Object.entries(artwork.manifest.animations)) state.animations[name] = { ...animation, source };
      }
      state.display = state.sources.movement.manifest.display; state.ready = true;
      controls.disabled = false; actionControls.disabled = false;
      document.querySelectorAll('[data-move]').forEach(button => { button.disabled = false; });
      loading.hidden = true; resize(); updateControls();
      announce(state.paused ? 'Artwork ready. Animation is paused; use Play or step through the frames.' : 'Artwork ready. Choose a movement or combat action and direction, or move in the clearing.');
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
