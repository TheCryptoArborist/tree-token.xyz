// Presentation only: deterministic poses, no RNG, movement or physics writes.
export function faceFlightPath(enemy, curve, progress, settle = false) {
  const tangent = curve.getTangent(progress);
  if (Math.abs(tangent.x) + Math.abs(tangent.y) <= 1e-8) return;
  let angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI - 90;
  angle = ((((angle + 180) % 360) + 360) % 360) - 180;
  if (settle) {
    const t = Math.max(0, Math.min(1, (progress - 0.8) / 0.2));
    angle *= 1 - t * t * (3 - 2 * t);
  }
  enemy.setAngle(angle);
}
export function animateEnemy(enemy, time) {
  if (
    !enemy.active ||
    time < (enemy.getData("shieldStunUntil") || 0) ||
    enemy.getData("leader") ||
    enemy.getData("guardian") ||
    enemy.getData("challengeTarget") ||
    enemy.getData("corrupted")
  )
    return;
  const current = enemy.texture.key,
    base = current.startsWith("bat-flight-")
      ? "bat"
      : current.startsWith("wasp-flight-")
        ? "wasp"
        : current;
  if (base !== "bat" && base !== "wasp") return;
  const pose = Math.floor((time + (enemy.phase || 0) * 100) / 125) % 2;
  const key = `${base}-flight-${pose}`;
  if (current !== key) enemy.setTexture(key);
}
export function setupCombatLook(scene, foreground) {
  if (scene.sys.settings.key !== "game") return;
  // Keep the forest, but separate silhouettes from its brightest details.
  scene.add
    .rectangle(240, 360, 480, 720, 0x020906, 0.18)
    .setDepth(-3)
    .setName("combat-contrast");
  foreground.setAlpha(0.22);
  for (const [kind, w, h] of [
    ["bat", 30, 22],
    ["wasp", 32, 28],
  ])
    for (let pose = 0; pose < 2; pose++) {
      const key = `${kind}-flight-${pose}`;
      if (scene.textures.exists(key)) continue;
      const g = scene.make.graphics({ x: 0, y: 0, add: false }),
        cx = w / 2,
        cy = kind === "bat" ? 10 : 13;
      const tipY = pose ? 14 : 3,
        innerY = pose ? h - 2 : h - 5;
      g.fillStyle(0x4f125e)
        .fillTriangle(cx, cy, 1, tipY, 7, innerY)
        .fillTriangle(cx, cy, w - 1, tipY, w - 7, innerY);
      g.lineStyle(1, 0xe3a6ff)
        .strokeTriangle(cx, cy, 1, tipY, 7, innerY)
        .strokeTriangle(cx, cy, w - 1, tipY, w - 7, innerY);
      if (kind === "bat") {
        g.fillStyle(0xc55df0).fillCircle(cx, cy, 6);
        g.lineStyle(1, 0xf0c6ff).strokeCircle(cx, cy, 6);
        g.fillStyle(0x9dffb4).fillRect(11, 8, 3, 2).fillRect(17, 8, 3, 2);
      } else {
        g.fillStyle(0x68dc76).fillEllipse(16, 14, 12, 24);
        g.lineStyle(1, 0xf5e783).strokeEllipse(16, 14, 12, 24);
        g.fillStyle(0xffd35a).fillRect(11, 9, 10, 3).fillRect(11, 16, 10, 3);
        g.fillStyle(0xff6b9b).fillCircle(13, 7, 2).fillCircle(19, 7, 2);
        g.fillStyle(0xf5e783).fillTriangle(16, 27, 12, 20, 20, 20);
      }
      g.generateTexture(key, w, h);
      g.destroy();
    }
}
