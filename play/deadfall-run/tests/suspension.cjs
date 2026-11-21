"use strict";
const assert = require("node:assert/strict");
global.THREE = require("../vendor/three.min.js");
const Physics = require("../physics.js"), Ride = require("../ride.js"), Route = require("../route.js");
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function plane({ bump = false, grade = 0, bank = 0 } = {}) {
  return { LENGTH: 10000, WIDTH: 12, isHandling: true, clamp: Route.clamp,
    frame: d => ({ p: new THREE.Vector3(0, -grade * d, -d), yaw: 0, f: new THREE.Vector3(0, -grade, -1).normalize() }),
    nearest: p => ({ d: -p.z, dist: Math.abs(p.x), lane: p.x }),
    surfaceHeight: (x, z) => grade * z + bank * x + (bump ? .06 * Math.exp(-(((z + 20) / .85) ** 2)) : 0) };
}
function rig(R = plane(), truck = null) {
  const P = Physics.createModel(R), state = P.createState(), tractor = truck?.userData.tractor || new THREE.Group(),
    trailer = truck?.userData.trailer || new THREE.Group(), ride = Ride.create(R);
  P.couple(state, tractor, trailer, true); ride.reset(state, tractor, trailer);
  return { R, P, state, tractor, trailer, ride, truck };
}
const dt = 1 / 120;
function tick(r, input = {}, advanceRide = true) {
  r.P.step(r.state, input, dt, "loaded"); r.P.couple(r.state, r.tractor, r.trailer);
  if (advanceRide) r.ride.step(r.state, r.tractor, r.trailer, dt);
  if (r.truck) DeadfallVehicle.update(r.truck, r.state, input, r.ride);
}
const pose = r => [r.state.pos.toArray(), r.state.trailerAxle.toArray(), r.state.hitch.toArray(), r.state.yaw,
  r.state.trailerYaw, r.state.speed, r.state.damage, r.state.logs, r.state.steer, r.state.roll, r.state.pitch];
test("stationary suspension stays settled, without time-driven bouncing", () => {
  for (const grade of [0, .07, -.07]) {
    const r = rig(plane({ grade })), before = JSON.stringify(r.ride.value);
    for (let i = 0; i < 1200; i++) r.ride.step(r.state, r.tractor, r.trailer, dt);
    assert.equal(JSON.stringify(r.ride.value), before);
  }
});
test("braking dips the nose and loads restraints forward; release settles the motion", () => {
  const r = rig(); r.state.speed = 10; r.ride.reset(r.state, r.tractor, r.trailer);
  for (let i = 0; i < 80; i++) tick(r, { brake: true });
  assert(r.ride.value.tractorPitch < -.005); assert(r.ride.value.cargoZ < -.008);
  while (r.state.speed > 0) tick(r, { brake: true });
  for (let i = 0; i < 720; i++) tick(r, { brake: true });
  for (const key of ["tractorPitch", "trailerPitch", "cargoX", "cargoZ"]) assert(Math.abs(r.ride.value[key]) < .00001, key);
});
test("turns load cargo outwards symmetrically, and the trailer responds after the cab", () => {
  const result = [];
  for (const sign of [-1, 1]) {
    const r = rig(); r.state.speed = 8; r.ride.reset(r.state, r.tractor, r.trailer);
    for (let i = 0; i < 120; i++) tick(r, { touchSteer: sign * .3 });
    const v = r.ride.value, tractorLean = r.tractor.rotation.z + v.tractorRoll, trailerLean = r.trailer.rotation.z + v.trailerRoll;
    // The spring offset is relative to the existing bank/lean of each root.
    assert(sign * tractorLean > 0); assert(sign * v.cargoX < 0);
    assert(Math.abs(trailerLean) < Math.abs(tractorLean));
    result.push([v.cargoX, v.cargoRoll, tractorLean, trailerLean]);
  }
  result[0].forEach((v, i) => assert(Math.abs(v + result[1][i]) < 1e-10));
});
test("a six-centimetre road bump reaches the trailer axle later than the front axle", () => {
  const r = rig(plane({ bump: true })), peaks = { front: [0, 0], tail: [0, 0] };
  let peakPitch = 0;
  for (let i = 0; i < 900; i++) {
    r.state.speed = 8; r.state.pos.set(0, 0, -i * dt * 8); r.P.couple(r.state, r.tractor, r.trailer);
    r.ride.step(r.state, r.tractor, r.trailer, dt);
    const v = r.ride.value, front = v.axles.tractor[0].left - .52, tail = v.axles.trailer[0].left - .52;
    if (front > peaks.front[0]) peaks.front = [front, i * dt];
    if (tail > peaks.tail[0]) peaks.tail = [tail, i * dt];
    peakPitch = Math.max(peakPitch, Math.abs(v.tractorPitch));
  }
  assert(peaks.front[0] > .05); assert(peaks.tail[1] > peaks.front[1] + 1);
  assert(peakPitch > .002); assert(peakPitch <= .018);
  assert(Math.abs(r.ride.value.tractorPitch) < .0001);
  console.log(`  Axle bump peaks: front ${peaks.front[1].toFixed(2)} s; trailer ${peaks.tail[1].toFixed(2)} s.`);
});
test("suspension cannot change steering, braking, trailer tracking, score or cargo count", () => {
  const a = rig(Route), b = rig(Route);
  for (let i = 0; i < 2400; i++) {
    const input = { throttle: i < 700, brake: i > 1600, touchSteer: Math.sin(i * dt) * .15 };
    tick(a, input, true); tick(b, input, false); assert.deepEqual(pose(a), pose(b));
  }
});
test("pause freezes motion and resetting from a moving start adds no false impact", () => {
  const r = rig(); r.state.speed = 8; r.ride.reset(r.state, r.tractor, r.trailer);
  for (let i = 0; i < 60; i++) tick(r, { brake: true });
  const before = JSON.stringify(r.ride.value);
  for (let i = 0; i < 240; i++) r.ride.step(r.state, r.tractor, r.trailer, 0);
  assert.equal(JSON.stringify(r.ride.value), before);
  r.state.speed = 8; r.ride.reset(r.state, r.tractor, r.trailer); r.ride.step(r.state, r.tractor, r.trailer, dt);
  assert.equal(r.ride.value.acceleration, 0); assert.equal(r.ride.value.cargoZ, 0);
});

// Genuine vehicle geometry; only the canvas texture painter is stubbed.
global.DeadfallRoute = Route;
global.document = { createElement: () => ({ getContext: () => new Proxy({}, {
  get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) }) }) };
require("../world.js"); require("../vehicle.js"); require("../effects.js");
test("sprung frames keep the visible coupling fixed and all wheel/strap transforms finite", () => {
  const truck = DeadfallVehicle.make(), r = rig(Route, truck);
  for (let i = 0; i < 1200; i++) {
    tick(r, { throttle: i < 700, brake: i > 850, touchSteer: Math.sin(i * dt) * .3 });
    const fifth = r.tractor.userData.visual.localToWorld(r.P.HITCH.clone());
    const pin = r.trailer.userData.visual.localToWorld(r.P.KINGPIN.clone());
    assert(fifth.distanceTo(pin) < 1e-9);
    for (const body of [r.tractor, r.trailer]) for (const w of body.userData.wheels) {
      const center = w.getWorldPosition(new THREE.Vector3()), ground = r.R.surfaceHeight(center.x, center.z);
      assert(Math.abs(center.y - ground - .52) < .035, "wheel lost ground contact on the road");
    }
  }
  truck.traverse(o => { for (const v of o.matrixWorld.elements) assert(Number.isFinite(v)); });
  const rd = r.trailer.userData;
  for (const strap of rd.straps) {
    const points = strap.geometry.parameters.path.points;
    assert(points[0].equals(strap.userData.rest[0])); assert(points[5].equals(strap.userData.rest[5]));
    for (const v of strap.geometry.attributes.position.array) assert(Number.isFinite(v));
  }
  for (const log of rd.logs) assert.equal(log.parent.parent, rd.cargoPivot);
});
test("load travel remains bounded and reset restores the complete secured bundle", () => {
  const truck = DeadfallVehicle.make(), r = rig(plane(), truck);
  for (let i = 0; i < 600; i++) {
    r.state.speed = i % 2 ? -2 : 27; r.state.yaw += .08; r.state.trailerYaw += .08;
    r.P.couple(r.state, r.tractor, r.trailer); r.ride.step(r.state, r.tractor, r.trailer, dt);
    DeadfallVehicle.update(truck, r.state, {}, r.ride);
    assert(Math.abs(r.ride.value.cargoX) <= .026); assert(Math.abs(r.ride.value.cargoZ) <= .035);
  }
  r.state = r.P.createState(); r.P.couple(r.state, r.tractor, r.trailer, true);
  r.ride.reset(r.state, r.tractor, r.trailer); DeadfallVehicle.update(truck, r.state, {}, r.ride);
  const rd = r.trailer.userData; assert(rd.logs.every(x => x.visible));
  assert.deepEqual(rd.cargoPivot.position.toArray(), [0, 2.35, 0]);
  for (const strap of rd.straps) strap.geometry.parameters.path.points.forEach((p, i) => assert(p.distanceTo(strap.userData.rest[i]) < 1e-12));
});
test("exhaust follows the sprung stacks while smoke already emitted stays in world space", () => {
  const truck = DeadfallVehicle.make(), r = rig(plane(), truck), fx = DeadfallEffects.create(new THREE.Scene());
  r.state.speed = 9; r.ride.reset(r.state, r.tractor, r.trailer);
  for (let i = 0; i < 60; i++) tick(r, { brake: true });
  fx.update(.1, { speed: 0, throttle: 1 }, r.tractor, true);
  const p = fx.cloud.geometry.attributes.position;
  for (let i = 0; i < 2; i++) assert(new THREE.Vector3().fromBufferAttribute(p, i).distanceTo(r.tractor.userData.exhaustPoints[i].getWorldPosition(new THREE.Vector3())) < .25);
  const emitted = new THREE.Vector3().fromBufferAttribute(p, 0); r.tractor.position.x += 20; r.tractor.updateMatrixWorld(true);
  fx.update(.01, { speed: 0, throttle: 0 }, r.tractor, true);
  assert(new THREE.Vector3().fromBufferAttribute(p, 0).distanceTo(emitted) < .1);
});
console.log(`\n${passed} suspension/load checks passed using actual geometry and a fixed simulation step.`);
