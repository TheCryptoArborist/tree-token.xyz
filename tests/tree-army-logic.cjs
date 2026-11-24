const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const html=fs.readFileSync(require('path').join(__dirname,'../play/tree-army/test/index.html'),'utf8');let script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const drawCalls=[],noop=()=>{},elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,dataset:{},style:{setProperty:noop},getBoundingClientRect:()=>({x:60,y:60,width:80,height:80}),listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)},setAttribute:noop,setPointerCapture:noop,replaceChildren:noop,append:noop,querySelector:()=>element(id+'-small'),getContext:()=>new Proxy({drawImage:(...args)=>drawCalls.push(args),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop}),width:1100,height:470});return elements.get(id)};
const handlers={};const context={console,Math,Set,document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>element(Math.random()),addEventListener:noop},innerWidth:1100,addEventListener:(name,fn)=>{handlers[name]=fn},requestAnimationFrame:noop};context.window=context;script=script.replace('requestAnimationFrame(frame);\n})();',`requestAnimationFrame(frame);window.test={enemyState:()=>enemies[0],enemiesState:()=>enemies,heroWeaponPose,fireHero:(dx,blast=false)=>fire(hero,{x:hero.x+dx,y:hero.y},480,29,blast),shot:()=>shots[shots.length-1],heroState:()=>({...hero}),placeEnemy:x=>{spawn();enemies[0].x=x;enemies[0].y=hero.y;},shotX:()=>shots[0]?.x,heroFoot,heroKnee,articulatedHero,walkFrame,reset,update,draw,sync,summon,upgrade,pause,cannon,shield,startWave,get:()=>({mode,wave,sap,seeds,heroLevel,allies:allies.length,enemies:enemies.length,spawned,planned,grove,heroHp:hero.hp,heroX:hero.x,heroY:hero.y,firstEnemyX:enemies[0]?.x,heroWalk:hero.walk,heroGait:hero.gait,allOnLane:[hero,...allies,...enemies].every(a=>a.y===GROUND),enemyHp:enemies[0]?.hp,enemyY:enemies[0]?.y,heroMoving:hero.moving,allyX:allies[0]?.x,allyWalk:allies[0]?.walk}),set:v=>{if(v.wave)wave=v.wave;if(v.seeds!==undefined)seeds=v.seeds;if(v.grove!==undefined)grove=v.grove;if(v.hp!==undefined)hero.hp=v.hp;if(v.heroY!==undefined)hero.y=v.heroY;if(v.enemyY!==undefined)enemies[0].y=v.enemyY;if(v.heroCd!==undefined)hero.cd=v.heroCd;if(v.enemySpeed!==undefined)enemies[0].speed=v.enemySpeed;if(v.enemyBoss!==undefined){enemies[0].boss=v.enemyBoss;enemies[0].reach=v.enemyBoss?80:38;}if(v.enemyTank!==undefined)enemies[0].tank=v.enemyTank;if(v.enemyHp!==undefined)enemies[0].hp=v.enemyHp;},clear:()=>{spawned=planned;enemies=[];update(.01);},killAll:()=>{for(const e of enemies)hurt(e,99999);},move:v=>held.add(v)};})();`);script=script.replace('loadArt();\nfunction frame', 'art.ready=true;art.images={background:{},army:{},hero:{},walk:{},heroRig:{}};\nfunction frame');vm.runInNewContext(script,context);const t=context.test;
element('next').onclick();assert.equal(t.get().mode,'briefing');assert.equal(element('heading').textContent,'Protect the Tree of Life');element('next').onclick();assert.equal(element('heading').textContent,'Lead from the front');element('next').onclick();assert.equal(element('heading').textContent,'Grow your army');element('next').onclick();assert.equal(t.get().mode,'battle');t.sync();assert.match(element('field-note').textContent,/Hold/);const beforeX=t.get().heroX;handlers.keydown({key:'ArrowRight',target:{closest:()=>null},preventDefault:noop,repeat:false});t.update(.04);handlers.keyup({key:'ArrowRight'});assert(t.get().heroX>beforeX);t.sync();assert.match(element('field-note').textContent,/Summon/);t.reset();handlers.keydown({key:'D',target:{closest:()=>null},preventDefault:noop,repeat:false});t.update(.04);handlers.keyup({key:'D'});const releasedX=t.get().heroX;t.update(.04);assert.equal(t.get().heroX,releasedX,'Uppercase D must stop on release');t.reset();for(let i=0;i<52;i++)t.update(.04);assert(t.get().enemies>0);assert(t.get().firstEnemyX<1180);t.reset();t.summon('oak');assert.equal(t.get().allies,1);assert.equal(t.get().sap,25);t.summon('oak');assert.equal(t.get().allies,1);t.pause();assert.equal(t.get().mode,'paused');t.update(1);assert.equal(t.get().sap,25);t.pause();assert.equal(t.get().mode,'battle');t.clear();assert.equal(t.get().mode,'camp');t.set({seeds:100});t.upgrade('hero');assert.equal(t.get().heroLevel,1);assert.equal(t.get().seeds,60);t.set({wave:10});t.startWave();for(let i=0;i<5000&&t.get().mode==='battle';i++){t.update(.04);t.killAll();}assert.equal(t.get().mode,'won');t.reset();t.set({grove:0});t.update(.01);assert.equal(t.get().mode,'lost');t.reset();t.set({hp:0});t.update(.01);assert.equal(t.get().mode,'lost');t.reset();assert.equal(t.get().allies,0);assert.equal(t.get().heroLevel,0);t.reset();t.placeEnemy(t.get().heroX+30);t.cannon();assert.equal(t.get().enemyHp,77,'Power Shot waits for its cast');t.update(.24);assert.equal(t.get().enemies,0,'Muzzle offset must not skip enemies at point-blank range');t.draw();t.sync();console.log('PASS: three-step briefing, keyboard movement, contextual hints, closer first-wave entrance, summon cost and cooldown, insufficient sap, pause freezes simulation, camp transition, upgrade cost/effect, actual wave-10 spawning and victory, grove/hero defeat, clean restart, render/HUD smoke check. Visual browser/touch checks remain pending.');


const pointer=(id,name,extra={})=>{for(const fn of element(id).listeners[name]||[])fn({pointerId:1,button:0,clientX:100,clientY:100,preventDefault:noop,...extra});};
t.reset();let x=t.get().heroX;
pointer('move-right','pointerdown');t.update(.04);assert(t.get().heroX>x,'Right hold moves hero immediately');assert(t.get().heroWalk>0,'Walk phase follows travel');
pointer('move-right','pointerup');x=t.get().heroX;t.update(.04);assert.equal(t.get().heroX,x,'Lifting finger stops movement');assert.equal(t.get().heroMoving,false);
pointer('move-left','pointerdown');t.update(.04);assert(t.get().heroX<x,'Left hold moves hero');pointer('move-left','pointercancel');x=t.get().heroX;t.update(.04);assert.equal(t.get().heroX,x,'Cancelled touch stops movement');
pointer('move-right','pointerdown');pointer('move-right','lostpointercapture');t.update(.04);assert.equal(t.get().heroX,x,'Lost capture clears movement');
pointer('move-right','pointerdown',{pointerId:1});pointer('move-left','pointerdown',{pointerId:2});t.update(.04);assert.equal(t.get().heroX,x,'Opposing fingers cancel');
pointer('move-left','pointerup',{pointerId:2});t.update(.04);assert(t.get().heroX>x,'Releasing one finger preserves the other');pointer('move-right','pointerup',{pointerId:1});
pointer('move-left','pointerdown');t.pause();const walk=t.get().heroWalk;x=t.get().heroX;t.update(.04);assert.equal(t.get().heroWalk,walk,'Pause freezes phase');t.pause();t.update(.04);assert.equal(t.get().heroX,x,'Pause clears held movement');
pointer('move-right','pointerdown');handlers.blur();t.update(.04);assert.equal(t.get().heroX,x,'Losing focus clears touch');t.pause();t.update(.04);assert.equal(t.get().heroX,x,'Resume must not restore stale input');
pointer('move-right','pointerdown');handlers.resize();t.update(.04);assert.equal(t.get().heroX,x,'Resize clears movement');
t.reset();t.summon('sprout');const ally=t.get();t.update(.04);assert(t.get().allyX>ally.allyX);assert(t.get().allyWalk>ally.allyWalk,'Ally gait advances with travel');
console.log('PASS: left/right hold, release, cancellation, lost capture, opposing inputs, pause/blur/resize cleanup and distance-driven gait.');
assert.equal(t.walkFrame({walk:0}),0);assert.equal(t.walkFrame({walk:Math.PI}),3);assert.equal(t.walkFrame({walk:2*Math.PI}),0);
for(const key of ['w','s','ArrowUp','ArrowDown']){
 t.reset();const start=t.get();handlers.keydown({key,target:{closest:()=>null},preventDefault:noop});t.update(.04);handlers.keyup({key});
 assert.equal(t.get().heroX,start.heroX,'Vertical keys must not move the hero');assert.equal(t.get().heroY,365,'Hero stays on lane');
}
t.reset();t.move('right');for(let i=0;i<400;i++){t.update(.04);t.killAll();assert(t.get().allOnLane,'All combatants share the lane');}handlers.blur();
t.reset();t.placeEnemy(t.get().heroX+120);for(let i=0;i<20;i++)t.update(.02);assert(t.get().enemyHp<77||t.get().enemies===0,'Ordinary auto-fire works on lane without pressing a special');
t.reset();t.placeEnemy(t.get().heroX+30);t.set({heroCd:10});const hp=t.get().heroHp;t.update(.01);assert.equal(t.get().heroHp,hp,'Enemy wind-up does not deal early damage');for(let i=0;i<11;i++)t.update(.04);assert(t.get().heroHp<hp,'Enemy melee deals damage at contact');
console.log('PASS: disabled vertical input, common lane for hero/troops/enemies, ordinary auto-fire and enemy melee.');

t.reset();for(let i=0;i<6000&&t.get().mode==='battle';i++){t.summon('sprout');t.summon('archer');t.summon('oak');t.cannon();t.shield();t.update(.04);}assert.equal(t.get().mode,'camp','A real first wave must be winnable with summons and abilities, without forced kills');console.log('PASS: actual first-wave combat clears with normal summons/abilities.');

// Foot contact is an outcome, not a pose counter: world travel must cancel
// the planted foot's local travel, while the other knee clears the ground.
for(const side of [0,1]){
 const phase=(side?Math.PI:0)+.2;
 const a=t.heroFoot(phase,side,1),b=t.heroFoot(phase+.2,side,1);
 assert(a.planted&&b.planted);assert.equal(a.y,-6);assert.equal(b.y,-6);
 assert(Math.abs(b.x-a.x+112*.2/(2*Math.PI))<1e-9,'Planted boot must not slide across the ground');
 const other=t.heroFoot(phase,1-side,1);assert(!other.planted);assert(other.y<-6,'Swinging foot clears the ground');
}
for(let i=0;i<32;i++){
 const phase=i*Math.PI/16,foot=t.heroFoot(phase,0,1),hip={x:-4,y:-62+Math.cos(phase*2)*1.8},knee=t.heroKnee(hip,foot);
 assert(Math.abs(Math.hypot(knee.x-hip.x,knee.y-hip.y)-32)<1e-8,'Thigh length must remain fixed');
 assert(Math.abs(Math.hypot(knee.x-foot.x,knee.y-foot.y)-34)<1e-8,'Shin length must remain fixed');
 assert.equal(t.heroFoot(phase,0,0).x,-8);assert.equal(t.heroFoot(phase,0,0).y,-6);
}
// Both legs must pass through toe-off, clearance and landing, with no ankle
// snap at contact. At each half-cycle the opposite foot owns the same pose.
for(let i=0;i<64;i++){
 const phase=i*Math.PI/32,a=t.heroFoot(phase,0,1),b=t.heroFoot(phase+Math.PI,1,1);
 assert(Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8,'Both legs perform the complete same stride');
 if(a.planted)assert.equal(a.angle,0,'Planted sole remains flat');
}
for(const phase of [0,Math.PI,Math.PI*2]){
 const a=t.heroFoot(phase-1e-6,0,1),b=t.heroFoot(phase+1e-6,0,1);
 assert(Math.abs(a.x-b.x)<.001&&Math.abs(a.y-b.y)<.001&&Math.abs(a.angle-b.angle)<.001,'No pose pop at contact or toe-off');
}
for(const keys of [['d'],['a'],['ArrowRight'],['ArrowLeft']]){
 t.reset();const before=t.get();for(const key of keys)handlers.keydown({key,target:{closest:()=>null},preventDefault:noop});t.update(.04);for(const key of keys)handlers.keyup({key});
 const after=t.get(),travel=Math.hypot(after.heroX-before.heroX,after.heroY-before.heroY);
 assert(Math.abs(after.heroWalk-travel/112*2*Math.PI)<1e-9,'Every direction drives gait by actual distance');
 assert(after.heroGait>0);t.update(.04);assert(t.get().heroGait<after.heroGait,'Release blends toward a stable stance');
 assert.equal(t.get().heroWalk,after.heroWalk,'Release does not keep stepping');
}
t.reset();t.placeEnemy(t.get().heroX+150);t.move('right');t.update(.04);const firingWalk=t.get().heroWalk;t.update(.04);handlers.blur();assert(t.get().heroWalk>firingWalk,'Movement advances gait while auto-attack is suspended');
console.log('PASS: alternating planted/swinging feet, ground contact, fixed bone lengths, horizontal distance phase, smooth stop and movement priority.');

const actor={walk:1.4,gait:1,cd:0,facing:1,flash:0};drawCalls.length=0;t.articulatedHero(actor,330,365,false);
const feet=drawCalls.filter(a=>a[1]===1296&&a[2]===524).map(a=>a.slice(1));drawCalls.length=0;
t.articulatedHero({...actor,cd:.7},330,365,true);
assert.deepEqual(drawCalls.filter(a=>a[1]===1296&&a[2]===524).map(a=>a.slice(1)),feet,'Shooting must draw the identical leg pose at the same gait phase');

// Clearing the field early must never skip future opening reinforcements.
t.reset();for(let i=0;i<1000;i++){t.update(.04);t.killAll();}
assert.equal(t.get().mode,'battle','Even instant kills cannot finish the opening before final reinforcements');
assert(t.get().spawned<t.get().planned);
const beforePause=t.get().spawned;t.pause();for(let i=0;i<500;i++)t.update(.04);
assert.equal(t.get().spawned,beforePause,'Pause freezes reinforcement schedule');t.pause();
for(let i=0;i<300&&t.get().mode==='battle';i++){t.update(.04);t.killAll();}
assert.equal(t.get().mode,'camp','Clearing all scheduled reinforcements completes the wave');
t.reset();t.update(.04);assert.equal(t.get().spawned,0,'Restart resets the opening schedule');
for(const width of [320,390,844,1100]){
 element('battle').width=width;t.reset();let elapsed=0;
 for(;elapsed<90&&t.get().mode==='battle';elapsed+=.04){t.summon('sprout');t.summon('archer');t.summon('oak');t.cannon();t.shield();t.update(.04);}
 assert.equal(t.get().mode,'camp','Opening remains winnable with normal combat');
 assert(elapsed>=45&&elapsed<=65,`Opening pacing out of range at ${width}px: ${elapsed}`);
 console.log(`PASS: opening wave ${width}px clears in ${elapsed.toFixed(2)} simulated seconds`);
}
t.set({wave:2});t.startWave();assert.equal(t.get().planned,9,'Later-wave enemy budget unchanged');
for(let i=0;i<115;i++)t.update(.04);assert.equal(t.get().spawned,2,'Later-wave spawn cadence unchanged');

// The actual projectile and rendered flash use one weapon anchor in both directions.
for(const direction of [-1,1])for(const blast of [false,true])for(const separation of [15,180]){
 t.reset();t.fireHero(direction*separation,blast);
 const h=t.heroState(),pose=t.heroWeaponPose(h),shot=t.shot();
 assert.equal(shot.x,h.x+direction*pose.muzzleX,'Shot must leave the muzzle, even at point blank');
 assert.equal(shot.y,h.y+pose.muzzleY,'Shot and rendered muzzle share height');
 assert.equal(Math.sign(shot.vx),direction);assert.equal(h.powerFlash,blast);assert(h.fireTime>0);
 t.update(.02);assert.equal(t.shot().y,shot.startY,'Hero rounds do not drop through the hand');
}
t.reset();t.fireHero(150,true);assert.equal(t.heroState().cd,0,'Special flash is independent of basic cooldown');
t.pause();t.update(.04);assert.equal(t.heroState().fireTime,.12,'Pause freezes firing effect');t.pause();
for(let i=0;i<8;i++)t.update(.02);assert.equal(t.heroState().fireTime,0,'Firing effect ends independently');
t.reset();t.placeEnemy(t.get().heroX+150);t.move('left');
for(let i=0;i<8;i++){t.update(.04);assert.equal(t.heroState().facing,-1,'Retreat never flips toward target for a single shot frame');}
handlers.keyup({key:'ArrowLeft'});t.update(.04);assert.equal(t.heroState().facing,1,'Stopping permits aiming at the enemy');assert.equal(t.heroState().action.kind,'shot');
t.reset();assert.equal(t.heroState().fireTime,0,'Restart clears firing presentation');
console.log('PASS: shared muzzle and flash, mirrored and point-blank origins, horizontal hero rounds, separate special flash, retreat facing and reset.');

// Observable combat outcomes, including misses and cancellation at contact.
for(const direction of [-1,1]){
 t.reset();t.placeEnemy(t.get().heroX+direction*50);t.set({heroCd:10,enemySpeed:0});t.update(.01);
 const health=t.get().heroHp;assert(t.enemyState().action,'Enemy enters a visible wind-up');
 t.move(direction===1?'left':'right');for(let i=0;i<12;i++)t.update(.04);
 assert.equal(t.get().heroHp,health,'Retreat before contact dodges the committed attack');
 t.reset();t.placeEnemy(t.get().heroX+direction*50);t.set({enemySpeed:0});t.update(.01);
 assert.equal(t.heroState().action.kind,'punch');assert.equal(t.get().enemyHp,77);
 for(let i=0;i<6;i++)t.update(.04);
 assert.equal(t.get().enemyHp,42,'Punch deals one melee hit at contact');assert.equal(t.shot(),undefined,'Punch emits no projectile');
 for(let i=0;i<5;i++)t.update(.04);assert.equal(t.get().enemyHp,42,'Recovery cannot apply another strike');
}
t.reset();t.placeEnemy(t.get().heroX+180);t.set({enemySpeed:0});t.move('right');for(let i=0;i<8;i++)t.update(.04);
assert.equal(t.get().enemyHp,77,'Walking does not auto-fire');assert.equal(t.heroState().action,null);
handlers.keyup({key:'ArrowRight'});t.update(.01);assert.equal(t.heroState().action.kind,'shot');
t.move('left');for(let i=0;i<8;i++)t.update(.04);assert.equal(t.get().enemyHp,77,'Movement cancels a pending normal shot');
t.reset();t.placeEnemy(t.get().heroX+120);t.update(.01);const attackTime=t.heroState().action.time;t.pause();t.update(1);assert.equal(t.heroState().action.time,attackTime,'Pause freezes wind-up');t.pause();t.reset();assert.equal(t.heroState().action,null,'Restart clears pending strikes');
t.placeEnemy(t.get().heroX+50);t.update(.01);t.killAll();t.update(.24);assert.equal(t.shot(),undefined,'Dead melee target cannot create a phantom shot');
console.log('PASS: bidirectional retreat dodges, delayed punch with no projectile, one strike per action, stop-to-fire, movement cancellation, pause and reset.');

// A weapon purchase is camp-only, charged once and retained through waves.
t.reset();assert.equal(t.heroState().melee,'fist');t.set({seeds:100});t.upgrade('chainsaw');assert.equal(t.heroState().melee,'fist','No mid-battle purchase');assert.equal(t.get().seeds,100);
t.clear();t.set({seeds:79});t.upgrade('chainsaw');assert.equal(t.heroState().melee,'fist','Insufficient seeds leave fist equipped');assert.equal(t.get().seeds,79);
t.set({seeds:80});t.upgrade('chainsaw');assert.equal(t.heroState().melee,'saw');assert.equal(t.get().seeds,0);t.set({seeds:100});t.upgrade('chainsaw');assert.equal(t.get().seeds,100,'An equipped upgrade cannot charge again');t.set({wave:2});t.startWave();assert.equal(t.heroState().melee,'saw','Weapon persists across waves');t.reset();assert.equal(t.heroState().melee,'fist','New run starts with the metal fist');
function equipSaw(){t.reset();t.clear();t.set({seeds:80});t.upgrade('chainsaw');t.set({wave:2});t.startWave();}
for(const direction of [-1,1]){
 equipSaw();const start=t.get().heroX+direction*80;t.placeEnemy(start);t.set({enemyHp:300,enemySpeed:0});t.update(.01);assert.equal(t.heroState().action.kind,'saw','Chainsaw reaches beyond fist range');t.update(.20);assert.equal(t.get().enemyHp,300,'No damage during wind-up');t.pause();const pausedX=t.get().firstEnemyX;t.update(1);assert.equal(t.get().firstEnemyX,pausedX);assert.equal(t.get().enemyHp,300);t.pause();t.update(.10);assert.equal(t.get().enemyHp,242,'Chainsaw contact deals its upgraded damage once');assert.equal(t.shot(),undefined,'Chainsaw is not a projectile');for(let i=0;i<4;i++)t.update(.04);assert.equal(t.get().enemyHp,242,'No repeat damage during recovery');assert(Math.abs(t.get().firstEnemyX-start-direction*42)<1e-6,'Full knockback follows the facing in either direction');
}
// A hit interrupts a committed ordinary attack, not just enemy movement.
t.reset();t.placeEnemy(t.get().heroX+50);t.set({enemySpeed:0,enemyHp:300});t.update(.01);assert(t.enemyState().action);const safeHp=t.get().heroHp;t.update(.22);assert.equal(t.enemyState().action,null,'Punch cancels the pending enemy strike');for(let i=0;i<5;i++)t.update(.04);assert.equal(t.get().heroHp,safeHp,'Cancelled enemy strike cannot deal delayed damage');assert(Math.abs(t.get().firstEnemyX-t.get().heroX-76)<1e-6,'Metal fist pushes 26 pixels');
for(const [flag,factor] of [['enemyTank',.6],['enemyBoss',.2]]){
 equipSaw();t.placeEnemy(t.get().heroX+50);t.set({enemyHp:300,enemySpeed:0,[flag]:true});t.update(.01);t.update(.30);for(let i=0;i<4;i++)t.update(.04);assert(Math.abs(t.get().firstEnemyX-t.get().heroX-50-42*factor)<1e-6,'Heavy enemies resist knockback');if(flag==='enemyBoss')assert(t.get().heroHp<400,'Boss attack continues through the hit');
}
equipSaw();t.placeEnemy(t.get().heroX+50);t.set({enemyHp:300,enemySpeed:0});t.update(.01);t.move('left');for(let i=0;i<10;i++)t.update(.04);assert.equal(t.get().enemyHp,300,'Moving cancels chainsaw wind-up');
equipSaw();t.placeEnemy(t.get().heroX+150);t.set({enemySpeed:0});t.update(.01);assert.equal(t.heroState().action.kind,'shot','Chainsaw does not replace ranged shotgun');
console.log('PASS: metal fist to chainsaw purchase, cost/duplicate guards, wave persistence, fresh-run reset, upgraded reach/damage, timed hit, mirrored knockback, attack interruption, tank/boss resistance and movement cancellation.');
