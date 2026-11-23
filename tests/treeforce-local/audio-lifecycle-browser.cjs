const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const revision = process.env.TREEFORCE_REVISION || "r8";
assert.ok(["r8", "r10", "r12", "r13"].includes(revision));
const origin =
  process.env.TREEFORCE_URL ||
  (revision === "r13"
    ? "http://127.0.0.1:4187"
    : revision === "r12"
      ? "http://127.0.0.1:4186"
      : revision !== "r8"
        ? "http://127.0.0.1:4184"
        : "http://127.0.0.1:4182");
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [],
      checks = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__oscCount = 0;
      const create = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...args) {
        window.__oscCount++;
        return create.apply(this, args);
      };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest, ...args) {
        const result = connect.call(this, dest, ...args);
        if (dest instanceof AudioDestinationNode) {
          const c = this.context;
          c.__meter ??= c.createAnalyser();
          connect.call(this, c.__meter);
        }
        return result;
      };
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (
        url.pathname === "/__local/practice" ||
        url.pathname.endsWith(`/arcade-review-${revision}.js`)
      ) {
        const response = await route.fetch();
        let body = await response.text();
        if (url.pathname === "/__local/practice")
          body = body.replace(
            "game = createCanopyGame",
            "window.__create=createCanopyGame;game = window.__game = createCanopyGame",
          );
        else
          body = body.replace(
            "function W(e){",
            `window.__audit={lifecycle:audioLifecycle,mixer:U,audio:K,start:J,cue:W${revision !== "r8" ? ",score:canopyScore" : ""}};function W(e){`,
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
    await page.evaluate(() => {
      window.s = __game.scene.getScene("game");
      s.invincible = true;
      s.autoFire = false;
      if (s.guideClose) s.guideClose();
      if (s.paused) s.togglePause();
      __audit.start();
    });
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    checks.push("music starts after user gesture");
    if (revision !== "r8") {
      await page.evaluate(() => s.startChallenge(2));
      await page.waitForFunction(() => __audit.score.mood === "bonus");
      await page.evaluate(() => s.startWave(3));
      await page.waitForFunction(() => __audit.score.mood === "normal");
      await page.evaluate(() => s.startWindfall(9));
      await page.waitForFunction(() => __audit.score.mood === "bonus");
      await page.evaluate(() => s.finishWindfall());
      await page.waitForFunction(() => __audit.score.mood === "boss");
      await page.evaluate(() => (s.waveClearing = true));
      await page.waitForFunction(() => __audit.score.mood === "normal");
      await page.evaluate(() => s.startWave(0));
      checks.push(
        "actual challenge, windfall, normal, boss and clear states select correct score",
      );
    }

    await page.evaluate(() => {
      __audit.mixer.sfxVolume = 0;
      __audit.mixer.musicVolume = 0;
    });
    await page.waitForTimeout(400);
    const zero = await page.evaluate(async () => {
      const n = __oscCount,
        c = __audit.audio();
      await new Promise((r) => setTimeout(r, 350));
      const data = new Float32Array(c.__meter.fftSize);
      c.__meter.getFloatTimeDomainData(data);
      return {
        newOsc: __oscCount - n,
        peak: Math.max(...data.map(Math.abs)),
        voices: __audit.lifecycle.voices.size,
        timer: __audit.lifecycle.timer !== undefined,
      };
    });
    assert.deepEqual(zero, { newOsc: 0, peak: 0, voices: 0, timer: false });
    checks.push(
      "music zero produces exact zero samples and no new oscillators",
    );
    await page.evaluate(() => {
      __audit.mixer.sfxVolume = 0.7;
      __audit.cue("upgrade");
    });
    assert.ok(await page.evaluate(() => __audit.mixer.voices.length > 0));
    checks.push("music zero leaves SFX available");
    await page.evaluate(() => {
      __audit.mixer.musicVolume = 0.55;
    });
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    checks.push("raising music volume restarts one scheduler");
    await page.evaluate(() => s.togglePause());
    await page.waitForFunction(
      () =>
        __audit.lifecycle.timer === undefined &&
        __audit.lifecycle.voices.size === 0 &&
        __audit.mixer.voices.length === 0,
    );
    const before = await page.evaluate(() => __oscCount);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => __oscCount), before);
    checks.push("Pause stops notes and music timer");
    await page.evaluate(() => s.togglePause());
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    checks.push("Resume restores music");
    await page.evaluate(() => {
      window.__run = s.run;
      window.dispatchEvent(new Event("blur"));
    });
    assert.equal(
      await page.evaluate(
        () => s.paused && __audit.lifecycle.timer === undefined,
      ),
      true,
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(
        () =>
          s.paused && s.run === __run && __audit.lifecycle.timer === undefined,
      ),
      true,
    );
    checks.push("wallet-style blur/focus retains paused run and silent audio");
    await page.evaluate(() => s.togglePause());
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(
      await page.evaluate(
        () => s.paused && __audit.lifecycle.timer === undefined,
      ),
      true,
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(
      await page.evaluate(
        () => s.paused && __audit.lifecycle.timer === undefined,
      ),
      true,
    );
    checks.push("hidden/visible return waits for Resume");
    await page.evaluate(() => {
      s.togglePause();
    });
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    await page.evaluate(() => s.toggleSfx());
    assert.equal(
      await page.evaluate(() => __audit.lifecycle.timer === undefined),
      true,
    );
    await page.evaluate(() => s.toggleSfx());
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    checks.push("master sound toggle stops and restores soundtrack");
    await page.evaluate(async () => {
      window.__oldContext = __audit.audio();
      await __oldContext.suspend();
    });
    await page
      .locator("#practice canvas")
      .click({ position: { x: 180, y: 300 } });
    await page.waitForFunction(() => __oldContext.state === "running");
    checks.push("user interaction recovers suspended AudioContext");
    await page.evaluate(() => {
      window.__oldGame = __game;
      __game.destroy(true);
    });
    await page.waitForFunction(() => __oldContext.state === "closed");
    const destroyed = await page.evaluate(() => ({
      owner: __audit.lifecycle.owner,
      timer: __audit.lifecycle.timer !== undefined,
      voices: __audit.lifecycle.voices.size,
      sfx: __audit.mixer.voices.length,
    }));
    assert.deepEqual(destroyed, {
      owner: null,
      timer: false,
      voices: 0,
      sfx: 0,
    });
    const count = await page.evaluate(() => __oscCount);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => __oscCount), count);
    checks.push("destroy closes context and clears all voices and scheduler");
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      __game = __create(document.getElementById("practice"), {
        initialScene: "title",
      });
    });
    await page.waitForFunction(() => __game.scene.isActive("title"));
    await page
      .locator("#practice canvas")
      .click({ position: { x: 180, y: 300 } });
    await page.waitForFunction(
      () =>
        __game.scene.isActive("game") && __game.scene.getScene("game").player,
    );
    await page.evaluate(() => {
      s = __game.scene.getScene("game");
      s.invincible = true;
      s.autoFire = false;
      if (s.guideClose) s.guideClose();
      if (s.paused) s.togglePause();
      __audit.start();
      __oldGame.events.emit("destroy");
    });
    await page.waitForFunction(() => __audit.lifecycle.timer !== undefined);
    assert.equal(
      await page.evaluate(
        () =>
          __audit.audio() !== __oldContext &&
          __audit.lifecycle.owner === __game,
      ),
      true,
    );
    checks.push(
      "recreated game owns fresh context; stale destruction cannot silence it",
    );
    assert.deepEqual(errors, []);
    const report = { synthetic: true, checks, zero, destroyed, errors };
    fs.writeFileSync(
      revision !== "r8"
        ? "docs/treeforce89-sound-identity-browser.json"
        : "docs/treeforce89-audio-lifecycle-checks.json",
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
