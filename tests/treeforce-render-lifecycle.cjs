const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const out='docs/treeforce89-render-lifecycle';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const reports=[];
try{for(const [width,mode] of [[1920,'standard'],[1920,'hd'],[390,'hd']]){
const page=await browser.newPage({viewport:{width,height:width===390?844:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4206'&&r.request().method()==='GET'?r.continue():r.abort());
await page.goto(`http://127.0.0.1:4206/arborwing-review.html?lab=1&revision=r20&art=after&render=${mode}`);await page.waitForFunction(()=>window.__game?.scene.getScene('game')?.player);
const prepare=()=>page.evaluate(()=>{const s=__game.scene.getScene('game');if(s.paused)s.togglePause();s.update=()=>{};s.physics.world.pause();s.tweens.killAll();s.enemies.clear(true,true);s.player.setPosition(210,460);s.autoFire=false;s.invincible=true;__game.scale.refresh();});await prepare();
const stages=await page.evaluate(()=>{const s=__game.scene.getScene('game'),samples=[];for(let stage=0;stage<5;stage++){s.stage=stage;s.applyStage(false);const p=s.player,f=p.frame; samples.push({stage,frame:f.name,source:f.sourceIndex,size:[p.width,p.height],display:[p.displayWidth,p.displayHeight],body:[p.body.width,p.body.height,p.body.offset.x,p.body.offset.y]});}return samples});
assert.deepEqual(stages.map(x=>x.frame),[0,1,2,3,4]);assert.equal(stages[0].source,1);assert(stages.slice(1).every(x=>x.source===0));
const captures=[];
for(let stage=0;stage<5;stage++){
const captured=await page.evaluate(stage=>{const s=__game.scene.getScene('game');s.rescuedWing?.destroy();s.rescuedWing=undefined;s.grafted=false;s.lives=3;s.stage=stage;s.applyStage(false);s.player.setActive(true).setVisible(true);s.player.body.enable=true;
const e=s.enemies.create(210,160,'borer');Object.assign(e,{homeX:210,homeY:160,kind:'borer',hp:3,formationIndex:0});s.snareEnemy=e;s.capturePlayer(e);s.tweens.killTweensOf(e);return{lives:s.lives,active:s.player.active,visible:s.player.visible,body:s.player.body.enable,frame:s.capturedWing.frame.name,tint:s.capturedWing.isTinted};},stage);
assert.deepEqual(captured,{lives:2,active:false,visible:false,body:false,frame:stage,tint:true});
await page.waitForFunction(()=>__game.scene.getScene('game').player.active);
const rescued=await page.evaluate(()=>{const s=__game.scene.getScene('game'),e=s.snareEnemy;const reserve={stage:s.stage,frame:s.player.frame.name,body:s.player.body.enable};e.setData('rescueWindow',true);const score=s.run.score;s.rescueCapturedWing(e);s.updateCapture(s.time.now);return{reserve,frame:s.rescuedWing.frame.name,grafted:s.grafted,tinted:s.rescuedWing.isTinted,scoreDelta:s.run.score-score,scale:[s.rescuedWing.scaleX,s.player.scaleX],offset:s.rescuedWing.x-s.player.x};});
assert.deepEqual(rescued.reserve,{stage:0,frame:0,body:true});assert.equal(rescued.frame,0);assert.equal(rescued.grafted,true);assert.equal(rescued.tinted,false);assert.equal(rescued.scoreDelta,2500);assert.equal(rescued.scale[0],rescued.scale[1]);assert.equal(Math.abs(rescued.offset),54);
if(stage===0)await page.locator('#practice canvas').screenshot({path:`${out}/rescued-${width}-${mode}.png`});
const transitions=await page.evaluate(()=>{const s=__game.scene.getScene('game'),frames=[];for(let i=0;i<4;i++){s.grow();frames.push([s.stage,s.player.frame.name,s.rescuedWing.frame.name]);}s.grafted=false;s.rescuedWing.destroy();s.rescuedWing=undefined;s.invincible=false;s.challenge=false;s.windfall=false;s.waveClearing=false;const damage=[];for(let i=0;i<4;i++){s.invulnUntil=0;s.damagePlayer();damage.push([s.stage,s.player.frame.name]);}s.invincible=true;return{frames,damage}});
assert.deepEqual(transitions.frames,[[1,1,1],[2,2,2],[3,3,3],[4,4,4]]);assert.deepEqual(transitions.damage,[[3,3],[2,2],[1,1],[0,0]]);captures.push({stage,captured,rescued,transitions});
}
const before=await page.evaluate(()=>{const s=__game.scene.getScene('game');window.oldPlayer=s.player;return __game.textures.get('playerSheet').source.length});
await page.evaluate(()=>__game.scene.getScene('game').scene.restart());await page.waitForFunction(()=>__game.scene.getScene('game').player!==window.oldPlayer);await prepare();
const restart=await page.evaluate(()=>{const s=__game.scene.getScene('game');return{stage:s.stage,lives:s.lives,frame:s.player.frame.name,sources:__game.textures.get('playerSheet').source.length,buffer:[__game.canvas.width,__game.canvas.height]}});assert.equal(restart.stage,0);assert.equal(restart.lives,3);assert.equal(restart.frame,0);assert.equal(restart.sources,before);assert.deepEqual(restart.buffer,width===1920&&mode==='hd'?[960,1440]:[480,720]);
assert.deepEqual(errors,[]);reports.push({width,mode,stages,captures,restart,errors});console.log(`Passed lifecycle ${width} ${mode}`);await page.close();}
assert.deepEqual(reports[0].stages,reports[1].stages);assert.deepEqual(reports[0].captures,reports[1].captures);
fs.writeFileSync(`${out}/checks.json`,JSON.stringify(reports,null,2));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
