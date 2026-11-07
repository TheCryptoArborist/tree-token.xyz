/* Lifecycle checks using real scene code and a stub renderer, not a browser. */
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const base = path.resolve(__dirname, ".."), THREE = require("../vendor/three.min.js");
class Element {
  constructor() {
    this.style = {}; this.dataset = {}; this.listeners = {}; this.value = "0"; this.hidden = false;
    this.tagName = "DIV"; this.textContent = ""; this.innerHTML = ""; this.disabled = false;
    const tokens = new Set(); this.classList = { add: x => tokens.add(x), remove: x => tokens.delete(x), contains: x => tokens.has(x),
      toggle: (x, force) => { if (force) tokens.add(x); else tokens.delete(x); } };
  }
  appendChild() {} setPointerCapture() {} blur() {}
  focus() { document.activeElement = this; }
  click() { this.dispatch("click"); }
  setAttribute(n, v) { this[n] = v; }
  addEventListener(n, f) { (this.listeners[n] ||= []).push(f); }
  dispatch(n, props = {}) { for (const f of this.listeners[n] || []) f({ target: this, preventDefault() {}, ...props }); }
  querySelector() { return this.child ||= new Element(); }
  getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); }
}
const html = fs.readFileSync(path.join(base, "handling.html"), "utf8");
const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
const testButtons = ["braking", "grade", "turns", "reverse"].map(id => { const e = new Element(); e.dataset.test = id; return e; });
const touchButtons = ["brake", "engine", "reverse", "throttle"].map(id => { const e = new Element(); e.dataset.control = id; return e; });
const document = new Element(); document.body = new Element(); document.hidden = false;
document.body.classList.add("handling");
document.getElementById = id => elements[id] || null; document.createElement = () => new Element();
document.querySelectorAll = s => s === "[data-test]" ? testButtons : s === "[data-control]" ? touchButtons : [];
const listeners = {}, raf = [], failures = []; let time = 0, scene, pads = [], audioDriving = false, audioStops = 0, lastState;
class Renderer {
  constructor() { this.domElement = new Element(); this.shadowMap = {}; this.info = { render: { calls: 0 } }; }
  setSize() {} setPixelRatio() {}
  render(s, c) { scene = s; s.updateMatrixWorld(true); c.updateMatrixWorld(true); }
}
const context = vm.createContext({ THREE: { ...THREE, WebGLRenderer: Renderer }, document, console,
  navigator: { getGamepads: () => pads }, localStorage: { getItem: () => null, setItem() {} },
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, performance: { now: () => time },
  requestAnimationFrame: f => raf.push(f), addEventListener: (n, f) => (listeners[n] ||= []).push(f),
  showBootError: x => failures.push(x) }); context.window = context;
for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
  if (file.startsWith("vendor/")) continue;
  vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context, { filename: file });
  if (file === "physics.js") {
    const step = context.DeadfallPhysics.step;
    context.DeadfallPhysics.step = (...args) => { lastState = args[0]; return step(...args); };
  }
  if (file === "audio.js") {
    const create = context.DeadfallAudio.create;
    context.DeadfallAudio.create = () => {
      const sound = create(), update = sound.update, stop = sound.stop;
      sound.update = (...args) => { audioDriving = args[2]; return update(...args); };
      sound.stop = () => { audioStops++; return stop(); };
      return sound;
    };
  }
}
function key(type, code) { for (const f of listeners[type] || []) f({ target: { tagName: "BODY" }, code, preventDefault() {} }); }
function frames(n) { for (let i = 0; i < n; i++) { time += 1000 / 60; const f = raf.shift(); assert(f); f(time); } }
let count = 0;
function test(name, run) { run(); assert.deepEqual(failures, []); count++; console.log(`PASS ${name}`); }
test("handling page initializes actual geometry and enables Start", () => {
  assert.equal(elements.drive.disabled, false); assert.equal(elements.drive.textContent, "START HANDLING TEST");
  assert.equal(elements.soundToggle.disabled, true); assert.equal(elements.soundSummary.textContent, "SOUND · N/A");
  assert(scene.getObjectByName("Handling road"));
  scene.traverse(o => { if (o.isMesh) for (const attr of Object.values(o.geometry.attributes)) for (const n of attr.array) assert(Number.isFinite(n)); });
});
test("all four test selectors load the correct starting scenario", () => {
  for (const button of testButtons) {
    button.dispatch("click"); elements.drive.dispatch("click"); frames(1);
    assert.equal(elements.labTitle.textContent, context.DeadfallLab.tests[button.dataset.test].title);
    assert.equal(button["aria-pressed"], "true"); elements.menu.dispatch("click");
  }
});
test("Start, throttle, Pause, Resume, and Retry control the lab lifecycle", () => {
  testButtons[0].dispatch("click"); elements.drive.dispatch("click"); key("keydown", "KeyW"); frames(240);
  assert(Number(elements.speed.textContent) > 8); assert.equal(audioDriving, true);
  const stops = audioStops; elements.pause.dispatch("click"); assert(audioStops > stops); frames(1); assert.equal(audioDriving, false);
  const time = elements.labTime.textContent; frames(120); assert.equal(elements.labTime.textContent, time);
  elements.resume.dispatch("click"); elements.retry.dispatch("click"); frames(6);
  assert.equal(audioDriving, true);
  assert.equal(elements.cargo.textContent, "5/5"); assert.equal(elements.damageText.textContent, "0%");
  assert(Number(elements.speed.textContent) < 1); assert(parseFloat(elements.labTime.textContent) < .2);
});
test("keyboard braking reaches the result screen and Retry restores the attempt", () => {
  let braking = false;
  for (let i = 0; i < 2400 && !elements.result.classList.contains("active"); i++) {
    braking ||= elements.labPhase.textContent.startsWith("Brake now");
    if (braking) { key("keyup", "KeyW"); key("keydown", "KeyS"); }
    else if (Number(elements.speed.textContent) < 20) key("keydown", "KeyW");
    else key("keyup", "KeyW");
    frames(1);
  }
  assert(elements.result.classList.contains("active")); assert.equal(elements.resultKicker.textContent, "TEST PASSED");
  assert(elements.resultStats.innerHTML.includes("Stop distance from line"));
  elements.retryResult.dispatch("click"); assert(!elements.result.classList.contains("active"));
  elements.menu.dispatch("click"); assert(elements.start.classList.contains("active"));
});
test("reverse test starts in overhead view and holds a connected hitch while backing", () => {
  testButtons[3].dispatch("click"); elements.drive.dispatch("click");
  assert(elements.camera.textContent.includes("OVERHEAD")); key("keydown", "KeyV"); frames(180); key("keyup", "KeyV");
  assert.equal(elements.gear.textContent, "R");
  const t = scene.getObjectByName("Logging tractor"), r = scene.getObjectByName("Articulated log semitrailer"), P = context.DeadfallPhysics;
  assert(t.localToWorld(P.HITCH.clone()).distanceTo(r.localToWorld(P.KINGPIN.clone())) < 1e-9);
  elements.camera.dispatch("click"); assert(elements.camera.textContent.includes("CHASE"));
  elements.menu.dispatch("click"); assert(elements.start.classList.contains("active"));
});
const pad = { id: "Synthetic NES-style pad", mapping: "standard", index: 0, connected: true, axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
function hold(index, pressed) { pad.buttons[index] = { pressed, value: Number(pressed) }; }
function tap(index) { hold(index, true); frames(1); hold(index, false); frames(2); }
function releasePad() { pad.buttons.forEach((_, i) => hold(i, false)); pad.axes = [0, 0]; frames(2); }
test("controller navigates the lab menu, starts, drives, steers and brakes", () => {
  pads = [pad]; frames(2); assert(elements.controllerStatus.textContent.includes("ready"));
  tap(12); tap(12); tap(12); // reverse -> turns -> grade -> braking
  assert.equal(testButtons[0]["aria-pressed"], "true");
  elements.drive.disabled = true; tap(9); assert(!document.body.classList.contains("driving"));
  elements.drive.disabled = false; tap(9);
  assert.equal(elements.labTitle.textContent, "20 mph stop");
  hold(0, true); frames(240); assert(Number(elements.speed.textContent) > 8);
  const t = scene.getObjectByName("Logging tractor"), yaw = t.rotation.y;
  hold(14, true); frames(60); hold(14, false); assert(t.rotation.y > yaw);
  hold(1, true); frames(180); assert.equal(Number(elements.speed.textContent), 0); // Brake wins over held A.
  releasePad();
});
test("controller pause and camera actions fire once while held", () => {
  hold(9, true); frames(60); assert.equal(elements.paused.hidden, false);
  const stopped = elements.labTime.textContent; frames(120); assert.equal(elements.labTime.textContent, stopped);
  releasePad(); tap(8); assert(elements.camera.textContent.includes("HOOD"));
  hold(8, true); frames(60); assert(elements.camera.textContent.includes("INSPECT"));
  releasePad(); tap(9); assert.equal(elements.paused.hidden, true);
});
test("unplugging pauses immediately and reconnecting cannot retain throttle", () => {
  elements.retry.dispatch("click"); releasePad(); hold(0, true); frames(60);
  pads = []; frames(2); assert.equal(elements.paused.hidden, false);
  const stopped = elements.labTime.textContent; frames(90); assert.equal(elements.labTime.textContent, stopped);
  pads = [pad]; frames(2); elements.retry.dispatch("click"); frames(60);
  assert.equal(Number(elements.speed.textContent), 0);
  releasePad(); hold(0, true); frames(90); assert(Number(elements.speed.textContent) > 0); releasePad();
});
test("controller setup pauses, traps keyboard focus, cancels and preserves controls", () => {
  elements.controllerOptions.dispatch("click"); assert(!elements.controllerPanel.hidden); assert(!elements.paused.hidden);
  elements.controllerBegin.dispatch("click"); frames(2); assert(elements.controllerPrompt.textContent.includes("LEFT"));
  key("keydown", "Tab"); assert.equal(document.activeElement, elements.controllerCancel);
  key("keydown", "Escape"); assert(elements.controllerPanel.hidden); assert(!elements.paused.hidden);
  assert(elements.controllerStatus.textContent.includes("cancelled"));
  releasePad(); tap(9); assert(elements.paused.hidden);
  elements.menu.dispatch("click");
});
test("D-pad down reverses from rest and D-pad up applies the engine brake", () => {
  releasePad(); tap(13); tap(13); tap(13); tap(9); // braking -> reverse
  assert.equal(elements.labTitle.textContent, "Reverse docking");
  hold(13, true); frames(180); assert.equal(elements.gear.textContent, "R");
  hold(1, true); frames(180); assert.equal(Number(elements.speed.textContent), 0);
  releasePad(); elements.menu.dispatch("click"); releasePad(); tap(12); tap(12); tap(9); // reverse -> grade
  assert.equal(elements.labTitle.textContent, "Downhill control");
  hold(12, true); frames(180); assert(Number(elements.speed.textContent) < 16);
  assert.equal(elements.brakeText.textContent, "COOL");
  releasePad(); elements.menu.dispatch("click");
});
for (const control of ["keyboard", "controller", "touch"]) {
  test(`${control} reverse can coast and reapply power without stopping`, () => {
    releasePad(); testButtons[3].dispatch("click"); elements.drive.dispatch("click"); frames(2);
    const reverse = on => {
      if (control === "keyboard") key(on ? "keydown" : "keyup", "KeyV");
      else if (control === "controller") hold(13, on);
      else touchButtons[2].dispatch(on ? "pointerdown" : "pointerup", { pointerId: 1 });
    };
    reverse(true); frames(60); reverse(false); frames(6);
    const speed = lastState.speed;
    assert(speed < -.25); assert.equal(lastState.reverse, false);
    reverse(true); frames(30);
    assert(lastState.speed < speed - .2, `${control}: no reverse power after coasting`);
    assert.equal(elements.gear.textContent, "R");
    assert(elements.cameraHint.textContent.includes("REVERSING"));
    reverse(false); elements.menu.dispatch("click");
  });
}
test("reverse hints explain a forward-motion lock and held brakes, then clear when released", () => {
  releasePad(); testButtons[3].dispatch("click"); elements.drive.dispatch("click");
  key("keydown", "KeyW"); frames(120); key("keyup", "KeyW");
  key("keydown", "KeyV"); frames(12);
  assert(lastState.speed > .25); assert.equal(lastState.reverse, false);
  assert(elements.cameraHint.textContent.includes("STOP WITH"));
  key("keydown", "KeyS"); frames(120);
  assert.equal(lastState.speed, 0); assert.equal(lastState.reverse, false);
  assert(elements.cameraHint.textContent.includes("RELEASE THE SERVICE BRAKE"));
  key("keyup", "KeyS"); key("keydown", "Space"); frames(6);
  assert(elements.cameraHint.textContent.includes("RELEASE THE ENGINE BRAKE"));
  key("keyup", "Space"); frames(60);
  assert(lastState.speed < -1); assert.equal(elements.gear.textContent, "R");
  key("keyup", "KeyV"); frames(6);
  assert(elements.cameraHint.textContent.includes("V · REVERSE"));
  elements.menu.dispatch("click");
});
console.log(`\n${count} handling lifecycle checks passed with DOM/renderer stubs and synthetic gamepads.`);
