"use strict";
const assert = require("node:assert/strict");
global.THREE = require("../vendor/three.min.js");
const physics = require("../physics.js"), dt = 1 / 120;
let passed = 0;
function test(name, run) { run(); console.log(`PASS ${name}`); passed++; }
function plane(grade = 0) {
  return { LENGTH: 100000, WIDTH: 100000, clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    frame: d => ({ p: new THREE.Vector3(0, -grade * d, -d), yaw: 0,
      f: new THREE.Vector3(0, -grade, -1).normalize() }),
    surfaceHeight: (x, z) => grade * z, nearest: p => ({ d: -p.z, dist: 0, lane: p.x }) };
}
function rig(grade = 0) {
  const route = plane(grade), P = physics.createModel(route), state = P.createState();
  const tractor = new THREE.Group(), trailer = new THREE.Group();
  P.couple(state, tractor, trailer, true);
  return { route, P, state, tractor, trailer };
}
function gap(r) { return r.tractor.localToWorld(r.P.HITCH.clone()).distanceTo(r.trailer.localToWorld(r.P.KINGPIN.clone())); }
function tick(r, input) { r.P.step(r.state, input, dt, "loaded"); r.P.couple(r.state, r.tractor, r.trailer); }
function sideways(displacement, yaw) { return displacement.x * Math.cos(yaw) + displacement.z * Math.sin(yaw); }

test("a stationary banked trailer cannot acquire yaw from repeated pose updates", () => {
  for (const grade of [0, .07, -.07]) for (const sign of [-1, 1]) {
    const r = rig(grade), s = r.state;
    s.yaw = .3; s.roll = sign * .035; s.sway = sign * .2;
    r.P.couple(s, r.tractor, r.trailer, true);
    const yaw = s.trailerYaw, axle = s.trailerAxle.clone();
    for (let i = 0; i < 600; i++) r.P.couple(s, r.tractor, r.trailer);
    assert(Math.abs(r.P.angle(s.trailerYaw - yaw)) < 1e-12);
    assert(s.trailerAxle.distanceTo(axle) < 1e-9); assert(gap(r) < 1e-9);
  }
});

test("extra coupling calls do not steer or move a driving trailer", () => {
  const a = rig(.07), b = rig(.07); a.state.speed = b.state.speed = 8;
  for (let i = 0; i < 1200; i++) {
    const input = { touchSteer: Math.sin(i * dt) * .2, engine: i > 600 };
    tick(a, input); tick(b, input);
    for (let n = 0; n < 4; n++) b.P.couple(b.state, b.tractor, b.trailer);
  }
  assert(Math.abs(a.P.angle(a.state.trailerYaw - b.state.trailerYaw)) < 1e-10);
  assert(a.state.trailerAxle.distanceTo(b.state.trailerAxle) < 1e-9);
});

test("gentle downhill corrections turn the trailer gradually, symmetrically left and right", () => {
  const results = [];
  for (const sign of [-1, 1]) {
    const r = rig(.07); r.state.speed = 8;
    for (let i = 0; i < 120; i++) tick(r, { touchSteer: sign * .2 });
    const s = r.state, tail = r.trailer.localToWorld(new THREE.Vector3(0, 0, 4.99));
    assert(sign * s.trailerYaw > 0); assert(sign * s.trailerYaw < sign * s.yaw * .6);
    assert(Math.abs(s.trailerAxle.x) < Math.abs(s.pos.x) * .3);
    assert(Math.abs(tail.x) < .1, `tail swept ${tail.x} m during a gentle first second`);
    results.push([s.yaw, s.trailerYaw, s.pos.x, s.trailerAxle.x, tail.x]);
  }
  results[0].forEach((v, i) => assert(Math.abs(v + results[1][i]) < 1e-10));
  console.log(`  After 1 s downhill: cab ${THREE.MathUtils.radToDeg(results[1][0]).toFixed(2)}°, trailer ${THREE.MathUtils.radToDeg(results[1][1]).toFixed(2)}°.`);
});

test("tractor rear tandem rolls along its heading instead of crabbing sideways", () => {
  for (const grade of [0, .07]) for (const sign of [-1, 1]) {
    const r = rig(grade); r.state.speed = 8;
    for (let i = 0; i < 720; i++) {
      const axle = r.tractor.localToWorld(new THREE.Vector3(0, 0, 1.55)), yaw = r.state.yaw;
      tick(r, { touchSteer: sign * .2 * Math.cos(i * dt) });
      const travel = r.tractor.localToWorld(new THREE.Vector3(0, 0, 1.55)).sub(axle);
      const mid = yaw + r.P.angle(r.state.yaw - yaw) / 2;
      assert(Math.abs(sideways(travel, mid)) < 1e-9);
    }
  }
});

test("rendered trailer axle has no sideways slip in forward or reverse on a grade", () => {
  let maximumSlip = 0, maximumGroundError = 0;
  for (const grade of [0, .07, -.07]) for (const reverse of [false, true]) for (const sign of [-1, 1]) {
    const r = rig(grade); r.state.speed = reverse ? 0 : 8;
    for (let i = 0; i < 720; i++) {
      const axle = r.trailer.localToWorld(new THREE.Vector3(0, 0, 2.9)), yaw = r.state.trailerYaw;
      tick(r, { reverse, touchSteer: sign * .2 * Math.cos(i * dt) });
      const actualAxle = r.trailer.localToWorld(new THREE.Vector3(0, 0, 2.9));
      const travel = actualAxle.clone().sub(axle), mid = yaw + r.P.angle(r.state.trailerYaw - yaw) / 2;
      maximumSlip = Math.max(maximumSlip, Math.abs(sideways(travel, mid)));
      maximumGroundError = Math.max(maximumGroundError, Math.abs(actualAxle.y - r.route.surfaceHeight(actualAxle.x, actualAxle.z)));
      assert(gap(r) < 1e-9);
    }
  }
  assert(maximumSlip < 1e-9, `lateral wheel slip ${maximumSlip} m/step`);
  assert(maximumGroundError < 1e-9, `axle plane missed terrain by ${maximumGroundError} m`);
});

test("steady-circle trailer offtracking agrees with independent circle geometry", () => {
  // Rear tandem follows a 30 m circle. The pin is 0.70 m behind it;
  // the trailer axle is 7.75 m behind the pin. Pythagoras gives its radius.
  const radius = 30, expected = Math.sqrt(radius ** 2 + .7 ** 2 - 7.75 ** 2);
  for (const sign of [-1, 1]) {
    const r = rig();
    for (let i = 0; i <= 10000; i++) {
      const yaw = sign * i * .04 / radius;
      r.state.yaw = r.P.angle(yaw);
      r.state.pos.set(sign * radius * (1 - Math.cos(yaw)) + 1.55 * Math.sin(yaw), 0,
        -sign * radius * Math.sin(yaw) - 1.55 * Math.cos(yaw));
      r.P.couple(r.state, r.tractor, r.trailer, i === 0);
    }
    const a = r.state.trailerAxle, measured = Math.hypot(a.x - sign * radius, a.z);
    assert(measured < radius); assert(Math.abs(measured - expected) < .002, `${measured} versus ${expected} m`);
    assert(gap(r) < 1e-9);
  }
});
console.log(`\n${passed} coupling regression checks passed. CPU trajectories and actual Three.js transforms; no GPU playtest.`);
