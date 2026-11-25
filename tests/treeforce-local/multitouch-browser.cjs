const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const origin = process.env.TREEFORCE_URL || "http://127.0.0.1:4187";
const revision = process.env.TREEFORCE_REVISION || "r13";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(["r13", "r15"].includes(revision));
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await b.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/*", async (r) => {
      const url = new URL(r.request().url());
      if (url.origin !== origin) return r.abort();
      if (url.pathname !== "/__local/practice") return r.continue();
      const s = await r.fetch();
      return r.fulfill({
        response: s,
        body: (await s.text()).replace(
          "game = createCanopyGame",
          "game = window.__game = createCanopyGame",
        ),
      });
    });
    await p.goto(`${origin}/__local/practice?lab=1&revision=${revision}`);
    await p.waitForFunction(
      () => window.__game?.scene.getScene("game")?.player,
    );
    await p.evaluate(() => {
      window.s = __game.scene.getScene("game");
      s.guideClose?.();
      if (s.paused) s.togglePause();
      s.invincible = true;
      s.autoFire = false;
    });
    await p.locator(".mobile-fire").scrollIntoViewIfNeeded();
    const canvas = await p.locator("#practice canvas").boundingBox(),
      fire = await p.locator(".mobile-fire").boundingBox();
    const c = await p.context().newCDPSession(p),
      a = {
        x: canvas.x + canvas.width / 2,
        y: canvas.y + canvas.height * 0.65,
        id: 1,
      },
      f = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 };
    const send = (type, touchPoints) =>
      c.send("Input.dispatchTouchEvent", { type, touchPoints });
    await send("touchStart", [a]);
    await send("touchStart", [a, f]);
    assert.equal(await p.evaluate(() => s.dragging && s.fireHeld), true);
    console.log(
      "both held",
      await p.evaluate(() => ({
        drag: s.dragging,
        fire: s.fireHeld,
        x: s.player.x,
      })),
    );
    await send("touchEnd", [f]);
    const result = await p.evaluate(() => ({
      drag: s.dragging,
      fire: s.fireHeld,
      x: s.player.x,
    }));
    console.log("fire released", result);
    await send("touchMove", [{ ...a, x: a.x + 20 }]);
    const after = await p.evaluate(() => ({ drag: s.dragging, x: s.player.x }));
    console.log("steering after release", after);
    assert.ok(after.x > result.x, "held steering must still move the hero");
    assert.equal(
      result.drag,
      true,
      "releasing Fire must preserve the other steering finger",
    );
    assert.equal(result.fire, false);
    await send("touchEnd", []);
    assert.equal(await p.evaluate(() => s.dragging), false);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "docs/multitouch-review.json",
      JSON.stringify(
        {
          synthetic: true,
          physicalPhone: false,
          fireRelease: result,
          steeringAfterRelease: after,
          allTouchesReleased: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
