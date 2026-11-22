/* Shared world coordinates. Local vehicle forward is -Z; positive heading turns right. */
(function (root) {
  "use strict";
  const LENGTH = 1800, WIDTH = 12;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function point(d) {
    return new THREE.Vector3(Math.sin(d / 115) * 31 + Math.sin(d / 43) * 5,
      128 - d * .071 + Math.sin(d / 91) * 1.8, 120 - d);
  }
  function frame(d, lane = 0) {
    const p = point(d), f = point(d + .5).sub(point(d - .5)).normalize();
    const side = new THREE.Vector3(-f.z, 0, f.x).normalize();
    return { p: p.addScaledVector(side, lane), f, side, yaw: Math.atan2(f.x, -f.z) };
  }
  function terrainHeight(x, z) {
    const d = 120 - z, p = point(d), offset = x - p.x, a = Math.abs(offset);
    const outside = Math.max(0, a - 8.4), blend = 1 - Math.exp(-outside / 26);
    const folds = Math.sin(x * .033 + d * .009) * 8 + Math.sin(x * .016 - d * .021) * 11
      + Math.sin(x * .081 + d * .044) * 2.3;
    // Match the road's longitudinal grade across its cross-section, not a flat strip.
    const dx = Math.cos(d / 115) * 31 / 115 + Math.cos(d / 43) * 5 / 43;
    const roadY = point(d + offset * dx / (1 + dx * dx)).y;
    // A cut into the uphill bank on the right; the valley falls away on the left.
    return roadY - .19 + blend * folds + (offset > 0 ? outside * .33 : -outside * .16);
  }
  function nearest(pos) {
    const approx = clamp(120 - pos.z, -40, LENGTH + 35);
    let best = { d: approx, dist: Infinity, lane: 0, p: point(approx) };
    // Project onto short segments instead of snapping the vehicle to six-metre samples.
    for (let d = approx - 14; d < approx + 14; d += 2) {
      const a = point(d), b = point(d + 2), dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp(((pos.x - a.x) * dx + (pos.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const p = a.lerp(b, t), dist = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (dist < best.dist) {
        const at = d + t * 2, side = frame(at).side;
        best = { d: at, dist, p, lane: (pos.x - p.x) * side.x + (pos.z - p.z) * side.z };
      }
    }
    return best;
  }
  function surfaceHeight(x, z) {
    const p = point(120 - z);
    return Math.abs(x - p.x) < 8.4 ? nearest({ x, z }).p.y + .045 : terrainHeight(x, z) + .035;
  }
  function random(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  const api = { LENGTH, WIDTH, point, frame, terrainHeight, surfaceHeight, nearest, clamp, random };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeadfallRoute = api;
})(typeof window !== "undefined" ? window : globalThis);
