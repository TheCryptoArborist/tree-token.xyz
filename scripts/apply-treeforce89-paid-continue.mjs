import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {rebaseTreeForceAssets} from './rebase-treeforce89-assets.mjs';
const root=resolve(import.meta.dirname,'..');
export function applyPaidContinue(source) {
 const pin='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
 const original=path=>execFileSync('git',['show',pin+':'+path],{cwd:source,encoding:'utf8'});
 for(const name of ['NFTreeGateway.tsx','CanopyGame.tsx','ContinuationReview.tsx','ContinuationDialog.tsx','WalletPicker.tsx'])
  copyFileSync(resolve(root,'treeforce89/frontend',name),resolve(source,'app',name));
 mkdirSync(resolve(source,'paid'),{recursive:true});
 for(const name of ['contract.mjs','client.mjs','receipt-discovery.mjs','wallet-options.mjs'])copyFileSync(resolve(root,'treeforce89/paid',name),resolve(source,'paid',name));
 let arcade=original('app/game/arcade.ts');
 const replace=(before,after)=>{assert.equal(arcade.split(before).length,2,'Unexpected game source boundary');arcade=arcade.replace(before,after);};
 replace('interface RunState{','export interface RunState{');
 const home=`
  if(this.game.registry.get("homeOnly")){
   forest(this);this.add.rectangle(240,360,480,720,ph.bg,.52);
   this.add.rectangle(240,360,430,674,ph.bg,.55).setStrokeStyle(2,ph.green,.65);
   this.add.text(240,53,"TREE ARCADE PRESENTS",font(10,pc.gold)).setOrigin(.5).setLetterSpacing(2);
   this.add.text(240,104,"TREE FORCE ’89",font(34,pc.green)).setOrigin(.5).setShadow(4,4,pc.cyan,4);
   this.add.text(240,146,"CANOPY COMMAND",font(18,pc.gold)).setOrigin(.5).setLetterSpacing(2);
   this.add.text(240,180,"GROW. SHIELD. DEFEND THE CANOPY.",font(10,pc.text)).setOrigin(.5);
   [80,155,325,400].forEach((x,i)=>{const enemy=this.add.sprite(x,230+(i%2)*15,"bat").setScale(1.1);
    this.tweens.add({targets:enemy,y:enemy.y-8,duration:700+i*90,yoyo:true,repeat:-1})});
   const hero=this.add.sprite(240,298,"playerSheet",0).setScale(1.18);
   this.tweens.add({targets:hero,y:290,duration:800,yoyo:true,repeat:-1});
   this.add.text(240,385,"ARBORWING READY",font(11,pc.green)).setOrigin(.5);
   this.add.text(240,687,"10 WAVES  ·  FINAL BOSS  ·  1 PLAYER",font(9,pc.muted)).setOrigin(.5);
   // This public home has no start, keyboard, pointer or gamepad handlers.
   // Only a verified NFTree session mounts the playable game.
   return;
  }
 `;
 replace('class TitleScene extends Phaser.Scene{\n constructor(){super("title")}\n create(){',
  'class TitleScene extends Phaser.Scene{\n constructor(){super("title")}\n create(){'+home);

 replace('create(){makeTextures(this);this.scene.start(this.game.registry.get("initialScene")||"title")}',
  'create(){makeTextures(this);const resume=this.game.registry.get("paidContinueResume");if(resume)this.scene.start("game",{resume});else this.scene.start(this.game.registry.get("initialScene")||"title")}');
 replace('// Checkout review is read-only; it cannot request a signature or restore lives.',
  '// Phaser opens checkout with the interrupted run. React requests payment; only a server grant may resume it.');
 replace('"VIEW DETAILS // PAYMENTS DISABLED"','"RESTORE 3 LIVES // SAME WAVE & SCORE"');
 replace('()=>requestCheckout())','()=>requestCheckout({...data.run}))');
 replace('requestCheckout?:()=>void','requestCheckout?:(run:RunState)=>void;resumeRun?:RunState;homeOnly?:boolean');
 replace('if(options?.serverRunId)game.registry.set("serverRunId",options.serverRunId);',
  'if(options?.serverRunId)game.registry.set("serverRunId",options.serverRunId);\n  if(options?.resumeRun)game.registry.set("paidContinueResume",options.resumeRun);\n  if(options?.homeOnly)game.registry.set("homeOnly",true);');
 writeFileSync(resolve(source,'app/game/arcade.ts'),arcade);
 rebaseTreeForceAssets(source);
 // The existing wallet connection, dependencies and contract remain pinned.
 assert.equal(readFileSync(resolve(source,'app/dapp-kit.ts'),'utf8'),original('app/dapp-kit.ts'));
 assert.equal(readFileSync(resolve(source,'package-lock.json'),'utf8'),original('package-lock.json'));
}
