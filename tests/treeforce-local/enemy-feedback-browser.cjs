// Execute actual game methods and Phaser timers with a deterministic local clock.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const origin = process.env.TREEFORCE_URL || "http://127.0.0.1:4181";
const revision = process.env.TREEFORCE_REVISION || "r7";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(["r6", "r7", "r11", "r12", "r13", "r14", "r15"].includes(revision));
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/__local/practice") {
        const response = await route.fetch();
        let body = await response.text();
        assert.equal(body.split("game = createCanopyGame").length, 2);
        body = body.replace(
          "game = createCanopyGame",
          "game = window.__game = createCanopyGame",
        );
        return route.fulfill({ response, body });
      }
      return route.continue();
    });
    await page.goto(
      origin + `/__local/practice?lab=1&revision=${revision}&scene=title`,
    );
    await page.waitForFunction(() => window.__game?.scene.isActive("title"));
    await page
      .locator("#practice canvas")
      .click({ position: { x: 180, y: 300 } });
    await page.waitForFunction(
      () =>
        __game.scene.isActive("game") && __game.scene.getScene("game").player,
    );
    const checks = await page.evaluate(() => {
      const s = __game.scene.getScene("game");
      __game.loop.sleep();
      s.invincible = true;
      s.autoFire = false;
      s.paused = false;
      s.time.paused = false;
      s.nextDiveAt = Infinity;
      s.nextEnemyFireAt = Infinity;
      s.captureUsed = true;
      const checks = [],
        white = 0xffffff,
        gold = 0xffe06b,
        normal = 0xffffff;
      const expect = (name, ok, actual) =>
        checks.push({ name, passed: !!ok, actual });
      const appearance = (e) => ({ tint: e.tintTopLeft, fill: e.tintFill });
      const update = () => s.updateEnemies(s.time.now, 0);
      const step = (ms) => {
        s.time.preUpdate();
        s.time.update(s.time.now + ms, ms);
        update();
      };
      const spawn = (kind = "borer") => {
        s.enemies.clear(true, true);
        s.tweens.killAll();
        s.spawn(kind);
        const e = s.enemies.getChildren()[0];
        e.hp = 100;
        e.settled = true;
        e.lastFire = Infinity;
        s.tweens.killTweensOf(e);
        return e;
      };
      for (const wave of [0, 4]) {
        s.run.wave = wave;
        const e = spawn(wave === 0 ? "bat" : "borer");
        s.primeDive(e, s.time.now);
        const duration = e.getData("divePlan").warningMs;
        update();
        expect(
          `wave ${wave + 1}: warning survives first update`,
          e.tintTopLeft === gold,
          appearance(e),
        );
        step(duration - 1);
        expect(
          `wave ${wave + 1}: warning lasts ${duration}ms`,
          e.tintTopLeft === gold,
          appearance(e),
        );
        step(1);
        expect(
          `wave ${wave + 1}: warning ends at dive`,
          e.tintTopLeft === normal && !e.tintFill,
          appearance(e),
        );
      }
      s.run.wave = 0;
      let e = spawn();
      s.hitEnemy(e, 1, false);
      update();
      expect(
        "nonlethal hit survives first update",
        e.tintFill && e.tintTopLeft === white,
        appearance(e),
      );
      step(54);
      expect("hit lasts through 54ms", e.tintFill, appearance(e));
      step(1);
      expect("hit clears at 55ms", !e.tintFill, appearance(e));
      e = spawn();
      s.hitEnemy(e, 1, false);
      step(30);
      s.hitEnemy(e, 1, false);
      step(25);
      expect(
        "older hit callback cannot erase newer hit",
        e.tintFill,
        appearance(e),
      );
      step(30);
      expect(
        "newest hit clears after its own 55ms",
        !e.tintFill,
        appearance(e),
      );
      e = spawn("bat");
      s.primeDive(e, s.time.now);
      s.hitEnemy(e, 1, false);
      step(55);
      expect(
        "warning returns after hit",
        e.tintTopLeft === gold && !e.tintFill,
        appearance(e),
      );
      e = spawn();
      e.setData("shieldStunUntil", s.time.now + 450);
      s.hitEnemy(e, 1, false);
      update();
      expect("hit takes precedence over stun", e.tintFill, appearance(e));
      step(55);
      expect(
        "stun returns after hit",
        e.tintTopLeft === 0x9dffb4 && !e.tintFill,
        appearance(e),
      );
      step(395);
      expect(
        "stun clears at expiry",
        e.tintTopLeft === normal && !e.tintFill,
        appearance(e),
      );
      e = spawn();
      e.setData("isCaptor", true);
      s.captorRaid(e);
      update();
      expect(
        "captor rescue window retains gold",
        e.tintTopLeft === gold,
        appearance(e),
      );
      s.hitEnemy(e, 1, false);
      step(55);
      expect(
        "captor gold returns after hit",
        e.tintTopLeft === gold && !e.tintFill,
        appearance(e),
      );
      s.returnToFormation(e);
      update();
      expect(
        "captor gold clears when rescue window closes",
        e.tintTopLeft === normal,
        appearance(e),
      );
      e = spawn("bat");
      e.setData("mutateAt", s.time.now);
      update();
      s.primeDive(e, s.time.now);
      s.executeDive(e);
      s.hitEnemy(e, 1, false);
      step(55);
      expect(
        "mutation keeps wasp texture without stuck flash",
        e.texture.key.replace(/-(?:flight-[01]|wing-[0-5]--?[0-2])$/, "") === "wasp" &&
          !e.tintFill &&
          e.tintTopLeft === normal,
        { texture: e.texture.key, ...appearance(e) },
      );
      e = spawn();
      e.setData("corrupted", true);
      s.executeDive(e);
      s.hitEnemy(e, 1, false);
      step(55);
      expect(
        "corrupted identity returns after flash",
        e.tintTopLeft === 0xff4fc8 && !e.tintFill,
        appearance(e),
      );
      e = spawn();
      e.setData("challengeTarget", true);
      update();
      expect(
        "challenge target retains existing gold",
        e.tintTopLeft === 0xffe493,
        appearance(e),
      );
      e = spawn("boss");
      e.setData("bossDamageStage", 2);
      s.hitEnemy(e, 1, false);
      update();
      expect("boss damage color does not erase hit", e.tintFill, appearance(e));
      step(99);
      expect("boss hit lasts through 99ms", e.tintFill, appearance(e));
      step(1);
      expect(
        "boss phase color returns at 100ms",
        e.tintTopLeft === 0xff8a62 && !e.tintFill,
        appearance(e),
      );
      e = spawn();
      s.hitEnemy(e, 1, false);
      s.togglePause();
      step(500);
      expect("pause holds hit flash", e.tintFill, appearance(e));
      s.togglePause();
      step(54);
      expect(
        "resume preserves remaining flash time",
        e.tintFill,
        appearance(e),
      );
      step(1);
      expect("resumed flash expires normally", !e.tintFill, appearance(e));
      e = spawn("bat");
      s.primeDive(e, s.time.now);
      const warning = e.getData("divePlan").warningMs;
      s.togglePause();
      step(1000);
      expect("pause holds dive warning", e.tintTopLeft === gold, appearance(e));
      s.togglePause();
      step(warning);
      expect(
        "resumed warning ends with actual dive",
        e.tintTopLeft === normal && !e.tintFill,
        appearance(e),
      );
      e = spawn();
      s.hitEnemy(e, 1, false);
      e.destroy();
      step(55);
      expect("destroyed enemy callback is safe", true);
      return checks;
    });
    assert.deepEqual(errors, []);
    const report = { synthetic: true, origin, revision, checks, errors };
    if (process.env.TREEFORCE_VISUAL_REPORT)
      fs.writeFileSync(
        process.env.TREEFORCE_VISUAL_REPORT,
        JSON.stringify(report, null, 2),
      );
    console.log(JSON.stringify(report, null, 2));
    if (revision !== "r6")
      assert.ok(
        checks.every((c) => c.passed),
        "Enemy feedback checks failed",
      );
    else
      assert.ok(
        checks.some((c) => !c.passed),
        "Baseline must reproduce defect",
      );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
