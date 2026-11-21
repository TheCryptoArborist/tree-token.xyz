/* Actual collision / tree reaction / ride / particle / UI integration.
   Only the renderer, canvas painter, audio device and user input are stubbed. */
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const base = path.resolve(__dirname, ".."), THREE = require("../vendor/three.min.js"), html = fs.readFileSync(path.join(base, "index.html"), "utf8");
class Element {
  constructor() {
    this.style = {}; this.dataset = {}; this.listeners = {}; this.value = "0"; this.hidden = false;
    this.tagName = "DIV"; this.textContent = ""; this.innerHTML = ""; this.disabled = false;
    const tokens = new Set(); this.classList = { add: x => tokens.add(x), remove: x => tokens.delete(x), contains: x => tokens.has(x),
      toggle: (x, v) => { if (v) tokens.add(x); else tokens.delete(x); } };
  }
  appendChild() {} setPointerCapture() {} blur() {} focus() {}
  setAttribute(k, v) { this[k] = v; }
  addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
  dispatch(k, props = {}) { for (const fn of this.listeners[k] || []) fn({ target: this, preventDefault() {}, ...props }); }
  querySelector() { return this.child ||= new Element(); }
  getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); }
}
function fixture(radius = .6) {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const document = new Element(); document.body = new Element(); document.hidden = false;
  document.getElementById = id => elements[id] || null; document.createElement = () => new Element(); document.querySelectorAll = () => [];
  const listeners = {}, raf = [], errors = [], options = { damage: 85, speed: 12 };
  let time = 0, scene, camera, canvas, state, world, tree, trunks, soundStops = 0, stopsAtImpact = null, hit = null;
  class Renderer {
    constructor() { this.domElement = canvas = new Element(); this.shadowMap = {}; this.info = { render: { calls: 0 } }; }
    setSize() {} setPixelRatio() {}
    render(s, c) { scene = s; camera = c; s.updateMatrixWorld(true); c.updateMatrixWorld(true); }
  }
  const context = vm.createContext({ THREE: { ...THREE, WebGLRenderer: Renderer }, document, console,
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, performance: { now: () => time },
    requestAnimationFrame: f => raf.push(f), addEventListener: (n, f) => (listeners[n] ||= []).push(f), showBootError: e => errors.push(e) });
  context.window = context;
  for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
    if (file.startsWith("vendor/")) continue;
    vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context, { filename: file });
    if (file === "route.js") Object.assign(context.DeadfallRoute, { LENGTH: 1800, WIDTH: 12,
      frame: (d, x = 0) => ({ p: new THREE.Vector3(x, 0, -d), yaw: 0, f: new THREE.Vector3(0, 0, -1) }),
      surfaceHeight: () => 0, terrainHeight: () => 0, nearest: p => ({ d: -p.z, lane: p.x, dist: Math.abs(p.x) }) });
    if (file === "physics.js") {
      const create = context.DeadfallPhysics.createState;
      context.DeadfallPhysics.createState = d => { state = create(d); state.pos.x = 20; state.speed = options.speed; state.damage = options.damage; return state; };
    }
    if (file === "world.js") context.DeadfallWorld.create = s => {
      const reactions = context.DeadfallWorld.reactions(), material = new THREE.MeshBasicMaterial();
      const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2, 5, 8), material, 1);
      trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius, radius, 5, 8), material, 1);
      const base = new THREE.Vector3(20, 0, -12), pose = new THREE.Matrix4().makeTranslation(20, 2.4, -12);
      crowns.setMatrixAt(0, new THREE.Matrix4().makeTranslation(20, 0, -12)); trunks.setMatrixAt(0, pose); s.add(crowns, trunks);
      tree = { id: "test-tree", kind: "tree", a: base, radius };
      reactions.tree(crowns, trunks, 0, base, 1, 0, tree);
      return world = { solids: [tree], sun: new THREE.DirectionalLight(), reset: reactions.reset,
        impact: h => { hit = h; stopsAtImpact = soundStops; reactions.impact(h); }, update: (p, d, dt) => reactions.update(dt) };
    };
    if (file === "audio.js") {
      const create = context.DeadfallAudio.create;
      context.DeadfallAudio.create = () => { const sound = create(), stop = sound.stop;
        sound.stop = () => { soundStops++; stop(); }; return sound; };
    }
  }
  function frames(n) { for (let i = 0; i < n; i++) { time += 1000 / 60; assert(raf.length); raf.shift()(time); } assert.deepEqual(errors, []); }
  function key(code) { for (const fn of listeners.keydown || []) fn({ code, target: { tagName: "BODY" }, preventDefault() {} }); }
  return { elements, document, options, frames, key, get state() { return state; }, get scene() { return scene; },
    get camera() { return camera; }, get canvas() { return canvas; }, get hit() { return hit; }, get tree() { return tree; },
    get soundStops() { return soundStops; }, get stopsAtImpact() { return stopsAtImpact; },
    treeMatrix() { const m = new THREE.Matrix4(); trunks.getMatrixAt(0, m); return m; },
    begin() { elements.drive.dispatch("click"); },
    impact() { for (let i = 0; i < 600 && !hit; i++) frames(1); assert(hit, "did not reach test tree"); } };
}
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
test("a fatal tree impact animates the scene before showing results and stops driving input", () => {
  const f = fixture(); f.begin(); f.impact();
  assert(f.state.disabled); assert.equal(f.state.damage, 100); assert.equal(f.state.speed, 0);
  assert(!f.elements.result.classList.contains("active")); assert.equal(f.soundStops, f.stopsAtImpact);
  const pos = f.state.pos.clone(), matrix = f.treeMatrix(), elapsed = f.state.elapsed;
  f.key("KeyW"); f.key("ArrowLeft"); f.frames(12);
  assert(f.state.pos.equals(pos)); assert.equal(f.state.elapsed, elapsed); assert(!f.treeMatrix().equals(matrix));
  const tractor = f.scene.getObjectByName("Logging tractor"), trailer = f.scene.getObjectByName("Articulated log semitrailer");
  assert(Math.abs(tractor.userData.ridePivot.rotation.x) > .002);
  const fifth = tractor.userData.visual.localToWorld(new THREE.Vector3(0, 1.42, 2.25));
  assert(fifth.distanceTo(trailer.userData.visual.localToWorld(new THREE.Vector3(0, 1.42, -4.85))) < 1e-9);
  assert(f.scene.getObjectByName("Exhaust and impact particles").geometry.attributes.aAlpha.array.some(v => v > 0));
  f.frames(160); assert(f.elements.result.classList.contains("active")); assert(f.elements.result.classList.contains("crash-result"));
  assert(f.elements.resultReason.textContent.includes("Tree impact at")); assert(f.elements.resultReason.textContent.includes("Tractor contact"));
  assert.equal(f.elements.again.textContent, "RESTART DESCENT"); assert(f.state.pos.equals(pos));
});
test("pause freezes crash time, suspension, debris and the tree; resume finishes the aftermath", () => {
  const f = fixture(); f.begin(); f.impact(); f.frames(8); f.elements.pause.dispatch("click");
  const tree = f.treeMatrix(), tractor = f.scene.getObjectByName("Logging tractor"), pitch = tractor.userData.ridePivot.rotation.x;
  const cloud = f.scene.getObjectByName("Exhaust and impact particles"), particles = Array.from(cloud.geometry.attributes.position.array);
  f.frames(240); assert(!f.elements.result.classList.contains("active")); assert(f.treeMatrix().equals(tree));
  assert.equal(tractor.userData.ridePivot.rotation.x, pitch); assert.deepEqual(Array.from(cloud.geometry.attributes.position.array), particles);
  f.elements.resume.dispatch("click"); f.frames(180); assert(f.elements.result.classList.contains("active"));
});
test("a crash remains inspectable and restart restores the truck, trees and controls", () => {
  const f = fixture(); const original = f.treeMatrix(); f.begin(); f.impact(); f.frames(180);
  const before = f.camera.position.clone(); f.canvas.dispatch("pointerdown", { clientX: 500, clientY: 300, pointerId: 1 });
  f.canvas.dispatch("pointermove", { clientX: 750, clientY: 300, pointerId: 1 }); f.canvas.dispatch("pointerup", { pointerId: 1 });
  f.frames(60); assert(f.camera.position.distanceTo(before) > 4);
  f.options.speed = f.options.damage = 0; f.elements.again.dispatch("click");
  assert.equal(f.state.damage, 0); assert.equal(f.state.logs, 5); assert(!f.state.disabled);
  assert(!f.elements.result.classList.contains("active")); assert(!f.document.body.classList.contains("crashed")); assert(f.treeMatrix().equals(original));
  f.key("KeyW"); f.frames(60); assert(f.state.speed > .5);
});
test("a low-speed tree impact remains drivable and the player can reverse clear", () => {
  const f = fixture(); f.options.speed = 5; f.options.damage = 0; f.begin(); f.impact(); f.frames(30);
  assert(f.hit.speed < 4.5);
  assert(!f.state.disabled); assert(f.state.damage > 0 && f.state.damage < 10); assert(!f.elements.result.classList.contains("active"));
  const z = f.state.pos.z, damage = f.state.damage; f.key("KeyV"); f.frames(180);
  assert(f.state.pos.z > z + 1); assert.equal(f.state.damage, damage);
});
test("a small tree can finish falling even when its impact disables the truck", () => {
  const f = fixture(.23); f.options.damage = 99; f.begin(); f.impact(); assert(f.hit.broken); assert(f.tree.disabled);
  f.frames(300); assert(f.elements.result.classList.contains("active"));
  const up = new THREE.Vector3(0, 1, 0).transformDirection(f.treeMatrix()); assert(up.y < .15);
  const alpha = f.scene.getObjectByName("Exhaust and impact particles").geometry.attributes.aAlpha.array;
  assert(Array.from(alpha).every(v => v === 0), "disabled engine kept making smoke or debris froze");
});
console.log(`\n${count} crash lifecycle checks passed with actual collisions and scene transforms; no GPU playtest.`);
