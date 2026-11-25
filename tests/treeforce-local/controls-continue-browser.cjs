// Synthetic authorized-resume payload only. No wallet, checkout or payment requests.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const revision = process.env.TREEFORCE_REVISION || "r13";
assert.ok(["r12", "r13", "r15"].includes(revision));
const origin =
  process.env.TREEFORCE_URL ||
  (revision === "r13" ? "http://127.0.0.1:4187" : "http://127.0.0.1:4186");
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({
          viewport: { width, height: 844 },
          isMobile: width < 620,
          hasTouch: width < 620,
        }),
        errors = [],
        checks = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.origin !== origin) return route.abort();
        if (u.pathname === "/__local/practice") {
          const response = await route.fetch();
          return route.fulfill({
            response,
            body: (await response.text()).replace(
              "game = createCanopyGame",
              "window.__create=createCanopyGame;game = window.__game = createCanopyGame",
            ),
          });
        }
        return route.continue();
      });
      await page.goto(origin + `/__local/practice?lab=1&revision=${revision}`);
      await page.waitForFunction(
        () => window.__game?.scene.getScene("game")?.player,
      );
      const initial = await page.evaluate(() => {
        window.s = __game.scene.getScene("game");
        return {
          score: s.run.score,
          lives: s.lives,
          guide: !!s.pauseOverlay,
          paused: s.paused,
        };
      });
      assert.equal(initial.score, 0);
      assert.equal(initial.lives, 3);
      if (width < 620) {
        assert.equal(initial.guide, true);
        assert.equal(initial.paused, true);
      }
      checks.push("fresh run and first mobile guide");
      await page.evaluate(() => {
        if (s.guideClose) s.guideClose();
        if (s.paused) s.togglePause();
        s.invincible = true;
      });
      const hero = await page.evaluate(() => {
        const frames = [];
        for (let i = 0; i < 5; i++) {
          s.stage = i;
          s.applyStage(false);
          const b = s.player.getBounds();
          frames.push({
            stage: i,
            top: b.top,
            bottom: b.bottom,
            left: b.left,
            right: b.right,
          });
        }
        s.stage = 0;
        s.applyStage(false);
        return frames;
      });
      assert.ok(
        hero.every(
          (b) => b.top > 68 && b.bottom < 640 && b.left > 0 && b.right < 480,
        ),
      );
      checks.push("hero fits play area at all five growth stages");
      if (width < 620) {
        const fire = page.locator(".mobile-fire"),
          auto = page.locator(".mobile-auto"),
          shield = page.locator(".mobile-shield");
        await page.waitForFunction(
          () => !document.querySelector(".mobile-fire").disabled,
        );
        for (const release of [
          "pointercancel",
          "lostpointercapture",
          "pointerup",
        ]) {
          await fire.dispatchEvent("pointerdown", {
            pointerId: 8,
            pointerType: "touch",
            isPrimary: true,
          });
          assert.equal(await page.evaluate(() => s.fireHeld), true);
          await fire.dispatchEvent(release, {
            pointerId: 8,
            pointerType: "touch",
            isPrimary: true,
          });
          assert.equal(await page.evaluate(() => s.fireHeld), false);
        }
        checks.push(
          "touch fire releases on cancel, capture loss and pointer-up",
        );
        const before = await page.evaluate(() => {
          window.__toggles = 0;
          const fn = s.toggleAutoFire;
          s.toggleAutoFire = function (...args) {
            __toggles++;
            return fn.apply(this, args);
          };
          return s.autoFire;
        });
        await auto.click();
        assert.equal(await page.evaluate(() => s.autoFire), !before);
        assert.equal(await page.evaluate(() => __toggles), 1);
        checks.push("Auto Fire click toggles exactly once");
        for (const action of ["tap", "keyboard"]) {
          await page.evaluate(() => (__toggles = 0));
          const was = await page.evaluate(() => s.autoFire);
          if (action === "tap") await auto.tap();
          else {
            await auto.focus();
            await page.keyboard.press("Enter");
          }
          assert.equal(await page.evaluate(() => s.autoFire), !was);
          assert.equal(await page.evaluate(() => __toggles), 1);
        }
        checks.push("touch tap and keyboard activation toggle once");
        assert.equal(await shield.isDisabled(), true);
        await page.evaluate(() => {
          s.stage = 1;
          s.pruneCharge = 100;
          s.applyStage(false);
          s.updateHud();
        });
        await page.waitForFunction(
          () => !document.querySelector(".mobile-shield").disabled,
        );
        await fire.focus();
        await page.keyboard.down("Space");
        assert.equal(
          await page.evaluate(() => s.fireHeld && s.stage === 1),
          true,
        );
        await page.keyboard.up("Space");
        assert.equal(await page.evaluate(() => s.fireHeld), false);
        checks.push("keyboard Fire does not also trigger Shield");
        await shield.click();
        assert.equal(await page.evaluate(() => s.stage), 0);
        checks.push("Shield requires growth/charge and spends growth");
        const bounds = await page.locator("#practice canvas").boundingBox();
        const button = await auto.boundingBox();
        await page.mouse.move(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height * 0.65,
        );
        await page.mouse.down();
        assert.equal(await page.evaluate(() => s.fireHeld), true);
        await page.mouse.move(
          button.x + button.width / 2,
          button.y + button.height / 2,
        );
        await page.mouse.up();
        assert.equal(
          await page.evaluate(() => !s.dragging && !s.fireHeld),
          true,
        );
        checks.push("mouse release over toolbar clears canvas firing");
        await fire.dispatchEvent("pointerdown", {
          pointerId: 8,
          pointerType: "touch",
        });
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        assert.equal(await page.evaluate(() => !s.fireHeld && s.paused), true);
        checks.push("interruption cancels held fire and pauses");
        await page.evaluate(() => {
          window.dispatchEvent(new Event("focus"));
          s.togglePause();
        });
      }
      await page.evaluate(() => {
        s.run.score = 43210;
        s.run.wave = 4;
        s.run.kills = 100;
        s.run.maxChain = 25;
        s.run.boomPickups = 1;
        s.run.turboPickups = 1;
        window.__resume = { ...s.run };
        __game.destroy(true);
      });
      await page.waitForFunction(
        () => !document.querySelector("#practice canvas"),
      );
      await page.evaluate(() => {
        __game = __create(document.getElementById("practice"), {
          initialScene: "game",
          resumeRun: __resume,
        });
      });
      await page.waitForFunction(() => __game.scene.getScene("game")?.player);
      const resumed = await page.evaluate(() => {
        window.s = __game.scene.getScene("game");
        return {
          score: s.run.score,
          wave: s.run.wave,
          lives: s.lives,
          kills: s.run.kills,
          maxChain: s.run.maxChain,
          boomPickups: s.run.boomPickups,
          turboPickups: s.run.turboPickups,
          runId: s.run.runId,
          seed: s.run.seed,
          originalRunId: __resume.runId,
          originalSeed: __resume.seed,
        };
      });
      assert.equal(resumed.score, 43210);
      assert.equal(resumed.wave, 4);
      assert.equal(resumed.lives, 3);
      assert.equal(resumed.kills, 100);
      assert.equal(resumed.maxChain, 25);
      assert.equal(resumed.boomPickups, 1);
      assert.equal(resumed.turboPickups, 1);
      assert.equal(resumed.runId, resumed.originalRunId);
      assert.equal(resumed.seed, resumed.originalSeed);
      checks.push(
        "simulated paid-continue resume retains score, wave, identity and achievement progress; restores three lives",
      );
      await page.evaluate(() => __game.destroy(true));
      await page.waitForFunction(
        () => !document.querySelector("#practice canvas"),
      );
      await page.evaluate(() => {
        __game = __create(document.getElementById("practice"), {
          initialScene: "game",
          serverRunId: "grove-" + "d".repeat(32),
        });
      });
      await page.waitForFunction(() => __game.scene.getScene("game")?.player);
      const fresh = await page.evaluate(() => {
        const s = __game.scene.getScene("game");
        return {
          score: s.run.score,
          wave: s.run.wave,
          lives: s.lives,
          maxChain: s.run.maxChain || 0,
          runId: s.run.runId,
        };
      });
      assert.deepEqual(fresh, {
        score: 0,
        wave: 0,
        lives: 3,
        maxChain: 0,
        runId: "grove-" + "d".repeat(32),
      });
      checks.push("next individual run starts clean");
      assert.deepEqual(errors, []);
      results.push({ width, checks, hero, resumed, fresh, errors });
      await page.close();
    }
    fs.writeFileSync(
      "docs/controls-continue.json",
      JSON.stringify({ synthetic: true, realPayment: false, results }, null, 2),
    );
    console.log(
      "Controls, growth visibility, resume and separate-run checks passed at 320/390/1280px",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
