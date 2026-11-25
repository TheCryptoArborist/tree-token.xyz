const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];try{
for(const width of [390,1920]){const states={};for(const art of ['before','after']){const p=await b.newPage({viewport:{width,height:width===390?844:1080},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'&&r.request().method()==='GET'?r.continue():r.abort()});
await p.goto(`http://127.0.0.1:4206/arborwing-review.html?lab=1&revision=r20&art=${art}`);await p.waitForFunction(()=>window.__game?.scene.getScene('game')?.player);await p.evaluate(()=>{const g=__game.scene.getScene('game');g.scene.pause();});await p.waitForTimeout(100);
const measured=await p.evaluate(()=>{const g=__game.scene.getScene('game'),p=g.player,b=p.body;return{renderer:__game.renderer.type,review:!!g.registry.get('seedlingHDReview'),artLayout:g.registry.get('seedlingArtLayout'),geometry:{x:p.x,y:p.y,w:p.width,h:p.height,displayWidth:p.displayWidth,displayHeight:p.displayHeight,originX:p.originX,originY:p.originY,bodyWidth:b.width,bodyHeight:b.height,offsetX:b.offset.x,offsetY:b.offset.y,bodyX:b.x,bodyY:b.y},frames:Array.from({length:5},(_,i)=>{const f=g.textures.getFrame('playerSheet',i);return{w:f.width,h:f.height,rw:f.realWidth,rh:f.realHeight}})}});
assert.equal(measured.renderer,2);assert.equal(measured.review,art==='after');states[art]=measured;
if(art==='after'){const a=measured.artLayout;assert(Math.abs(a.width/a.height-a.source.width/a.source.height)<1e-9);assert(a.width<=36&&a.height<=59);assert(a.x>=45&&a.y>=75);}

const bounds=await p.locator('#practice canvas').boundingBox();const scale=bounds.width/480;const clip={x:bounds.x+175*scale,y:bounds.y+430*scale,width:130*scale,height:145*scale};await p.screenshot({path:`docs/treeforce89-arborwing-review/${art}-${width}.png`,clip});
await p.locator('#practice canvas').screenshot({path:`docs/treeforce89-arborwing-review/game-${art}-${width}.png`});
assert.deepEqual(errors,[]);await p.close();}
assert.deepEqual(states.before.geometry,states.after.geometry);assert.deepEqual(states.before.frames,states.after.frames);results.push({width,...states,geometryUnchanged:true});}
fs.writeFileSync('docs/treeforce89-arborwing-review/checks.json',JSON.stringify(results,null,2));console.log(results);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
