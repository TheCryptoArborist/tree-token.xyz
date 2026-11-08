import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,step,collect,layout,restartGame} from '../src/engine.js';
test('30 screens are bounded, distinct within each forest and progressively armored',()=>{for(let n=1;n<=30;n++){const b=layout(n);assert(b.length>20&&b.length<=88);assert(b.every(b=>b.x>=20&&b.x+b.w<=780&&b.y>90&&b.y+b.h<550));}assert.equal(new Set(Array.from({length:6},(_,i)=>JSON.stringify(layout(i+1).map(b=>[b.x,b.y,b.kind])))).size,6);assert(layout(30).some(b=>b.hp===3));assert.equal(layout(1).length,56);assert.equal(layout(24).length,81);});
test('fixed-step simulation and seeded drops replay identically',()=>{const a=createGame(123),b=createGame(123);for(let n=0;n<12000;n++){const input={x:400+300*Math.sin(n/60),launch:true,fire:true};step(a,input);step(b,input);}assert.deepEqual(a,b);});
test('paddle collision changes aim and reflected ball travels upward',()=>{const s=createGame();s.status='playing';s.balls=[{primary:true,x:440,y:809,vx:0,vy:400}];step(s,{x:400});assert(s.balls[0].vy<0);assert(s.balls[0].vx>0);});
test('the original seed controls lives even while bonus seeds survive',()=>{const s=createGame();s.status='playing';s.balls=[{primary:true,x:700,y:920,vx:1,vy:400},{primary:false,x:400,y:400,vx:1,vy:400}];step(s,{x:40});assert.equal(s.lives,2);assert.equal(s.status,'ready');assert.equal(s.balls.length,1);});
test('three losses stop the game; launch, new inputs and pickups do not create free lives',()=>{const s=createGame();for(let n=0;n<3;n++){s.status='playing';s.balls[0]={primary:true,x:700,y:920,vx:1,vy:400};step(s,{x:40});}assert.equal(s.status,'gameover');assert.equal(s.lives,0);const before=JSON.stringify(s);for(let i=0;i<300;i++)step(s,{launch:true,x:400});assert.equal(JSON.stringify(s),before);assert.throws(()=>restartGame(createGame()));assert.equal(restartGame(s).lives,3);});
test('paid continue preserves a later grove, remaining brick damage and score with three fresh lives',()=>{
 const defeated=createGame(123),bricks=layout(17).slice(6);bricks.find(brick=>brick.hp>1).hp=1;
 Object.assign(defeated,{status:'gameover',lives:0,score:9876,level:17,bricks,levelTicks:321,tick:12345,combo:8,fireAt:12360,effects:{hot:60},pickups:[{type:'wide',x:100,y:400}],shots:[{x:300,y:250}],hazards:[{x:500,y:150}],newGameFrom:'old-defeat',extraInternal:'do not inherit'});
 const snapshot=structuredClone(defeated),next=restartGame(defeated,456);
 assert.equal(next.score,9876);assert.equal(next.carriedScore,9876);assert.equal(next.scoreCarryVersion,1);
 assert.equal(next.level,17);assert.equal(next.lives,3);assert.equal(next.levelTicks,321);assert.equal(next.tick,0);assert.equal(next.rng,456);
 assert.deepEqual(next.bricks,bricks);assert.notEqual(next.bricks,bricks);assert.notEqual(next.bricks[0],bricks[0]);assert.equal(next.boss,null);
 assert.equal(next.combo,0);assert.equal(next.fireAt,0);assert.deepEqual(next.effects,{});assert.deepEqual(next.pickups,[]);assert.deepEqual(next.shots,[]);assert.deepEqual(next.hazards,[]);
 assert.equal(next.status,'ready');assert.deepEqual(next.balls,[{x:400,y:806,vx:0,vy:0,primary:true,attached:true}]);
 assert.equal(Object.hasOwn(next,'newGameFrom'),false);assert.equal(Object.hasOwn(next,'extraInternal'),false);
 assert.deepEqual(defeated,snapshot);next.bricks[0].hp=0;assert.deepEqual(defeated,snapshot);
});
test('paid continue preserves final boss damage, firing countdown and movement phase through the next launch',()=>{
 const defeated=createGame(42),phase=987,boss={x:400+Math.sin(phase/95)*230,y:230,hp:7,maxHp:45,fire:23};
 Object.assign(defeated,{status:'gameover',lives:0,level:30,score:45000,bricks:[],boss,levelTicks:phase,balls:[]});
 const snapshot=structuredClone(defeated),next=restartGame(defeated,43);
 assert.equal(next.level,30);assert.equal(next.score,45000);assert.equal(next.lives,3);assert.deepEqual(next.bricks,[]);assert.deepEqual(next.boss,boss);assert.notEqual(next.boss,boss);
 for(let i=0;i<60;i++)step(next,{x:400});
 assert.equal(next.status,'ready');assert.equal(next.levelTicks,phase);assert.deepEqual(next.boss,boss);
 step(next,{x:400,launch:true});assert.equal(next.status,'playing');assert.equal(next.balls[0].attached,false);assert.equal(next.levelTicks,phase);assert.deepEqual(next.boss,boss);
 step(next,{x:400});assert.equal(next.levelTicks,phase+1);assert.equal(next.boss.hp,7);assert.equal(next.boss.fire,22);assert.equal(next.boss.x,400+Math.sin((phase+1)/95)*230);
 assert.deepEqual(defeated,snapshot);next.boss.hp=1;assert.deepEqual(defeated,snapshot);
});
test('paid continue keeps grove one progress while a free new game starts a full grove one at zero',()=>{
 const defeated=createGame(1);Object.assign(defeated,{status:'gameover',lives:0,score:1600,bricks:defeated.bricks.slice(10),levelTicks:780,balls:[]});
 const next=restartGame(defeated,2);assert.equal(next.level,1);assert.equal(next.score,1600);assert.equal(next.lives,3);assert.equal(next.levelTicks,780);assert.deepEqual(next.bricks,defeated.bricks);
 const fresh=createGame(2);assert.equal(fresh.level,1);assert.equal(fresh.score,0);assert.equal(fresh.carriedScore,0);assert.equal(fresh.levelTicks,0);assert.deepEqual(fresh.bricks,layout(1));
});
test('restart refuses live runs, invalid saved scores and unknown groves',()=>{
 const defeated=createGame();Object.assign(defeated,{status:'gameover',lives:0});
 for(const score of [-1,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>restartGame({...defeated,score}),/Saved score is invalid/);
 for(const level of [0,-1,31,1.5,Infinity,NaN,'17',undefined])assert.throws(()=>restartGame({...defeated,level}),/Saved forest screen is invalid/);
 assert.throws(()=>restartGame({...defeated,lives:1}),/all lives/);assert.equal(createGame().score,0);assert.equal(createGame().carriedScore,0);
});
test('each of eight original pickup roles has a working themed counterpart',()=>{const s=createGame();step(s,{launch:true});for(const type of ['wide','tether','hot','laser','fast','slow','wild']){collect(s,type);assert(s.effects[type]>0);}collect(s,'multi');assert.equal(s.balls.length,4);const old=s.shots.length;step(s,{fire:true});assert(s.shots.length>old);});
test('last screen spawns the final boss and only a boss defeat finishes the campaign',()=>{const s=createGame();s.level=30;s.status='playing';s.bricks=[];step(s,{x:400});assert(s.boss);assert.equal(s.status,'playing');s.boss.hp=0;step(s,{x:400});assert.equal(s.status,'won');});
test('cleared stages wait for a launch command and carry remaining lives forward',()=>{const s=createGame();s.status='playing';s.bricks=[];s.lives=2;step(s,{x:400});assert.equal(s.status,'cleared');for(let i=0;i<60;i++)step(s,{});assert.equal(s.level,1);step(s,{launch:true});assert.equal(s.level,2);assert.equal(s.lives,2);});
