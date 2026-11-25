const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const revision = process.env.TREEFORCE_REVISION || "r9";
assert.ok(["r8", "r9", "r12", "r13", "r15"].includes(revision));
const origin =
  process.env.TREEFORCE_URL ||
  (revision === "r13"
    ? "http://127.0.0.1:4187"
    : revision === "r12"
      ? "http://127.0.0.1:4186"
      : revision === "r9"
        ? "http://127.0.0.1:4183"
        : "http://127.0.0.1:4182");
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const results = [];
  try {
    for (const width of [320, 390, 1000]) {
      const page = await browser.newPage({
          viewport: { width, height: 900 },
          isMobile: width < 620,
          hasTouch: width < 620,
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === "/__local/practice") {
          const response = await route.fetch();
          const body = (await response.text()).replace(
            "game = createCanopyGame",
            "game = window.__game = createCanopyGame",
          );
          return route.fulfill({ response, body });
        }
        return route.continue();
      });
      await page.goto(origin + `/__local/practice?lab=1&revision=${revision}`);
      await page.waitForFunction(
        () => window.__game?.scene.getScene("game")?.player,
      );
      const result = await page.evaluate(() => {
        const s = __game.scene.getScene("game");
        if (s.guideClose) s.guideClose();
        if (s.paused) s.togglePause();
        __game.loop.sleep();
        s.time.paused = false;
        s.paused = false;
        s.tweens.resumeAll();
        s.invincible = true;
        s.autoFire = false;
        s.enemies.clear(true, true);
        s.tweens.killAll();
        s.startWave(9);
        s.waveStart = 0;
        s.nextDiveAt = Infinity;
        s.nextEnemyFireAt = Infinity;
        s.spawnCanopyTyrant();
        const boss = s.enemies.getChildren()[0],
          tween = s.tweens.getTweensOf(boss)[0];
        const bounds = (o) => {
          const b = o.getBounds();
          return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        };
        const track = s.children.getByName("bossHpTrack");
        const hudBottom = Math.max(
          68,
          bounds(track).bottom + 0.5,
          bounds(s.bossHpText).bottom,
        );
        tween.update(0);
        tween.update(0);
        const entrance = [];
        let previous = 0;
        for (const ms of [0, 500, 1000, 1500, 2000, 2500]) {
          tween.update(ms - previous);
          previous = ms;
          entrance.push({ ms, y: boss.y, bounds: bounds(boss) });
        }
        s.tweens.killTweensOf(boss);
        boss.settled = true;
        boss.lastFire = Infinity;
        let minTop = Infinity,
          maxBottom = -Infinity,
          minLeft = Infinity,
          maxRight = -Infinity,
          damageMin = Infinity;
        for (let phase = 0; phase <= 3; phase++) {
          boss.setData("bossDamageStage", phase);
          if (phase) s.addBossDamage(boss, phase);
          for (let ms = 0; ms <= 20000; ms += 10) {
            s.updateEnemies(ms, 0);
            const b = bounds(boss);
            minTop = Math.min(minTop, b.top);
            maxBottom = Math.max(maxBottom, b.bottom);
            minLeft = Math.min(minLeft, b.left);
            maxRight = Math.max(maxRight, b.right);
            for (const mark of s.bossDamageFx)
              damageMin = Math.min(damageMin, bounds(mark).top);
          }
        }
        s.tweens.killTweensOf(s.notice);
        s.notice.setVisible(true).setAlpha(1).setScale(1);
        const bannerTop = bounds(s.notice).top;
        const originalFire = s.enemyFire;
        let fired = 0;
        s.enemyFire = () => fired++;
        boss.lastFire = 10000;
        s.updateEnemies(11150, 0);
        const beforeCadence = fired;
        s.updateEnemies(11151, 0);
        const afterCadence = fired;
        s.enemyFire = originalFire;
        boss.lastFire = Infinity;
        s.bullets.clear(true, true);
        boss.x = 240;
        boss.y = 180;
        s.enemyFire(boss);
        const shots = s.bullets.getChildren().map((b) => ({
          x: b.x,
          y: b.y,
          speed: Math.hypot(b.body.velocity.x, b.body.velocity.y),
        }));
        boss.body.updateFromGameObject();
        boss.body.updateCenter();
        const body = {
          width: boss.body.width,
          height: boss.body.height,
          centerX: boss.body.center.x,
          centerY: boss.body.center.y,
          spriteX: boss.x,
          spriteY: boss.y,
        };
        // Render the highest settled pose with all phase marks and a phase banner.
        s.updateEnemies((Math.PI * 1.5) / 0.0021, 0);
        s.cameras.main.flashEffect.reset();
        s.cameras.main.shakeEffect.reset();
        __game.renderer.preRender();
        __game.scene.render(__game.renderer);
        __game.renderer.postRender();
        const canvas = document
          .querySelector("#practice canvas")
          .getBoundingClientRect();
        return {
          hudBottom,
          entrance,
          minTop,
          maxBottom,
          minLeft,
          maxRight,
          damageMin,
          bannerTop,
          shots,
          body,
          canvas: { width: canvas.width, height: canvas.height },
          hp: boss.hp,
          fireCadence: beforeCadence === 0 && afterCadence === 1,
        };
      });
      assert.deepEqual(errors, []);
      assert.equal(result.hp, 24);
      assert.equal(result.shots.length, 5);
      assert.ok(
        result.shots.every((b) => Math.abs(b.speed - 217 * 1.315) < 0.001),
      );
      assert.equal(result.fireCadence, true);
      assert.ok(Math.abs(result.body.width - 96 * 1.08) < 0.001);
      assert.ok(Math.abs(result.body.height - 82 * 1.08) < 0.001);
      assert.ok(Math.abs(result.body.centerX - result.body.spriteX) < 1);
      assert.ok(Math.abs(result.body.centerY - result.body.spriteY) < 1);
      if (revision !== "r8") {
        assert.ok(result.minTop > result.hudBottom + 6);
        assert.ok(result.damageMin > result.hudBottom);
        assert.ok(result.maxBottom < result.bannerTop);
        assert.ok(result.minLeft > 0 && result.maxRight < 480);
        assert.ok(result.entrance.at(-1).bounds.top > result.hudBottom);
      } else assert.ok(result.minTop < result.hudBottom);
      await page.screenshot({
        path: `docs/treeforce89-boss-${revision}-${width}.png`,
      });
      results.push({ width, ...result, errors });
      await page.close();
    }
    fs.writeFileSync(
      `docs/treeforce89-boss-${revision}-checks.json`,
      JSON.stringify({ synthetic: true, revision, results }, null, 2),
    );
    console.log(
      JSON.stringify(
        results.map(
          ({ width, minTop, hudBottom, maxBottom, bannerTop, entrance }) => ({
            width,
            minTop,
            hudBottom,
            maxBottom,
            bannerTop,
            entrance,
          }),
        ),
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
