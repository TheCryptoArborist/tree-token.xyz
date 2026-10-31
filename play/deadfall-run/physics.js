/* Kinematic tractor / semitrailer model, not a rigid-body physics engine. */
(function (root) {
  "use strict";
  const R = typeof module !== "undefined" && module.exports ? require("./route.js") : root.DeadfallRoute;
  const HITCH = new THREE.Vector3(0, 1.42, 2.25);
  const KINGPIN = new THREE.Vector3(0, 1.42, -4.85);
  const AXLE = new THREE.Vector3(0, 0, 2.9);
  const HITCH_TO_AXLE = AXLE.z - KINGPIN.z;
  const presets = {
    easy: { steerLow: 30, steerHigh: 14, response: 6.5, throttle: 5.2, brake: 10.8, engine: 4.2, camera: 4.2 },
    standard: { steerLow: 26, steerHigh: 11, response: 5.4, throttle: 4.6, brake: 9.7, engine: 3.6, camera: 3.8 },
    heavy: { steerLow: 22, steerHigh: 8, response: 4.2, throttle: 3.9, brake: 8.7, engine: 3.1, camera: 3.2 }
  };
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  function createState(d = 0) {
    const f = R.frame(d);
    const state = { pos: f.p.clone(), yaw: f.yaw, pitch: Math.atan2(f.f.y, Math.hypot(f.f.x, f.f.z)),
      roll: 0, speed: 0, steer: 0, throttle: 0, brakeHeat: 0, damage: 0, logs: 5, progress: d,
      trailerYaw: f.yaw, trailerPitch: 0, trailerAxle: new THREE.Vector3(), hitch: new THREE.Vector3(),
      sway: 0, stressTime: 0, elapsed: 0, offroad: false, collisions: new Set(), reverse: false,
      articulation: 0, wheelRotation: 0 };
    state.pos.y = R.surfaceHeight(state.pos.x, state.pos.z);
    return state;
  }
  function poseTractor(state, tractor) {
    tractor.position.copy(state.pos);
    tractor.rotation.order = "YXZ";
    tractor.rotation.set(state.pitch, -state.yaw, state.roll);
    tractor.updateMatrixWorld(true);
  }
  function couple(state, tractor, trailer, initialize = false) {
    poseTractor(state, tractor);
    const hitch = tractor.localToWorld(HITCH.clone());
    if (initialize) state.trailerYaw = state.yaw;
    else {
      const dx = hitch.x - state.trailerAxle.x, dz = hitch.z - state.trailerAxle.z;
      if (Math.hypot(dx, dz) > .01) state.trailerYaw = Math.atan2(dx, -dz);
    }
    const f = new THREE.Vector3(Math.sin(state.trailerYaw), 0, -Math.cos(state.trailerYaw));
    const axle = hitch.clone().addScaledVector(f, -HITCH_TO_AXLE);
    const axleGround = R.surfaceHeight(axle.x, axle.z);
    state.trailerPitch = Math.atan2(hitch.y - (axleGround + KINGPIN.y), HITCH_TO_AXLE);
    trailer.rotation.order = "YXZ";
    trailer.rotation.set(state.trailerPitch, -state.trailerYaw, state.roll * .35 + state.sway * .018);
    // The *transformed* kingpin and fifth wheel coincide, including pitch and roll.
    trailer.position.copy(hitch).sub(KINGPIN.clone().applyQuaternion(trailer.quaternion));
    trailer.updateMatrixWorld(true);
    state.trailerAxle.copy(trailer.localToWorld(AXLE.clone()));
    state.hitch.copy(hitch);
    state.articulation = angle(state.yaw - state.trailerYaw);
  }
  function step(state, input, dt, preset = "standard") {
    const tune = presets[preset] || presets.standard;
    state.elapsed += dt;
    const steering = input.touchSteer || ((input.right ? 1 : 0) - (input.left ? 1 : 0));
    const steerLimit = THREE.MathUtils.degToRad(tune.steerLow - Math.min(Math.abs(state.speed), 25) / 25 * (tune.steerLow - tune.steerHigh));
    state.steer = THREE.MathUtils.damp(state.steer, steering * steerLimit, tune.response, dt);
    state.throttle = THREE.MathUtils.damp(state.throttle, input.throttle ? 1 : 0, 4, dt);
    const moving = Math.abs(state.speed) > .15;
    state.brakeHeat = R.clamp(state.brakeHeat + ((input.brake && moving) ? 15 + Math.abs(state.speed) * .25 : -8.5) * dt, 0, 100);
    if (input.reverse && Math.abs(state.speed) < .25) state.reverse = true;
    if (!input.reverse) state.reverse = false;
    const f = new THREE.Vector3(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const front = state.pos.clone().addScaledVector(f, 2.6), back = state.pos.clone().addScaledVector(f, -2.6);
    const grade = (R.surfaceHeight(front.x, front.z) - R.surfaceHeight(back.x, back.z)) / 5.2;
    const gravity = -9.81 * grade;
    const thrust = state.reverse ? -2.8 : state.throttle * tune.throttle * (1 - Math.min(Math.abs(state.speed) / 26, .85));
    const brakeForce = input.brake ? tune.brake * (state.brakeHeat > 88 ? .42 : 1) : 0;
    const engineForce = input.engine ? tune.engine : 0;
    let next = state.speed + (gravity + thrust - state.speed * .045) * dt;
    const resist = (brakeForce + engineForce + .12) * dt;
    // Braking dissipates speed; it must never turn into reverse acceleration.
    next = Math.sign(next) * Math.max(0, Math.abs(next) - resist);
    if (input.brake && Math.abs(state.speed) < .08 && brakeForce > Math.abs(gravity + thrust)) next = 0;
    state.speed = R.clamp(next, -3.2, 27);
    const yawRate = state.speed / 5.25 * Math.tan(state.steer) * .64;
    state.yaw = angle(state.yaw + yawRate * dt);
    f.set(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    state.pos.addScaledVector(f, state.speed * dt);
    const nearest = R.nearest(state.pos);
    state.progress = R.clamp(nearest.d, 0, R.LENGTH);
    state.offroad = nearest.dist > R.WIDTH * .53;
    state.pos.y = R.surfaceHeight(state.pos.x, state.pos.z);
    state.pitch = THREE.MathUtils.damp(state.pitch, Math.atan(grade), 8, dt);
    state.roll = THREE.MathUtils.damp(state.roll, R.clamp(yawRate * state.speed * .013, -.11, .11), 5, dt);
    const targetSway = R.clamp(yawRate * state.speed * .14 + (input.brake ? Math.abs(state.speed) * .013 : 0), -1.5, 1.5);
    state.sway = THREE.MathUtils.damp(state.sway, targetSway, 2.3, dt);
    if (state.offroad) {
      state.speed *= Math.exp(-1.65 * dt);
      state.damage = R.clamp(state.damage + Math.max(0, Math.abs(state.speed) * 2.237 - 22) * .011 * dt, 0, 100);
    }
    state.wheelRotation -= state.speed * dt / .52;
    const unstable = Math.abs(state.sway) > 1.18 || Math.abs(state.articulation) > 1.12;
    state.stressTime = unstable ? state.stressTime + dt : Math.max(0, state.stressTime - dt * .6);
    let lost = false;
    if (state.stressTime > 1.4 && state.logs > 0 && Math.abs(state.speed) > 2) {
      state.logs--; state.stressTime = 0; lost = true;
    }
    return { lost, nearest };
  }
  const api = { HITCH, KINGPIN, AXLE, HITCH_TO_AXLE, presets, angle, createState, poseTractor, couple, step };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeadfallPhysics = api;
})(typeof window !== "undefined" ? window : globalThis);
