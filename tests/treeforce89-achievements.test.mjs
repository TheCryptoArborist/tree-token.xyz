import {test} from 'node:test';import assert from 'node:assert/strict';
import {BADGES,earnedBadges,validateRun,validateUsername} from '../treeforce89/achievements/rules.mjs';
import {checkoutSnapshot,restoreProgress} from '../treeforce89/achievements/progress.mjs';
import {validateSnapshot} from '../treeforce89/paid/contract.mjs';
const run={runId:'grove-'+'a'.repeat(32),seed:1,start:1,mode:'ARCADE',score:50000,kills:150,wave:9,shotsFired:1000,shotsHit:900,maxStage:4,perfect:1,maxChain:25,clearedWaves:10,cleanWaves:1,turboPickups:1,boomPickups:1,ranked:true,cleared:true};
test('13 distinct achievements have reachable thresholds',()=>{assert.equal(BADGES.length,13);assert.equal(new Set(BADGES.map(b=>b[0])).size,13);assert.equal(earnedBadges(validateRun(run)).length,13);assert.equal(earnedBadges({}).length,0);});
test('practice and malformed statistics cannot rank',()=>{for(const patch of [{ranked:false},{score:-1},{score:NaN},{shotsHit:2000},{maxChain:151}])assert.throws(()=>validateRun({...run,...patch}));});
test('pilot names are bounded plain text',()=>{assert.equal(validateUsername(' The Arborist '),'The Arborist');for(const value of ['a','<script>','a'.repeat(21),'🔥🔥🔥'])assert.throws(()=>validateUsername(value));});
test('continue contract stays exact and achievements survive authorized resume',()=>{const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)};const snapshot=checkoutSnapshot(run,storage);assert.equal(Object.keys(snapshot).length,11);validateSnapshot(snapshot,run.runId);const restored=restoreProgress(snapshot,storage);assert.equal(restored.maxChain,25);assert.equal(restored.ranked,true);assert.equal(restored.boomPickups,1);assert.equal(restoreProgress(snapshot,{getItem:()=>null}).ranked,false);});
