import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  candidateRequest,
  validateRequired,
  main,
} from "../scripts/treeforce-local/host-preserved-preview.mjs";
const approved=JSON.parse(fs.readFileSync(new URL('../production/treeforce-pilot-r19/candidate.json',import.meta.url)));
const c={...approved.baseline,baseline:approved.baseline,files:approved.files,payload:Object.entries(approved.payload).map(([path,f])=>({path,...f})),publicationAuthorized:false,published:false};
test("candidate creation retains complete digest inventory and backend configuration", () => {
  const r = candidateRequest(c);
  assert.deepEqual(r.files, c.files);
  assert.equal(Object.keys(r.functions).length, 62);
  assert.deepEqual(r.function_schedules, c.schedules);
  assert.equal(r.branch, c.runtime.branch);
  assert.equal(r.draft, false);
  assert(!("published" in r));
  for (const f of c.functions) {
    assert.equal(r.functions[f.n], f.d);
    if (f.tr) assert.deepEqual(r.functions_config[f.n].traffic_rules, f.tr);
  }
});
test("publication-authorized or already-published plans are refused", () => {
  assert.throws(() => candidateRequest({ ...c, publicationAuthorized: true }));
  assert.throws(() => candidateRequest({ ...c, published: true }));
});
test("only reviewed static digests can be uploaded and backend uploads fail closed", () => {
  const d = {
    required: [c.payload[0].sha1],
    required_functions: [],
    required_edge_functions: [],
    required_server: [],
  };
  validateRequired(d, c);
  for (const key of [
    "required_functions",
    "required_edge_functions",
    "required_server",
  ])
    assert.throws(() => validateRequired({ ...d, [key]: ["x"] }, c));
  assert.throws(() =>
    validateRequired({ ...d, required: ["0".repeat(40)] }, c),
  );
  assert.throws(() =>
    validateRequired(
      { ...d, required: [c.payload[0].sha1, c.payload[0].sha1] },
      c,
    ),
  );
});
test("no production publishing mode is exposed", async () => {
  await assert.rejects(main(["publish", "extra"]));
  const source = fs.readFileSync(
    new URL(
      "../scripts/treeforce-local/host-preserved-preview.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  assert(!source.includes("'/restore'"));
  assert(!source.includes("'/unlock'"));
  assert(source.includes("assertPreserved(await captureCurrent"));
});
