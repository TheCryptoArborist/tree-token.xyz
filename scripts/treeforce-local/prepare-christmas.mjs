// Incremental local-only copy; never a deployment package.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {replaceOnce} from './prepare-feedback.mjs';
const source = path.resolve(process.argv[2] || 'release/treeforce-impact-effects');
const output = path.resolve(process.argv[3] || 'release/treeforce-christmas');
if (source === output || output.startsWith(source + path.sep)) throw Error('Keep baseline separate');
const review = JSON.parse(await fs.readFile(source+'/review.json','utf8'));
for (const [file, hash] of Object.entries(review.changed)) {
  if (createHash('sha256').update(await fs.readFile(source+file)).digest('hex') !== hash) throw Error('Baseline mismatch: '+file);
}
await fs.mkdir(output);
await fs.cp(source,output,{recursive:true});
const assets='/play/treeforce89/assets/';
await fs.copyFile('treeforce89/frontend/game/christmas-look.mjs',output+assets+'christmas-look-local.js');
await fs.copyFile('treeforce89/frontend/game/holiday-mode.mjs',output+assets+'holiday-mode-local.js');
let engine=await fs.readFile(source+assets+'arcade-review-r15.js','utf8');
engine='import {beginHolidayScene,installHolidaySelector} from "./holiday-mode-local.js";\nimport {setupChristmasLook} from "./christmas-look-local.js";\n'+replaceOnce(engine,'setupCombatLook(e,r);','setupCombatLook(e,r);beginHolidayScene(e);setupChristmasLook(e);');
engine=replaceOnce(engine,'installMobileTouchbar(game,e);','installMobileTouchbar(game,e);if(!t?.homeOnly)installHolidaySelector(game,e,t);');
await fs.writeFile(output+assets+'arcade-review-r15.js',engine);
await fs.copyFile('treeforce89/frontend/game/christmas-audio.mjs',output+assets+'christmas-audio-local.js');
let score = await fs.readFile(source+assets+'sound-identity-r10.js','utf8');
score = 'import {holidayMusicEnabled} from "./holiday-mode-local.js";\nimport {holidayNotes} from "./christmas-audio-local.js";\n' + replaceOnce(score,
  'scoreStep(mood, this.step++)',
  'holidayNotes(scoreStep(mood, this.step++), mood, holidayMusicEnabled(lifecycle.owner))');
await fs.writeFile(output+assets+'sound-identity-r10.js',score);

let html=await fs.readFile('scripts/treeforce-local/practice.html','utf8');
html=html.replace('Captured current game with reviewed module links.','Holiday mode preview · Calendar simulated at Dec 15, 2026. Choose a theme on the title screen.');
html=html.replace('initialScene,','initialScene, holidayPreviewNow: Date.parse("2026-12-15T12:00:00Z"),');
html=html.replace('start(params.get("scene") === "title" ? "title" : "game");','start("title");');
await fs.mkdir(output+'/__local',{recursive:true});
await fs.writeFile(output+'/__local/christmas.html',html);
await fs.writeFile(output+'/CHRISTMAS-LOCAL-ONLY.txt','Scenery prototype. Use /__local/christmas.html?lab=1&revision=r15&theme=christmas. Not a release package; inherited review.json describes the unchanged r15 baseline, not this experiment.');
console.log(output);
