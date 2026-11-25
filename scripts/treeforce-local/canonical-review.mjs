// Additive canonical review publication only; never replaces the live game entry.
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
} from "./capture-production-inventory.mjs";
import { digest, storedEntry } from "./prepare-preserved-candidate.mjs";
import { configurations, validateRequired } from "./host-preserved-preview.mjs";
import { assertServedContent } from "../stats-market-delivery.mjs";
import { waitForAllBuilds } from "../release-arcade-cutoff.mjs";
export const REVIEW = "/play/treeforce89/review/index.html";
const LIVE = "/play/treeforce89/index.html",
  SOURCE = "6b0644f389c93c42eac2606d";
export function assembleReview(b, approved, html) {
  assert.equal(approved.revision, "r15");
  assert.equal(approved.payload.length, 44);
  const previous = approved.payload.find((f) => f.path === LIVE);
  assert.equal(digest(html), previous.sha256);
  const entry = Buffer.from(
    html
      .toString()
      .replace(
        "<title>TREE FORCE '89: Canopy Command</title>",
        '<title>TREE FORCE \'89 — Review</title><meta name="robots" content="noindex,nofollow" />',
      ),
  );
  assert.notDeepEqual(entry, html);
  const payload = approved.payload
    .filter((f) => f.path !== LIVE)
    .map((f) => ({ ...f, action: "add" }));
  assert(
    payload.every(
      (f) =>
        f.path.startsWith("/play/treeforce89/assets/") ||
        f.path === "/play/treeforce89/mobile-review-r5.css",
    ),
  );
  payload.push({
    path: REVIEW,
    sha1: digest(entry, "sha1"),
    sha256: digest(entry),
    bytes: entry.length,
    action: "add",
  });
  const files = { ...b.files };
  for (const f of payload) {
    assert(
      !Object.keys(b.files).some(
        (p) => p.toLowerCase() === f.path.toLowerCase(),
      ),
      "Review path already exists",
    );
    files[f.path] = f.sha1;
  }
  assert.equal(files[LIVE], b.files[LIVE]);
  return { entry, payload, files };
}
export async function main(args = process.argv.slice(2)) {
  assert.equal(
    args.length,
    3,
    "Usage: publish-review expected-current-deploy fresh-output-dir",
  );
  assert.equal(args[0], "publish-review");
  const expected = args[1],
    out = path.resolve(args[2]);
  assert(/^[a-f0-9]{24}$/.test(expected));
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.mkdir(out);
  const token = readToken(),
    get = readOnlyApi(token);
  const baseline = await captureCurrent(get, expected);
  const approved = JSON.parse(
    await fs.readFile(
      "docs/treeforce89-hosted-preview-20261124/candidate.json",
      "utf8",
    ),
  );
  assert.equal(
    fingerprint(approved),
    (
      await fs.readFile(
        "docs/treeforce89-hosted-preview-20261124/candidate.json.sha256",
        "utf8",
      )
    ).trim(),
  );
  const sourceOrigin = `https://${SOURCE}--tree-token.netlify.app`;
  const readPublic = async (url) => {
    const r = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(r.status, 200, url);
    return Buffer.from(await r.arrayBuffer());
  };
  const original = storedEntry(
    await readPublic(sourceOrigin + LIVE),
    approved.files[LIVE],
  );
  const { entry, payload, files } = assembleReview(
    baseline,
    approved,
    original,
  );
  const plan = {
    baseline,
    payload,
    files,
    sourceCandidate: SOURCE,
    reviewPath: REVIEW,
    sourceCommit: process.env.GITHUB_SHA || null,
  };
  await fs.writeFile(out + "/plan.json", JSON.stringify(plan, null, 2));
  let id,
    readyToPublish = false;
  const api = async (
    endpoint,
    method = "GET",
    body,
    type = "application/json",
  ) => {
    if (method === "GET" && !endpoint.includes("/deploys?"))
      return get(endpoint);
    assert(
      method === "GET"
        ? new RegExp(
            `^sites/${SITE_ID}/deploys\\?per_page=100&page=\\d+$`,
          ).test(endpoint)
        : method === "POST"
          ? endpoint ===
              `sites/${SITE_ID}/deploys?title=TreeForce89-additive-canonical-review` ||
            (readyToPublish && endpoint === `deploys/${id}/lock`)
          : method === "PUT" &&
            id &&
            payload.some((f) => endpoint === `deploys/${id}/files${f.path}`),
      "Forbidden release request",
    );
    const r = await fetch("https://api.netlify.com/api/v1/" + endpoint, {
      method,
      redirect: "error",
      headers: { Authorization: "Bearer " + token, "Content-Type": type },
      body:
        body == null
          ? undefined
          : type === "application/json"
            ? JSON.stringify(body)
            : body,
      signal: AbortSignal.timeout(60000),
    });
    assert(r.ok, "Netlify operation HTTP " + r.status);
    return r.json();
  };
  const inventory = async (id) => {
    const files = {};
    for (let page = 1; page <= 100; page++) {
      const rows = await get(`deploys/${id}/files?per_page=100&page=${page}`);
      assert(Array.isArray(rows));
      for (const f of rows) {
        assert(!Object.hasOwn(files, f.path));
        files[f.path] = f.sha;
      }
      if (rows.length < 100) return files;
    }
    throw Error("Incomplete inventory");
  };
  const backend = (d) => {
    const sort = (a) => [...a].sort((a, b) => a.n.localeCompare(b.n));
    assert.deepEqual(sort(d.available_functions), sort(baseline.functions));
    assert.deepEqual(d.function_schedules, baseline.schedules);
    for (const [k, v] of Object.entries(baseline.runtime))
      assert.deepEqual(d[k], v, k);
  };
  assertPreserved(await captureCurrent(get, expected), baseline);
  const began = Date.now();
  let d = await api(
    `sites/${SITE_ID}/deploys?title=TreeForce89-additive-canonical-review`,
    "POST",
    {
      files,
      functions: Object.fromEntries(baseline.functions.map((f) => [f.n, f.d])),
      functions_config: configurations(baseline),
      function_schedules: baseline.schedules,
      draft: false,
      async: false,
      branch: baseline.runtime.branch,
    },
  );
  assert(/^[a-f0-9]{24}$/.test(d.id) && d.id !== expected && d.id !== SOURCE);
  id = d.id;
  await fs.writeFile(
    out + "/state.json",
    JSON.stringify(
      {
        id,
        baseline: expected,
        published: false,
        planSha256: fingerprint(plan),
      },
      null,
      2,
    ),
  );
  assert(
    d.site_id === SITE_ID &&
      !d.published_at &&
      Date.parse(d.created_at) >= began - 10000,
  );
  validateRequired(d, { payload });
  const uploads = [];
  for (const h of d.required) {
    const f = payload.find((f) => f.sha1 === h);
    const bytes =
      f.path === REVIEW ? entry : await readPublic(sourceOrigin + f.path);
    assert.equal(digest(bytes), f.sha256);
    await api(
      `deploys/${id}/files${f.path}`,
      "PUT",
      bytes,
      "application/octet-stream",
    );
    uploads.push({ path: f.path, bytes: bytes.length });
  }
  for (let i = 0; i < 180; i++) {
    d = await get("deploys/" + id);
    if (d.state === "ready") break;
    assert(!["error", "canceled", "rejected"].includes(d.state));
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(d.state, "ready");
  assert(!d.published_at);
  backend(d);
  assert.deepEqual(await inventory(id), files);
  const origin = `https://${id}--tree-token.netlify.app`;
  const checkDelivery = async (origin) => {
    assertServedContent("index.html", await readPublic(origin + REVIEW), entry);
    for (const f of payload.filter((f) => f.path !== REVIEW))
      assert.equal(digest(await readPublic(origin + f.path)), f.sha256, f.path);
  };
  await checkDelivery(origin);
  // Run the committed, read-only browser smoke against this exact nested path before publication.
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    process.execPath,
    [
      "tests/treeforce-canonical-browser.cjs",
      origin,
      out + "/candidate-browser.json",
    ],
    { stdio: "inherit", env: process.env },
  );
  await waitForAllBuilds(api, id);
  assertPreserved(await captureCurrent(get, expected), baseline);
  d = await get("deploys/" + id);
  assert.equal(d.state, "ready");
  assert(!d.published_at);
  backend(d);
  assert.deepEqual(await inventory(id), files);
  readyToPublish = true;
  await api(`deploys/${id}/lock`, "POST");
  readyToPublish = false;
  for (let i = 0; i < 60; i++) {
    const s = await get("sites/" + SITE_ID);
    assert(
      [expected, id].includes(s.published_deploy?.id),
      "Concurrent publication",
    );
    if (s.published_deploy.id === id && s.published_deploy.locked) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const published = await captureCurrent(get, id);
  assert.deepEqual(published.files, files);
  for (const k of ["functions", "schedules", "runtime", "environment"])
    assert.deepEqual(published[k], baseline[k]);
  await checkDelivery("https://tree-token.xyz");
  execFileSync(
    process.execPath,
    [
      "tests/treeforce-canonical-browser.cjs",
      "https://tree-token.xyz",
      out + "/canonical-browser.json",
    ],
    { stdio: "inherit", env: process.env },
  );
  const report = {
    id,
    baseline: expected,
    url: "https://tree-token.xyz/play/treeforce89/review/",
    published: true,
    locked: true,
    existingPathsPreserved: Object.keys(baseline.files).length,
    addedPaths: payload.length,
    changedExistingPaths: 0,
    totalPaths: Object.keys(files).length,
    backendRecords: baseline.functions.length,
    schedules: baseline.schedules.length,
    uploads,
    planSha256: fingerprint(plan),
    checkedAt: new Date().toISOString(),
    slushWarningClearance: "Owner verification pending",
  };
  await fs.writeFile(
    out + "/state.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
