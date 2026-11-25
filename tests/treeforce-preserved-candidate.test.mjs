import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assembleCandidate,
  digest,
  storedEntry,
} from "../scripts/treeforce-local/prepare-preserved-candidate.mjs";
import {
  ARBORETUM_SNIPPET,
  assertServedContent,
} from "../scripts/stats-market-delivery.mjs";
const entry = "/play/treeforce89/index.html",
  modulePath = "/play/treeforce89/assets/index-review-r15.js";
const fixture = () => {
  const baseline = JSON.parse(
    fs.readFileSync(
      new URL(
        "../docs/treeforce89-production-inventory-20261124/baseline.json",
        import.meta.url,
      ),
    ),
  );
  const stored = Buffer.from(
    '<html><head><script src="/assets/index-share-r4.js"></script><link href="/mobile-r1.css"></head><body>' +
      ARBORETUM_SNIPPET +
      "</body></html>",
  );
  const served = Buffer.from(
    stored.toString().replace("</body>", ARBORETUM_SNIPPET + "</body>"),
  );
  baseline.files[entry] = digest(stored, "sha1");
  const originals = { [entry]: served },
    body = Buffer.from("export const fixture=true;");
  const review = {
    backendChanges: 0,
    source: { files: { [entry]: { path: entry, sha256: digest(served) } } },
    changed: { [modulePath]: digest(body) },
  };
  const overlay = {
    [entry]: Buffer.from(
      served
        .toString()
        .replace("index-share-r4", "index-review-r15")
        .replace("mobile-r1", "mobile-review-r5"),
    ),
    [modulePath]: body,
  };
  return { baseline, review, originals, overlay, stored };
};
const build = (f) =>
  assembleCandidate(f.baseline, f.review, f.originals, f.overlay);
test("complete inventory retains unrelated files and exact backend/configuration records", () => {
  const f = fixture(),
    c = build(f);
  assert.equal(c.counts.candidateFiles, c.counts.baselineFiles + 1);
  for (const [p, h] of Object.entries(f.baseline.files))
    if (p !== entry) assert.equal(c.files[p], h);
  for (const field of ["functions", "schedules", "runtime", "environment"])
    assert.deepEqual(c[field], f.baseline[field]);
  c.functions[0].n = "modified";
  assert.notEqual(c.functions[0].n, f.baseline.functions[0].n);
  assert.equal(c.published, false);
  assert.equal(c.publicationAuthorized, false);
});
test("upload removes exactly the known delivery insertion and preserves existing stored copies", () => {
  const f = fixture(),
    c = build(f),
    stored = storedEntry(f.originals[entry], f.baseline.files[entry]);
  assert.deepEqual(stored, f.stored);
  assert.equal(c.entryDelivery.removedDeliverySnippetCopies, 1);
  const upload = Buffer.from(
    stored
      .toString()
      .replace("index-share-r4", "index-review-r15")
      .replace("mobile-r1", "mobile-review-r5"),
  );
  assert.equal(c.files[entry], digest(upload, "sha1"));
  assertServedContent("index.html", f.overlay[entry], upload);
});
test("exact inventory hash validates the observed lowercase CSS lookup", () => {
  const f = fixture(),
    p = "/play/treeforce89/assets/Example.css",
    bytes = Buffer.from("body{}");
  f.baseline.files[p.toLowerCase()] = digest(bytes, "sha1");
  f.originals[p] = bytes;
  f.review.source.files[p] = { path: p, sha256: digest(bytes) };
  build(f);
  f.baseline.files[p.toLowerCase()] = "0".repeat(40);
  assert.throws(() => build(f), /complete inventory/);
});
test("unexpected existing path collisions including case differences fail closed", () => {
  const f = fixture();
  f.baseline.files[modulePath.toUpperCase()] = digest(
    f.overlay[modulePath],
    "sha1",
  );
  assert.throws(() => build(f), /existing-path collision/);
});
test("extra, missing, changed and out-of-scope payloads are rejected", () => {
  for (const mutate of [
    (f) => {
      f.overlay["/unexpected"] = Buffer.from("x");
    },
    (f) => {
      delete f.overlay[modulePath];
    },
    (f) => {
      f.overlay[modulePath] = Buffer.from("changed");
    },
    (f) => {
      f.overlay[entry] = Buffer.from("changed");
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => build(f));
  }
  const f = fixture();
  f.review.changed["/_redirects"] = digest(Buffer.from("x"));
  f.overlay["/_redirects"] = Buffer.from("x");
  assert.throws(() => build(f), /Non-game/);
});
test("unknown HTML mutation and extra delivered copies cannot be normalized away", () => {
  const f = fixture();
  assert.throws(
    () =>
      storedEntry(
        Buffer.from(
          f.originals[entry].toString().replace("<head>", "<head>changed"),
        ),
        f.baseline.files[entry],
      ),
    /beyond one/,
  );
  assert.throws(
    () =>
      storedEntry(
        Buffer.from(
          f.originals[entry]
            .toString()
            .replace("</body>", ARBORETUM_SNIPPET + "</body>"),
        ),
        f.baseline.files[entry],
      ),
    /beyond one/,
  );
});
test("a changed original or incomplete backend is rejected", () => {
  const f = fixture();
  f.originals[entry] = Buffer.from("changed");
  assert.throws(() => build(f), /Original game drift/);
  const g = fixture();
  g.baseline.functions.pop();
  assert.throws(() => build(g), /61/);
});
