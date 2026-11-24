const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const revision = process.env.TREEFORCE_REVISION || "r12";
assert.ok(["r12", "r13"].includes(revision));
const origin = process.env.TREEFORCE_URL || "http://127.0.0.1:4186";
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
      const timing = await page.evaluate(() => {
        window.s = __game.scene.getScene("game");
        if (s.guideClose) s.guideClose();
        if (s.paused) s.togglePause();
        __game.loop.sleep();
        s.tweens.killAll();
        s.enemies.clear(true, true);
        s.invincible = true;
        s.autoFire = false;
        const retainedChildren = new Set(s.children.list);
        const phases = [];
        for (const kind of ["challenge", "windfall"])
          for (const repeat of [false, true]) {
            s.bonusText = s.add.text(0, 0, "");
            s.showBonusIntro(kind);
            const first = repeat ? 1100 : 3000;
            const timeline = [];
            const record = () =>
              timeline.push(s.bonusIntro?.phase || "complete");
            record();
            s.updateBonusIntro(first - 1);
            record();
            s.paused = true;
            s.updateBonusIntro(10000);
            record();
            s.paused = false;
            s.updateBonusIntro(1);
            record();
            s.updateBonusIntro(649);
            record();
            s.updateBonusIntro(1);
            record();
            s.updateBonusIntro(449);
            record();
            s.updateBonusIntro(1);
            record();
            phases.push({ kind, repeat, timeline });
          }
        const original = s.time.delayedCall.bind(s.time),
          durations = [];
        s.time.delayedCall = function (ms, ...args) {
          durations.push(ms);
          return original(ms, ...args);
        };
        for (const wave of [0, 2, 9]) {
          s.run.wave = wave;
          s.roundSequence();
        }
        s.time.delayedCall = original;
        s.time.removeAllEvents();
        s.time.preUpdate();
        // Remove only new synthetic result cards; preserve the depth-25 Pause button.
        s.children.list
          .filter((o) => o.depth === 25 && !retainedChildren.has(o))
          .forEach((o) => o.destroy());
        return {
          pauseControlRetained: !!(s.pauseButtonBg?.active && s.pauseButtonBg.visible),
          phases,
          clearDelays: durations.filter((ms) =>
            [1800, 2400, 3600].includes(ms),
          ),
        };
      });
      assert.equal(timing.pauseControlRetained, true);
      for (const p of timing.phases)
        assert.deepEqual(p.timeline, [
          "title",
          "title",
          "title",
          "ready",
          "ready",
          "go",
          "go",
          "complete",
        ]);
      assert.deepEqual(timing.clearDelays, [2400, 1800, 3600]);
      const challenge = await page.evaluate(() => {
        s.challenge = undefined;
        s.startChallenge(2);
        s.updateBonusIntro(4100);
        s.rushDestroyed = 40;
        s.rushShotsFired = 40;
        s.rushShotsHit = 40;
        s.challenge.escaped = 0;
        s.run.score = 4000;
        s.finishChallenge();
        const score = s.run.score;
        s.finishChallenge();
        const card = s.children.list.filter((o) => o.depth === 25).at(-1),
          text = card.list.find((o) => o.type === "Text"),
          panel = card.list.find((o) => o.type === "Rectangle");
        const b = text.getBounds(),
          p = panel.getBounds();
        s.cameras.main.flashEffect.reset();
        s.cameras.main.shakeEffect.reset();
        s.notice.setVisible(false);
        __game.renderer.preRender();
        __game.scene.render(__game.renderer);
        __game.renderer.postRender();
        return {
          score,
          afterRepeat: s.run.score,
          text: text.text,
          fits:
            b.left >= p.left &&
            b.right <= p.right &&
            b.top >= p.top &&
            b.bottom <= p.bottom,
        };
      });
      assert.equal(challenge.score, 14000);
      assert.equal(challenge.afterRepeat, 14000);
      assert.ok(challenge.text.includes("TARGET POINTS +4,000 (EARNED)"));
      assert.ok(challenge.text.includes("COMPLETION BONUS +10,000"));
      assert.ok(challenge.fits);
      await page.screenshot({
        path: `docs/treeforce89-challenge-${revision}-${width}.png`,
      });
      const partial = await page.evaluate(() => {
        s.time.removeAllEvents();
        s.children.list
          .filter((o) => o.depth === 25)
          .forEach((o) => o.destroy());
        s.challenge = undefined;
        s.startChallenge(2);
        s.updateBonusIntro(4100);
        s.rushDestroyed = 39;
        s.rushShotsFired = 40;
        s.rushShotsHit = 39;
        s.challenge.escaped = 1;
        s.run.score = 3900;
        s.finishChallenge();
        return {
          score: s.run.score,
          text: s.children.list
            .filter((o) => o.depth === 25)
            .at(-1)
            .list.find((o) => o.type === "Text").text,
        };
      });
      assert.equal(partial.score, 3900);
      assert.ok(partial.text.includes("TARGET POINTS +3,900 (EARNED)"));
      assert.ok(partial.text.includes("COMPLETION BONUS +0"));
      const wave = await page.evaluate(() => {
        s.time.removeAllEvents();
        s.children.list
          .filter((o) => o.depth === 25)
          .forEach((o) => o.destroy());
        s.run.score = 5000;
        s.startWave(2);
        s.run.score += 1234;
        s.run.kills = s.waveKillsStart + 12;
        s.chain = 8;
        s.updateHud();
        s.roundSequence();
        const card = s.children.list.filter((o) => o.depth === 25).at(-1);
        s.tweens.killTweensOf(card);
        card.setAlpha(1);
        const text = card.list.filter((o) => o.type === "Text").at(-1),
          panel = card.list.find((o) => o.type === "Rectangle"),
          b = text.getBounds(),
          p = panel.getBounds();
        s.notice.setVisible(false);
        s.lessonText.setVisible(false);
        __game.renderer.preRender();
        __game.scene.render(__game.renderer);
        __game.renderer.postRender();
        return {
          score: s.run.score,
          text: text.text,
          fits:
            b.left >= p.left &&
            b.right <= p.right &&
            b.top >= p.top &&
            b.bottom <= p.bottom,
        };
      });
      assert.equal(wave.score, 6234);
      assert.ok(wave.text.includes("+1,234 POINTS THIS ATTEMPT"));
      assert.ok(wave.fits);
      await page.screenshot({
        path: `docs/treeforce89-wave-clear-${revision}-${width}.png`,
      });
      assert.deepEqual(errors, []);
      results.push({ width, timing, challenge, partial, wave, errors });
      await page.close();
    }
    fs.writeFileSync(
      "docs/treeforce89-round-presentation-checks.json",
      JSON.stringify(results, null, 2),
    );
    console.log(
      "Timing, pause, score attribution, idempotence and card bounds passed at 320/390/1000px",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
