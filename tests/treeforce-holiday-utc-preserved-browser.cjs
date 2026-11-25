const { chromium } = require(
  process.env.TREEFORCE_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  const [origin, report] = process.argv.slice(2);
  assert(
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
    origin === "https://tree-token.xyz" ||
      /^https:\/\/[a-f0-9]{24}--tree-token\.netlify\.app$/.test(origin),
  );
  const b = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  try {
    const p = await b.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [],
      failedAssets = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (
        r.url().startsWith(origin + "/play/treeforce89/") &&
        r.status() >= 400
      )
        failedAssets.push({ url: r.url(), status: r.status() });
    });
    await p.route("**/*", (r) =>
      ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.abort(),
    );
    await p.goto(origin + "/play/treeforce89/review/holiday/", {
      waitUntil: "networkidle",
    });
    assert.equal(await p.title(), "TREE FORCE '89 — Holiday Review");
    await p.getByRole("button", { name: "Connect Sui wallet" }).waitFor();
    const body = await p.locator("body").innerText();
    assert(body.includes("3 lives"));
    assert(body.includes("20,000 TREE"));
    assert.equal(await p.locator('script[src*="index-review-r17"]').count(), 1);
    assert.equal(
      await p.locator('meta[name="robots"]').getAttribute("content"),
      "noindex,nofollow",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(failedAssets, []);
    await p.screenshot({ path: report + ".png", fullPage: true });
    fs.writeFileSync(
      report,
      JSON.stringify(
        {
          origin,
          path: "/play/treeforce89/review/holiday/",
          width: 390,
          nftreeGate: true,
          threeLives: true,
          continuePriceUnchanged: true,
          r17Entry: true,
          noindex: true,
          errors,
          failedAssets,
          walletConnected: false,
          payment: false,
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
