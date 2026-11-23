import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
import { prepareBossClearance } from "./prepare-boss-clearance.mjs";
export function patchSoundIdentity(engine) {
  let next =
    'import {CanopyScore,IdentityMixer} from "./sound-identity-r10.js";\n' +
    engine;
  next = replaceOnce(next, "U=new FeedbackCueMixer;", "U=new IdentityMixer;");
  next = replaceOnce(
    next,
    "const audioLifecycle=new AudioLifecycle",
    "const canopyScore=new CanopyScore;const audioLifecycle=new AudioLifecycle",
  );
  next = replaceOnce(
    next,
    "const old=z;z=undefined;H=0;",
    "const old=z;z=undefined;H=0;canopyScore.reset();",
  );
  const start = next.indexOf("function J(){audioLifecycle.start("),
    end = next.indexOf("function Y(){", start);
  if (start < 0 || end < start) throw Error("Missing owned soundtrack tick");
  return replaceOnce(
    next,
    next.slice(start, end),
    "function J(){audioLifecycle.start(()=>canopyScore.tick(audioLifecycle,K(),U))}",
  );
}
export async function prepareSoundIdentity(source, output) {
  await prepareBossClearance(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  const sourceModule = await fs.readFile(
    new URL(
      "../../treeforce89/frontend/game/sound-identity.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  await save(
    "sound-identity-r10.js",
    replaceOnce(sourceModule, "./audio-cues.mjs", "./combat-feedback-r6.js"),
  );
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r9.js`,
      "utf8",
    );
    if (name === "arcade") body = patchSoundIdentity(body);
    await save(
      `${name}-review-r10.js`,
      body.replace(
        /\.\/(index|arcade|graphql)-review-r9\.js/g,
        "./$1-review-r10.js",
      ),
    );
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r9.js",
      "/assets/index-review-r10.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope += "; task 5 original 8-bar encounter score and combat timbres";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareSoundIdentity(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-sound-identity"),
    ),
  );
