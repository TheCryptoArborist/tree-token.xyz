import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
import { prepareVisualFeedback } from "./prepare-visual-feedback.mjs";
export function patchAudioLifecycle(engine) {
  let next =
    'import {AudioLifecycle} from "./audio-lifecycle-r8.js";\n' + engine;
  next = replaceOnce(
    next,
    "U=new FeedbackCueMixer;",
    'U=new FeedbackCueMixer;const audioLifecycle=new AudioLifecycle({mixer:U,muted:()=>B,releaseContext:()=>{const old=z;z=undefined;H=0;if(old&&old.state!=="closed")void old.close().catch(()=>{});}});',
  );
  next = replaceOnce(
    next,
    "function W(e){if(!B)",
    "function W(e){if(!audioLifecycle.blocked())",
  );
  next = replaceOnce(
    next,
    'category="legacy"){if(!B)',
    'category="legacy"){if(!audioLifecycle.blocked())',
  );
  next = replaceOnce(
    next,
    "z.state===`suspended`&&z.resume()",
    "z.state===`suspended`&&z.resume().catch(()=>{})",
  );
  const begin = next.indexOf("function q(e,t,n,r,i,a){"),
    end = next.indexOf("var te=class extends n.Scene", begin);
  if (begin < 0 || end < begin) throw Error("Missing music region");
  const region = next.slice(begin, end);
  const tickStart = region.indexOf("let t=e.currentTime+.025"),
    tickEnd = region.indexOf("};t(),V=window.setInterval");
  if (tickStart < 0 || tickEnd < tickStart) throw Error("Missing music tick");
  const tick = region.slice(tickStart, tickEnd);
  next = replaceOnce(
    next,
    region,
    "function q(...args){audioLifecycle.tone(...args)}function J(){audioLifecycle.start(()=>{let e=K();" +
      tick +
      "})}function Y(){audioLifecycle.stop()}",
  );
  next = replaceOnce(
    next,
    "installMobileTouchbar(game,e);return game",
    "installMobileTouchbar(game,e);if(!t?.homeOnly)audioLifecycle.bind(game,e,J);return game",
  );
  return next;
}
export async function prepareAudioLifecycle(source, output) {
  await prepareVisualFeedback(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  await save(
    "audio-lifecycle-r8.js",
    await fs.readFile(
      new URL(
        "../../treeforce89/frontend/game/audio-lifecycle.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r7.js`,
      "utf8",
    );
    if (name === "arcade") body = patchAudioLifecycle(body);
    await save(
      `${name}-review-r8.js`,
      body.replace(
        /\.\/(index|arcade|graphql)-review-r7\.js/g,
        "./$1-review-r8.js",
      ),
    );
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r7.js",
      "/assets/index-review-r8.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope += "; task 3 audio ownership, pause and true music mute";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareAudioLifecycle(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-audio-lifecycle"),
    ),
  );
