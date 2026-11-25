// Presentation only: six wing poses over the existing 250ms cycle.
import {
  faceFlightPath as face,
  setupCombatLook as setup,
} from "./combat-visuals.mjs";
export function faceFlightPath(enemy, curve, progress, settle = false) {
  face(enemy, curve, progress, settle);
  const a = curve.getTangent(Math.max(0, progress - 0.04));
  const b = curve.getTangent(Math.min(1, progress + 0.04));
  const turn = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
  const fade = settle ? Math.max(0, Math.min(1, (1 - progress) / 0.2)) : 1;
  enemy.setData(
    "flightBank",
    Math.max(-2, Math.min(2, Math.round(turn * 5 * fade))),
  );
}
const specialFlags = ["leader", "guardian", "challengeTarget", "corrupted"];
export function animateEnemy(enemy, time) {
  if (
    !enemy.active ||
    time < (enemy.getData("shieldStunUntil") || 0) ||
    specialFlags.some((k) => enemy.getData(k))
  )
    return;
  const current = enemy.texture.key;
  const kind = /^(bat|wasp)(?:$|-flight-|-wing-)/.exec(current)?.[1];
  if (!kind) return;
  const pose = Math.floor(
    ((((time + (enemy.phase || 0) * 100) % 250) + 250) % 250) / (250 / 6),
  );
  const bank =
    enemy.returning || (enemy.settled && !enemy.diving)
      ? 0
      : enemy.getData("flightBank") || 0;
  const key = `${kind}-wing-${pose}-${bank}`;
  if (current !== key) enemy.setTexture(key);
}
export function setupCombatLook(scene, foreground) {
  setup(scene, foreground);
  if (scene.sys.settings.key !== "game") return;
  for (const [kind, w, h] of [
    ["bat", 30, 22],
    ["wasp", 32, 28],
  ])
    for (let pose = 0; pose < 6; pose++)
      for (let bank = -2; bank <= 2; bank++) {
        const key = `${kind}-wing-${pose}-${bank}`;
        if (scene.textures.exists(key)) continue;
        const g = scene.make.graphics({ x: 0, y: 0, add: false }),
          cx = w / 2,
          cy = kind === "bat" ? 10 : 13;
        const down = (1 - Math.cos((pose * Math.PI) / 3)) / 2;
        const tip = 3 + 11 * down,
          inner = h - 5 + 3 * down;
        // Different rising/falling trailing edges give six distinct silhouettes.
        const trail = Math.sin((pose * Math.PI) / 3) * 1.4;
        for (const side of [-1, 1]) {
          const folded = bank * side > 0 ? Math.abs(bank) * 1.8 : 0;
          const x = cx + side * (cx - 1 - folded),
            ix = cx + side * (cx - 7 - folded * 0.4);
          g.fillStyle(0x4f125e).fillTriangle(
            cx,
            cy,
            x,
            tip + folded * 0.35,
            ix,
            inner + trail,
          );
          g.lineStyle(1, 0xe3a6ff).strokeTriangle(
            cx,
            cy,
            x,
            tip + folded * 0.35,
            ix,
            inner + trail,
          );
        }
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
