import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
import { prepareSoundIdentity } from "./prepare-sound-identity.mjs";
export function patchCombatVisuals(engine) {
  let next =
    'import {faceFlightPath,animateEnemy,setupCombatLook} from "./combat-visuals-r11.js";\n' +
    engine;
  next = replaceOnce(
    next,
    "e.setAngle(Math.sin(n*Math.PI*2)*(r?-18:18))",
    "faceFlightPath(e,c,n,true)",
  );
  next = replaceOnce(
    next,
    "e.setAngle((t.end.x<e.homeX?-1:1)*(15+65*i))",
    "faceFlightPath(e,r,i)",
  );
  next = replaceOnce(
    next,
    "applyEnemyFeedback(a,e);",
    "applyEnemyFeedback(a,e);animateEnemy(a,e);",
  );
  next = replaceOnce(
    next,
    "setDepth(7).setAlpha(.48);e.tweens.add",
    "setDepth(7).setAlpha(.48);setupCombatLook(e,r);e.tweens.add",
  );
  return next;
}
export async function prepareCombatVisuals(source, output) {
  await prepareSoundIdentity(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  await save(
    "combat-visuals-r11.js",
    await fs.readFile(
      new URL(
        "../../treeforce89/frontend/game/combat-visuals.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r10.js`,
      "utf8",
    );
    if (name === "arcade") body = patchCombatVisuals(body);
    await save(
      `${name}-review-r11.js`,
      body.replace(
        /\.\/(index|arcade|graphql)-review-r10\.js/g,
        "./$1-review-r11.js",
      ),
    );
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r10.js",
      "/assets/index-review-r11.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope +=
    "; task 6 path-facing enemies, wing poses and combat contrast";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareCombatVisuals(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-combat-visuals"),
    ),
  );
