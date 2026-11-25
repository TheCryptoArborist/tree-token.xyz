// Incremental review overlay: reuse the corrected r13 game without rebuilding the site.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
const source = path.resolve(
  process.argv[2] || "release/treeforce-enemy-animation",
);
const output = path.resolve(
  process.argv[3] || "release/treeforce-impact-effects",
);
if (source === output || output.startsWith(source + path.sep))
  throw Error("Keep baseline separate");
const review = JSON.parse(await fs.readFile(source + "/review.json", "utf8"));
for (const [file, sha] of Object.entries(review.changed)) {
  const bytes = await fs.readFile(source + file);
  if (createHash("sha256").update(bytes).digest("hex") !== sha)
    throw Error("Baseline hash mismatch: " + file);
}
await fs.mkdir(output);
await fs.cp(source, output, { recursive: true });
const assets = "/play/treeforce89/assets/";
async function save(file, body) {
  await fs.writeFile(output + file, body);
  review.changed[file] = createHash("sha256").update(body).digest("hex");
}
const helper = await fs.readFile(
  new URL(
    "../../treeforce89/frontend/game/impact-effects.mjs",
    import.meta.url,
  ),
  "utf8",
);
await save(assets + "impact-effects-r15.js", helper);
for (const name of ["index", "arcade", "graphql"]) {
  let body = await fs.readFile(
    source + assets + name + "-review-r14.js",
    "utf8",
  );
  if (name === "arcade") {
    body =
      'import {enemyImpact} from "./impact-effects-r15.js";\nfunction enemyDeathFx(scene,x,y,kind,boss){if(boss)return Q(scene,x,y,38);return enemyImpact(scene,x,y,kind,(a,b)=>n.Math.Between(a,b))}\n' +
      body;
    body = replaceOnce(
      body,
      "Q(this,i,a,r?38:s===`borer`?16:9)",
      "enemyDeathFx(this,i,a,s,r)",
    );
  }
  await save(
    assets + name + "-review-r15.js",
    body.replace(
      /\.\/(index|arcade|graphql)-review-r14\.js/g,
      "./$1-review-r15.js",
    ),
  );
}
const file = "/play/treeforce89/index.html";
await fs.writeFile(
  output + file,
  replaceOnce(
    await fs.readFile(source + file, "utf8"),
    "/assets/index-review-r14.js",
    "/assets/index-review-r15.js",
  ),
);
review.scope +=
  "; localized enemy shatter, spore dust and bark fragments; original random draw budget retained";
await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
console.log("Prepared incremental r15: " + output);
