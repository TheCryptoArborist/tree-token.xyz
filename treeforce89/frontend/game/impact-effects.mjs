// Enemy death presentation only. Preserve the old burst's random draw budget.
const states = new WeakMap();
export function enemyImpact(scene, x, y, kind, sample) {
  const heavy = kind === "borer",
    dust = kind === "spore",
    count = heavy ? 16 : 9;
  const draws = Array.from({ length: count }, () => [
    sample(-65, 65),
    sample(-70, 55),
    sample(280, 620),
  ]);
  let state = states.get(scene);
  if (!state) {
    state = { live: 0 };
    states.set(scene, state);
  }
  if (state.live + count > 72) return false;
  for (let i = 0; i < count; i++) {
    const [rx, ry, rd] = draws[i],
      angle = (i * Math.PI * 2) / count;
    const radius = (dust ? 15 : heavy ? 26 : 23) + Math.abs(rx) / 8;
    const dx = Math.cos(angle) * radius,
      dy = Math.sin(angle) * radius;
    const color = dust
      ? i % 2
        ? 0xc78de3
        : 0x9dffb4
      : heavy
        ? i % 3
          ? 0xb78b58
          : 0xf4d88a
        : i % 3
          ? 0x9dffb4
          : 0xe3eeb2;
    const p = dust
      ? scene.add.circle(x, y, 1.5 + (i % 2), color, 0.55)
      : heavy
        ? scene.add.rectangle(x, y, 3 + (i % 3), 6, color)
        : scene.add.triangle(x, y, 0, -3, 2, 3, -2, 2, color);
    p.setDepth(4).setAngle(i * 37);
    p.impactProgress = 0;
    state.live++;
    p.once("destroy", () => {
      state.live = Math.max(0, state.live - 1);
    });
    const duration = dust
      ? 380 + (rd - 280) * 0.35
      : heavy
        ? 360 + (rd - 280) * 0.45
        : 190 + (rd - 280) * 0.28;
    scene.tweens.add({
      targets: p,
      impactProgress: 1,
      duration,
      ease: "Linear",
      onUpdate: () => {
        const t = p.impactProgress;
        if (heavy)
          p.setPosition(
            x + dx * t,
            y - (16 + Math.abs(ry) * 0.2) * t + 48 * t * t,
          );
        else
          p.setPosition(
            x + dx * (1 - (1 - t) ** 2),
            y + dy * (1 - (1 - t) ** 2) + (dust ? -10 * t : 8 * t * t),
          );
        p.setAlpha((dust ? 0.55 : 1) * (1 - t));
        p.setScale(dust ? 1 + t * 0.7 : 1 - t * 0.55);
        if (!dust) p.setAngle(i * 37 + (rx < 0 ? -1 : 1) * 120 * t);
      },
      onComplete: () => p.destroy(),
    });
  }
  return true;
}
