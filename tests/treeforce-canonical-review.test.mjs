import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assembleReview,
  REVIEW,
  main,
} from "../scripts/treeforce-local/canonical-review.mjs";
import { digest } from "../scripts/treeforce-local/prepare-preserved-candidate.mjs";
const read = (p) =>
  JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url)));
const baseline = read("docs/treeforce89-hosted-preview-20261124/baseline.json");
const original = read(
  "docs/treeforce89-hosted-preview-20261124/candidate.json",
);
function fixture() {
  const c = structuredClone(original),
    html = Buffer.from("<title>TREE FORCE '89: Canopy Command</title>");
  c.payload.find((x) => x.path === "/play/treeforce89/index.html").sha256 =
    digest(html);
  return { c, html, b: structuredClone(baseline) };
}
test("review adds exactly 44 paths and changes zero existing hashes", () => {
  const { b, c, html } = fixture(),
    p = assembleReview(b, c, html);
  assert.equal(p.payload.length, 44);
  for (const [k, v] of Object.entries(b.files)) assert.equal(p.files[k], v);
  assert(p.files[REVIEW]);
  assert(p.entry.toString().includes("noindex,nofollow"));
});
test("existing review or asset paths including case variants stop assembly", () => {
  for (const name of [
    REVIEW,
    original.payload.find((x) => x.action === "add").path.toUpperCase(),
  ]) {
    const { b, c, html } = fixture();
    b.files[name] = "a".repeat(40);
    assert.throws(() => assembleReview(b, c, html), /already exists/);
  }
});
test("unreviewed entry and unexpected asset scope fail closed", () => {
  const { b, c, html } = fixture();
  assert.throws(() => assembleReview(b, c, Buffer.from("changed")));
  c.payload.find((x) => x.action === "add").path = "/unexpected";
  assert.throws(() => assembleReview(b, c, html));
});
test("only explicitly requested review publication is accepted", async () => {
  await assert.rejects(main(["publish", "a".repeat(24), "/tmp/not-created"]));
});
