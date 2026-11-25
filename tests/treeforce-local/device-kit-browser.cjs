const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const origin = "http://127.0.0.1:4188";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const errors = [],
        failed = [],
        external = [],
        blockedReads = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (
          r.status() === 401 &&
          new URL(r.url()).pathname.startsWith("/api/")
        ) {
          blockedReads.push(new URL(r.url()).pathname);
          return;
        }
        if (r.status() >= 400) failed.push([r.status(), r.url()]);
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {
          external.push(url.origin);
          return route.abort();
        }
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
      await page.goto(origin);
      assert.equal(
        await page.getByRole("heading", { name: /Phone review/ }).count(),
        1,
      );
      await page.getByRole("link", { name: "Play review" }).click();
      await page.waitForFunction(() => window.__game?.scene.isActive("title"));
      await page
        .locator("#practice canvas")
        .click({ position: { x: width * 0.46, y: width * 0.77 } });
      await page.waitForFunction(() => __game.scene.getScene("game")?.player);
      await page.evaluate(() => {
        const s = __game.scene.getScene("game");
        if (s.guideClose) s.guideClose();
        if (s.paused) s.togglePause();
        s.invincible = true;
      });
      for (const viewport of [
        { width: 844, height: width },
        { width, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await page.waitForFunction(
          () =>
            __game.scale.width > 0 &&
            __game.scene.getScene("game")?.player.active,
        );
      }
      const auto = page.locator(".mobile-auto");
      const before = await page.evaluate(
        () => __game.scene.getScene("game").autoFire,
      );
      await auto.tap();
      assert.equal(
        await page.evaluate(() => __game.scene.getScene("game").autoFire),
        !before,
      );
      await page.screenshot({
        path: `docs/treeforce89-device-kit-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
      assert.deepEqual(external, []);
      results.push({
        width,
        titleToPlay: true,
        rotationRoundTrip: true,
        autoFireSingleToggle: true,
        errors,
        failed,
        external,
        blockedReads,
      });
      await page.close();
    }
    assert.equal(
      (
        await fetch(origin + "/play/treeforce89/api/tree-session", {
          method: "POST",
        })
      ).status,
      405,
    );
    assert.equal(
      (await fetch(origin + "/play/treeforce89/api/tree-session")).status,
      401,
    );
    assert.equal((await fetch(origin + "/play/treeforce89/")).status, 404);
    fs.writeFileSync(
      "docs/treeforce89-device-kit-checks.json",
      JSON.stringify(
        {
          synthetic: true,
          engine: "Chromium",
          physicalPhone: false,
          writeRequestsBlocked: true,
          noAuthenticatedAppIncluded: true,
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      "Portable kit: title-to-play, rotation round trip, controls and local-only requests passed at 320/390/430px.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
