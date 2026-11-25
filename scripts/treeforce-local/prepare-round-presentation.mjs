import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { replaceOnce } from "./prepare-feedback.mjs";
import { prepareCombatVisuals } from "./prepare-combat-visuals.mjs";
export function patchRoundPresentation(engine) {
  let next =
    'import {clearCardMs,markBonusIntro,introPhaseTime,wavePoints,challengePoints} from "./round-presentation-r12.js";\n' +
    engine;
  next = replaceOnce(
    next,
    "this.waveKillsStart=this.run.kills,this.waveClearing=!1",
    "this.waveKillsStart=this.run.kills,this.waveScoreStart=this.run.score,this.waveClearing=!1",
  );
  next = replaceOnce(
    next,
    "this.time.delayedCall(t?3600:2400,",
    "this.time.delayedCall(clearCardMs(e,t),",
  );
  next = replaceOnce(
    next,
    "CHAIN          ${this.chain}\\n\\n${t?",
    "CHAIN          ${this.chain}\\n+${wavePoints(this.run.score,this.waveScoreStart)} POINTS THIS ATTEMPT\\n\\n${t?",
  );
  next = replaceOnce(
    next,
    "this.bonusIntro={elapsed:0,phase:`title`,card:c,prompt:s}",
    "this.bonusIntro={elapsed:0,phase:`title`,card:c,prompt:s,repeat:markBonusIntro(this.game,e)}",
  );
  next = replaceOnce(
    next,
    "let n=a(t.elapsed);",
    "let n=a(introPhaseTime(t.elapsed,t.repeat));",
  );
  next = replaceOnce(
    next,
    "this.add.rectangle(240,342,402,192,L.panel,.99)",
    "this.add.rectangle(240,342,402,224,L.panel,.99)",
  );
  next = replaceOnce(
    next,
    "${t.perfect?`PERFECT BONUS +10,000`:`TARGET SCORE +`+(this.rushDestroyed*o.targetScore).toLocaleString()}",
    "${challengePoints(this.rushDestroyed,o.targetScore,t.bonus)}",
  );
  return next;
}
export async function prepareRoundPresentation(source, output) {
  await prepareCombatVisuals(source, output);
  const assets = "/play/treeforce89/assets/",
    changed = {};
  const save = async (name, body) => {
    await fs.writeFile(output + assets + name, body);
    changed[assets + name] = createHash("sha256").update(body).digest("hex");
  };
  await save(
    "round-presentation-r12.js",
    await fs.readFile(
      new URL(
        "../../treeforce89/frontend/game/round-presentation.mjs",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const name of ["index", "arcade", "graphql"]) {
    let body = await fs.readFile(
      output + assets + `${name}-review-r11.js`,
      "utf8",
    );
    if (name === "arcade") body = patchRoundPresentation(body);
    await save(
      `${name}-review-r12.js`,
      body.replace(
        /\.\/(index|arcade|graphql)-review-r11\.js/g,
        "./$1-review-r12.js",
      ),
    );
  }
  const html = output + "/play/treeforce89/index.html";
  await fs.writeFile(
    html,
    replaceOnce(
      await fs.readFile(html, "utf8"),
      "/assets/index-review-r11.js",
      "/assets/index-review-r12.js",
    ),
  );
  const review = JSON.parse(await fs.readFile(output + "/review.json", "utf8"));
  Object.assign(review.changed, changed);
  review.scope +=
    "; task 7 compact repeat transitions and earned-point attribution";
  review.presentationTimingChanged =
    "Later clear cards 1800ms; repeat bonus intros 2200ms. First clear, first bonus of each kind, READY/GO, final victory and combat timing unchanged.";
  await fs.writeFile(output + "/review.json", JSON.stringify(review, null, 2));
  return changed;
}
if (process.argv[1] === import.meta.filename)
  console.log(
    await prepareRoundPresentation(
      path.resolve(process.argv[2] || "release/treeforce-baseline"),
      path.resolve(process.argv[3] || "release/treeforce-round-presentation"),
    ),
  );
