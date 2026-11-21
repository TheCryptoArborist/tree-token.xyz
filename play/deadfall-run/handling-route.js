/* Independent proving ground. Classic scripts also work from a local file. */
(function (root) {
  "use strict";
  const base = typeof module !== "undefined" && module.exports ? require("./route.js") : root.DeadfallRoute;
  const { clamp, random } = base, LENGTH = 900, WIDTH = 14;
  function height(d) {
    if (d <= 210) return 80;
    if (d < 250) return 80 - .07 * (d - 210) ** 2 / 80;
    if (d < 440) return 78.6 - .07 * (d - 250);
    if (d < 480) { const u = d - 440; return 65.3 - .07 * u + .07 * u * u / 80; }
    return 63.9;
  }
  function point(d) {
    const t = clamp((d - 520) / 260, 0, 1);
    return new THREE.Vector3(22 * (1 - Math.cos(t * Math.PI * 2)), height(d), 120 - d);
  }
  function frame(d, lane = 0) {
    const p = point(d), f = point(d + .1).sub(point(d - .1)).normalize();
    const side = new THREE.Vector3(-f.z, 0, f.x).normalize();
    return { p: p.addScaledVector(side, lane), f, side, yaw: Math.atan2(f.x, -f.z) };
  }
  function nearest(pos) {
    const approx = clamp(120 - pos.z, -80, LENGTH + 80);
    let best = { d: approx, dist: Infinity, lane: 0, p: point(approx) };
    for (let d = approx - 35; d < approx + 35; d += 2) {
      const a = point(d), b = point(d + 2), dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp(((pos.x - a.x) * dx + (pos.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const p = a.lerp(b, t), dist = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (dist < best.dist) {
        const side = frame(d + t * 2).side;
        best = { d: d + t * 2, dist, p, lane: (pos.x - p.x) * side.x + (pos.z - p.z) * side.z };
      }
    }
    return best;
  }
  // The whole yard is drivable; cones are scoring markers, not solid barriers.
  function surfaceHeight(x, z) { return height(120 - z) + .045; }
  function terrainHeight(x, z) { return height(120 - z) - .16; }
  const api = { isHandling: true, LENGTH, WIDTH, point, frame, nearest, surfaceHeight, terrainHeight, clamp, random };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeadfallRoute = api;
})(typeof window !== "undefined" ? window : globalThis);
