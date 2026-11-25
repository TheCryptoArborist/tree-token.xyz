// Transitional, byte-preserving module-link repair. Gameplay remains in its source lineage;
// captured bundles are comparison inputs, never edited or checked in as source.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const pins = {
  "index-share-r4.js":
    "738c68535a66f68544a9ca30ba0ab6894bca312872568f89910a40954bd741bf",
  "arcade-renewal-r3.js":
    "2e9d45ed31189ebaaa7e9d3762ef32295d67a64880f0ec1d2a71aed2f80b8003",
  "graphql-mobile-r1.js":
    "45e654d6851f198d4d4d37d9a7d1753aad5985fe7f0c9ccf0154007da0922254",
};
const names = {
  "index-share-r4.js": "index-review-r5.js",
  "arcade-renewal-r3.js": "arcade-review-r5.js",
  "graphql-mobile-r1.js": "graphql-review-r5.js",
  "index-renewal-r3.js": "index-review-r5.js",
  "index-mobile-r1.js": "index-review-r5.js",
};
export function relink(text) {
  return text.replace(
    /(?<=["'`])\.\/(index-share-r4|arcade-renewal-r3|graphql-mobile-r1|index-renewal-r3|index-mobile-r1)\.js(?=["'`])/g,
    (name) => "./" + names[name.slice(2)],
  );
}
export async function prepare(source, output) {
  assert.notEqual(
    path.resolve(source),
    path.resolve(output),
    "Keep captured evidence immutable",
  );
  const assets = "/play/treeforce89/assets/",
    manifest = JSON.parse(await fs.readFile(source + "/manifest.json", "utf8"));
  for (const [name, pin] of Object.entries(pins)) {
    const bytes = await fs.readFile(source + assets + name);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      pin,
      "Unreviewed production drift: " + name,
    );
  }
  // Verify every captured asset, not only the three changed modules.
  for (const record of Object.values(manifest.files))
    assert.equal(
      createHash("sha256")
        .update(await fs.readFile(source + record.path))
        .digest("hex"),
      record.sha256,
      record.path,
    );
  await fs.cp(source, output, { recursive: true });
  const changed = {};
  for (const name of Object.keys(pins)) {
    const original = await fs.readFile(source + assets + name, "utf8"),
      next = relink(original);
    assert.notEqual(next, original);
    await fs.writeFile(output + assets + names[name], next);
    changed[assets + names[name]] = createHash("sha256")
      .update(next)
      .digest("hex");
  }
  const css = await fs.readFile(
    source + "/play/treeforce89/mobile-r1.css",
    "utf8",
  );
  assert.equal(
    createHash("sha256").update(css).digest("hex"),
    "dd1952c8f37372bc70821baf5b466722227b890167e1b37312ff65d76a6f6bcd",
    "Mobile stylesheet drift",
  );
  const scopedCss = css
    .replaceAll(
      ".nftree-game-shell canvas",
      ".nftree-game-shell .phaser-mount canvas",
    )
    .replaceAll(
      ".nftree-game-shell.mobile-play-active canvas",
      ".nftree-game-shell.mobile-play-active .phaser-mount canvas",
    );
  assert.equal(
    (css.match(/\.nftree-game-shell(?:\.mobile-play-active)? canvas/g) || [])
      .length,
    4,
  );
  await fs.writeFile(
    output + "/play/treeforce89/mobile-review-r5.css",
    scopedCss,
  );
  changed["/play/treeforce89/mobile-review-r5.css"] = createHash("sha256")
    .update(scopedCss)
    .digest("hex");
  const html = await fs.readFile(
    source + "/play/treeforce89/index.html",
    "utf8",
  );
  assert.equal(html.split("/assets/index-share-r4.js").length, 2);
  await fs.writeFile(
    output + "/play/treeforce89/index.html",
    html
      .replace("/assets/index-share-r4.js", "/assets/index-review-r5.js")
      .replace("/mobile-r1.css", "/mobile-review-r5.css"),
  );
  await fs.writeFile(
    output + "/review.json",
    JSON.stringify(
      {
        notDeployableStandalone: true,
        source: manifest,
        changed,
        scope:
          "Module references, scoped Phaser canvas selectors, HTML references; retains all old assets",
        backendChanges: 0,
      },
      null,
      2,
    ),
  );
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepare(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-candidate"),
    ),
  );
