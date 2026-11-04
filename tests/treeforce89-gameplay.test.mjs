import test from 'node:test';import assert from 'node:assert/strict';
import {WEAPONS,collectCore,corePity,divePlan,selectAttack,BONUS,hasBonusAfter,bonusRow,bonusAward} from '../treeforce89/frontend/game/gameplay-rules.mjs';
test('collected cores advance all five weapon profiles without skipping tiers',()=>{
 let state={level:0,charge:0};const levels=[];
 for(let i=0;i<7;i++){state=collectCore(state.level,state.charge);levels.push(state.level);}
 assert.deepEqual(levels,[1,1,2,2,3,3,4]);assert.equal(state.charge,0);
 assert.deepEqual(collectCore(4,0),{level:4,charge:0,upgraded:false,score:500});
 assert.throws(()=>collectCore(1,2));assert.equal(corePity(0),6);
 assert(WEAPONS[1].fireMs<WEAPONS[0].fireMs);assert.equal(WEAPONS[4].shots,3);
 for(const w of WEAPONS)assert(w.activeCap>=w.shots&&w.activeCap<=6);
});
test('tutorial stays predictable; later attacks include distinct curves and a dodge warning',()=>{
 for(let serial=0;serial<6;serial++)assert.equal(selectAttack({wave:0,kind:'bat',serial}),'swoop');
 assert.deepEqual([0,1,2].map(serial=>selectAttack({wave:4,kind:'bat',serial})),['swoop','hook','crossfire']);
 assert.equal(selectAttack({wave:4,kind:'borer'}),'charge');
 const options={wave:5,kind:'bat',x:65,y:120,playerX:240};
 const paths=[0,1,2].map(serial=>divePlan({...options,serial}));
 assert.equal(new Set(paths.map(p=>JSON.stringify([p.c1,p.c2]))).size,3);
 for(const p of paths){assert(p.warningMs>=450);assert(p.duration>=1250);assert.equal(p.end.x,240);}
 assert.equal(divePlan({...options,playerX:-100}).end.x,36);
 assert.equal(divePlan({...options,playerX:1000}).end.x,444);
});
test('bonus occurs between waves four/five and eight/nine, never after the final boss',()=>{
 assert.deepEqual(Array.from({length:10},(_,i)=>i).filter(hasBonusAfter),[3,7]);
 assert(BONUS.firstRow+(BONUS.rows-1)*BONUS.rowInterval+(635-80)/BONUS.fallSpeed*1000<BONUS.duration);
 for(let seed=0;seed<5;seed++)for(let i=0;i<BONUS.rows;i++){
  const row=bonusRow(i,seed);assert.equal(row.hazards.length,3);assert.equal(row.safeLanes.length,2);
  assert(!row.hazards.includes(row.seedX));assert.deepEqual(row,bonusRow(i,seed));
 }
});
test('bonus rewards are score and one earned core; no extra lives or token entitlement',()=>{
 assert.deepEqual(bonusAward({bumps:0,collected:16}),{score:3000,core:1,collectedScore:1600});
 assert.deepEqual(bonusAward({bumps:2,collected:3}),{score:500,core:0,collectedScore:300});
 assert.throws(()=>bonusAward({bumps:0,collected:17}));
});
