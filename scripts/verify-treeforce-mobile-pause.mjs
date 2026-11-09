import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=process.argv[2];assert(file,'Pass the generated arcade module path');
const code=fs.readFileSync(file,'utf8');const start=code.indexOf('togglePause(guide=false){');const end=code.indexOf('makeDebug(){',start);assert(start>=0&&end>start,'Mobile pause method not found');const method=code.slice(start,end);
const scene={paused:false,physics:{world:{isPaused:false}},time:{paused:false},nodes:[],containers:[],clearCount:0,pauseCount:0,resumeCount:0,clearTouchState(){this.clearCount++}};
const node=(kind,args)=>{const n={kind,args,handlers:{},destroyed:false};for(const k of ['setFontSize','setWordWrapWidth','setBackgroundColor','setPadding','setName','setDisplaySize','setInteractive','setStrokeStyle','setOrigin','setAlign','setLineSpacing','setDepth','setVisible','setText'])n[k]=()=>n;n.on=(event,fn)=>{n.handlers[event]=fn;return n};n.destroy=()=>{n.destroyed=true};scene.nodes.push(n);return n};
scene.add={circle:(...a)=>node('circle',a),image:(...a)=>node('image',a),rectangle:(...a)=>node('rectangle',a),text:(...a)=>node('text',a),container:(...a)=>{let c=node('container',a);scene.containers.push(c);return c}};
scene.tweens={pauseAll:()=>scene.pauseCount++,resumeAll:()=>scene.resumeCount++,killTweensOf:()=>{}};scene.notice=node('notice',[]);scene.pauseButtonText=node('pause-label',[]);
scene.togglePause=new Function('L','I','R','localStorage','return ({'+method+'}).togglePause')({bg:0,panel:1,green:2,gold:3,bgSoft:4},{gold:1,text:2,green:3},()=>({}),{setItem(){}});
scene.togglePause(true);assert(scene.paused&&scene.physics.world.isPaused&&scene.time.paused);assert(scene.nodes.some(n=>n.kind==='text'&&n.args[2]==='SHOOT · DODGE · COLLECT'));assert(scene.nodes.some(n=>n.kind==='text'&&n.args[2].includes('SHIELD: GROW + FULL CHARGE')));assert.deepEqual(scene.nodes.filter(n=>n.kind==='image').map(n=>n.args[2]),['bat','borer','blightDart','barkDrill','windfallLimb','growthSeed','weaponCore','victoryTurbo','boomLogo']);
scene.nodes.find(n=>n.kind==='rectangle'&&n.args[1]===550).handlers.pointerdown();assert(!scene.paused&&!scene.physics.world.isPaused&&!scene.time.paused);
scene.nodes=[];scene.togglePause();const helpText=scene.nodes.find(n=>n.kind==='text'&&n.args[2]==='HOW TO PLAY');assert(helpText);const help=scene.nodes.find(n=>n.kind==='rectangle'&&n.args[1]===506);assert(help?.handlers.pointerdown);const resumes=scene.resumeCount;help.handlers.pointerdown();assert(scene.paused&&scene.physics.world.isPaused&&scene.time.paused);assert.equal(scene.resumeCount,resumes,'Opening help must not resume gameplay');assert.equal(scene.containers.filter(c=>!c.destroyed).length,1,'Duplicate overlays');
const resume=scene.nodes.findLast(n=>n.kind==='rectangle'&&n.args[1]===550);resume.handlers.pointerdown();assert(!scene.paused&&!scene.physics.world.isPaused&&!scene.time.paused);assert.equal(scene.containers.filter(c=>!c.destroyed).length,0);assert.equal(scene.clearCount,5);
console.log('Passed: tutorial start, pause, help replay without resuming timers, single overlay, resume, cleared touch state.');

// Exercise the actual emitted HUD method to prevent stat/control overlap.
scene.nodes=[];scene.makeDebug=()=>{};scene.updateHud=()=>{};scene.updateAutoHud=()=>{};
const hudStart=code.indexOf('makeHud(){');const hudEnd=code.indexOf('bindInput(){',hudStart);assert(hudStart>=0&&hudEnd>hudStart);
const hud=new Function('L','I','R','return ({'+code.slice(hudStart,hudEnd)+'}).makeHud')({bg:0,panel:1,green:2,gold:3,bgSoft:4},{gold:1,text:2,green:3},()=>({}));hud.call(scene);
const controls=[scene.autoButtonBg,scene.pruneButtonBg,scene.fireButtonBg];
for(let i=0;i<controls.length;i++){const[x,y,w,h]=controls[i].args;assert(w>=120&&h>=60,'Action target too small');assert(y+h/2<=720,'Control outside canvas');assert(scene.powerText.args[1]+14<y-h/2,'Weapon readout overlaps controls');assert(scene.stageText.args[1]+14<y-h/2,'Growth readout overlaps controls');if(i){const[px,,pw]=controls[i-1].args;assert(px+pw/2<x-w/2,'Adjacent action targets overlap')}}
assert(scene.nodes.some(n=>n.kind==='circle'&&n.args[0]===126&&n.args[1]===54),'Help control must stay out of action row');
console.log('Passed: separated stat rows, non-overlapping action targets, in-canvas controls and relocated help.');
