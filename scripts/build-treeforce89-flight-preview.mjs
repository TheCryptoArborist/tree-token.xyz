// Isolated Deploy Preview only; does not publish or rebuild production handlers.
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,cpSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {stagePinnedFrontend} from './lib/treeforce89-pinned-frontend.mjs';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'.netlify/treeforce89-flight-source');
assert.equal(process.env.CONTEXT,'deploy-preview');
assert.equal(process.env.HEAD||process.env.BRANCH,'feature/treeforce89-galaga-gameplay');
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
// Netlify bundles the existing preview gateway after this command. Its pinned
// SDK lives in a separate package and is not installed by the root npm ci.
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],resolve(root,'netlify/preview-lib/treeforce89-source'));
await stagePinnedFrontend(source);
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
await import('./prepare-treeforce89-flight-lab.mjs');
const stage=resolve(root,'.netlify/treeforce89-flight-lab/play/treeforce89');
const output=resolve(root,'dist-preview/play/treeforce89/flight-lab');
mkdirSync(output,{recursive:true});cpSync(stage,output,{recursive:true});
copyFileSync(resolve(root,'treeforce89/review/index.html'),resolve(output,'review.html'));
await build({entryPoints:[resolve(source,'app/game/arcade.ts')],outfile:resolve(output,'review-engine.js'),bundle:true,format:'esm',minify:true,
 define:{'import.meta.env.BASE_URL':'"/play/treeforce89/flight-lab/"'}});
console.log('Prepared isolated TREE FORCE gameplay lab at /play/treeforce89/flight-lab/review.html. No production mutation.');
