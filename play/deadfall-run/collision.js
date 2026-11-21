/* Swept planar contacts for the existing articulated kinematic rig.
   Both bodies have solid footprints. This is not a general rigid-body engine. */
(function (root) {
  "use strict";
  const scalars = ["yaw", "pitch", "roll", "sway", "trailerYaw", "trailerPitch", "trailerReach", "trailerSide", "articulation", "wheelRotation"];
  function capture(state) {
    const result = { pos: state.pos.clone(), hitch: state.hitch.clone(), trailerAxle: state.trailerAxle.clone() };
    for (const key of scalars) result[key] = state[key];
    return result;
  }
  function restore(state, saved) {
    for (const key of ["pos", "hitch", "trailerAxle"]) state[key].copy(saved[key]);
    for (const key of scalars) state[key] = saved[key];
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  function closest(p, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, n = dx * dx + dz * dz;
    const t = n ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / n, 0, 1) : 0;
    return { x: a.x + dx * t, z: a.z + dz * t };
  }
  function segmentPair(a, b, c, d) {
    const ux = b.x - a.x, uz = b.z - a.z, vx = d.x - c.x, vz = d.z - c.z;
    const den = ux * vz - uz * vx;
    if (Math.abs(den) > 1e-10) {
      const wx = c.x - a.x, wz = c.z - a.z;
      const t = (wx * vz - wz * vx) / den, s = (wx * uz - wz * ux) / den;
      if (t >= 0 && t <= 1 && s >= 0 && s <= 1) {
        const p = { x: a.x + ux * t, z: a.z + uz * t }; return { a: p, b: p, d: 0 };
      }
    }
    const pairs = [[a, closest(a, c, d)], [b, closest(b, c, d)], [closest(c, a, b), c], [closest(d, a, b), d]];
    let best;
    for (const [p, q] of pairs) { const d = dist2(p, q); if (!best || d < best.d) best = { a: p, b: q, d }; }
    return best;
  }
  function footprint(body, trailer = false) {
    const zMin = trailer ? -4.95 : -4.72, zMax = trailer ? 5.0 : 3.5;
    const center = body.localToWorld(new THREE.Vector3(0, 0, (zMin + zMax) / 2));
    const yaw = -body.rotation.y, cos = Math.cos(yaw), sin = Math.sin(yaw);
    return { center, cos, sin, width: 1.50, length: (zMax - zMin) / 2, body: trailer ? "trailer" : "tractor" };
  }
  function contact(box, object) {
    if (object.disabled) return null;
    if (object.maxY !== undefined && box.center.y - 1.2 > object.maxY) return null;
    if (object.minY !== undefined && box.center.y + 4 < object.minY) return null;
    const local = p => ({ x: (p.x - box.center.x) * box.cos + (p.z - box.center.z) * box.sin,
      z: -(p.x - box.center.x) * box.sin + (p.z - box.center.z) * box.cos });
    const a = local(object.a), b = local(object.b || object.a), w = box.width, l = box.length;
    const inside = p => Math.abs(p.x) <= w && Math.abs(p.z) <= l;
    let near = inside(a) ? { a, b: a, d: 0 } : inside(b) ? { a: b, b, d: 0 } : null;
    if (!near) {
      const corners = [{ x: -w, z: -l }, { x: w, z: -l }, { x: w, z: l }, { x: -w, z: l }];
      for (let i = 0; i < 4; i++) {
        const pair = segmentPair(a, b, corners[i], corners[(i + 1) % 4]);
        if (!near || pair.d < near.d) near = pair;
      }
    }
    const radius = object.radius + .012;
    if (near.d >= radius * radius) return null;
    let nx = near.b.x - near.a.x, nz = near.b.z - near.a.z, distance = Math.hypot(nx, nz);
    if (distance < 1e-9) { nx = -near.a.x; nz = -near.a.z; distance = Math.hypot(nx, nz); }
    if (distance < 1e-9) { nx = 1; nz = 0; distance = 1; }
    nx /= distance; nz /= distance;
    return { object, body: box.body,
      normal: new THREE.Vector3(nx * box.cos - nz * box.sin, 0, nx * box.sin + nz * box.cos),
      point: new THREE.Vector3(box.center.x + near.a.x * box.cos - near.a.z * box.sin,
        box.center.y + .8, box.center.z + near.a.x * box.sin + near.a.z * box.cos) };
  }
  function create(R, P, objects = [], onImpact = () => {}) {
    const grid = new Map(), cell = 24, cooldown = new Map();
    const key = (x, z) => `${x},${z}`;
    for (const object of objects) {
      const b = object.b || object.a, r = object.radius;
      for (let x = Math.floor((Math.min(object.a.x, b.x) - r) / cell); x <= Math.floor((Math.max(object.a.x, b.x) + r) / cell); x++)
        for (let z = Math.floor((Math.min(object.a.z, b.z) - r) / cell); z <= Math.floor((Math.max(object.a.z, b.z) + r) / cell); z++) {
          const k = key(x, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(object);
        }
    }
    function nearby(a, b = a, margin = 18) {
      const found = new Set();
      for (let x = Math.floor((Math.min(a.x, b.x) - margin) / cell); x <= Math.floor((Math.max(a.x, b.x) + margin) / cell); x++)
        for (let z = Math.floor((Math.min(a.z, b.z) - margin) / cell); z <= Math.floor((Math.max(a.z, b.z) + margin) / cell); z++)
          for (const o of grid.get(key(x, z)) || []) if (!o.disabled) found.add(o);
      return [...found];
    }
    function overlaps(tractor, trailer, candidates) {
      const boxes = [footprint(tractor), footprint(trailer, true)];
      for (const box of boxes) for (const object of candidates || nearby(tractor.position, trailer.position, 8)) {
        const hit = contact(box, object); if (hit) return hit;
      }
      return null;
    }
    function resolve(state, previous, tractor, trailer, dt) {
      const desired = capture(state), candidates = nearby(previous.pos, state.pos);
      if (!candidates.length) return null;
      const travel = desired.pos.clone().sub(previous.pos);
      const turn = P.angle(desired.yaw - previous.yaw);
      // Every intermediate probe starts from the same saved hitch/axle state.
      // Probing must not accumulate trailer steering or separate the coupling.
      function probe(t) {
        restore(state, previous); state.pos.lerp(desired.pos, t); state.yaw = P.angle(previous.yaw + turn * t);
        for (const k of ["pitch", "roll", "sway", "wheelRotation"]) state[k] = previous[k] + (desired[k] - previous[k]) * t;
        P.couple(state, tractor, trailer);
        return overlaps(tractor, trailer, candidates);
      }
      const span = Math.max(travel.length(), desired.trailerAxle.distanceTo(previous.trailerAxle)) + Math.abs(turn) * 6;
      const steps = Math.max(1, Math.ceil(span / .18));
      let hit = null, lo = 0, hi = 1;
      for (let i = 1; i <= steps; i++) { const t = i / steps; hit = probe(t); if (hit) { hi = t; break; } lo = t; }
      if (!hit) { restore(state, desired); P.couple(state, tractor, trailer); return null; }
      let initialHit = hit;
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2, found = probe(mid); if (found) { hi = mid; initialHit = found; } else lo = mid; }
      probe(Math.max(0, lo - .001));
      const normal = initialHit.normal, velocity = travel.clone().multiplyScalar(1 / Math.max(dt, .0001));
      const closing = Math.max(0, -velocity.dot(normal));
      const speed = Math.abs(state.speed), impactSpeed = Math.min(speed, Math.max(closing, Math.abs(turn) * 4 / Math.max(dt, .0001)));
      const o = initialHit.object, smallTree = o.kind === "tree" && o.radius < .28;
      const breakable = (smallTree || o.kind === "limb" || o.kind === "post") && impactSpeed > (smallTree ? 4.5 : 2);
      if (breakable) { o.disabled = true; state.speed *= smallTree ? .38 : .65; }
      else {
        const safe = capture(state), slide = travel.clone().multiplyScalar(1 - lo);
        slide.addScaledVector(normal, -Math.min(0, slide.dot(normal)));
        // A shallow scrape may slide along the rail; head-on contacts stop.
        const ratio = speed > .1 ? closing / speed : 1;
        let slid = false;
        if (o.kind === "barrier" && ratio < .6 && slide.length() < .5 && slide.lengthSq() > 1e-10) {
          state.pos.addScaledVector(slide, .88); state.pos.y = R.surfaceHeight(state.pos.x, state.pos.z);
          P.couple(state, tractor, trailer); slid = !overlaps(tractor, trailer, candidates);
          if (!slid) { restore(state, safe); P.couple(state, tractor, trailer); }
        }
        state.speed = slid ? state.speed * Math.exp(-(.4 + ratio * 3) * dt) : 0;
      }
      state.progress = R.clamp(R.nearest(state.pos).d, 0, R.LENGTH);
      const last = cooldown.get(o.id) ?? -Infinity;
      const event = { ...initialHit, speed: impactSpeed, broken: breakable };
      if (impactSpeed > .6 && state.elapsed - last > .55) {
        cooldown.set(o.id, state.elapsed); state.collisions.add(o.id);
        state.damage = R.clamp(state.damage + Math.min(75, impactSpeed * impactSpeed * (smallTree ? .12 : .32)), 0, 100);
        onImpact(event);
      }
      return event;
    }
    return { resolve, overlaps, objects, reset() { cooldown.clear(); for (const o of objects) o.disabled = false; } };
  }
  const api = { create, capture, footprint, contact };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.DeadfallCollision = api;
})(typeof window !== "undefined" ? window : globalThis);
