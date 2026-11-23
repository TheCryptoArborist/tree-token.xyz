// Boss layout overlay; retain existing art, body size, attack cadence and speed.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
import { prepareAudioLifecycle } from "./prepare-audio-lifecycle.mjs";
export function patchBossClearance(engine) {
  let next = replaceOnce(
    engine,
    "e.homeX=240,e.homeY=138,e.phase=0",
    "e.homeX=240,e.homeY=180,e.phase=0",
  );
  next = replaceOnce(
    next,
    "a.y=120+Math.sin((e-this.waveStart)*.0021)*25",
    "a.y=180+Math.sin((e-this.waveStart)*.0021)*25",
  );
  next = replaceOnce(
    next,
    "this.children.getByName(`bossHpTrack`)?.setVisible(!0),this.banner(",
    "this.children.getByName(`bossHpTrack`)?.setVisible(!0),this.notice.setY(300),this.banner(",
  );
  return next;
}
export async function prepareBossClearance(source, output) {
  await prepareAudioLifecycle(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r8.js`,
      "utf8",
    );
    if (name === "arcade") body = patchBossClearance(body);
    body = body.replace(
      /\.\/(index|arcade|graphql)-review-r8\.js/g,
      "./$1-review-r9.js",
    );
    await fs.writeFile(output + assets + `${name}-review-r9.js`, body);
    changed[assets + `${name}-review-r9.js`] = createHash("sha256")
      .update(body)
      .digest("hex");
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r8.js",
      "/assets/index-review-r9.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope += "; task 4 boss vertical clearance and banner position";
  review.gameplayRulesChanged = false;
  review.gameplayGeometryChanged =
    "Boss settled center moves from 120 to 180; entrance destination 138 to 180. Sprite and hitbox remain aligned. Projectile travel distance decreases; cadence, speed and damage unchanged.";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareBossClearance(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-boss-clearance"),
    ),
  );
