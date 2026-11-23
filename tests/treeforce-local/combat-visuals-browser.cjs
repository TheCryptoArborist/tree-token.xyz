const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const revision = process.env.TREEFORCE_REVISION || "r11";
assert.ok(["r10", "r11"].includes(revision));
const origin =
  revision === "r11" ? "http://127.0.0.1:4185" : "http://127.0.0.1:4184";
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
          return route.fulfill({
            response,
            body: (await response.text()).replace(
              "game = createCanopyGame",
              "game = window.__game = createCanopyGame",
            ),
          });
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
        s.invincible = true;
        s.autoFire = false;
        s.tweens.killAll();
        s.nextDiveAt = Infinity;
        s.nextEnemyFireAt = Infinity;
        s.captureUsed = true;
        const trace = [];
        const sample = (e, stage, step) => {
          e.body.updateFromGameObject();
          e.body.updateCenter();
          trace.push({
            kind: e.kind,
            stage,
            step,
            x: e.x,
            y: e.y,
            angle: e.angle,
            width: e.body.width,
            height: e.body.height,
            offsetX: e.body.center.x - e.x,
            offsetY: e.body.center.y - e.y,
          });
        };
        for (const kind of ["bat", "borer", "spore"]) {
          s.enemies.clear(true, true);
          s.tweens.killAll();
          s.run.wave = 0;
          s.waveSpawned = 0;
          s.attackPatternSerial = 0;
          s.player.x = 240;
          s.spawn(kind, "leftArc");
          const e = s.enemies.getChildren()[0];
          e.phase = 0;
          let tween = s.tweens.getTweensOf(e)[0]; // Entry uses a counter tween, not a sprite target.
          tween = s.tweens.getTweens().find((t) => t.isNumberTween);
          if (!tween) throw Error("Entry counter tween not found");
          tween.update(0);
          tween.update(0);
          for (let i = 0; i <= 4; i++) {
            if (i) tween.update(1050);
            sample(e, "entry", i);
          }
          s.tweens.killAll();
          e.setPosition(160, 150);
          e.homeX = 160;
          e.homeY = 150;
          e.settled = true;
          s.run.wave = 4;
          s.primeDive(e, s.time.now);
          s.executeDive(e);
          tween = s.tweens.getTweens().find((t) => t.isNumberTween);
          if (!tween) throw Error("Dive counter tween not found");
          tween.update(0);
          tween.update(0);
          const duration = e.getData("divePlan").duration;
          for (let i = 0; i < 4; i++) {
            if (i) tween.update(duration / 4);
            sample(e, "dive", i);
          }
        }
        s.enemies.clear(true, true);
        s.tweens.killAll();
        s.run.wave = 4;
        s.waveText.setText("WAVE\n05");
        for (let i = 0; i < 16; i++) {
          s.waveSpawned = i;
          s.spawn(i % 5 === 0 ? "borer" : "bat");
          const e = s.enemies.getChildren().at(-1);
          s.tweens.killTweensOf(e);
          e.phase = i * 0.3;
          e.settled = true;
          e.setPosition(e.homeX, e.homeY);
          e.lastFire = Infinity;
        }
        s.tweens.killAll();
        s.waveStart = 0;
        s.updateEnemies(1000, 0);
        const bats = s.enemies
          .getChildren()
          .filter((e) => e.kind === "bat" && !e.getData("leader"));
        const e = bats[0];
        e.phase = 0;
        s.updateEnemies(1000, 0);
        const pose0 = e.texture.key;
        s.updateEnemies(1125, 0);
        const pose1 = e.texture.key;
        const dims = {
          width: e.width,
          height: e.height,
          bodyWidth: e.body.sourceWidth,
          bodyHeight: e.body.sourceHeight,
        };
        s.hitEnemy(e, 0, false);
        s.updateEnemies(1125, 0);
        const hitPreserved = e.tintFill;
        e.setData("feedbackHit", null);
        e.setData("feedbackDiveWarning", true);
        s.updateEnemies(1125, 0);
        const warningPreserved = e.tintTopLeft === 0xffe06b;
        const hero = {
          key: s.player.texture.key,
          width: s.player.width,
          height: s.player.height,
          scale: s.player.scaleX,
          y: s.player.y,
        };
        s.notice.setVisible(false);
        s.lessonText.setVisible(false);
        s.enemies
          .getChildren()
          .slice(0, 3)
          .forEach((e) => s.enemyFire(e));
        s.cameras.main.flashEffect.reset();
        s.cameras.main.shakeEffect.reset();
        __game.renderer.preRender();
        __game.scene.render(__game.renderer);
        __game.renderer.postRender();
        return {
          trace,
          pose0,
          pose1,
          dims,
          hitPreserved,
          warningPreserved,
          hero,
          contrast: s.children.getByName("combat-contrast")?.fillAlpha || 0,
          foreground: s.children.list.find(
            (o) => o.texture?.key === "forest-front",
          )?.alpha,
        };
      });
      assert.deepEqual(errors, []);
      assert.ok(result.hitPreserved && result.warningPreserved);
      assert.equal(result.hero.key, "playerSheet");
      assert.equal(result.dims.width, 30);
      assert.equal(result.dims.height, 22);
      if (revision === "r11") {
        assert.notEqual(result.pose0, result.pose1);
        assert.equal(result.contrast, 0.18);
        assert.equal(result.foreground, 0.22);
      } else {
        assert.equal(result.pose0, result.pose1);
        assert.equal(result.foreground, 0.48);
      }
      await page.screenshot({
        path: `docs/treeforce89-combat-${revision}-${width}.png`,
      });
      results.push({ width, ...result, errors });
      await page.close();
    }
    fs.writeFileSync(
      `docs/treeforce89-combat-${revision}-checks.json`,
      JSON.stringify(results, null, 2),
    );
    console.log("Three viewport checks passed: " + revision);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
