// Package the reviewed game for private LAN testing; never a site release payload.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const source = path.resolve(
  process.argv[2] || "release/treeforce-integrated-review",
);
const output = path.resolve(process.argv[3] || "release/treeforce-device-kit");
if (source === output || output.startsWith(source + path.sep))
  throw new Error("Device kit must be separate from the reviewed build");
// Refuse an existing output so stale files cannot enter the portable archive.
await fs.mkdir(output);
const review = JSON.parse(
  await fs.readFile(path.join(source, "review.json"), "utf8"),
);
const entry = await fs.readFile(
  path.join(source, "play/treeforce89/index.html"),
  "utf8",
);
const revision = entry.match(/\/assets\/index-review-(r\d+)\.js/)?.[1];
if (!["r13", "r14", "r15"].includes(revision))
  throw Error("Unrecognized reviewed entry revision");
const hashes = {};
for (const [name, expected] of Object.entries(review.changed)) {
  const actual = createHash("sha256")
    .update(await fs.readFile(source + name))
    .digest("hex");
  if (actual !== expected) throw new Error(`Reviewed file changed: ${name}`);
  hashes[name] = actual;
}
const dexToken = await fs.readFile(
  new URL("./device-assets/dex-reward-token.jpeg", import.meta.url),
);
hashes["/play/treeforce89/assets/powerups/dex-reward-token.jpeg"] = createHash(
  "sha256",
)
  .update(dexToken)
  .digest("hex");
await fs.mkdir(path.join(output, "site/play/treeforce89"), { recursive: true });
await fs.mkdir(path.join(output, "server"));
await fs.cp(
  path.join(source, "play/treeforce89/assets"),
  path.join(output, "site/play/treeforce89/assets"),
  { recursive: true },
);
await fs.writeFile(
  path.join(
    output,
    "site/play/treeforce89/assets/powerups/dex-reward-token.jpeg",
  ),
  dexToken,
);
await fs.cp(path.join(source, "assets"), path.join(output, "site/assets"), {
  recursive: true,
});
await fs.cp(path.join(source, "scripts"), path.join(output, "site/scripts"), {
  recursive: true,
});
const badgeCss = await fs.readFile(
  new URL("../../play/treeforce89/retro-achievements.css", import.meta.url),
);
await fs.writeFile(
  path.join(output, "site/play/treeforce89/retro-achievements.css"),
  badgeCss,
);
hashes["/play/treeforce89/retro-achievements.css"] = createHash("sha256")
  .update(badgeCss)
  .digest("hex");
await fs.copyFile(
  path.join(source, "play/treeforce89/mobile-review-r5.css"),
  path.join(output, "site/play/treeforce89/mobile-review-r5.css"),
);
const server = await fs.readFile(
  new URL("./serve.mjs", import.meta.url),
  "utf8",
);
await fs.writeFile(
  path.join(output, "server/serve.mjs"),
  server.replace(":${port}/play/treeforce89/", ":${port}/"),
);
let practice = await fs.readFile(
  new URL("./practice.html", import.meta.url),
  "utf8",
);
practice = practice.replace(
  'href="/play/treeforce89/">Inspect the gated app',
  'href="/">Review checklist',
);
await fs.writeFile(path.join(output, "server/practice.html"), practice);
await fs.writeFile(
  path.join(output, "site/index.html"),
  (
    await fs.readFile(new URL("./device-review.html", import.meta.url), "utf8")
  ).replaceAll("r13", revision),
);
await fs.writeFile(
  path.join(output, "start.mjs"),
  `import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
const port = Number(process.argv[2] || 4187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port from 1024 to 65535');
process.argv[2] = fileURLToPath(new URL('./site', import.meta.url));
process.argv[3] = String(port);
console.log('Tree Force 89 ${revision} • private practice • no wallets, payments or saves');
console.log('Computer: http://127.0.0.1:' + port + '/');
for (const records of Object.values(networkInterfaces())) for (const a of records || [])
  if (a.family === 'IPv4' && !a.internal) console.log('Same-Wi-Fi phone: http://' + a.address + ':' + port + '/');
console.log('Use a trusted local network. Stop with Ctrl+C. Do not publish this kit.');
await import('./server/serve.mjs');
`,
);
await fs.writeFile(
  path.join(output, "README.txt"),
  `TREE FORCE 89 — PRIVATE PHONE REVIEW — ${revision}

1. Extract this entire folder on a computer with Node.js 22 or later.
2. Open a terminal in the extracted folder and run: node start.mjs
3. Connect your phone to the same Wi-Fi and open the printed phone URL.
   If several addresses appear, use your computer's Wi-Fi address.
   Allow local-network access if your computer firewall asks.
4. Open Play review and follow the checklist. Stop the server with Ctrl+C.

No npm install or wallet is needed. Do not open index.html as a file URL.
Optional alternate port: node start.mjs 4188
Guest Wi-Fi/client isolation or a VPN may prevent the phone reaching the computer.
Keep the computer awake while testing. This folder has no production backend.

Review sound, touch controls, Pause/Resume, tutorial, enemy motion and visibility.
Please report phone model, OS/browser, orientation, action, expected/actual behavior.
No test results are uploaded. Screenshots/recordings and notes can be shared in chat.

This unranked harness cannot validate Slush, NFTree login, real score saves,
paid checkout or native receipt sharing. Local HTTP also does not validate HTTPS-
only browser APIs. Those remain separate device checks on an authorized setup.
No pricing/access rules were changed. Do not publish this ungated practice kit,
deploy it to the production site, or use it to perform a real payment.
`,
);
await fs.writeFile(
  path.join(output, "review-manifest.json"),
  JSON.stringify(
    {
      revision,
      purpose: "Private LAN device review",
      productionRelease: false,
      sourceBaseline: review.source,
      reviewedHashes: hashes,
      backendIncluded: false,
      walletTestingSupported: false,
    },
    null,
    2,
  ),
);
console.log(`Device review kit prepared: ${output}`);
