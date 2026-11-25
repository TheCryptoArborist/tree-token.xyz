const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const reports = [];
  try {
    for (const [rev, port] of [
      ["r14", 4191],
      ["r15", 4192],
    ]) {
      const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const origin = `http://127.0.0.1:${port}`;
      await page.route("**/*", async (r) => {
        const u = new URL(r.request().url());
        if (u.origin !== origin) return r.abort();
        if (u.pathname === "/__local/practice") {
          const s = await r.fetch();
          return r.fulfill({
            response: s,
            body: (await s.text()).replace(
              "game = createCanopyGame",
              "game = window.__game = createCanopyGame",
            ),
          });
        }
        return r.continue();
      });
      await page.goto(origin + `/__local/practice?lab=1&revision=${rev}`);
      await page.waitForFunction(
        () => window.__game?.scene.getScene("game")?.player,
      );
      const checks = await page.evaluate(() => {
        const s = __game.scene.getScene("game");
        s.guideClose?.();
        if (s.paused) s.togglePause();
        __game.loop.sleep();
        s.invincible = true;
        s.autoFire = false;
        const out = [];
        for (const kind of ["bat", "borer", "spore"]) {
          s.enemies.clear(true, true);
          s.pickups.clear(true, true);
          s.tweens.killAll();
          s.rng = new s.rng.constructor(12345);
          s.run.score = 0;
          s.run.kills = 0;
          s.chain = 0;
          s.pruneCharge = 0;
          s.clearedRows.clear();
          s.killsSinceSeed =
            s.killsSinceCore =
            s.killsSinceTurbo =
            s.killsSinceBoom =
              0;
          s.spawn(kind);
          s.tweens.killAll();
          const e = s.enemies.getChildren()[0];
          e.setPosition(240, 260);
          e.setData("formationRow", -1);
          e.hp = 2;
          e.diving = false;
          e.settled = true;
          let state = 123,
            calls = 0;
          const original = Math.random;
          Math.random = () => {
            calls++;
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
          };
          try {
            s.hitEnemy(e, 1, false);
            const hit = { hp: e.hp, score: s.run.score, kills: s.run.kills };
            s.hitEnemy(e, 99, false);
            out.push({
              kind,
              hit,
              score: s.run.score,
              kills: s.run.kills,
              chain: s.chain,
              pruneCharge: s.pruneCharge,
              lives: s.lives,
              randomCalls: calls,
              randomState: state,
              nextGameRandom: s.rng.next(),
              drops: s.pickups
                .getChildren()
                .map((p) => ({
                  type: p.getData("pickupType"),
                  x: p.x,
                  y: p.y,
                  vx: p.body.velocity.x,
                  vy: p.body.velocity.y,
                })),
              remainingEnemies: s.enemies
                .getChildren()
                .map((e) => ({
                  kind: e.kind,
                  hp: e.hp,
                  vx: e.body.velocity.x,
                  vy: e.body.velocity.y,
                })),
            });
          } finally {
            Math.random = original;
          }
        }
        return out;
      });
      assert.deepEqual(errors, []);
      reports.push({ revision: rev, checks, errors });
      await page.close();
    }
    assert.deepEqual(reports[0].checks, reports[1].checks);
    fs.writeFileSync(
      "docs/impact-gameplay-parity.json",
      JSON.stringify({ synthetic: true, matched: true, reports }, null, 2),
    );
    console.log(
      "r14/r15 match: damage, score, kills, chain, lives, drops, spore split and both random streams.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
