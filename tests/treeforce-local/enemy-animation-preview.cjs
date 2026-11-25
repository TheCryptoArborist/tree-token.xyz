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
    const p = await b.newPage({ viewport: { width: 640, height: 900 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.origin !== "http://127.0.0.1:4191") return r.abort();
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
    await p.goto("http://127.0.0.1:4191/__local/practice?lab=1&revision=r14");
    await p.waitForFunction(
      () => window.__game?.scene.getScene("game")?.player,
    );
    const report = await p.evaluate(async () => {
      const s = (window.__s = __game.scene.getScene("game"));
      __game.loop.sleep();
      s.tweens.killAll();
      s.children.list.forEach((o) => o.setVisible(false));
      window.old =
        await import("/play/treeforce89/assets/combat-visuals-r11.js");
      window.next =
        await import("/play/treeforce89/assets/enemy-animation-r14.js");
      s.add.rectangle(240, 360, 480, 720, 0x081710).setDepth(80);
      const label = (x, y, text, size = 16) =>
        s.add
          .text(x, y, text, {
            fontFamily: "monospace",
            fontSize: size,
            color: "#dcecac",
            align: "center",
          })
          .setOrigin(0.5)
          .setDepth(82);
      label(240, 44, "TREE FORCE 89 / WING MOTION", 21);
      label(125, 105, "BEFORE / 2 POSES");
      label(355, 105, "AFTER / 6 POSES");
      label(240, 300, "BAT");
      label(240, 535, "MUTATED WASP");
      label(240, 620, "Actual game textures at 4x scale", 14);
      label(240, 650, "Same wingbeat speed and flight heading", 13);
      label(240, 680, "Preview only / no gameplay rule changes", 12);
      window.actors = [];
      for (const [kind, y] of [
        ["bat", 205],
        ["wasp", 435],
      ])
        for (const x of [125, 355]) {
          const a = s.add.image(x, y, kind).setScale(4).setDepth(81);
          a.phase = 0;
          a.diving = true;
          actors.push(a);
        }
      const textures = {};
      for (const kind of ["bat", "wasp"]) {
        const frames = [];
        for (let i = 0; i < 6; i++) {
          const source = s.textures.get(`${kind}-wing-${i}-0`).getSourceImage();
          frames.push(source.toDataURL());
          if (
            source.width !== (kind === "bat" ? 30 : 32) ||
            source.height !== (kind === "bat" ? 22 : 28)
          )
            throw Error("Texture size drift");
        }
        textures[kind] = new Set(frames).size;
      }
      const before = s.textures.getTextureKeys().length;
      next.setupCombatLook(s, { setAlpha() {} });
      const after = s.textures.getTextureKeys().length;
      return {
        uniqueNeutralPoses: textures,
        cacheCountBefore: before,
        cacheCountAfter: after,
      };
    });
    assert.deepEqual(report.uniqueNeutralPoses, { bat: 6, wasp: 6 });
    assert.equal(report.cacheCountBefore, report.cacheCountAfter);
    for (let i = 0; i < 72; i++) {
      await p.evaluate(
        (t) => {
          const curve = {
              getTangent: (q) => ({ x: Math.sin(q * Math.PI * 2) * 2, y: 1 }),
            },
            progress = (t % 3000) / 3000;
          actors.forEach((a, n) => {
            const helper = n % 2 ? next : old;
            helper.faceFlightPath(a, curve, progress);
            helper.animateEnemy(a, t);
          });
          __game.renderer.preRender();
          __game.scene.render(__game.renderer);
          __game.renderer.postRender();
        },
        (i * 1000) / 24,
      );
      await p
        .locator("#practice canvas")
        .screenshot({ path: `frames/${String(i).padStart(3, "0")}.png` });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "animation-preview.json",
      JSON.stringify(
        { ...report, frames: 72, fps: 24, errors, synthetic: true },
        null,
        2,
      ),
    );
    console.log(
      "Six unique poses per species; cache reuse and comparison capture passed.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
