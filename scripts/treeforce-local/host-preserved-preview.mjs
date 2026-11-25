// Create and verify an unpublished candidate only. No publish/restore/unlock endpoint exists here.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  SITE_ID,
  readToken,
  readOnlyApi,
  captureCurrent,
  assertPreserved,
  fingerprint,
  validateFunctions,
} from "./capture-production-inventory.mjs";
import { digest } from "./prepare-preserved-candidate.mjs";
import { assertServedContent } from "../stats-market-delivery.mjs";
export function configurations(b) {
  validateFunctions(b.functions);
  const overrides = new Set(
    (b.runtime.functions_region_overrides || []).map((x) => x.name),
  );
  const route = (r) =>
    Object.fromEntries(
      Object.entries({
        pattern: r.p,
        literal: r.l,
        expression: r.e,
        methods: r.m,
        prefer_static: r.ps,
      }).filter(([, v]) => v != null),
    );
  return Object.fromEntries(
    b.functions.map((f) => {
      const c = {};
      for (const [from, to] of Object.entries({
        dn: "display_name",
        g: "generator",
        bd: "build_data",
        p: "priority",
        tr: "traffic_rules",
        vcpu: "vcpu",
        es: "event_subscriptions",
      }))
        if (f[from] != null) c[to] = f[from];
      if (f.vcpu == null && Object.hasOwn(f, "mo")) c.memory = f.mo;
      if (overrides.has(f.n)) c.region = f.rgo ?? f.rg;
      if (f.ro) c.routes = f.ro.map(route);
      if (f.er) c.excluded_routes = f.er.map(route);
      return [f.n, c];
    }),
  );
}
export function validateRequired(d, c) {
  for (const k of [
    "required",
    "required_functions",
    "required_edge_functions",
    "required_server",
  ])
    assert(Array.isArray(d[k]), "Missing upload requirements " + k);
  for (const k of [
    "required_functions",
    "required_edge_functions",
    "required_server",
  ])
    assert.equal(d[k].length, 0, "Backend uploads forbidden");
  assert.equal(new Set(d.required).size, d.required.length);
  for (const h of d.required)
    assert(
      c.payload.some((f) => f.sha1 === h),
      "Unapproved upload requested",
    );
}
export function candidateRequest(c) {
  assert.equal(c.publicationAuthorized, false);
  assert.equal(c.published, false);
  // Production context is necessary for existing production-scoped authentication.
  // The required existing production lock prevents automatic publication; no promotion follows.
  return {
    files: c.files,
    functions: Object.fromEntries(c.functions.map((f) => [f.n, f.d])),
    functions_config: configurations(c.baseline),
    function_schedules: c.schedules,
    draft: false,
    async: false,
    branch: c.runtime.branch,
  };
}
export async function main(args = process.argv.slice(2)) {
  assert.equal(args.length, 1, "Usage: candidate-directory");
  const root = path.resolve(args[0]),
    c = JSON.parse(await fs.readFile(root + "/candidate.json", "utf8"));
  assert.equal(
    fingerprint(c),
    (await fs.readFile(root + "/candidate.json.sha256", "utf8")).trim(),
  );
  assert.equal(fingerprint(c.baseline), c.baselineSha256);
  assert.equal(c.counts.replacedFiles, 1);
  assert.equal(c.counts.addedFiles, 43);
  const token = readToken(),
    get = readOnlyApi(token);
  for (const f of c.payload)
    assert.equal(
      digest(await fs.readFile(root + "/payload" + f.path)),
      f.sha256,
    );
  await fs.access(root + "/hosted.json").then(
    () => {
      throw Error("Candidate already created; do not repeat");
    },
    () => {},
  );
  assertPreserved(await captureCurrent(get, c.baselineDeployId), c.baseline);
  let candidateId;
  async function write(endpoint, method, body, type = "application/json") {
    assert(
      method === "POST"
        ? endpoint ===
            `sites/${SITE_ID}/deploys?title=TreeForce89-r15-unpublished-review`
        : method === "PUT" &&
            candidateId &&
            c.payload.some(
              (f) => endpoint === `deploys/${candidateId}/files${f.path}`,
            ),
      "Forbidden mutation",
    );
    const r = await fetch("https://api.netlify.com/api/v1/" + endpoint, {
      method,
      redirect: "error",
      headers: { Authorization: "Bearer " + token, "Content-Type": type },
      body: type === "application/json" ? JSON.stringify(body) : body,
      signal: AbortSignal.timeout(60000),
    });
    assert(r.ok, "Netlify preview request failed HTTP " + r.status);
    return r.json();
  }
  const began = Date.now();
  let d = await write(
    `sites/${SITE_ID}/deploys?title=TreeForce89-r15-unpublished-review`,
    "POST",
    candidateRequest(c),
  );
  assert(
    /^[a-f0-9]{24}$/.test(d.id) &&
      d.id !== c.baselineDeployId &&
      d.site_id === SITE_ID,
  );
  candidateId = d.id;
  await fs.writeFile(
    root + "/hosted.json",
    JSON.stringify(
      {
        id: d.id,
        baseline: c.baselineDeployId,
        candidateSha256: fingerprint(c),
        verified: false,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  assert(Date.parse(d.created_at) >= began - 10000);
  assert(!d.published_at, "Candidate must remain unpublished");
  validateRequired(d, c);
  assertPreserved(await captureCurrent(get, c.baselineDeployId), c.baseline);
  for (const h of d.required) {
    const f = c.payload.find((x) => x.sha1 === h),
      bytes = await fs.readFile(root + "/payload" + f.path);
    assert.equal(digest(bytes, "sha1"), h);
    await write(
      `deploys/${candidateId}/files${f.path}`,
      "PUT",
      bytes,
      "application/octet-stream",
    );
  }
  for (let i = 0; i < 180; i++) {
    d = await get("deploys/" + candidateId);
    if (d.state === "ready") break;
    assert(
      !["error", "rejected", "canceled"].includes(d.state),
      "Candidate failed",
    );
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(d.state, "ready");
  assert(!d.published_at);
  assert.equal(d.site_id, SITE_ID);
  const sort = (a) => [...a].sort((a, b) => a.n.localeCompare(b.n));
  assert.deepEqual(
    sort(d.available_functions),
    sort(c.functions),
    "Complete backend records differ",
  );
  assert.deepEqual(d.function_schedules, c.schedules);
  for (const [k, v] of Object.entries(c.runtime))
    assert.deepEqual(d[k], v, "Runtime mismatch: " + k);
  const files = {};
  for (let page = 1; page <= 100; page++) {
    const batch = await get(
      `deploys/${candidateId}/files?per_page=100&page=${page}`,
    );
    assert(Array.isArray(batch));
    for (const f of batch) {
      assert(!Object.hasOwn(files, f.path));
      files[f.path] = f.sha;
    }
    if (batch.length < 100) break;
    assert(page < 100);
  }
  assert.deepEqual(files, c.files, "Hosted inventory differs");
  const origin = `https://${candidateId}--tree-token.netlify.app`;
  for (const f of c.payload) {
    const r = await fetch(origin + f.path, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(r.status, 200, f.path);
    const bytes = Buffer.from(await r.arrayBuffer()),
      expected = await fs.readFile(root + "/payload" + f.path);
    assertServedContent(
      f.path.endsWith("/index.html") ? "index.html" : f.path,
      bytes,
      expected,
    );
  }
  assertPreserved(await captureCurrent(get, c.baselineDeployId), c.baseline);
  const report = {
    id: candidateId,
    url: origin + "/play/treeforce89/",
    baseline: c.baselineDeployId,
    candidateSha256: fingerprint(c),
    verified: true,
    unpublished: true,
    productionChanged: false,
    counts: c.counts,
    completeBackendMatch: true,
    completeInventoryMatch: true,
    protectedConfigurationMatch: true,
    payloadDeliveryMatch: true,
    verifiedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    root + "/hosted.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
