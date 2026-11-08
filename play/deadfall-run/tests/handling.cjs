"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
global.THREE = require("../vendor/three.min.js");
const R = require("../handling-route.js"), P = require("../physics.js").createModel(R);
const L = require("../handling.js").create(R, P), dt = 1 / 120;
let passed = 0;
function test(name, run) { run(); console.log(`PASS ${name}`); passed++; }
function rig(id) {
  const state = P.createState(L.tests[id].start), tractor = new THREE.Group(), trailer = new THREE.Group();
  L.prepare(id, state); P.couple(state, tractor, trailer, true);
  return { state, tractor, trailer, session: L.begin(id, state) };
}
function cones(id) {
  const result = [], positions = id === "braking" ? [90, 100, 110, 120, 125] : id === "turns" ? [588.5, 591.5, 648.5, 651.5, 708.5, 711.5] : id === "reverse" ? [118, 125, 132] : [];
  for (const d of positions) for (const side of [-1, 1]) {
    const mesh = new THREE.Group(); mesh.position.copy(R.frame(d, side * (id === "reverse" ? 2.65 : 4.8)).p);
    result.push({ id: `${d}-${side}`, d, mesh });
  }
  return result;
}
function tick(r, input = {}, markers = []) {
  P.step(r.state, input, dt, "loaded"); P.couple(r.state, r.tractor, r.trailer);
  L.sample(r.session, r.state, r.tractor, r.trailer, input, dt, markers);
}
function drive(id, controller) {
  const r = rig(id), markers = cones(id);
  for (let i = 0; i < 24000 && !r.session.done; i++) tick(r, controller(r), markers);
  return r;
}
function steering(s, desired) {
  const t = P.presets.loaded, limit = THREE.MathUtils.degToRad(t.steerLow - Math.min(Math.abs(s.speed), 25) / 25 * (t.steerLow - t.steerHigh));
  return R.clamp(desired / limit, -1, 1);
}
function beforeBrakeLine(r) { return R.nearest(r.tractor.localToWorld(new THREE.Vector3(0, 0, -4.7))).d < 90; }
test("loaded steering never exceeds 20 degrees per second, including reversal", () => {
  const r = rig("braking"); let previous = 0;
  for (let i = 0; i < 960; i++) {
    tick(r, { brake: true, right: i < 360, left: i >= 360 });
    assert(Math.abs(r.state.steer - previous) <= THREE.MathUtils.degToRad(20) * dt + 1e-12); previous = r.state.steer;
  }
  assert(r.state.steer < -.5);
});
test("a cold loaded rig stops from 20 mph inside the measured zone", () => {
  const r = drive("braking", r => ({ throttle: beforeBrakeLine(r) && r.state.speed < 20 / 2.237, brake: !beforeBrakeLine(r) }));
  assert(r.session.success, JSON.stringify(L.report(r.session)) + r.session.reason);
  assert(r.session.stopDistance > 7 && r.session.stopDistance < 15);
  assert(r.session.maxGap < 1e-9); assert.equal(r.state.logs, 5);
  console.log(`  Cold stop: ${r.session.stopDistance.toFixed(2)} m from line; entry ${r.session.entrySpeed.toFixed(2)} mph.`);
});
test("a slow approach cannot earn a braking pass", () => {
  const r = drive("braking", r => ({ throttle: beforeBrakeLine(r) && r.state.speed < 4, brake: !beforeBrakeLine(r) }));
  assert(r.session.done); assert(!r.session.success); assert(r.session.reason.includes("18–22"));
});
test("hot service brakes extend stopping distance and still cannot reverse", () => {
  function stop(heat) {
    const r = rig("braking"); r.state.speed = 20 / 2.237; r.state.brakeHeat = heat;
    const start = r.state.pos.clone();
    for (let i = 0; i < 1200; i++) { tick(r, { brake: true }); assert(r.state.speed >= 0); }
    assert.equal(r.state.speed, 0); return start.distanceTo(r.state.pos);
  }
  const cold = stop(0), hot = stop(100); assert(hot > cold * 1.6);
  console.log(`  Hot/cold stopping distance: ${hot.toFixed(2)} / ${cold.toFixed(2)} m.`);
});
test("downhill engine braking keeps the loaded rig in the speed band", () => {
  const r = drive("grade", ({ state: s }) => ({ engine: s.speed > 8, throttle: s.speed < 6 }));
  assert(r.session.success, r.session.reason); assert.equal(r.session.serviceTime, 0); assert.equal(r.session.maxHeat, 0);
  assert(r.session.maxGap < 1e-9); assert.equal(r.state.logs, 5);
});
test("both bodies can clear the S-turn cone gates without losing the load", () => {
  const r = drive("turns", ({ state: s }) => {
    const target = R.point(s.progress + 12), heading = Math.atan2(target.x - s.pos.x, -(target.z - s.pos.z));
    const yawRate = P.angle(heading - s.yaw) * 1.5;
    return { throttle: s.speed < 6, engine: s.speed > 6.7,
      touchSteer: steering(s, Math.atan(yawRate * 5.25 / Math.max(.5, s.speed) / .64)) };
  });
  assert(r.session.success, r.session.reason); assert.equal(r.session.gateCount, 3); assert.equal(r.session.coneHits.size, 0);
  assert(r.session.maxGap < 1e-9); assert.equal(r.state.logs, 5);
});
test("reverse docking is achievable from the offset angled start", () => {
  const r = drive("reverse", ({ state: s, trailer }) => {
    const at = R.nearest(trailer.position);
    // Correct the offset early, then unwind before entering the bay. The old
    // low-gain fixture inadvertently relied on roll-induced trailer steering.
    const desiredTrailerYaw = R.clamp(at.lane * .06, -.15, .15);
    const desiredYaw = s.trailerYaw + R.clamp(.8 * P.angle(s.trailerYaw - desiredTrailerYaw), -.15, .15);
    const yawRate = P.angle(desiredYaw - s.yaw) * 1.2;
    return { reverse: at.d > 125.8, brake: at.d <= 125.8,
      touchSteer: steering(s, Math.atan(yawRate * 5.25 / Math.min(-.6, s.speed) / .64)) };
  });
  assert(r.session.success, JSON.stringify({ reason: r.session.reason, d: r.session.bayDistance, x: r.session.bayOffset, angle: r.session.bayAngle, articulation: r.state.articulation, cones: r.session.coneHits.size }));
  assert(r.session.stopHold >= 2); assert(r.session.maxGap < 1e-9); assert.equal(r.state.logs, 5);
  console.log(`  Reverse dock: ${r.session.time.toFixed(2)} s; offset ${r.session.bayOffset.toFixed(3)} m; heading ${r.session.bayAngle.toFixed(2)}°.`);
});
test("parking sideways, moving, or without brakes cannot pass docking", () => {
  for (const invalid of ["angle", "moving", "brake"]) {
    const r = rig("reverse");
    r.state.pos.copy(R.point(132.1)); r.state.yaw = invalid === "angle" ? .4 : 0;
    P.couple(r.state, r.tractor, r.trailer, true);
    for (let i = 0; i < 360; i++) {
      r.state.speed = invalid === "moving" ? -.4 : 0;
      L.sample(r.session, r.state, r.tractor, r.trailer, { brake: invalid !== "brake" }, dt);
    }
    assert(!r.session.success, invalid);
  }
});
test("reverse power returns after releasing and reapplying while still backing", () => {
  const r = rig("reverse");
  for (let i = 0; i < 120; i++) tick(r, { reverse: true });
  for (let i = 0; i < 12; i++) tick(r);
  const coasting = r.state.speed;
  assert(coasting < -.25); assert.equal(r.state.reverse, false);
  for (let i = 0; i < 60; i++) tick(r, { reverse: true });
  assert.equal(r.state.reverse, true);
  assert(r.state.speed < coasting - .2, `Reverse failed to accelerate: ${coasting} -> ${r.state.speed}`);
  assert(r.session.maxGap < 1e-9);
});
test("the loaded rig can back uphill from grass on the actual 7% lab grade", () => {
  const r = rig("grade");
  r.state.pos.copy(R.frame(300, 10).p); r.state.speed = 0;
  P.couple(r.state, r.tractor, r.trailer, true);
  const start = r.state.pos.clone();
  for (let i = 0; i < 600; i++) {
    tick(r, { reverse: true });
    assert(r.state.speed <= 0, "Reverse rolled downhill");
    assert.equal(r.state.surface, "grass");
  }
  assert(r.state.speed < -.7, `Reverse stalled at ${r.state.speed} m/s`);
  assert(r.state.pos.z > start.z + 1.5);
  assert(r.state.speed >= -2); assert(r.session.maxGap < 1e-9);
});
test("forward motion blocks reverse until braking, and service brake wins over reverse", () => {
  const r = rig("reverse"); r.state.speed = 1;
  for (let i = 0; i < 120; i++) tick(r, { reverse: true });
  assert(r.state.speed > .25); assert.equal(r.state.reverse, false);
  for (let i = 0; i < 120; i++) tick(r, { brake: true, reverse: true });
  assert.equal(r.state.speed, 0); assert.equal(r.state.reverse, false);
  for (let i = 0; i < 120; i++) tick(r, { reverse: true });
  assert(r.state.speed < -1); assert.equal(r.state.reverse, true);
});
test("trailer contact counts even when the tractor misses a cone", () => {
  const r = rig("turns"), marker = new THREE.Group();
  marker.position.copy(r.trailer.localToWorld(new THREE.Vector3(1.3, 0, 3)));
  L.sample(r.session, r.state, r.tractor, r.trailer, {}, dt, [{ id: "trailer-only", d: r.state.progress - 10, mesh: marker }]);
  assert.equal(r.session.coneHits.size, 1);
});
test("standing at the start does not pass any scenario", () => {
  for (const id of Object.keys(L.tests)) {
    const r = rig(id); for (let i = 0; i < 600; i++) tick(r, { brake: true });
    assert(!r.session.success, id);
  }
});
test("handling terrain and grade transitions are continuous", () => {
  for (const d of [210, 250, 440, 480, 520, 780]) {
    assert(R.point(d - .001).distanceTo(R.point(d + .001)) < .003);
    assert(R.frame(d - .001).f.distanceTo(R.frame(d + .001).f) < .0001);
  }
  const a = R.point(300), b = R.point(400); assert(Math.abs((b.y - a.y) / 100 + .07) < 1e-10);
});
test("handling package has local dependencies and no transplanted game assets", () => {
  const base = path.resolve(__dirname, ".."), html = fs.readFileSync(path.join(base, "handling.html"), "utf8");
  for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) assert(fs.existsSync(path.join(base, src)), src);
  assert(html.includes('href="https://tree-token.xyz/play/"')); assert(!/type="module"|<script[^>]+src="https?:/.test(html));
  for (const file of fs.readdirSync(base)) assert(!/\.(exe|dll|iso|zipfs)$/i.test(file));
});
console.log(`\n${passed} handling checks passed. Simulated controllers and CPU transforms; not a human/GPU playtest.`);
