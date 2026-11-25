// Owner-authorized main-game promotion and cabinet countdown; all other paths preserved.
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
export const REVIEW = "/play/treeforce89/index.html";
const LIVE = "/play/treeforce89/index.html", SOURCE = "6b0663eb4b2316cfc7ad2bc8";
export function assembleHoliday(b, approved) {
  assertPreserved(b,approved.baseline);
  const payload=Object.entries(approved.payload).map(([path,f])=>({path,...f}));assert.equal(payload.length,9);
  const files={...b.files};const entries=['/play/index.html',REVIEW];
  assert.deepEqual(Object.keys(approved.previousEntries).sort(),[...entries].sort());
  for(const f of payload){
    if(entries.includes(f.path))assert.equal(files[f.path],approved.previousEntries[f.path],'Entry drift');
    else {assert(/^\/play\/treeforce89\/assets\/(?:index-review|arcade-review|graphql-review|sound-identity|holiday-mode)-r18\.js$/.test(f.path)||['/scripts/treeforce-season-r18.mjs','/scripts/treeforce-cabinet-holiday-r18.mjs'].includes(f.path));assert(!Object.keys(files).some(k=>k.toLowerCase()===f.path.toLowerCase()),'Path collision');}
    files[f.path]=f.sha1;
  }
  assert.deepEqual(files,approved.files);
  for(const [name,hash]of Object.entries(b.files))if(!entries.includes(name))assert.equal(files[name],hash);
  return {payload,files};
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
      "production/treeforce-main-r18/candidate.json",
      "utf8",
    ),
  );
  assert.equal(
    fingerprint(approved),
    (
      await fs.readFile(
        "production/treeforce-main-r18/candidate.json.sha256",
        "utf8",
      )
    ).trim(),
  );
  const readPublic = async (url) => {
    const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert.equal(r.status,200,url);return Buffer.from(await r.arrayBuffer());
  };
  const {payload,files}=assembleHoliday(baseline,approved);
  const readPayload=f=>fs.readFile('production/treeforce-main-r18'+f.path);
  for(const f of payload){const bytes=await readPayload(f);assert.equal(digest(bytes),f.sha256);assert.equal(digest(bytes,'sha1'),f.sha1);}
  const entry=await readPayload(payload.find(f=>f.path===REVIEW));
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
              `sites/${SITE_ID}/deploys?title=TreeForce89-main-and-festive-cabinet` ||
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
  await waitForAllBuilds(api, expected);
  assertPreserved(await captureCurrent(get, expected), baseline);
  const began = Date.now();
  let d = await api(
    `sites/${SITE_ID}/deploys?title=TreeForce89-main-and-festive-cabinet`,
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
      await readPayload(f);
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
      if(f.path.endsWith('.html'))assertServedContent('index.html',await readPublic(origin+f.path),await readPayload(f));
      else assert.equal(digest(await readPublic(origin + f.path)), f.sha256, f.path);
  };
  await checkDelivery(origin);
  // Run the committed, read-only browser smoke against this exact nested path before publication.
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    process.execPath,
    [
      "tests/treeforce-main-browser.cjs",
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
      "tests/treeforce-main-browser.cjs",
      "https://tree-token.xyz",
      out + "/canonical-browser.json",
    ],
    { stdio: "inherit", env: process.env },
  );
  const report = {
    id,
    baseline: expected,
    url: "https://tree-token.xyz/play/treeforce89/",
    published: true,
    locked: true,
    existingPathsPreserved: Object.keys(baseline.files).length - 2,
    addedPaths: payload.length - 2,
    changedExistingPaths: 2,
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
