const { chromium } = require("playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  fs.mkdirSync("frames", { recursive: true });
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await b.newPage({ viewport: { width: 640, height: 900 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.origin !== "http://127.0.0.1:4192") return r.abort();
      if (
        u.pathname === "/__local/practice" ||
        u.pathname.endsWith("/arcade-review-r15.js")
      ) {
        const s = await r.fetch();
        let body = await s.text();
        body =
          u.pathname === "/__local/practice"
            ? body.replace(
                "game = createCanopyGame",
                "game = window.__game = createCanopyGame",
              )
            : body.replace("function Q(", "window.__oldBurst=Q;function Q(");
        return r.fulfill({ response: s, body });
      }
      return r.continue();
    });
    await p.goto("http://127.0.0.1:4192/__local/practice?lab=1&revision=r15");
    await p.waitForFunction(
      () => window.__game?.scene.getScene("game")?.player,
    );
    await p.evaluate(async () => {
      const s = (window.s = __game.scene.getScene("game"));
      s.guideClose?.();
      if (s.paused) s.togglePause();
      __game.loop.sleep();
      s.tweens.killAll();
      s.children.list.forEach((o) => o.setVisible(false));
      window.fx =
        await import("/play/treeforce89/assets/impact-effects-r15.js");
      s.add.rectangle(240, 360, 480, 720, 0x081710).setDepth(0);
      const label = (x, y, t, n = 16) =>
        s.add
          .text(x, y, t, {
            fontFamily: "monospace",
            fontSize: n,
            color: "#dcecac",
            align: "center",
          })
          .setOrigin(0.5)
          .setDepth(82);
      label(240, 40, "TREE FORCE 89 / IMPACT EFFECTS", 20);
      label(125, 90, "BEFORE / LEAVES");
      label(355, 90, "AFTER / MATERIAL");
      label(240, 265, "LIGHT ENEMY / QUICK SHATTER");
      label(240, 440, "SPORE / SOFT PUFF");
      label(240, 615, "BORER / FALLING BARK");
      label(240, 675, "Actual game effects / no damage changes", 13);
      window.permanent = new Set(s.children.list);
      window.burst = () => {
        s.tweens.killAll();
        s.children.list
          .filter((o) => !permanent.has(o))
          .forEach((o) => o.destroy());
        for (const [kind, y] of [
          ["bat", 180],
          ["spore", 355],
          ["borer", 530],
        ]) {
          const original = Math.random;
          let seed = 123;
          const random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          try {
            Math.random = random;
            __oldBurst(s, 125, y, kind === "borer" ? 16 : 9);
            seed = 123;
            fx.enemyImpact(
              s,
              355,
              y,
              kind,
              (a, b) => Math.floor(random() * (b - a + 1)) + a,
            );
          } finally {
            Math.random = original;
          }
        }
        for (const t of s.tweens.getTweens()) {
          t.update(0);
          t.update(0);
        }
      };
    });
    for (let i = 0; i < 72; i++) {
      await p.evaluate((i) => {
        if (i % 18 === 0) burst();
        for (const t of s.tweens.getTweens()) t.update(1000 / 24);
        __game.renderer.preRender();
        __game.scene.render(__game.renderer);
        __game.renderer.postRender();
      }, i);
      await p
        .locator("#practice canvas")
        .screenshot({ path: `frames/${String(i).padStart(3, "0")}.png` });
    }
    const cleanup = await p.evaluate(() => {
      for (const t of s.tweens.getTweens())
        for (let i = 0; i < 30; i++) t.update(100);
      const after = s.children.list.filter((o) => !permanent.has(o)).length;
      burst();
      s.tweens.pauseAll();
      const particles = s.children.list.filter(
        (o) => o.impactProgress !== undefined,
      );
      const before = particles.map((p) => p.impactProgress);
      s.tweens.update(200, 200);
      const held = particles.every((p, i) => p.impactProgress === before[i]);
      s.tweens.resumeAll();
      for (const t of s.tweens.getTweens())
        for (let i = 0; i < 30; i++) t.update(100);
      return {
        after,
        pausedProgressHeld: held,
        afterResume: s.children.list.filter((o) => !permanent.has(o)).length,
      };
    });
    assert.equal(cleanup.after, 0);
    assert.equal(cleanup.pausedProgressHeld, true);
    assert.equal(cleanup.afterResume, 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "docs/impact-cleanup.json",
      JSON.stringify(
        { synthetic: true, frames: 72, fps: 24, cleanup, errors },
        null,
        2,
      ),
    );
    console.log(
      "Effect preview recorded; pause freezes progress, resume/completion clears all particles.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
