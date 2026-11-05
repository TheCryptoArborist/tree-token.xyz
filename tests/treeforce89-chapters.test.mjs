import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {transformSync} from 'esbuild';
import * as rules from '../treeforce89/frontend/game/chapter-rules.mjs';
import {WEAPONS} from '../treeforce89/frontend/game/gameplay-rules.mjs';
import {CueMixer,CUES} from '../treeforce89/frontend/game/audio-cues.mjs';
const source=readFileSync(new URL('../treeforce89/frontend/game/arcade.ts',import.meta.url),'utf8');
const config=readFileSync(new URL('../treeforce89/frontend/game/config.ts',import.meta.url),'utf8').replace(/^import .*$/gm,'').replaceAll('export ','');
const {waves,tuning}=new Function('WEAPONS','SHIELD_MS',transformSync(config,{loader:'ts'}).code+';return {waves,tuning}')(WEAPONS,rules.SHIELD_MS);
const cueLog=[];
// Fluent Phaser objects with captured text/data, without copying gameplay implementation.
function object(){const data={},n={active:true,x:0,y:0,destroy(){this.active=false},getData:k=>data[k],setData(k,v){data[k]=v;return proxy},setPosition(x,y){this.x=x;this.y=y;return proxy},setText(t){this.text=t;return proxy}};const proxy=new Proxy(n,{get:(o,k)=>k in o?o[k]:(()=>proxy)});return proxy;}
function group(){let rows=[];return {clear(){rows.forEach(x=>x.destroy());rows=[]},create(x,y){const n=object();n.setPosition(x,y);rows.push(n);return n},getChildren:()=>rows,countActive:()=>rows.filter(x=>x.active).length};}
const Phaser={Scene:class{},Math:{Vector2:class{constructor(x,y){this.x=x;this.y=y}},Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}},Curves:{CubicBezier:class{getPoint(){return {x:240,y:220}}}}};
const names=['Phaser',...Object.keys(rules),'waves','tuning','cue','font','pc','ph','leafBurst','E'];
const values=[Phaser,...Object.values(rules),waves,tuning,n=>cueLog.push(n),()=>({}),{gold:'gold',green:'green',text:'white'},{panel:1,gold:2,green:3,cyan:4},()=>{},{PLAYER_PRUNED:"shield"}];
const gameClass=source.slice(source.indexOf('class GameScene'),source.indexOf('class GameOverScene'));
const GameScene=new Function(...names,transformSync(gameClass,{loader:'ts'}).code+';return GameScene')(...values);
function scene(){const g=Object.create(GameScene.prototype),calls=[],timers=[];Object.assign(g,{run:{score:0,wave:1,kills:0,seed:3},rushDestroyed:0,rushShotsFired:0,rushShotsHit:0,rushTargets:0,stage:1,lives:3,pruneCharge:100,pruneKills:0,invulnUntil:0,player:object(),enemies:group(),shots:group(),bullets:group(),pickups:group(),waveText:object(),turboText:object(),pruneText:object(),time:{now:100,delayedCall(ms,fn){timers.push({ms,fn})}},add:{rectangle:object,text:object,circle:object,container:object},tweens:{add(){},addCounter(){}},events:{emit(){}},cameras:{main:{shake(){},flash(){}}},banner(){},setLesson(){},clearTouchState(){},updateHud(){},updateFireHud(){},applyStage(){},sys:{isActive:()=>true},calls,timers});return g;}
test('the actual campaign routes both bonus types and retains ten combat waves',()=>{
 assert.equal(waves.length,10);assert.deepEqual(Array.from({length:10},(_,i)=>rules.bonusKindAfter(i)),[null,'challenge',null,'windfall',null,'challenge',null,'windfall',null,null]);
 for(let i=0;i<10;i++){const g=scene();g.run.wave=i;for(const key of ['startChallenge','startWindfall','startWave','endRun'])g[key]=n=>g.calls.push([key,n]);g.roundSequence();g.timers.at(-1).fn();assert.equal(g.calls[0][0],i===9?'endRun':rules.bonusKindAfter(i)==='challenge'?'startChallenge':rules.bonusKindAfter(i)==='windfall'?'startWindfall':'startWave');}
 const guardian=waves[5].spawns.filter(s=>s.pattern==='guardian');assert.equal(guardian.length,1);assert(guardian[0].delay>=9000);
});
test('actual challenge launch clears combat and an entirely missed round exits after all 40 targets',()=>{
 const g=scene();g.startChallenge(2);assert.equal(g.challenge.nextWave,2);assert.equal(g.lives,3);assert.equal(g.shots.countActive(),0);assert.equal(g.waveClearing,false);
 for(let t=0;t<28000;t+=250){g.time.now=t;g.updateChallenge(250);}
 assert.equal(g.challenge.spawned,40);assert.equal(g.challenge.escaped,40);assert.equal(g.challenge.finishing,true);assert.equal(g.lives,3);assert.equal(g.enemies.countActive(),0);assert.equal(g.run.score,0);
 const done=g.timers.at(-1);assert.equal(done.ms,3200);g.startWave=n=>g.calls.push(n);done.fn();assert.deepEqual(g.calls,[2]);assert.equal(g.challenge,undefined);
});
test('actual challenge target hits award once, skip combat drops and cannot hurt the pilot',()=>{
 const g=scene();g.startChallenge(6);const e=g.enemies.create(240,200).setData('challengeTarget',true);g.hitEnemy(e,1,false);g.hitEnemy(e,1,false);
 assert.equal(g.rushDestroyed,1);assert.equal(g.run.score,100);assert.equal(g.lives,3);g.damagePlayer();assert.equal(g.lives,3);
 g.enemyFire({active:true});assert.equal(g.bullets.countActive(),0);
});
test('perfect completion rewards all targets regardless of extra missed shots, once only',()=>{
 const g=scene();g.startChallenge(6);g.rushDestroyed=40;g.rushShotsFired=52;g.rushShotsHit=40;g.finishChallenge();g.finishChallenge();assert.equal(g.run.score,10000);assert.equal(cueLog.at(-1),'perfect');
 assert.throws(()=>rules.challengeResult({destroyed:39,escaped:0}));
 for(let i=0;i<40;i++)for(const round of [0,1]){const r=rules.challengeRoute(i,round);assert(r.start.x<0||r.start.x>480);assert(r.end.x<0||r.end.x>480);assert(Math.max(r.start.y,r.c1.y,r.c2.y,r.end.y)<=430);assert(r.duration>=5000);}
});
test('actual shield spends one growth and lasts three seconds, with an expiry cue',()=>{
 const g=scene();g.prune();assert.equal(g.stage,0);assert.equal(g.pruneCharge,0);assert.equal(g.invulnUntil,3100);assert.equal(g.shieldUntil,3100);assert.equal(g.lives,3);
 g.updateShield(3099);assert(g.shieldRing.active);g.updateShield(3100);assert.equal(g.shieldRing,undefined);assert.equal(cueLog.at(-1),'shieldOff');
});
function audio(){const c={currentTime:1,destination:{},oscillators:[],createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}},createOscillator(){const o={frequency:{setValueAtTime(){}},start(){},stop(){this.stopped=true},connect(){},disconnect(){}};c.oscillators.push(o);return o}};return c;}
test('original event motifs differ; priority audio preempts shots and independent SFX mute is honored',()=>{
 assert.equal(new Set(Object.values(CUES).map(c=>JSON.stringify([c.notes,c.type,c.step]))).size,Object.keys(CUES).length);
 const m=new CueMixer(),c=audio();assert(m.shot(c,600));assert(!m.shot(c,600));assert(m.play(c,'perfect'));assert(c.oscillators[0].stopped);assert(!m.shot(c,600));assert(m.duckUntil>c.currentTime);
 m.stop();assert.equal(m.voices.length,0);m.sfxVolume=0;c.currentTime=5;assert(!m.play(c,'seed'));assert(m.musicVolume>0);
});
