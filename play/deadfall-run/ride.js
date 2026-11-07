/* Secondary suspension and restrained-load motion. Does not write driving state.
   Metres/radians/seconds; sprung frames pivot at the existing coupling points. */
(function (root) {
  "use strict";
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const AXLES = { tractor: [-3.18, .88, 2.22], trailer: [2.25, 3.57] };
  function spring(frequency, damping, limit) {
    return { x: 0, v: 0, frequency, damping, limit };
  }
  function advance(s, target, dt) {
    target = clamp(target, -s.limit, s.limit);
    const w = 2 * Math.PI * s.frequency, a = s.damping * w, b = w * Math.sqrt(1 - s.damping ** 2);
    const decay = Math.exp(-a * dt), cos = Math.cos(b * dt), sin = Math.sin(b * dt), offset = s.x - target;
    const x = target + decay * (offset * cos + (s.v + a * offset) / b * sin);
    s.v = decay * (s.v * cos - (a * s.v + w * w * offset) / b * sin);
    s.x = clamp(x, -s.limit, s.limit);
    if (x !== s.x && s.x * s.v > 0) s.v = 0;
    return s.x;
  }
  function create(R) {
    const springs = {
      tractorPitch: spring(1.65, .70, .018), tractorRoll: spring(1.8, .76, .012),
      trailerPitch: spring(1.25, .72, .009), trailerRoll: spring(1.45, .76, .010),
      cargoX: spring(2.2, .80, .026), cargoZ: spring(2.0, .82, .035),
      cargoPitch: spring(2.2, .80, .0025), cargoRoll: spring(2.2, .80, .0035)
    };
    const value = { tractorPitch: 0, tractorRoll: 0, trailerPitch: 0, trailerRoll: 0,
      cargoX: 0, cargoZ: 0, cargoPitch: 0, cargoRoll: 0, acceleration: 0, lateral: 0,
      axles: { tractor: [], trailer: [] } };
    let previous = null;
    // Spatial roughness, not clock-driven shaking. Smooth lab asphalt has none.
    function roughness(x, z) {
      const n = R.nearest({ x, z }), edge = Math.abs(n.lane ?? n.dist), half = R.WIDTH / 2;
      const blend = clamp((edge - half) / 2.1, 0, 1), soil = clamp((edge - half - 2.1) / 2, 0, 1);
      const amplitude = R.isHandling && edge <= half ? 0 : .0015 + blend * .008 + soil * .013;
      return amplitude * (Math.sin(z * 3.1 + x * 1.7) * .55 + Math.sin(z * 1.07 - x * 2.2) * .30 + Math.sin(z * 7.7 + x * 4.1) * .15);
    }
    function sample(body, axleOffsets) {
      const up = Math.max(.5, body.matrixWorld.elements[5]);
      return axleOffsets.map(z => {
        const pair = [-1, 1].map(side => {
          const p = body.localToWorld(new THREE.Vector3(side * 1.18, 0, z));
          const ground = R.surfaceHeight(p.x, p.z);
          return { tyre: clamp((ground + .52 - p.y) / up, .32, .72),
            input: clamp((ground + roughness(p.x, p.z) + .52 - p.y) / up - .52, -.18, .18) };
        });
        return { z, left: pair[0].tyre, right: pair[1].tyre,
          height: (pair[0].input + pair[1].input) / 2, bank: (pair[1].input - pair[0].input) / 2.36 };
      });
    }
    function targets(state, tractor, trailer, acceleration, lateral, trailerLateral) {
      value.axles.tractor = sample(tractor, AXLES.tractor); value.axles.trailer = sample(trailer, AXLES.trailer);
      const t = value.axles.tractor, r = value.axles.trailer;
      const rear = (t[1].height + t[2].height) / 2, tail = (r[0].height + r[1].height) / 2;
      return { tractorPitch: (t[0].height - rear) / 4.73 + acceleration * .0024,
        tractorRoll: (t[0].bank + t[1].bank + t[2].bank) / 3 + lateral * .0016,
        trailerPitch: -tail / 7.75 + acceleration * .0010,
        trailerRoll: (r[0].bank + r[1].bank) / 2 + trailerLateral * .0015,
        cargoX: -trailerLateral * .004, cargoZ: acceleration * .004,
        cargoPitch: acceleration * .00025, cargoRoll: trailerLateral * .0006 };
    }
    function remember(state) {
      previous = { speed: state.speed, yaw: state.yaw, trailerYaw: state.trailerYaw, pos: state.pos.clone() };
    }
    function reset(state, tractor, trailer) {
      const target = targets(state, tractor, trailer, 0, 0, 0);
      for (const [key, s] of Object.entries(springs)) { s.x = clamp(target[key], -s.limit, s.limit); s.v = 0; value[key] = s.x; }
      value.acceleration = value.lateral = 0; remember(state);
      return value;
    }
    function step(state, tractor, trailer, dt) {
      if (!previous || state.pos.distanceTo(previous.pos) > 4) return reset(state, tractor, trailer);
      if (!(dt > 0)) return value;
      dt = Math.min(.05, dt);
      const acceleration = clamp((state.speed - previous.speed) / dt, -14, 10);
      const lateral = clamp(angle(state.yaw - previous.yaw) / dt * state.speed, -12, 12);
      const trailerLateral = clamp(angle(state.trailerYaw - previous.trailerYaw) / dt * state.speed, -12, 12);
      const filter = 1 - Math.exp(-dt * 12);
      value.acceleration += (acceleration - value.acceleration) * filter;
      value.lateral += (trailerLateral - value.lateral) * filter;
      const target = targets(state, tractor, trailer, value.acceleration, lateral, value.lateral);
      for (const [key, s] of Object.entries(springs)) value[key] = advance(s, target[key], dt);
      remember(state); return value;
    }
    return { value, reset, step };
  }
  const api = { create, AXLES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeadfallRide = api;
})(typeof window !== "undefined" ? window : globalThis);
