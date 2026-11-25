// Local visual prototype only. No physics, RNG, score or wallet changes.
export function setupChristmasLook(scene) {
  if (scene.sys.settings.key !== 'game' || scene.holidayTheme !== 'christmas') return;
  scene.children.list.filter(o => o.texture?.key?.startsWith('forest-')).forEach(o => o.setTint(0x9dcddd));
  const trim = scene.add.graphics().setDepth(-2).setName('christmas-trim');
  // Frosted firs frame the arena; keep the middle clear for combat.
  for (const x of [7, 473]) {
    for (let tier = 0; tier < 3; tier++) {
      const y = 410 + tier * 48, half = 25 + tier * 10;
      trim.fillStyle(0x163e49, .9).fillTriangle(x, y - 90, x - half, y + 30, x + half, y + 30);
      trim.fillStyle(0xbce4e8, .65).fillTriangle(x, y - 90, x - half * .42, y - 40, x + half * .42, y - 40);
    }
    for (let i = 0; i < 8; i++) {
      trim.fillStyle(i % 2 ? 0xf5ce76 : 0xd26d82, .75).fillCircle(x + (x < 240 ? 1 : -1) * (6 + i % 3 * 7), 372 + i * 22, 2);
    }
  }
  // A small red-and-gold ribbon follows the original Arborwing; no texture/body swap.
  const ribbon = scene.add.graphics().setName('christmas-arborwing');
  ribbon.fillStyle(0xb93750).fillTriangle(-9, 2, -3, -2, -3, 5)
    .fillTriangle(9, 2, 3, -2, 3, 5);
  ribbon.fillStyle(0xf4d27c).fillCircle(0, 2, 2);
  const snow = scene.add.graphics().setDepth(-2).setName('christmas-snow');
  const flakes = Array.from({length: 32}, (_, i) => ({x:(i*137+29)%480,y:(i*83+17)%720,r:i%3===0?1.5:1}));
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let elapsed = 0;
  function draw(_time, delta = 0) {
    if (!scene.paused && !reduced) elapsed += Math.min(delta, 50);
    const hero = scene.player;
    ribbon.setVisible(!!hero?.active && hero.visible);
    if (hero?.active) ribbon.setPosition(hero.x, hero.y).setRotation(hero.rotation)
      .setDepth(hero.depth + .01).setAlpha(hero.alpha);
    snow.clear().fillStyle(0xd8eff3, .36);
    for (const f of flakes) snow.fillCircle((f.x + Math.sin(elapsed/3500+f.y)*5 +480)%480,(f.y+elapsed*.012)%720,f.r);
  }
  draw();
  scene.events.on('update', draw);
  scene.events.once('shutdown', () => scene.events.off('update', draw));
}
