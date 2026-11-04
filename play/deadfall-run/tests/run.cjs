/* Run: node tests/run.cjs. No dependencies, browser, or GPU required.
   This verifies actual Three.js scene construction and game logic, NOT rendered appearance. */
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const base = path.resolve(__dirname, "..");
global.THREE = require(path.join(base, "vendor/three.min.js"));
const R = require(path.join(base, "route.js")), P = require(path.join(base, "physics.js"));
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function rig(d = 0) { const state = P.createState(d), tractor = new THREE.Group(), trailer = new THREE.Group(); P.couple(state, tractor, trailer, true); return { state, tractor, trailer }; }
function advance(r, count, input = {}, dt = 1 / 120, preset = "standard") {
  for (let i = 0; i < count; i++) { P.step(r.state, input, dt, preset); P.couple(r.state, r.tractor, r.trailer); }
}
function gap(r) { return r.tractor.localToWorld(P.HITCH.clone()).distanceTo(r.trailer.localToWorld(P.KINGPIN.clone())); }
test("fifth wheel and kingpin coincide on slopes and during roll", () => {
  const r = rig(); let maximum = 0;
  for (let i = 0; i < 1600; i++) {
    r.state.pos.copy(R.point(i % 1800)); r.state.yaw = i * .051;
    r.state.pitch = Math.sin(i * .1) * .15; r.state.roll = Math.cos(i * .09) * .11;
    P.couple(r.state, r.tractor, r.trailer, i % 30 === 0); maximum = Math.max(maximum, gap(r));
  }
  assert(maximum < 1e-9, `hitch error ${maximum}`);
});
test("trailer starts BEHIND the tractor, aligned to its heading", () => {
  for (const d of [0, 60, 210, 600, 1250, 1700]) {
    const r = rig(d), local = r.tractor.worldToLocal(r.trailer.position.clone());
    assert(local.z > 6.8); assert(Math.abs(local.x) < 1e-7);
    assert(Math.abs(P.angle(r.state.yaw - r.state.trailerYaw)) < 1e-10); assert(gap(r) < 1e-9);
  }
});
test("brakes stop and hold without accidentally reversing", () => {
  const r = rig(); r.state.speed = 9; advance(r, 240, { brake: true });
  assert.equal(r.state.speed, 0); advance(r, 1800, { brake: true }); assert.equal(r.state.speed, 0);
});
test("reverse continues beyond the old 0.8 m/s stall", () => {
  const r = rig(); advance(r, 360, { reverse: true }); assert(r.state.speed < -1.5); assert(r.state.speed >= -3.2);
  assert(gap(r) < 1e-9);
});
test("reverse cannot engage while travelling forward", () => {
  const r = rig(); r.state.speed = 8; advance(r, 120, { reverse: true }); assert(r.state.speed > 0); assert.equal(r.state.reverse, false);
});
test("engine brake reduces speed without service-brake heat", () => {
  const r = rig(); r.state.speed = 14; advance(r, 240, { engine: true });
  assert(r.state.speed < 10); assert.equal(r.state.brakeHeat, 0);
});
test("brake heat accumulates in motion, then cools", () => {
  const r = rig(); r.state.speed = 24; advance(r, 120, { brake: true });
  const heat = r.state.brakeHeat; assert(heat > 12); advance(r, 120); assert(r.state.brakeHeat < heat);
});
test("speed-sensitive steering, left/right signs, all presets", () => {
  for (const preset of Object.keys(P.presets)) {
    const r = rig(); const yaw = r.state.yaw; r.state.speed = 12;
    advance(r, 60, { right: true }, 1 / 120, preset); assert(P.angle(r.state.yaw - yaw) > 0);
    assert(r.state.steer > 0 && r.state.steer < THREE.MathUtils.degToRad(P.presets[preset].steerLow));
    advance(r, 120, { left: true }, 1 / 120, preset); assert(r.state.steer < 0); assert(gap(r) < 1e-9);
  }
});
test("stationary steering does not spin or detach the rig", () => {
  const r = rig(), yaw = r.state.yaw; advance(r, 600, { brake: true, right: true });
  assert.equal(r.state.speed, 0); assert.equal(r.state.yaw, yaw); assert(gap(r) < 1e-9);
});
test("road height is smooth, with no six-metre vertical snapping", () => {
  let previous = R.surfaceHeight(R.point(0).x, R.point(0).z);
  for (let d = .25; d <= R.LENGTH; d += .25) {
    const p = R.point(d), y = R.surfaceHeight(p.x, p.z);
    assert(Math.abs(y - (p.y + .045)) < .001); assert(Math.abs(y - previous) < .04); previous = y;
  }
});
test("fixed-step driving matches at 30, 60, and 144 render FPS", () => {
  function drive(fps) {
    const r = rig(); let accumulator = 0;
    for (let frame = 0; frame < fps * 12; frame++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-12 >= 1 / 120) { advance(r, 1, { throttle: true, right: r.state.elapsed > 2 && r.state.elapsed < 3 }); accumulator -= 1 / 120; }
    }
    return r.state;
  }
  const a = drive(30), b = drive(60), c = drive(144);
  assert(a.pos.distanceTo(b.pos) < 1e-8); assert(a.pos.distanceTo(c.pos) < 1e-8);
});

// Scene construction uses genuine Three geometry/matrices and a stubbed 2D texture painter.
class Element {
  constructor(id = "") {
    this.id = id; this.style = {}; this.dataset = {}; this.listeners = {}; this.value = "0"; this.hidden = false;
    this.textContent = ""; this.innerHTML = ""; this.disabled = false; this.children = []; this.tagName = "DIV";
    const tokens = new Set(); this.classList = { add: x => tokens.add(x), remove: x => tokens.delete(x), contains: x => tokens.has(x),
      toggle: (x, force) => { const on = force === undefined ? !tokens.has(x) : force; on ? tokens.add(x) : tokens.delete(x); return on; } };
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  dispatch(name, props = {}) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, ...props }); }
  querySelector() { return this.child ||= new Element(); }
  blur() {}
  setPointerCapture() {}
  getContext() { return new Proxy({}, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) }); }
}
const elements = new Map(), element = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
const touchButtons = ["engine", "brake", "throttle", "reverse"].map(action => { const e = new Element(); e.dataset.control = action; return e; });
const presets = ["easy", "standard", "heavy"].map(preset => { const e = new Element(); e.dataset.preset = preset; return e; });
const document = new Element(); document.body = new Element(); document.hidden = false;
document.getElementById = element; document.createElement = () => new Element();
document.querySelectorAll = selector => selector === "[data-control]" ? touchButtons : selector === "[data-preset]" ? presets : [];
const listeners = {}, raf = [], failures = [];
let renderer, capturedScene, capturedCamera, clock = 0;
class Renderer {
  constructor() { renderer = this; this.domElement = new Element(); this.shadowMap = {}; this.info = { render: { calls: 0 } }; }
  setSize() {} setPixelRatio() {}
  render(scene, camera) { capturedScene = scene; capturedCamera = camera; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
}
const context = vm.createContext({ THREE: { ...THREE, WebGLRenderer: Renderer }, DeadfallRoute: R, DeadfallPhysics: P,
  document, console, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, performance: { now: () => clock },
  requestAnimationFrame: fn => raf.push(fn), addEventListener: (name, fn) => (listeners[name] ||= []).push(fn),
  showBootError: message => failures.push(message), window: null }); context.window = context;
for (const file of ["world.js", "vehicle.js"]) vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context, { filename: file });
test("detailed vehicle builds; resetting restores all five visible logs", () => {
  const truck = context.DeadfallVehicle.make(), state = P.createState();
  state.logs = 2; context.DeadfallVehicle.update(truck, state, {});
  assert.equal(truck.userData.trailer.userData.logs.filter(l => l.visible).length, 2);
  context.DeadfallVehicle.update(truck, P.createState(), {});
  assert.equal(truck.userData.trailer.userData.logs.filter(l => l.visible).length, 5);
  assert.equal(truck.userData.tractor.userData.wheels.length, 10); assert.equal(truck.userData.trailer.userData.wheels.length, 8);
  assert.equal(truck.userData.tractor.userData.front.length, 2);
});
vm.runInContext(fs.readFileSync(path.join(base, "play.js"), "utf8"), context, { filename: "play.js" });
test("game boots; start button is enabled with no initialization errors", () => {
  assert.deepEqual(failures, []); assert.equal(element("drive").disabled, false); assert.equal(element("drive").textContent, "BEGIN DESCENT");
  assert(capturedScene && capturedCamera); assert.equal(raf.length, 1);
});
test("all scene coordinates, normals and UVs are finite", () => {
  let meshes = 0, vertices = 0;
  capturedScene.traverse(obj => {
    if (!obj.isMesh) return; meshes++;
    for (const attr of Object.values(obj.geometry.attributes)) for (const n of attr.array) assert(Number.isFinite(n));
    vertices += obj.geometry.attributes.position.count;
    if (obj.isInstancedMesh) for (const n of obj.instanceMatrix.array) assert(Number.isFinite(n));
  });
  assert(meshes > 100); console.log(`  Scene: ${meshes} mesh objects; ${vertices.toLocaleString()} stored vertices (before instancing).`);
});
test("road and terrain are continuous indexed meshes with upward normals", () => {
  const terrain = capturedScene.getObjectByName("Continuous mountain terrain"); assert(terrain.geometry.index);
  const road = capturedScene.getObjectByName("Continuous road surface");
  for (const mesh of road.children.slice(0, 4)) {
    assert(mesh.geometry.index); const normal = mesh.geometry.attributes.normal;
    for (let i = 0; i < normal.count; i++) assert(normal.getY(i) > .98);
  }
});
test("sky shader includes exist and are on valid preprocessor lines", () => {
  capturedScene.traverse(obj => {
    if (!obj.material?.isShaderMaterial) return;
    const shader = obj.material.fragmentShader;
    assert(!/[^\n\t ]#include/.test(shader));
    for (const [, name] of shader.matchAll(/#include <([^>]+)>/g)) assert(THREE.ShaderChunk[name], name);
  });
});
function event(name, props = {}) { for (const fn of listeners[name] || []) fn({ target: { tagName: "BODY" }, preventDefault() {}, ...props }); }
function frames(n, fps = 60) { for (let i = 0; i < n; i++) { const fn = raf.shift(); assert(fn); clock += 1000 / fps; fn(clock); } }
test("start click enters game and throttle drives the truck", () => {
  element("drive").dispatch("click"); assert(document.body.classList.contains("driving"));
  event("keydown", { code: "KeyW" }); frames(180); event("keyup", { code: "KeyW" });
  assert(Number(element("speed").textContent) > 10); assert(Number(element("distance").textContent.replace(/\D/g, "")) < 1800);
});
test("pause freezes movement and releases throttle; Escape resumes", () => {
  event("keydown", { code: "KeyW" }); element("pause").dispatch("click"); frames(10);
  const speed = element("speed").textContent, distance = element("distance").textContent;
  frames(120); assert.equal(element("speed").textContent, speed); assert.equal(element("distance").textContent, distance);
  assert.equal(element("paused").hidden, false); event("keydown", { code: "Escape" });
  assert.equal(element("paused").hidden, true); assert.equal(element("pause").textContent, "PAUSE");
});
test("three camera modes, inspection orbit, and zoom respond", () => {
  element("camera").dispatch("click"); frames(60); assert(element("camera").textContent.includes("HOOD"));
  const hood = capturedCamera.position.clone();
  element("camera").dispatch("click"); frames(60); assert(element("camera").textContent.includes("INSPECT"));
  assert(hood.distanceTo(capturedCamera.position) > 5);
  element("pause").dispatch("click"); frames(120);
  const before = capturedCamera.position.clone();
  renderer.domElement.dispatch("pointerdown", { clientX: 500, clientY: 400, pointerId: 1 });
  renderer.domElement.dispatch("pointermove", { clientX: 750, clientY: 410, pointerId: 1 });
  renderer.domElement.dispatch("pointerup", { pointerId: 1 }); renderer.domElement.dispatch("wheel", { deltaY: -200 });
  frames(120); assert(before.distanceTo(capturedCamera.position) > 10);
  element("camera").dispatch("click"); assert(element("camera").textContent.includes("CHASE"));
});
test("recovery remains connected and charges damage once per press", () => {
  element("pause").dispatch("click"); event("keydown", { code: "KeyR", repeat: false });
  const damage = element("damageText").textContent; event("keydown", { code: "KeyR", repeat: true }); frames(6);
  assert.equal(element("damageText").textContent, damage);
  const tractor = capturedScene.getObjectByName("Logging tractor"), trailer = capturedScene.getObjectByName("Articulated log semitrailer");
  assert(tractor.localToWorld(P.HITCH.clone()).distanceTo(trailer.localToWorld(P.KINGPIN.clone())) < 1e-9);
});
test("losing focus auto-pauses; touch inputs release on cancellation", () => {
  touchButtons[2].dispatch("pointerdown", { pointerId: 2 }); frames(60); event("blur"); assert.equal(element("paused").hidden, false);
  assert(!touchButtons[2].classList.contains("active")); element("resume").dispatch("click");
  touchButtons[2].dispatch("pointerdown", { pointerId: 3 }); touchButtons[2].dispatch("pointercancel", { pointerId: 3 });
  assert(!touchButtons[2].classList.contains("active"));
});
test("quality selector and diagnostic HUD operate", () => {
  element("quality").dispatch("click"); assert(element("quality").textContent.includes("HIGH"));
  element("quality").dispatch("click"); assert(element("quality").textContent.includes("LOW")); assert.equal(renderer.shadowMap.enabled, false);
  event("keydown", { code: "F3" }); frames(10); assert.equal(element("diagnostics").hidden, false); assert(element("diagnostics").textContent.includes("HITCH 0.000 mm"));
});
test("HTML includes every bundled script, without CDN/module dependencies", () => {
  const html = fs.readFileSync(path.join(base, "index.html"), "utf8");
  for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) assert(fs.existsSync(path.join(base, src)), src);
  assert(!/type="module"|<script[^>]+src="https?:/.test(html));
  assert(html.includes('class="arcade-back" href="https://tree-token.xyz/play/"'));
  assert(html.includes('rel="canonical" href="https://tree-token.xyz/play/deadfall-run/"'));
  assert(html.includes('id="startupError"')); assert(html.includes('id="drive" disabled'));
});
test("the cut terrain does not protrude through the driving surface", () => {
  const terrain = capturedScene.getObjectByName("Continuous mountain terrain");
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0); let worst = -Infinity;
  for (let d = 0; d <= R.LENGTH; d += 60) for (const lane of [-5, 0, 5]) {
    const p = R.frame(d, lane).p; ray.set(p.clone().add(new THREE.Vector3(0, 300, 0)), down);
    const hits = ray.intersectObject(terrain); assert(hits.length);
    const intrusion = hits[0].point.y - (p.y + .045); worst = Math.max(worst, intrusion);
  }
  assert(worst < -.02, `terrain overlaps road by ${worst} m`);
});
test("all handling presets can follow the complete route with a connected trailer", () => {
  for (const preset of Object.keys(P.presets)) {
    const r = rig(); let steps = 0, maxGap = 0, maxLane = 0;
    while (r.state.progress < R.LENGTH - 12 && steps++ < 42000) {
      const s = r.state, target = R.point(s.progress + 10);
      const heading = Math.atan2(target.x - s.pos.x, -(target.z - s.pos.z));
      const yawRate = P.angle(heading - s.yaw) * 1.5;
      const desiredSteer = Math.atan(yawRate * 5.25 / Math.max(.5, s.speed) / .64);
      const tune = P.presets[preset];
      const limit = THREE.MathUtils.degToRad(tune.steerLow - Math.min(Math.abs(s.speed), 25) / 25 * (tune.steerLow - tune.steerHigh));
      advance(r, 1, { throttle: s.speed < 14, engine: s.speed > 16, touchSteer: R.clamp(desiredSteer / limit, -1, 1) }, 1 / 120, preset);
      maxGap = Math.max(maxGap, gap(r)); maxLane = Math.max(maxLane, R.nearest(s.pos).dist);
    }
    assert(r.state.progress >= R.LENGTH - 12, `${preset} did not reach the mill`);
    assert(maxGap < 1e-9); assert(maxLane < 1.5, `${preset} wandered ${maxLane} m`); assert.equal(r.state.logs, 5);
  }
});
test("chase view frames the complete rig at a wide desktop aspect ratio", () => {
  event("keydown", { code: "KeyR", repeat: false }); element("pause").dispatch("click"); frames(240);
  const tractor = capturedScene.getObjectByName("Logging tractor"), trailer = capturedScene.getObjectByName("Articulated log semitrailer");
  for (const [body, corners] of [[tractor, [[-1.7, 0, -4.7], [1.7, 3.7, 3.5]]], [trailer, [[-1.5, 0, -4.9], [1.5, 3.4, 4.99]]]]) {
    for (const x of [corners[0][0], corners[1][0]]) for (const y of [corners[0][1], corners[1][1]]) for (const z of [corners[0][2], corners[1][2]]) {
      const p = body.localToWorld(new THREE.Vector3(x, y, z)).project(capturedCamera);
      assert(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `clipped vehicle: ${p.toArray()}`);
    }
  }
});
test("failure screen and Drive Again return a fresh five-log run", () => {
  element("resume").dispatch("click");
  for (let i = 0; i < 20; i++) event("keydown", { code: "KeyR", repeat: false });
  assert(element("result").classList.contains("active")); assert.equal(element("resultTitle").textContent, "Truck disabled.");
  element("again").dispatch("click"); assert(element("start").classList.contains("active"));
  element("drive").dispatch("click"); assert.equal(element("cargo").textContent, "5/5"); assert.equal(element("damageText").textContent, "0%");
  assert.equal(element("distance").textContent, "1,800 m");
});
assert.deepEqual(failures, []);
console.log(`\n${passed} checks passed. These are CPU/DOM-stub tests, not a GPU or browser playtest.`);
