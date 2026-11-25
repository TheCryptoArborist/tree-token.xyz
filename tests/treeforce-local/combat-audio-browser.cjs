// Local unranked engine routing and real Web Audio verification. No external requests.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const origin = process.env.TREEFORCE_URL || "http://127.0.0.1:4180";
const revision = process.env.TREEFORCE_REVISION || "r6";
assert.ok(["r6", "r12", "r13", "r15"].includes(revision));
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (
        url.pathname === "/__local/practice" ||
        url.pathname.endsWith(`/arcade-review-${revision}.js`)
      ) {
        const response = await route.fetch();
        let body = await response.text();
        const needle =
          url.pathname === "/__local/practice"
            ? "game = createCanopyGame"
            : "function W(e){";
        assert.equal(body.split(needle).length, 2);
        body = body.replace(
          needle,
          url.pathname === "/__local/practice"
            ? "game = window.__game = createCanopyGame"
            : "window.__audit={mixer:U,audio:K};function W(e){",
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
      .click({ position: { x: 230, y: 400 } });
    await page.waitForFunction(
      () =>
        __game.scene.isActive("game") && __game.scene.getScene("game").player,
    );
    const result = await page.evaluate(() => {
      const scene = __game.scene.getScene("game"),
        m = __audit.mixer,
        c = __audit.audio();
      scene.invincible = true;
      scene.autoFire = false;
      scene.enemies.clear(true, true);
      const events = [],
        schedule = m.schedule;
      m.schedule = function (...args) {
        const accepted = schedule.apply(this, args);
        events.push({ key: args[2], category: args[4], accepted });
        return accepted;
      };
      const reset = () => {
        m.stop();
        m.last.clear();
        m.duckUntil = 0;
      };
      reset();
      scene.lastShot = -10000;
      scene.fire();
      scene.spawn("borer");
      const enemy = scene.enemies.getChildren()[0];
      enemy.hp = 5;
      reset();
      scene.enemyFire(enemy);
      reset();
      scene.hitEnemy(enemy, 1, false);
      reset();
      scene.hitEnemy(enemy, 99, false);
      scene.togglePause();
      reset();
      const fire = m.combat(c, "fire", 620, 0.025, 0.03),
        hit = m.combat(c, "hit", 150, 0.03, 0.03);
      reset();
      const upgrade = m.play(c, "upgrade"),
        kill = m.combat(c, "kill", 230, 0.06, 0.06);
      return {
        events,
        fire,
        hit,
        upgrade,
        kill,
        voices: m.voices.length,
        audioState: c.state,
      };
    });
    for (const category of ["fire", "enemyFire", "hit", "kill"])
      assert.ok(
        result.events.some((e) => e.key === "combat:" + category && e.accepted),
        category,
      );
    for (const key of ["fire", "hit", "upgrade", "kill"])
      assert.equal(result[key], true, key);
    assert.equal(result.audioState, "running");
    assert.ok(result.voices <= 10);
    assert.deepEqual(errors, []);
    const report = { synthetic: true, origin, checks: result, errors };
    if (process.env.TREEFORCE_AUDIO_REPORT)
      fs.writeFileSync(
        process.env.TREEFORCE_AUDIO_REPORT,
        JSON.stringify(report, null, 2),
      );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
