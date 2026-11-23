const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const html=fs.readFileSync(require('path').join(__dirname,'../play/tree-army/test/index.html'),'utf8');let script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const drawCalls=[],noop=()=>{},elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,dataset:{},style:{setProperty:noop},getBoundingClientRect:()=>({x:60,y:60,width:80,height:80}),listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)},setPointerCapture:noop,replaceChildren:noop,append:noop,querySelector:()=>element(id+'-small'),getContext:()=>new Proxy({drawImage:(...args)=>drawCalls.push(args),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop}),width:1100,height:470});return elements.get(id)};
const handlers={};const context={console,Math,Set,document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>element(Math.random()),addEventListener:noop},innerWidth:1100,addEventListener:(name,fn)=>{handlers[name]=fn},requestAnimationFrame:noop};context.window=context;script=script.replace('requestAnimationFrame(frame);\n})();',`requestAnimationFrame(frame);window.test={placeEnemy:x=>{spawn();enemies[0].x=x;enemies[0].y=hero.y;},shotX:()=>shots[0]?.x,heroFoot,heroKnee,articulatedHero,walkFrame,reset,update,draw,sync,summon,upgrade,pause,cannon,shield,startWave,get:()=>({mode,wave,sap,seeds,heroLevel,allies:allies.length,enemies:enemies.length,spawned,planned,grove,heroHp:hero.hp,heroX:hero.x,heroY:hero.y,firstEnemyX:enemies[0]?.x,heroWalk:hero.walk,heroGait:hero.gait,enemyHp:enemies[0]?.hp,enemyY:enemies[0]?.y,heroMoving:hero.moving,allyX:allies[0]?.x,allyWalk:allies[0]?.walk}),set:v=>{if(v.wave)wave=v.wave;if(v.seeds!==undefined)seeds=v.seeds;if(v.grove!==undefined)grove=v.grove;if(v.hp!==undefined)hero.hp=v.hp;if(v.heroY!==undefined)hero.y=v.heroY;if(v.enemyY!==undefined)enemies[0].y=v.enemyY;if(v.heroCd!==undefined)hero.cd=v.heroCd;if(v.enemySpeed!==undefined)enemies[0].speed=v.enemySpeed;},clear:()=>{spawned=planned;enemies=[];update(.01);},killAll:()=>{for(const e of enemies)hurt(e,99999);},move:v=>held.add(v)};})();`);script=script.replace('loadArt();\nfunction frame', 'art.ready=true;art.images={background:{},army:{},hero:{},walk:{},heroRig:{}};\nfunction frame');vm.runInNewContext(script,context);const t=context.test;
element('next').onclick();assert.equal(t.get().mode,'briefing');assert.equal(element('heading').textContent,'Protect the Tree of Life');element('next').onclick();assert.equal(element('heading').textContent,'Lead from the front');element('next').onclick();assert.equal(element('heading').textContent,'Grow your army');element('next').onclick();assert.equal(t.get().mode,'battle');t.sync();assert.match(element('field-note').textContent,/Hold/);const beforeX=t.get().heroX;handlers.keydown({key:'ArrowRight',target:{closest:()=>null},preventDefault:noop,repeat:false});t.update(.04);handlers.keyup({key:'ArrowRight'});assert(t.get().heroX>beforeX);t.sync();assert.match(element('field-note').textContent,/Summon/);t.reset();handlers.keydown({key:'D',target:{closest:()=>null},preventDefault:noop,repeat:false});t.update(.04);handlers.keyup({key:'D'});const releasedX=t.get().heroX;t.update(.04);assert.equal(t.get().heroX,releasedX,'Uppercase D must stop on release');t.reset();for(let i=0;i<52;i++)t.update(.04);assert(t.get().enemies>0);assert(t.get().firstEnemyX<1180);t.reset();t.summon('oak');assert.equal(t.get().allies,1);assert.equal(t.get().sap,25);t.summon('oak');assert.equal(t.get().allies,1);t.pause();assert.equal(t.get().mode,'paused');t.update(1);assert.equal(t.get().sap,25);t.pause();assert.equal(t.get().mode,'battle');t.clear();assert.equal(t.get().mode,'camp');t.set({seeds:100});t.upgrade('hero');assert.equal(t.get().heroLevel,1);assert.equal(t.get().seeds,60);t.set({wave:10});t.startWave();for(let i=0;i<5000&&t.get().mode==='battle';i++){t.update(.04);t.killAll();}assert.equal(t.get().mode,'won');t.reset();t.set({grove:0});t.update(.01);assert.equal(t.get().mode,'lost');t.reset();t.set({hp:0});t.update(.01);assert.equal(t.get().mode,'lost');t.reset();assert.equal(t.get().allies,0);assert.equal(t.get().heroLevel,0);t.reset();t.placeEnemy(t.get().heroX+30);t.cannon();assert(t.shotX()>t.get().heroX,'Cannon starts at the muzzle');t.update(.01);assert.equal(t.get().enemies,0,'Muzzle offset must not skip enemies at point-blank range');t.draw();t.sync();console.log('PASS: three-step briefing, keyboard movement, contextual hints, closer first-wave entrance, summon cost and cooldown, insufficient sap, pause freezes simulation, camp transition, upgrade cost/effect, actual wave-10 spawning and victory, grove/hero defeat, clean restart, render/HUD smoke check. Visual browser/touch checks remain pending.');


const pointer=(id,name,extra={})=>{for(const fn of element(id).listeners[name]||[])fn({pointerId:1,button:0,clientX:100,clientY:100,preventDefault:noop,...extra});};
t.reset();let x=t.get().heroX;
pointer('battle','pointerdown');pointer('battle','pointermove',{clientX:108});t.update(.04);assert.equal(t.get().heroX,x,'Small finger motion stays in dead zone');
pointer('battle','pointermove',{clientX:145});t.update(.04);assert(t.get().heroX>x,'Right drag moves hero');assert(t.get().heroWalk>0,'Walk phase follows travel');
pointer('battle','pointermove',{clientX:60});x=t.get().heroX;t.update(.04);assert(t.get().heroX<x,'Drag can reverse direction');
pointer('battle','pointerup');x=t.get().heroX;t.update(.04);assert.equal(t.get().heroX,x,'Lifting finger stops movement');assert.equal(t.get().heroMoving,false);
pointer('joystick','pointerdown',{clientX:140});t.update(.04);assert(t.get().heroX>x,'Hold button moves');pointer('joystick','pointercancel');x=t.get().heroX;t.update(.04);assert.equal(t.get().heroX,x,'Cancelled touch stops movement');
pointer('joystick','pointerdown',{clientX:60});t.pause();const walk=t.get().heroWalk;t.update(.04);assert.equal(t.get().heroWalk,walk,'Pause freezes walk phase');t.pause();t.update(.04);assert.equal(t.get().heroX,x,'Pause clears held touch');
pointer('joystick','pointerdown',{clientX:140});handlers.blur();t.update(.04);assert.equal(t.get().heroX,x,'Losing focus clears touch');
t.reset();t.summon('sprout');const ally=t.get();t.update(.04);assert(t.get().allyX>ally.allyX);assert(t.get().allyWalk>ally.allyWalk,'Ally gait advances with travel');
console.log('PASS: drag dead zone, direction reversal, release, cancelled touch, pause/focus interruption, distance-driven walk phase.');

assert.equal(t.walkFrame({walk:0}),0);assert.equal(t.walkFrame({walk:Math.PI}),3);assert.equal(t.walkFrame({walk:2*Math.PI}),0);

t.reset();let start=t.get();handlers.keydown({key:'w',target:{closest:()=>null},preventDefault:noop});t.update(.04);handlers.keyup({key:'w'});assert(t.get().heroY<start.heroY,'W moves up');
t.reset();start=t.get();for(const key of ['d','s'])handlers.keydown({key,target:{closest:()=>null},preventDefault:noop});t.update(.04);for(const key of ['d','s'])handlers.keyup({key});assert(Math.abs(Math.hypot(t.get().heroX-start.heroX,t.get().heroY-start.heroY)-185*.04)<.001,'Diagonal speed is normalized');
t.reset();pointer('joystick','pointerdown',{clientX:100,clientY:60});for(let i=0;i<100;i++)t.update(.04);assert.equal(t.get().heroY,290,'Top ground boundary');pointer('joystick','pointerup');
t.reset();pointer('battle','pointerdown');pointer('battle','pointermove',{clientY:140});t.update(.04);assert(t.get().heroY>365,'Vertical touch drag moves down');pointer('battle','pointercancel');const stopped=t.get().heroY;t.update(.04);assert.equal(t.get().heroY,stopped,'Cancel stops vertical movement');
t.reset();t.placeEnemy(t.get().heroX+30);t.set({heroY:390,enemyY:290,heroCd:10});const hp=t.get().heroHp;t.update(.01);assert.equal(t.get().heroHp,hp,'Melee cannot hit across courtyard depth');assert(t.get().enemyY>290,'Enemy pursues target vertically');
t.reset();t.placeEnemy(t.get().heroX+120);t.set({enemyY:300});for(let i=0;i<20;i++)t.update(.02);assert(t.get().enemyHp<77||t.get().enemies===0,'Angled auto-fire hits its target');
console.log('PASS: vertical movement, equal diagonal speed, courtyard bounds, vertical touch cancellation, depth-aware melee and angled auto-fire.');

t.reset();t.placeEnemy(t.get().heroX+150);t.cannon();t.set({enemyY:290,enemySpeed:0,heroCd:10});const untouched=t.get().enemyHp;for(let i=0;i<15;i++)t.update(.04);assert.equal(t.get().enemyHp,untouched,'Projectile must miss a target outside its depth path');
t.reset();pointer('joystick','pointerdown',{clientX:100,clientY:140});for(let i=0;i<50;i++)t.update(.04);pointer('joystick','pointerup');assert.equal(t.get().heroY,390,'Bottom ground boundary');

t.reset();for(let i=0;i<6000&&t.get().mode==='battle';i++){t.summon('sprout');t.summon('archer');t.summon('oak');t.cannon();t.shield();t.update(.04);}assert.equal(t.get().mode,'camp','A real first wave must be winnable with summons and abilities, without forced kills');console.log('PASS: actual first-wave combat clears with normal summons/abilities.');

// Foot contact is an outcome, not a pose counter: world travel must cancel
// the planted foot's local travel, while the other knee clears the ground.
for(const side of [0,1]){
 const phase=(side?Math.PI:0)+.2;
 const a=t.heroFoot(phase,side,1),b=t.heroFoot(phase+.2,side,1);
 assert(a.planted&&b.planted);assert.equal(a.y,-6);assert.equal(b.y,-6);
 assert(Math.abs(b.x-a.x+80*.2/(2*Math.PI))<1e-9,'Planted boot must not slide across the ground');
 const other=t.heroFoot(phase,1-side,1);assert(!other.planted);assert(other.y<-6,'Swinging foot clears the ground');
}
for(let i=0;i<32;i++){
 const phase=i*Math.PI/16,foot=t.heroFoot(phase,0,1),hip={x:-4,y:-66-Math.cos(phase*2)*1.2},knee=t.heroKnee(hip,foot);
 assert(Math.abs(Math.hypot(knee.x-hip.x,knee.y-hip.y)-32)<1e-8,'Thigh length must remain fixed');
 assert(Math.abs(Math.hypot(knee.x-foot.x,knee.y-foot.y)-34)<1e-8,'Shin length must remain fixed');
 assert.equal(t.heroFoot(phase,0,0).x,-8);assert.equal(t.heroFoot(phase,0,0).y,-6);
}
for(const keys of [['d'],['a'],['w'],['s'],['d','w'],['a','s'],['a','w'],['d','s']]){
 t.reset();const before=t.get();for(const key of keys)handlers.keydown({key,target:{closest:()=>null},preventDefault:noop});t.update(.04);for(const key of keys)handlers.keyup({key});
 const after=t.get(),travel=Math.hypot(after.heroX-before.heroX,after.heroY-before.heroY);
 assert(Math.abs(after.heroWalk-travel/80*2*Math.PI)<1e-9,'Every direction drives gait by actual distance');
 assert(after.heroGait>0);t.update(.04);assert(t.get().heroGait<after.heroGait,'Release blends toward a stable stance');
 assert.equal(t.get().heroWalk,after.heroWalk,'Release does not keep stepping');
}
t.reset();t.placeEnemy(t.get().heroX+150);t.move('right');t.update(.04);const firingWalk=t.get().heroWalk;t.update(.04);handlers.blur();assert(t.get().heroWalk>firingWalk,'Auto-fire must not stop locomotion');
console.log('PASS: alternating planted/swinging feet, ground contact, fixed bone lengths, eight-direction distance phase, smooth stop and movement while firing.');

const actor={walk:1.4,gait:1,cd:0,facing:1,flash:0};drawCalls.length=0;t.articulatedHero(actor,330,365,false);
const feet=drawCalls.filter(a=>a[1]===1296&&a[2]===524).map(a=>a.slice(1));drawCalls.length=0;
t.articulatedHero({...actor,cd:.7},330,365,true);
assert.deepEqual(drawCalls.filter(a=>a[1]===1296&&a[2]===524).map(a=>a.slice(1)),feet,'Shooting must draw the identical leg pose at the same gait phase');
