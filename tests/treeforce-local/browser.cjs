const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const width = Number(process.env.TREEFORCE_WIDTH || 390);
const origin = process.env.TREEFORCE_URL || "http://127.0.0.1:4174";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw Error("Local synthetic checks only");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    isMobile: width < 620,
    hasTouch: width < 620,
  });
  page.setDefaultTimeout(10000);
  const errors = [],
    requests = [],
    checks = [];
  let sequence = 0,
    session,
    profile = { username: "ExistingPilot", badges: [] },
    failSave = false;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const now = Date.now;
    window.__offset = 0;
    Date.now = () => now() + window.__offset;
    window.__games = [];
    window.__mounts = [];
  });
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) {
      await route.abort();
      return;
    }
    if (
      url.pathname.includes("/api/") ||
      url.pathname.endsWith("/session-refresh")
    ) {
      const body = request.postDataJSON();
      requests.push({ path: url.pathname, method: request.method() });
      let data;
      const wallet = body?.wallet || session?.wallet,
        now = await page.evaluate(() => Date.now());
      if (url.pathname.endsWith("tree-challenge")) {
        const nonce = "c".repeat(64),
          expiresAt = now + 300000;
        data = {
          nonce,
          expiresAt,
          message: [
            "TREE FORCE '89 wallet login",
            "Origin: " + origin,
            "Network: sui:mainnet",
            "Wallet: " + wallet,
            "Nonce: " + nonce,
            "Expires: " + new Date(expiresAt).toISOString(),
            "This signature does not authorize a token transfer.",
          ].join("\n"),
        };
      } else if (url.pathname.endsWith("tree-session"))
        data = {
          sessionToken: (++sequence).toString(16).padStart(64, "0"),
          runId: "grove-" + sequence.toString(16).padStart(32, "0"),
          expiresAt: now + 3600000,
          wallet,
        };
      else if (url.pathname.endsWith("session-refresh"))
        data = {
          ...session,
          sessionToken: "f".repeat(64),
          expiresAt: now + 3600000,
        };
      else if (url.pathname.endsWith("tree-logout")) data = { loggedOut: true };
      else if (url.pathname.endsWith("tree-run"))
        data = {
          ...session,
          sessionToken: (++sequence).toString(16).padStart(64, "0"),
          runId: "grove-" + sequence.toString(16).padStart(32, "0"),
        };
      else if (url.pathname.endsWith("treeforce89-leaderboard")) {
        if (request.method() === "POST") {
          if (failSave) {
            failSave = false;
            await route.fulfill({
              status: 503,
              json: { error: "Simulated save failure" },
            });
            return;
          }
          profile = {
            username: body.username,
            badges: body.run ? ["first-blight"] : profile.badges,
          };
        }
        data = { entries: [], ...profile };
      } else {
        await route.fulfill({
          status: 403,
          json: { error: "No synthetic handler; payments disabled" },
        });
        return;
      }
      if (url.pathname.endsWith("tree-session") && !session) session = data;
      if (
        url.pathname.endsWith("session-refresh") ||
        url.pathname.endsWith("tree-run")
      )
        session = data;
      await route.fulfill({ json: data });
      return;
    }
    if (/\/assets\/index-.*\.js$/.test(url.pathname)) {
      const response = await route.fetch();
      let text = await response.text();
      if (text.includes("(0,b.createRoot)"))
        text = text.replace(
          "(0,b.createRoot)",
          `window.__mounts.push(${JSON.stringify(url.pathname)});window.__kit=vC;window.__wallets=Rc();(0,b.createRoot)`,
        );
      await route.fulfill({ response, body: text });
      return;
    }
    if (/\/assets\/arcade-.*\.js$/.test(url.pathname)) {
      const response = await route.fetch();
      let text = await response.text();
      text = text.replace(
        "installMobileTouchbar(game,e);return game",
        "installMobileTouchbar(game,e);window.__games.push(game);return game",
      );
      await route.fulfill({ response, body: text });
      return;
    }
    await route.continue();
  });
  await page.goto(origin + "/play/treeforce89/");
  await page.waitForFunction(() => window.__games.length && window.__kit);
  await page.waitForTimeout(600);
  checks.push({
    name: "initial application mounts",
    actual: await page.evaluate(() => __mounts.length),
  });
  await page.evaluate(() => {
    const account = {
      address: "0x" + "1".repeat(64),
      publicKey: new Uint8Array(32),
      chains: ["sui:mainnet"],
      features: [
        "sui:signPersonalMessage",
        "sui:signTransaction",
        "sui:signAndExecuteTransaction",
      ],
    };
    const listeners = [];
    window.__change = (accounts) => {
      wallet.accounts = accounts;
      [...listeners].forEach((f) => f({ accounts }));
    };
    window.__account = account;
    const wallet = {
      version: "1.0.0",
      name: "Local Test Wallet",
      icon: "data:image/svg+xml;base64,PHN2Zy8+",
      chains: ["sui:mainnet"],
      accounts: [account],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: wallet.accounts }),
        },
        "standard:events": {
          version: "1.0.0",
          on: (event, fn) => {
            listeners.push(fn);
            return () => listeners.splice(listeners.indexOf(fn), 1);
          },
        },
        "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
        "sui:signPersonalMessage": {
          version: "1.1.0",
          signPersonalMessage: async ({ message }) => ({
            bytes: btoa(String.fromCharCode(...message)),
            signature: "LOCAL_TEST_ONLY",
          }),
        },
        "sui:signTransaction": {
          version: "2.0.0",
          signTransaction: async () => {
            throw Error("Real payments prohibited in local fixture");
          },
        },
        "sui:signAndExecuteTransaction": {
          version: "2.0.0",
          signAndExecuteTransaction: async () => {
            throw Error("Real payments prohibited in local fixture");
          },
        },
      },
    };
    window.__wallets.register(wallet);
  });
  await page
    .getByRole("button", { name: "Connect Sui wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Local Test Wallet/ }).click();
  await page
    .getByRole("button", { name: "Verify NFTree & Play", exact: true })
    .click();
  await page.waitForSelector(".nftree-wallet-bar");
  await page.waitForFunction(
    () => __games.at(-1)?.scene?.getScene("game")?.player,
  );
  const gameState = () =>
    page.evaluate(() => {
      const s = __games.at(-1).scene.getScene("game");
      return {
        score: s.run.score,
        lives: s.lives,
        paused: s.paused,
        wave: s.run.wave,
        playerY: s.player.y,
        gameCount: __games.length,
      };
    });
  console.log("connected", await gameState());
  // Import the real lazy dependency while an authenticated run is mounted.
  const graph = origin.includes("4173")
    ? "graphql-mobile-r1.js"
    : `graphql-review-${process.env.TREEFORCE_REVISION || "r5"}.js`;
  await page.evaluate(async (name) => {
    await import("/play/treeforce89/assets/" + name);
  }, graph);
  await page.waitForTimeout(600);
  checks.push({
    name: "mounts after lazy GraphQL",
    actual: await page.evaluate(() => __mounts.length),
  });
  checks.push({
    name: "verified run survives lazy GraphQL",
    actual: await page.locator(".nftree-wallet-bar").count(),
  });
  if (origin.includes("4173")) {
    fs.writeFileSync(
      "docs/treeforce89-browser-baseline.json",
      JSON.stringify({ synthetic: true, origin, checks, errors }, null, 2),
    );
    console.log(JSON.stringify({ checks, errors }, null, 2));
    await browser.close();
    return;
  }
  assert.equal(await page.evaluate(() => __mounts.length), 1);
  assert.equal(await page.locator(".nftree-wallet-bar").count(), 1);
  console.log("after graph", await gameState());
  await page.screenshot({
    path: `docs/treeforce89-candidate-guide-${width}.png`,
    fullPage: true,
  });
  const before = await gameState();
  assert.equal(before.score, 0);
  assert.equal(before.lives, 3);
  checks.push({ name: "fresh run zero score and three lives", actual: true });
  await page.evaluate(() => {
    let s = __games.at(-1).scene.getScene("game");
    if (s.paused) s.togglePause();
    s.run.score = 1234;
    s.togglePause();
  });
  const paused = await gameState();
  assert.equal(paused.paused, true);
  await page.waitForTimeout(250);
  assert.equal((await gameState()).score, 1234);
  console.log("testing disconnect");
  await page.evaluate(() => __change([]));
  await page.getByText(/Wallet connection interrupted/).waitFor();
  await page.evaluate(() => __change([__account]));
  await page
    .getByRole("button", { name: "Connect Sui wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Local Test Wallet/ }).click();
  await page.waitForTimeout(200);
  assert.equal((await gameState()).gameCount, before.gameCount);
  assert.equal((await gameState()).score, 1234);
  checks.push({
    name: "temporary disconnect retains paused run",
    actual: true,
  });
  console.log("testing expiry");
  await page.evaluate(() => {
    __offset = 3700000;
    window.dispatchEvent(new Event("pageshow"));
  });
  await page.getByRole("button", { name: "Verify & resume run" }).waitFor();
  await page.getByRole("button", { name: "Verify & resume run" }).click();
  await page.waitForFunction(
    () => !document.querySelector(".session-reconnect"),
  );
  assert.equal((await gameState()).gameCount, before.gameCount);
  assert.equal((await gameState()).score, 1234);
  checks.push({
    name: "expiry and same-wallet recovery retain mounted run",
    actual: true,
  });
  // A result is synthetic; every save is intercepted locally.
  await page.evaluate(() => {
    const s = __games.at(-1).scene.getScene("game");
    s.run.kills = 5;
    s.endRun();
  });
  await page.waitForTimeout(200);
  console.log("testing save");
  await page.locator("#pilot-name").fill("LocalPilot");
  failSave = true;
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await page.getByText("Simulated save failure", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Share your run →" }).count(),
    0,
  );
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await page
    .getByText("Score and achievements saved to your wallet.", { exact: true })
    .waitFor();
  const link = page.getByRole("link", { name: "Share your run →" });
  await link.waitFor();
  const href = await link.getAttribute("href");
  assert.match(
    href,
    /^https:\/\/tree-token.xyz\/play\/\?shareGame=treeforce89&shareRun=[a-f0-9]{64}#daily$/,
  );
  checks.push({ name: "failed save retry and receipt handoff", actual: true });
  const ratio = await page
    .locator("canvas[aria-label]")
    .evaluate(
      (e) => e.getBoundingClientRect().width / e.getBoundingClientRect().height,
    );
  assert.ok(Math.abs(ratio - 1200 / 675) < 0.02);
  checks.push({
    name: "share card keeps landscape proportions",
    actual: ratio,
  });
  await page.screenshot({
    path: `docs/treeforce89-candidate-result-${width}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect Sui wallet", exact: true })
    .waitFor();
  assert.equal(await page.locator(".nftree-wallet-bar").count(), 0);
  checks.push({
    name: "explicit disconnect clears game identity",
    actual: true,
  });
  await page.evaluate(() =>
    __change([{ ...__account, address: "0x" + "2".repeat(64) }]),
  );
  session = null;
  profile = { username: "SecondPilot", badges: [] };
  await page
    .getByRole("button", { name: "Connect Sui wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Local Test Wallet/ }).click();
  await page
    .getByRole("button", { name: "Verify NFTree & Play", exact: true })
    .click();
  await page.waitForSelector(".nftree-wallet-bar");
  await page.waitForFunction(
    () => __games.at(-1)?.scene?.getScene("game")?.player,
  );
  assert.equal((await gameState()).score, 0);
  assert.equal((await gameState()).lives, 3);
  assert.equal(
    await page.getByRole("link", { name: "Share your run →" }).count(),
    0,
  );
  await page.waitForFunction(
    () => document.querySelector("#pilot-name")?.value === "SecondPilot",
  );
  checks.push({
    name: "second wallet starts separate run and profile",
    actual: true,
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `docs/treeforce89-browser-checks-${width}.json`,
    JSON.stringify(
      { synthetic: true, origin, checks, errors, requests },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
