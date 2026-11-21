"use strict";
const assert = require("node:assert/strict");
global.THREE = require("../vendor/three.min.js");
const physics = require("../physics.js"), collision = require("../collision.js"), dt = 1 / 120;
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function rig(objects = [], x = 0, bank = 0) {
  const R = { LENGTH: 100000, WIDTH: 12, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    frame: d => ({ p: new THREE.Vector3(0, 0, -d), yaw: 0, f: new THREE.Vector3(0, 0, -1) }),
    surfaceHeight: x => x * bank, nearest: p => ({ d: -p.z, dist: Math.abs(p.x), lane: p.x }) };
  const P = physics.createModel(R), state = P.createState(), tractor = new THREE.Group(), trailer = new THREE.Group(), events = [];
  state.pos.x = x; state.pos.y = R.surfaceHeight(x); P.couple(state, tractor, trailer, true);
  return { R, P, state, tractor, trailer, events, C: collision.create(R, P, objects, e => events.push(e)) };
}
function gap(r) { return r.tractor.localToWorld(r.P.HITCH.clone()).distanceTo(r.trailer.localToWorld(r.P.KINGPIN.clone())); }
function tick(r, input = {}) {
  const before = collision.capture(r.state);
  r.P.step(r.state, input, dt, "loaded"); r.P.couple(r.state, r.tractor, r.trailer);
  const hit = r.C.resolve(r.state, before, r.tractor, r.trailer, dt);
  assert(gap(r) < 1e-9, "contact separated the kingpin");
  return hit;
}
const wall = () => ({ id: "wall", kind: "barrier", a: new THREE.Vector3(-20, 0, -12), b: new THREE.Vector3(20, 0, -12), radius: .1 });
test("head-on barrier blocks the cab, applies impact damage, and allows backing away", () => {
  const r = rig([wall()]); r.state.speed = 10;
  for (let i = 0; i < 180; i++) tick(r);
  assert(r.state.pos.z > -7.19); assert.equal(r.state.speed, 0); assert(r.state.damage > 0);
  assert.equal(r.events.length, 1); assert.equal(r.events[0].body, "tractor"); assert(!r.C.overlaps(r.tractor, r.trailer));
  const damage = r.state.damage, z = r.state.pos.z;
  for (let i = 0; i < 240; i++) tick(r, { throttle: true });
  assert.equal(r.state.damage, damage, "resting pressure repeatedly damages the rig");
  for (let i = 0; i < 360; i++) tick(r, { reverse: true });
  assert(r.state.pos.z > z + 2); assert.equal(r.state.damage, damage);
});
test("a long proposed step cannot tunnel through a thin barrier", () => {
  const r = rig([wall()]), before = collision.capture(r.state); r.state.speed = 27;
  r.state.pos.z = -50; r.P.couple(r.state, r.tractor, r.trailer);
  const hit = r.C.resolve(r.state, before, r.tractor, r.trailer, 2);
  assert(hit); assert(r.state.pos.z > -7.19); assert.equal(r.state.speed, 0); assert(gap(r) < 1e-9);
});
test("reverse contact is detected at the trailer while the cab is clear", () => {
  const tree = { id: "rear-tree", kind: "tree", a: new THREE.Vector3(0, 0, 16), radius: .5 };
  const r = rig([tree]);
  for (let i = 0; i < 700; i++) tick(r, { reverse: true });
  assert(r.events.length); assert.equal(r.events[0].body, "trailer");
  assert(r.trailer.localToWorld(new THREE.Vector3(0, 0, 5)).z < 15.5);
  assert(!r.C.overlaps(r.tractor, r.trailer)); assert.equal(tree.disabled, undefined);
});
test("a shallow rail scrape slides along the rail without crossing or instantly freezing", () => {
  const rail = { id: "side-rail", kind: "barrier", a: new THREE.Vector3(3, 0, 20), b: new THREE.Vector3(3, 0, -100), radius: .1 };
  const r = rig([rail]); r.state.yaw = .10; r.state.speed = 10; r.P.couple(r.state, r.tractor, r.trailer, true);
  let first = null, last = null;
  for (let i = 0; i < 300; i++) {
    const hit = tick(r); if (hit && !first) first = { z: r.state.pos.z, speed: r.state.speed, i };
    if (hit) last = { z: r.state.pos.z, speed: r.state.speed, i };
    assert(!r.C.overlaps(r.tractor, r.trailer), "scrape left a body inside the rail");
  }
  assert(first && last); assert(first.speed > 7); assert(last.z < first.z - 3); assert(last.speed > 1);
});
test("mature trees stop the rig; smaller trees can break and are restored on reset", () => {
  for (const radius of [.23, .6]) {
    const tree = { id: "tree", kind: "tree", a: new THREE.Vector3(0, 0, -12), radius };
    const r = rig([tree]); r.state.speed = 8;
    for (let i = 0; i < 240; i++) tick(r);
    assert.equal(r.events.length, 1); assert.equal(r.events[0].broken, radius < .28);
    if (radius < .28) { assert(tree.disabled); assert(r.state.pos.z < -10); }
    else { assert.equal(r.state.speed, 0); assert(r.state.pos.z > -6.7); }
    r.C.reset(); assert.equal(tree.disabled, false);
  }
});
test("collision checks without contact preserve the original steering trajectory", () => {
  const a = rig([]), b = rig([{ id: "nearby-rock", kind: "rock", a: new THREE.Vector3(-14, 0, -20), radius: .5 }]);
  a.state.speed = b.state.speed = 8;
  for (let i = 0; i < 1000; i++) { const input = { touchSteer: .1 * Math.cos(i * dt) }; tick(a, input); tick(b, input); }
  assert(a.state.pos.distanceTo(b.state.pos) < 1e-9); assert(a.state.trailerAxle.distanceTo(b.state.trailerAxle) < 1e-9);
});
test("surface grip and resistance affect the rig when either axle leaves the road", () => {
  const road = rig([], 0), gravel = rig([], 5), grass = rig([], 10);
  for (const r of [road, gravel, grass]) { r.state.speed = 8; for (let i = 0; i < 120; i++) tick(r); }
  assert.equal(road.state.surface, "asphalt"); assert.equal(gravel.state.surface, "gravel"); assert.equal(grass.state.surface, "grass");
  assert(road.state.speed > gravel.state.speed && gravel.state.speed > grass.state.speed);
  const tailOff = rig(); tailOff.state.trailerAxle.x = 10;
  tailOff.P.step(tailOff.state, {}, dt, "loaded"); assert.equal(tailOff.state.surface, "grass");
  const banked = rig([], 10, .12); for (let i = 0; i < 240; i++) tick(banked, { brake: true });
  assert(Math.abs(banked.state.roll - Math.atan(.12)) < .001); assert(gap(banked) < 1e-9);
});
console.log(`\n${passed} collision and terrain checks passed using actual Three.js transforms and swept contacts.`);
