import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {rebaseTreeForceAssets} from './rebase-treeforce89-assets.mjs';
const root=resolve(import.meta.dirname,'..');
export function applyPaidContinue(source) {
 const pin='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
 const original=path=>execFileSync('git',['show',pin+':'+path],{cwd:source,encoding:'utf8'});
 for(const name of ['NFTreeGateway.tsx','CanopyGame.tsx','ContinuationReview.tsx','ContinuationDialog.tsx'])
  copyFileSync(resolve(root,'treeforce89/frontend',name),resolve(source,'app',name));
 mkdirSync(resolve(source,'paid'),{recursive:true});
 for(const name of ['contract.mjs','client.mjs','receipt-discovery.mjs'])copyFileSync(resolve(root,'treeforce89/paid',name),resolve(source,'paid',name));
 let arcade=original('app/game/arcade.ts');
 const replace=(before,after)=>{assert.equal(arcade.split(before).length,2,'Unexpected game source boundary');arcade=arcade.replace(before,after);};
 replace('interface RunState{','export interface RunState{');
 replace('create(){makeTextures(this);this.scene.start(this.game.registry.get("initialScene")||"title")}',
  'create(){makeTextures(this);const resume=this.game.registry.get("paidContinueResume");if(resume)this.scene.start("game",{resume});else this.scene.start(this.game.registry.get("initialScene")||"title")}');
 replace('// Checkout review is read-only; it cannot request a signature or restore lives.',
  '// Phaser opens checkout with the interrupted run. React requests payment; only a server grant may resume it.');
 replace('"VIEW DETAILS // PAYMENTS DISABLED"','"RESTORE 3 LIVES // SAME WAVE & SCORE"');
 replace('()=>requestCheckout())','()=>requestCheckout({...data.run}))');
 replace('requestCheckout?:()=>void','requestCheckout?:(run:RunState)=>void;resumeRun?:RunState');
 replace('if(options?.serverRunId)game.registry.set("serverRunId",options.serverRunId);',
  'if(options?.serverRunId)game.registry.set("serverRunId",options.serverRunId);\n  if(options?.resumeRun)game.registry.set("paidContinueResume",options.resumeRun);');
 writeFileSync(resolve(source,'app/game/arcade.ts'),arcade);
 rebaseTreeForceAssets(source);
 // The existing wallet connection, dependencies and contract remain pinned.
 assert.equal(readFileSync(resolve(source,'app/dapp-kit.ts'),'utf8'),original('app/dapp-kit.ts'));
 assert.equal(readFileSync(resolve(source,'package-lock.json'),'utf8'),original('package-lock.json'));
}
