// Assemble a complete digest-based candidate locally. No network or publication API.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  loadBaseline,
  validateSnapshot,
  fingerprint,
} from "./capture-production-inventory.mjs";
import { ARBORETUM_SNIPPET } from "../stats-market-delivery.mjs";
const entry = "/play/treeforce89/index.html";
export const digest = (bytes, algorithm = "sha256") =>
  createHash(algorithm).update(bytes).digest("hex");

export function storedEntry(bytes, expectedHash) {
  if (digest(bytes, "sha1") === expectedHash) return Buffer.from(bytes);
  const html = bytes.toString(),
    at = html.lastIndexOf(ARBORETUM_SNIPPET);
  assert(at >= 0, "Unknown delivered HTML mutation");
  const suffix = html.slice(at + ARBORETUM_SNIPPET.length);
  assert(
    /^\s*<\/body>\s*<\/html>\s*$/i.test(suffix),
    "Unexpected snippet placement",
  );
  const stored = Buffer.from(html.slice(0, at) + suffix);
  assert.equal(
    digest(stored, "sha1"),
    expectedHash,
    "HTML differs beyond one known delivery snippet",
  );
  return stored;
}
const relink = (bytes) =>
  Buffer.from(
    bytes
      .toString()
      .replace("/assets/index-share-r4.js", "/assets/index-review-r15.js")
      .replace("/mobile-r1.css", "/mobile-review-r5.css"),
  );

export function assembleCandidate(baseline, review, originals, overlay) {
  validateSnapshot(baseline);
  assert.equal(review.backendChanges, 0);
  for (const record of Object.values(review.source.files)) {
    const bytes = originals[record.path];
    assert(bytes, "Missing original: " + record.path);
    assert.equal(
      digest(bytes),
      record.sha256,
      "Original game drift: " + record.path,
    );
    const storedPath = Object.hasOwn(baseline.files, record.path)
      ? record.path
      : record.path.toLowerCase();
    assert(
      Object.hasOwn(baseline.files, storedPath),
      "Missing baseline path: " + record.path,
    );
    const stored =
      record.path === entry
        ? storedEntry(bytes, baseline.files[storedPath])
        : bytes;
    assert.equal(
      digest(stored, "sha1"),
      baseline.files[storedPath],
      "Game differs from complete inventory: " + record.path,
    );
  }
  const expectedPaths = [...Object.keys(review.changed), entry].sort();
  assert.equal(new Set(expectedPaths).size, expectedPaths.length);
  assert.deepEqual(
    Object.keys(overlay).sort(),
    expectedPaths,
    "Overlay must match reviewed files exactly",
  );
  const expectedHTML = originals[entry]
    .toString()
    .replace("/assets/index-share-r4.js", "/assets/index-review-r15.js")
    .replace("/mobile-r1.css", "/mobile-review-r5.css");
  assert.notEqual(expectedHTML, originals[entry].toString());
  assert.equal(
    overlay[entry].toString(),
    expectedHTML,
    "Unexpected entry change",
  );
  const files = { ...baseline.files },
    payload = [];
  for (const name of expectedPaths) {
    assert(
      name.startsWith("/play/treeforce89/") && !name.split("/").includes(".."),
      "Non-game overlay path",
    );
    const bytes =
      name === entry
        ? relink(storedEntry(originals[entry], baseline.files[entry]))
        : overlay[name];
    if (name !== entry) {
      assert.equal(
        digest(bytes),
        review.changed[name],
        "Reviewed overlay drift: " + name,
      );
      assert(
        !Object.keys(baseline.files).some(
          (p) => p.toLowerCase() === name.toLowerCase(),
        ),
        "Unexpected existing-path collision: " + name,
      );
    }
    files[name] = digest(bytes, "sha1");
    payload.push({
      path: name,
      sha1: files[name],
      sha256: digest(bytes),
      bytes: bytes.length,
      action: name === entry ? "replace" : "add",
    });
  }
  for (const [name, hash] of Object.entries(baseline.files))
    if (name !== entry)
      assert.equal(files[name], hash, "Unrelated static file changed");
  assert.notEqual(files[entry], baseline.files[entry]);
  return {
    schemaVersion: 1,
    revision: "r15",
    purpose: "Complete preserved review candidate",
    published: false,
    publicationAuthorized: false,
    hostedPreviewCreated: false,
    baselineDeployId: baseline.deployId,
    baselineSha256: fingerprint(baseline),
    reviewedOverlaySha256: fingerprint(review),
    entryDelivery: {
      storedOriginalSha1: baseline.files[entry],
      reviewedServedSha256: digest(overlay[entry]),
      removedDeliverySnippetCopies:
        digest(originals[entry], "sha1") === baseline.files[entry] ? 0 : 1,
    },
    baseline: structuredClone(baseline),
    files,
    payload,
    functions: structuredClone(baseline.functions),
    schedules: structuredClone(baseline.schedules),
    runtime: structuredClone(baseline.runtime),
    environment: structuredClone(baseline.environment),
    counts: {
      baselineFiles: Object.keys(baseline.files).length,
      candidateFiles: Object.keys(files).length,
      preservedFiles: Object.keys(baseline.files).length - 1,
      replacedFiles: 1,
      addedFiles: payload.length - 1,
      functions: baseline.functions.length,
      schedules: baseline.schedules.length,
    },
    delivery:
      "Reuse baseline content hashes and exact backend/provider records; upload only verified payload bytes. This directory is not a standalone static deploy.",
    nextGates: [
      "Fresh full live/configuration recheck",
      "Hosted candidate preservation and authentication checks",
      "Owner phone review",
      "Separate explicit production authorization",
    ],
  };
}

export async function prepare(
  baselineFile,
  reviewFile,
  originalsDir,
  overlayDir,
  outputDir,
) {
  const output = path.resolve(outputDir);
  for (const input of [
    originalsDir,
    overlayDir,
    path.dirname(baselineFile),
    path.dirname(reviewFile),
  ]) {
    const p = path.resolve(input);
    assert(
      output !== p && !output.startsWith(p + path.sep),
      "Keep output separate from inputs",
    );
  }
  const baseline = loadBaseline(baselineFile),
    review = JSON.parse(await fs.readFile(reviewFile, "utf8"));
  const originals = {},
    overlay = {};
  for (const record of Object.values(review.source.files))
    originals[record.path] = await fs.readFile(
      path.resolve(originalsDir, "." + record.path),
    );
  for (const name of [...Object.keys(review.changed), entry])
    overlay[name] = await fs.readFile(path.resolve(overlayDir, "." + name));
  const candidate = assembleCandidate(baseline, review, originals, overlay);
  await fs.mkdir(output); // Fresh output only; no mixed or stale release files.
  for (const file of candidate.payload) {
    const dest = output + "/payload" + file.path;
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(
      dest,
      file.path === entry
        ? relink(storedEntry(originals[entry], baseline.files[entry]))
        : overlay[file.path],
    );
    assert.equal(digest(await fs.readFile(dest)), file.sha256);
  }
  await fs.writeFile(
    output + "/candidate.json",
    JSON.stringify(candidate, null, 2) + "\n",
  );
  await fs.writeFile(
    output + "/candidate.json.sha256",
    fingerprint(candidate) + "\n",
  );
  return candidate;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    7,
    "Usage: baseline.json reviewed.json original-game-dir overlay-dir fresh-output-dir",
  );
  const candidate = await prepare(...process.argv.slice(2));
  console.log(
    JSON.stringify({
      baseline: candidate.baselineDeployId,
      ...candidate.counts,
      candidateSha256: fingerprint(candidate),
      published: false,
    }),
  );
}
