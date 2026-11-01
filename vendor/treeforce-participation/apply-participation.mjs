import assert from 'node:assert/strict';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Apply only after the exact pinned paid/HUD overlays have reproduced baseline.
// No score, win/loss, wallet, payment, physics, or continuation rules are changed.
export function applyParticipation(source,projectRoot){
 const file=resolve(source,'app/game/arcade.ts');
 let arcade=readFileSync(file,'utf8');
 const replace=(before,after)=>{
  assert.equal(arcade.split(before).length,2,'Unexpected participation patch boundary');
  arcade=arcade.replace(before,after);
 };
 replace('import * as Phaser from "phaser";',
  'import * as Phaser from "phaser";\nimport {shouldTrackTreeForceStart} from "../participation-client.mjs";');
 replace('this.startWave(startAt);if(this.resumeRun)',`this.startWave(startAt);
  if(shouldTrackTreeForceStart({runId:this.run.runId,serverRunId:this.game.registry.get("serverRunId"),
   wave:startAt,resumed:!!this.resumeRun,homeOnly:this.game.registry.get("homeOnly")===true,
   hasTestEntry:new URLSearchParams(window.location.search).has("wave"),debug:this.debug||this.invincible})){
   const report=this.game.registry.get("onFirstWaveStarted");
   if(typeof report==="function"){try{report(this.run.runId)}catch{/* Progress never stops gameplay. */}}
  }
  if(this.resumeRun)`);
 replace('requestCheckout?:(run:RunState)=>void;resumeRun?:RunState;homeOnly?:boolean',
  'requestCheckout?:(run:RunState)=>void;resumeRun?:RunState;homeOnly?:boolean;onFirstWaveStarted?:(runId:string)=>void');
 replace('if(options?.requestCheckout)game.registry.set("requestCheckout",options.requestCheckout);',
  'if(options?.requestCheckout)game.registry.set("requestCheckout",options.requestCheckout);\n  if(options?.onFirstWaveStarted)game.registry.set("onFirstWaveStarted",options.onFirstWaveStarted);');
 writeFileSync(file,arcade);
 for(const name of ['CanopyGame.tsx','NFTreeGateway.tsx','participation-client.mjs','participation.css'])
  copyFileSync(resolve(projectRoot,'treeforce89/frontend',name),resolve(source,'app',name));
}
