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
const listeners = {}, raf = [], failures = []; let time = 0, scene;
class Renderer {
  constructor() { this.domElement = new Element(); this.shadowMap = {}; this.info = { render: { calls: 0 } }; }
  setSize() {} setPixelRatio() {}
  render(s, c) { scene = s; s.updateMatrixWorld(true); c.updateMatrixWorld(true); }
}
const context = vm.createContext({ THREE: { ...THREE, WebGLRenderer: Renderer }, document, console,
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, performance: { now: () => time },
  requestAnimationFrame: f => raf.push(f), addEventListener: (n, f) => (listeners[n] ||= []).push(f),
  showBootError: x => failures.push(x) }); context.window = context;
for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
  if (file.startsWith("vendor/")) continue;
  vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context, { filename: file });
}
function key(type, code) { for (const f of listeners[type] || []) f({ target: { tagName: "BODY" }, code, preventDefault() {} }); }
function frames(n) { for (let i = 0; i < n; i++) { time += 1000 / 60; const f = raf.shift(); assert(f); f(time); } }
let count = 0;
function test(name, run) { run(); assert.deepEqual(failures, []); count++; console.log(`PASS ${name}`); }
test("handling page initializes actual geometry and enables Start", () => {
  assert.equal(elements.drive.disabled, false); assert.equal(elements.drive.textContent, "START HANDLING TEST");
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
  assert(Number(elements.speed.textContent) > 8); elements.pause.dispatch("click"); frames(1);
  const time = elements.labTime.textContent; frames(120); assert.equal(elements.labTime.textContent, time);
  elements.resume.dispatch("click"); elements.retry.dispatch("click"); frames(6);
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
console.log(`\n${count} handling lifecycle checks passed with DOM/renderer stubs.`);
