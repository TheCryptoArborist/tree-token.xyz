import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  prepare,
  relink,
  pins,
} from "../../scripts/treeforce-local/prepare.mjs";

const baseline = "release/treeforce-baseline";
const candidate = "release/treeforce-candidate";

test("candidate keeps original assets and removes legacy entry edges from active modules", async () => {
  await prepare(baseline, candidate);
  const manifest = JSON.parse(
    await fs.readFile(`${baseline}/manifest.json`, "utf8"),
  );
  for (const record of Object.values(manifest.files)) {
    if (record.path.endsWith("/index.html")) continue;
    assert.deepEqual(
      await fs.readFile(candidate + record.path),
      await fs.readFile(baseline + record.path),
      record.path,
    );
  }
  for (const name of [
    "index-review-r5.js",
    "arcade-review-r5.js",
    "graphql-review-r5.js",
  ]) {
    const body = await fs.readFile(
      `${candidate}/play/treeforce89/assets/${name}`,
      "utf8",
    );
    assert.doesNotMatch(
      body,
      /\.\/(?:index-(?:mobile-r1|renewal-r3|share-r4)|arcade-renewal-r3|graphql-mobile-r1)\.js/,
    );
  }
  assert.equal(Object.keys(pins).length, 3);
});

test("relink leaves unrelated content intact and is idempotent", () => {
  const input =
    'import "./index-mobile-r1.js"; const label="index-mobile-r1.js"; const url="https://example.com/index-mobile-r1.js";';
  const expected =
    'import "./index-review-r5.js"; const label="index-mobile-r1.js"; const url="https://example.com/index-mobile-r1.js";';
  assert.equal(relink(input), expected);
  assert.equal(relink(expected), expected);
});
