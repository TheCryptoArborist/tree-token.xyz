// Frontend-only overlay atop the hash-pinned, reconciled runtime. Not a whole-site release.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepare } from "./prepare.mjs";

export function replaceOnce(text, from, to) {
  assert.equal(text.split(from).length, 2, `Runtime anchor drift: ${from}`);
  return text.replace(from, to);
}

export function patchCombatAudio(engine) {
  let next =
    'import {CueMixer as FeedbackCueMixer} from "./combat-feedback-r6.js";\n' +
    engine;
  next = replaceOnce(next, "U=new m;", "U=new FeedbackCueMixer;");
  next = replaceOnce(
    next,
    "function $(e,t,n=.05,r=.04){if(!B)try{U.shot(K(),t,n,r)}catch{}}",
    'function $(e,t,n=.05,r=.04,category="legacy"){if(!B)try{U.combat(K(),category,t,n,r)}catch{}}',
  );
  const routes = [
    ["$(this,r?760:t.damage>1?300:t.pierce?520:620,.025,.03)", "fire"],
    [
      "$(this,e.kind===`borer`?175:e.kind===`spore`?280:350,.07,.03)",
      "enemyFire",
    ],
    ["$(this,92,.13,.1)", "hit"],
    ["$(this,112,.055,.05)", "hit"],
    ["$(this,150,.03,.03)", "hit"],
    ["$(this,r?72:s===`borer`?90:230,r?.15:.06,r?.13:.06)", "kill"],
  ];
  for (const [call, category] of routes) {
    next = replaceOnce(next, call, call.slice(0, -1) + `,"${category}")`);
  }
  return next;
}

export async function prepareFeedback(source, output) {
  await prepare(source, output);
  const assets = "/play/treeforce89/assets/";
  const changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  const mixer = await fs.readFile(
    new URL("../../treeforce89/frontend/game/audio-cues.mjs", import.meta.url),
    "utf8",
  );
  await save("combat-feedback-r6.js", mixer);
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r5.js`,
      "utf8",
    );
    if (name === "arcade") body = patchCombatAudio(body);
    body = body.replace(
      /\.\/(index|arcade|graphql)-review-r5\.js/g,
      "./$1-review-r6.js",
    );
    await save(`${name}-review-r6.js`, body);
  }
  const htmlPath = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    htmlPath,
    replaceOnce(
      await fs.readFile(htmlPath, "utf8"),
      "/assets/index-review-r5.js",
      "/assets/index-review-r6.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope += "; task 1 combat sound categories and bounded impact voices";
  review.gameplayRulesChanged = false;
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename) {
  console.log(
    await prepareFeedback(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-feedback"),
    ),
  );
}
