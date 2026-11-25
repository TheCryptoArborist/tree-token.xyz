// Run combined-build checks without overwriting earlier per-task evidence.
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const output = path.resolve(
  process.argv[2] || "/workspace/treeforce-integrated-r13",
);
fs.mkdirSync(path.join(output, "docs"), { recursive: true });
const env = {
  ...process.env,
  TREEFORCE_URL: process.env.TREEFORCE_URL || "http://127.0.0.1:4187",
  TREEFORCE_REVISION: process.env.TREEFORCE_REVISION || "r13",
  TREEFORCE_VISUAL_REPORT: path.join(output, "docs/enemy-feedback.json"),
  TREEFORCE_AUDIO_REPORT: path.join(output, "docs/combat-audio.json"),
};
const jobs = [
  [
    "unit",
    [
      "--test",
      ...[
        "combat-audio.test.mjs",
        "sound-identity.test.mjs",
        "combat-visuals.test.mjs",
        "enemy-animation.test.mjs",
        "impact-effects.test.mjs",
      ].map((n) => path.join(__dirname, n)),
    ],
  ],
  [
    "identity-mixer",
    ["--test", path.join(__dirname, "combat-audio.test.mjs")],
    { TREEFORCE_SOUND_IDENTITY: "1" },
  ],
  ...[
    "audio-lifecycle-browser.cjs",
    "combat-audio-browser.cjs",
    "enemy-feedback-browser.cjs",
    "boss-clearance-browser.cjs",
    "combat-visuals-browser.cjs",
    "round-presentation-browser.cjs",
    "controls-continue-browser.cjs",
    "multitouch-browser.cjs",
  ].map((n) => [n, [path.join(__dirname, n)]]),
  ...[320, 390, 1280].map((width) => [
    "wallet-" + width,
    [path.join(__dirname, "browser.cjs")],
    { TREEFORCE_WIDTH: String(width) },
  ]),
];
const results = [];
for (const [name, args, extra] of jobs) {
  const start = Date.now();
  const r = spawnSync(process.execPath, args, {
    cwd: output,
    env: { ...env, ...extra },
    encoding: "utf8",
    timeout: 180000,
  });
  fs.writeFileSync(
    path.join(output, name + ".log"),
    (r.stdout || "") + (r.stderr || ""),
  );
  const result = {
    name,
    exitCode: r.status,
    error: r.error?.message,
    seconds: (Date.now() - start) / 1000,
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
fs.writeFileSync(
  path.join(output, "suite-results.json"),
  JSON.stringify(results, null, 2),
);
if (results.some((r) => r.exitCode !== 0)) process.exit(1);
