const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];fs.mkdirSync('docs/treeforce89-render-review',{recursive:true});
try{for(const width of [390,1920]){const samples={};for(const mode of ['standard','hd']){
const p=await browser.newPage({viewport:{width,height:width===390?844:1080}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'&&r.request().method()==='GET'?r.continue():r.abort());
await p.goto(`http://127.0.0.1:4206/arborwing-review.html?lab=1&revision=r20&art=after&render=${mode}`);await p.waitForFunction(()=>window.__game?.scene.getScene('game')?.player);await p.evaluate(()=>__game.scale.refresh());await p.waitForTimeout(100);
const measure=()=>p.evaluate(()=>{const g=__game,s=g.scene.getScene('game'),c=g.canvas,b=s.player.body;const r=c.getBoundingClientRect();return{buffer:[c.width,c.height],css:[r.width,r.height],scale:[g.scale.gameSize.width,g.scale.gameSize.height,g.scale.baseSize.width,g.scale.baseSize.height],world:[s.physics.world.bounds.width,s.physics.world.bounds.height],camera:[s.cameras.main.width,s.cameras.main.height,s.cameras.main.zoom],hero:[s.player.x,s.player.y,s.player.width,s.player.height,b.width,b.height,b.offset.x,b.offset.y],renderer:[g.renderer.width,g.renderer.height]}});
const initial=await measure();assert.deepEqual(initial.buffer,mode==='hd'&&width>=1000?[960,1440]:[480,720]);samples[mode]=initial;
// Pointer normalization must stay in logical game coordinates despite a larger backbuffer.
const rect=await p.locator('#practice canvas').boundingBox();await p.mouse.move(rect.x+240*rect.width/480,rect.y+300*rect.height/720);
const pointer=await p.evaluate(()=>{const q=__game.input.activePointer;return[q.x,q.y]});assert(Math.abs(pointer[0]-240)<2);assert(Math.abs(pointer[1]-300)<2);
if(width>=1000){const x=initial.hero[0];await p.keyboard.down('ArrowLeft');await p.waitForTimeout(180);await p.keyboard.up('ArrowLeft');assert(await p.evaluate(()=>__game.scene.getScene('game').player.x)<x);await p.evaluate(()=>{const s=__game.scene.getScene('game');s.player.setPosition(240,460);s.player.body.reset(240,460);});}
// Actual Pause and overlay Resume buttons must both hit-test correctly.
const pause=await p.evaluate(()=>{const s=__game.scene.getScene('game');const t=s.children.list.find(o=>typeof o.text==='string'&&o.text.includes('PAUSE'));if(!t)return null;const r=t.getBounds();return{x:r.centerX,y:r.centerY}});assert(pause);
await p.mouse.click(rect.x+pause.x*rect.width/480,rect.y+pause.y*rect.height/720);assert.equal(await p.evaluate(()=>__game.scene.getScene('game').paused),true);
await p.mouse.click(rect.x+240*rect.width/480,rect.y+438*rect.height/720);assert.equal(await p.evaluate(()=>__game.scene.getScene('game').paused),false);
await p.evaluate(()=>__game.scene.getScene('game').scene.pause());await p.waitForTimeout(80);
await p.locator('#practice canvas').screenshot({path:`docs/treeforce89-render-review/${mode}-${width}.png`});
const scale=rect.width/480;await p.screenshot({path:`docs/treeforce89-render-review/hero-${mode}-${width}.png`,clip:{x:rect.x+175*scale,y:rect.y+430*scale,width:130*scale,height:145*scale}});
if(mode==='hd'&&width===1920){await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);assert.deepEqual((await measure()).buffer,[480,720]);await p.setViewportSize({width:1920,height:1080});await p.waitForTimeout(200);assert.deepEqual((await measure()).buffer,[960,1440]);}
assert.deepEqual(errors,[]);await p.close();}
for(const field of ['css','scale','world','camera','hero','renderer'])assert.deepEqual(samples.standard[field],samples.hd[field],field);
results.push({width,samples,logicalGeometryPreserved:true,pointerCoordinates:true,pauseResume:true,keyboard:width>=1000,errors:[]});}
fs.writeFileSync('docs/treeforce89-render-review/checks.json',JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
