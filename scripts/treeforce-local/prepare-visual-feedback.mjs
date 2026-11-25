// Task 2 frontend overlay. Preserve the complete captured site for any future release.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { prepareFeedback, replaceOnce } from "./prepare-feedback.mjs";

export function patchEnemyFeedback(engine) {
  let next =
    'import {applyEnemyFeedback, setDiveWarning, flashEnemyHit} from "./enemy-feedback-r7.js";\n' +
    engine;
  const changes = [
    [
      "if(a.phase+=t*.001,e<(a.getData(`shieldStunUntil`)||0)){a.setTint(10354612);return}else a.getData(`transformed`)||a.clearTint();",
      "applyEnemyFeedback(a,e);if(a.phase+=t*.001,e<(a.getData(`shieldStunUntil`)||0))return;",
    ],
    [
      "let t=a.getData(`bossDamageStage`)||0;t===1?a.setTint(16765786):t===2?a.setTint(16747106):t>=3&&a.setTint(Math.floor(e/120)%2?16739170:15911244),this.bossDamageFx",
      "this.bossDamageFx",
    ],
    [
      ".setData(`escortAttack`,n).setTint(16769131);",
      ".setData(`escortAttack`,n);setDiveWarning(e,true,this.time.now);",
    ],
    [
      "executeDive(e){if(!e.active)return;e.clearTint();",
      "executeDive(e){if(!e.active)return;setDiveWarning(e,false,this.time.now);",
    ],
    [
      "e.setTintFill(16777215),this.time.delayedCall(r?100:55,()=>e.active&&e.clearTint())",
      "flashEnemyHit(this,e,r?100:55)",
    ],
  ];
  for (const [from, to] of changes) next = replaceOnce(next, from, to);
  return next;
}

export async function prepareVisualFeedback(source, output) {
  await prepareFeedback(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  await save(
    "enemy-feedback-r7.js",
    await fs.readFile(
      new URL(
        "../../treeforce89/frontend/game/enemy-feedback.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r6.js`,
      "utf8",
    );
    if (name === "arcade") body = patchEnemyFeedback(body);
    body = body.replace(
      /\.\/(index|arcade|graphql)-review-r6\.js/g,
      "./$1-review-r7.js",
    );
    await save(`${name}-review-r7.js`, body);
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r6.js",
      "/assets/index-review-r7.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope += "; task 2 enemy warning and hit-flash presentation";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareVisualFeedback(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-visual-feedback"),
    ),
  );
