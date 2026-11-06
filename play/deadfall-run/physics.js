/* Kinematic tractor / semitrailer model, not a rigid-body physics engine. */
(function (root) {
  "use strict";
  function createModel(R) {
    const HITCH = new THREE.Vector3(0, 1.42, 2.25);
    const KINGPIN = new THREE.Vector3(0, 1.42, -4.85);
    const AXLE = new THREE.Vector3(0, 0, 2.9);
    const HITCH_TO_AXLE = AXLE.z - KINGPIN.z;
    const TRACTOR_REAR_AXLE = new THREE.Vector3(0, 0, (.88 + 2.22) / 2);
    const presets = {
      easy: { steerLow: 30, steerHigh: 14, response: 6.5, throttle: 5.2, brake: 10.8, engine: 4.2, camera: 4.2 },
      standard: { steerLow: 26, steerHigh: 11, response: 5.4, throttle: 4.6, brake: 9.7, engine: 3.6, camera: 3.8 },
      heavy: { steerLow: 22, steerHigh: 8, response: 4.2, throttle: 3.9, brake: 8.7, engine: 3.1, camera: 3.2 },
      // Original benchmark tuning, not a reproduction of the Prism3D physics engine.
      loaded: { steerLow: 38, steerHigh: 9, steerRate: 20, response: 4, throttle: 1.65,
        brake: 4.3, engine: 1.05, camera: 3.8, reverseThrust: 1.1, reverseMax: 2,
        heatGain: 4, cooling: 2.5, fadeStart: 70 }
    };
    const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
    function createState(d = 0) {
      const f = R.frame(d);
      const state = { pos: f.p.clone(), yaw: f.yaw, pitch: Math.atan2(f.f.y, Math.hypot(f.f.x, f.f.z)),
        roll: 0, speed: 0, steer: 0, throttle: 0, brakeHeat: 0, damage: 0, logs: 5, progress: d,
        trailerYaw: f.yaw, trailerPitch: 0, trailerReach: HITCH_TO_AXLE, trailerSide: 0,
        trailerAxle: new THREE.Vector3(), hitch: new THREE.Vector3(),
        sway: 0, stressTime: 0, elapsed: 0, offroad: false, collisions: new Set(), reverse: false,
        articulation: 0, wheelRotation: 0, coupled: false, surface: "asphalt", scraping: 0 };
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
      const roll = state.roll * .35 + state.sway * .018;
      // Horizontal kingpin-to-axle offset in the trailer's heading frame.
      // Lean offsets the pin sideways above the tyres. That is an offset, NOT
      // fresh steering on every update (the old axle-to-pin atan2 accumulated it).
      const side = -KINGPIN.y * Math.sin(roll), height = KINGPIN.y * Math.cos(roll);
      const previousYaw = initialize ? state.yaw : state.trailerYaw;
      const dx = hitch.x - state.hitch.x, dz = hitch.z - state.hitch.z;
      const lateral = dx * Math.cos(previousYaw) + dz * Math.sin(previousYaw);
      const longitudinal = dx * Math.sin(previousYaw) - dz * Math.cos(previousYaw);
      let yaw = previousYaw, pitch = state.trailerPitch, reach = HITCH_TO_AXLE;
      // Solve pitch/heading together. The axle displacement has zero sideways
      // component at the midpoint heading, in forward AND reverse. Using signed
      // hitch travel also makes repeated pose updates without travel idempotent.
      for (let i = 0; i < 8; i++) {
        reach = HITCH_TO_AXLE * Math.cos(pitch) - height * Math.sin(pitch);
        yaw = initialize ? previousYaw : angle(previousYaw + 2 * Math.atan2(
          lateral + state.trailerSide - side, longitudinal + state.trailerReach + reach));
        const x = hitch.x - reach * Math.sin(yaw) - side * Math.cos(yaw);
        const z = hitch.z + reach * Math.cos(yaw) - side * Math.sin(yaw);
        const rise = hitch.y - R.surfaceHeight(x, z);
        pitch = Math.asin(R.clamp(rise / Math.hypot(HITCH_TO_AXLE, height), -.99, .99))
          - Math.atan2(height, HITCH_TO_AXLE);
      }
      reach = HITCH_TO_AXLE * Math.cos(pitch) - height * Math.sin(pitch);
      state.trailerYaw = yaw; state.trailerPitch = pitch;
      state.trailerReach = reach; state.trailerSide = side;
      trailer.rotation.order = "YXZ";
      trailer.rotation.set(pitch, -yaw, roll);
      // The *transformed* kingpin and fifth wheel coincide, including pitch and roll.
      trailer.position.copy(hitch).sub(KINGPIN.clone().applyQuaternion(trailer.quaternion));
      trailer.updateMatrixWorld(true);
      state.trailerAxle.copy(trailer.localToWorld(AXLE.clone()));
      state.hitch.copy(hitch);
      state.articulation = angle(state.yaw - state.trailerYaw);
      state.coupled = true;
    }
    function step(state, input, dt, preset = "standard") {
      const tune = presets[preset] || presets.standard;
      state.elapsed += dt;
      const roadPosition = R.nearest(state.pos);
      const rearDistance = state.coupled ? R.nearest(state.trailerAxle).dist : roadPosition.dist;
      const edgeDistance = Math.max(roadPosition.dist, rearDistance) + 1.45;
      state.surface = edgeDistance <= R.WIDTH / 2 ? "asphalt" : edgeDistance <= R.WIDTH / 2 + 2.1 ? "gravel" : "grass";
      const grip = state.surface === "asphalt" ? 1 : state.surface === "gravel" ? .84 : .64;
      const steering = input.touchSteer || ((input.right ? 1 : 0) - (input.left ? 1 : 0));
      const steerLimit = THREE.MathUtils.degToRad(tune.steerLow - Math.min(Math.abs(state.speed), 25) / 25 * (tune.steerLow - tune.steerHigh));
      const desiredSteer = THREE.MathUtils.damp(state.steer, steering * steerLimit, tune.response, dt);
      const steerTravel = tune.steerRate ? THREE.MathUtils.degToRad(tune.steerRate) * dt : Infinity;
      state.steer = tune.steerRate ? state.steer + R.clamp(desiredSteer - state.steer, -steerTravel, steerTravel) : desiredSteer;
      state.throttle = THREE.MathUtils.damp(state.throttle, input.throttle ? 1 : 0, 4, dt);
      const moving = Math.abs(state.speed) > .15;
      state.brakeHeat = R.clamp(state.brakeHeat + ((input.brake && moving) ? (tune.heatGain || 15) + Math.abs(state.speed) * .25 : -(tune.cooling || 8.5)) * dt, 0, 100);
      if (input.reverse && Math.abs(state.speed) < .25) state.reverse = true;
      if (!input.reverse) state.reverse = false;
      const f = new THREE.Vector3(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const front = state.pos.clone().addScaledVector(f, 2.6), back = state.pos.clone().addScaledVector(f, -2.6);
      const grade = (R.surfaceHeight(front.x, front.z) - R.surfaceHeight(back.x, back.z)) / 5.2;
      const gravity = -9.81 * grade;
      state.grade = grade;
      const thrust = state.reverse ? -(tune.reverseThrust || 2.8) : state.throttle * tune.throttle * (1 - Math.min(Math.abs(state.speed) / 26, .85));
      const fade = tune.fadeStart ? 1 - .58 * R.clamp((state.brakeHeat - tune.fadeStart) / (100 - tune.fadeStart), 0, 1) : (state.brakeHeat > 88 ? .42 : 1);
      const brakeForce = input.brake ? tune.brake * fade * grip : 0;
      const engineForce = input.engine ? tune.engine : 0;
      let next = state.speed + (gravity + (input.brake && preset === "loaded" ? 0 : thrust) - state.speed * .045) * dt;
      const resist = (brakeForce + engineForce + .12) * dt;
      // Braking dissipates speed; it must never turn into reverse acceleration.
      next = Math.sign(next) * Math.max(0, Math.abs(next) - resist);
      if (input.brake && Math.abs(state.speed) < .08 && brakeForce > Math.abs(gravity + thrust)) next = 0;
      state.speed = R.clamp(next, -(tune.reverseMax || 3.2), 27);
      // Keep the established steering tune, but move about the non-steering
      // rear tandem, not the cab's model origin. Its wheels must not crab sideways.
      const yawRate = state.speed / 5.25 * Math.tan(state.steer) * .64 * Math.sqrt(grip);
      const yawTravel = yawRate * dt, midYaw = state.yaw + yawTravel / 2;
      const rearOffset = TRACTOR_REAR_AXLE.z * Math.cos(state.pitch);
      state.pos.addScaledVector(f, -rearOffset);
      const sinc = Math.abs(yawTravel) < 1e-8 ? 1 : Math.sin(yawTravel / 2) / (yawTravel / 2);
      state.pos.x += Math.sin(midYaw) * state.speed * dt * sinc;
      state.pos.z -= Math.cos(midYaw) * state.speed * dt * sinc;
      state.yaw = angle(state.yaw + yawTravel);
      state.pitch = THREE.MathUtils.damp(state.pitch, Math.atan(grade), 8, dt);
      f.set(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      state.pos.addScaledVector(f, TRACTOR_REAR_AXLE.z * Math.cos(state.pitch));
      const nearest = R.nearest(state.pos);
      state.progress = R.clamp(nearest.d, 0, R.LENGTH);
      state.offroad = state.surface !== "asphalt";
      state.pos.y = R.surfaceHeight(state.pos.x, state.pos.z);
      const side = new THREE.Vector3(Math.cos(state.yaw), 0, Math.sin(state.yaw));
      const rightGround = state.pos.clone().addScaledVector(side, 1.3), leftGround = state.pos.clone().addScaledVector(side, -1.3);
      const bank = state.offroad ? Math.atan2(R.surfaceHeight(rightGround.x, rightGround.z) - R.surfaceHeight(leftGround.x, leftGround.z), 2.6) : 0;
      const rollLimit = state.offroad ? .28 : .11;
      state.roll = THREE.MathUtils.damp(state.roll, R.clamp(yawRate * state.speed * .013 + bank, -rollLimit, rollLimit), 5, dt);
      const targetSway = R.clamp(yawRate * state.speed * .14 + (input.brake ? Math.abs(state.speed) * .013 : 0), -1.5, 1.5);
      state.sway = THREE.MathUtils.damp(state.sway, targetSway, 2.3, dt);
      if (state.offroad) {
        const drag = state.surface === "gravel" ? .10 : .28;
        state.speed *= Math.exp(-drag * dt);
        state.speed = Math.sign(state.speed) * Math.max(0, Math.abs(state.speed) - (state.surface === "gravel" ? .16 : .55) * dt);
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
    return { HITCH, KINGPIN, AXLE, HITCH_TO_AXLE, TRACTOR_REAR_AXLE, presets, angle, createState, poseTractor, couple, step, createModel };
  }
  const api = createModel(typeof module !== "undefined" && module.exports ? require("./route.js") : root.DeadfallRoute);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeadfallPhysics = api;
})(typeof window !== "undefined" ? window : globalThis);
