import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
import { prepareRoundPresentation } from "./prepare-round-presentation.mjs";
export async function prepareIntegratedReview(source, output) {
  await prepareRoundPresentation(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  await save(
    "touchbar-input-r13.js",
    await fs.readFile(
      new URL(
        "../../treeforce89/frontend/game/touchbar-input.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r12.js`,
      "utf8",
    );
    if (name === "arcade") {
      body =
        'import {isolateTouchbarInput} from "./touchbar-input-r13.js";\n' +
        body;
      body = replaceOnce(
        body,
        " const press=()=>{const s=usable();",
        ' const detachInput=isolateTouchbarInput(bar,()=>{release();scene()?.clearTouchState()});game.events.once("destroy",detachInput);\n const press=()=>{const s=usable();',
      );
    }
    await save(
      `${name}-review-r13.js`,
      body.replace(
        /\.\/(index|arcade|graphql)-review-r12\.js/g,
        "./$1-review-r13.js",
      ),
    );
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r12.js",
      "/assets/index-review-r13.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope +=
    "; task 8 isolate mobile DOM controls from Phaser window input";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareIntegratedReview(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-integrated-review"),
    ),
  );
