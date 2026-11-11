import test from 'node:test';
import assert from 'node:assert/strict';
import {completedResultGames} from '../scripts/arcade-social-play-share.js';
import {resultMessages,shareGames} from '../scripts/arcade-result-share-builder.js';
const today='2026-11-11';
const evidence={sessionActive:true,stale:false,loading:false,dateKey:today,runs:[{gameId:'garden-bot'}]};
test('only a completed saved result unlocks sharing; first-wave participation does not',()=>{
 assert.deepEqual(completedResultGames(evidence,today).map(g=>g.id),['garden-bot']);
 assert.deepEqual(completedResultGames({sessionActive:true,stale:false,progress:{dateKey:today,today:{gameIds:['treeforce89']}}},today),[]);
});
test('signed-out, stale, loading and previous-day results stay locked',()=>{
 for(const change of [{sessionActive:false},{stale:true},{loading:true}])assert.deepEqual(completedResultGames({...evidence,...change},today),[]);
 assert.deepEqual(completedResultGames(evidence,'2026-11-12'),[]);
 assert.deepEqual(completedResultGames(null,today),[]);
});
test('result messages name the finished game, fit X, and contain no fabricated scores',()=>{
 for(const game of shareGames.filter(g=>g.id!=='treeforce89')){
 const messages=resultMessages(game);assert.equal(new Set(messages).size,3);
 for(const message of messages){assert.ok(message.includes(game.name));assert.ok(message.includes('https://tree-token.xyz/play/'));assert.ok(message.length<=280);assert.doesNotMatch(message,/scored|winner|verified/i);}
 }
});

import {completedQuestConfiguration} from '../scripts/arcade-daily-growth-play-share.js';
test('the first quest includes all four working games with completion rules',()=>{
 const treeforce={id:'treeforce89',creditRule:'start-run'},garden={id:'garden-bot',creditRule:'complete-result'};
 const result=completedQuestConfiguration({enabledGames:[treeforce,garden],eligibleGames:[treeforce,garden],todayPick:treeforce});
 assert.deepEqual(result.eligibleGames.map(g=>g.id),['treeforce89','canopy-breaker','garden-bot','pvp']);assert.equal(result.todayPick.id,'treeforce89');assert.ok(result.eligibleGames.every(g=>g.creditRule==='complete-result'));
 assert.deepEqual(result.enabledGames,[treeforce,garden]);
});
