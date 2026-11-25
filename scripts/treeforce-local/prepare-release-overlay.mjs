// Local, nondeployable overlay only. Never builds or contacts the production site.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const [sourceArg, baselineArg, outputArg] = process.argv.slice(2);
assert(
  sourceArg && baselineArg && outputArg,
  "Usage: source fresh-capture output",
);
const [source, baseline, output] = [sourceArg, baselineArg, outputArg].map(
  (x) => path.resolve(x),
);
assert(!output.startsWith(source + path.sep) && output !== source);
assert(!output.startsWith(baseline + path.sep) && output !== baseline);
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const review = await read(source + "/review.json");
const fresh = await read(baseline + "/manifest.json");
assert.deepEqual(
  Object.keys(fresh.files).sort(),
  Object.keys(review.source.files).sort(),
  "Live game closure drift",
);
for (const [key, record] of Object.entries(fresh.files)) {
  assert.equal(record.path, review.source.files[key].path);
  assert.equal(
    record.sha256,
    review.source.files[key].sha256,
    "Live asset drift: " + key,
  );
  assert.equal(sha(await fs.readFile(baseline + record.path)), record.sha256);
}
const htmlPath = "/play/treeforce89/index.html";
const currentHtml = await fs.readFile(baseline + htmlPath, "utf8");
const candidateHtml = await fs.readFile(source + htmlPath, "utf8");
assert.equal(
  candidateHtml,
  currentHtml
    .replace("/assets/index-share-r4.js", "/assets/index-review-r15.js")
    .replace("/mobile-r1.css", "/mobile-review-r5.css"),
  "Unexpected entry changes",
);
const files = [];
for (const [name, expected] of Object.entries({
  ...review.changed,
  [htmlPath]: sha(candidateHtml),
})) {
  assert(
    name.startsWith("/play/treeforce89/") && !name.split("/").includes(".."),
    "Non-game path",
  );
  const bytes = await fs.readFile(source + name);
  assert.equal(sha(bytes), expected, "Reviewed asset drift: " + name);
  files.push({ path: name, sha256: expected, bytes: bytes.length });
}
await fs.mkdir(output); // Refuse stale or mixed output.
for (const file of files) {
  await fs.mkdir(path.dirname(output + "/overlay" + file.path), {
    recursive: true,
  });
  await fs.copyFile(source + file.path, output + "/overlay" + file.path);
}
const plan = {
  revision: "r15",
  productionRelease: false,
  completeSiteInventory: false,
  capturedAt: fresh.capturedAt,
  sourceBaseline: review.source.capturedAt,
  verifiedLiveGameFiles: Object.keys(fresh.files).length,
  files,
  backendChanges: 0,
  schedulesChanged: 0,
  requiredBeforeRelease: [
    "Fresh complete static inventory and protected configuration capture",
    "Preserve every current backend/provider record and schedule",
    "Check overlay path collisions against that inventory",
    "Recheck current production ID and multichain branch",
    "Owner phone review and separate production authorization",
  ],
};
await fs.writeFile(
  output + "/overlay-plan.json",
  JSON.stringify(plan, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    output,
    files: files.length,
    verifiedLiveGameFiles: plan.verifiedLiveGameFiles,
    productionRelease: false,
  }),
);
