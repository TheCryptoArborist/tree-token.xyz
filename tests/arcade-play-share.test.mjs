import test from 'node:test';
import assert from 'node:assert/strict';
import {completedResultGames} from '../scripts/arcade-social-play-share.js';
import {resultMessages,shareGames} from '../scripts/arcade-result-share-builder.js';
const today='2026-11-11';
const evidence={sessionActive:true,stale:false,busy:false,progress:{dateKey:today,today:{gameIds:['treeforce89','garden-bot']}}};
test('only a completed saved result unlocks sharing; first-wave participation does not',()=>{
 assert.deepEqual(completedResultGames(evidence,today).map(g=>g.id),['garden-bot']);
 assert.deepEqual(completedResultGames({...evidence,progress:{dateKey:today,today:{gameIds:['treeforce89']}}},today),[]);
});
test('signed-out, stale, loading and previous-day results stay locked',()=>{
 for(const change of [{sessionActive:false},{stale:true},{busy:true}])assert.deepEqual(completedResultGames({...evidence,...change},today),[]);
 assert.deepEqual(completedResultGames(evidence,'2026-11-12'),[]);
 assert.deepEqual(completedResultGames(null,today),[]);
});
test('result messages name the finished game, fit X, and contain no fabricated scores',()=>{
 for(const game of shareGames.filter(g=>g.id!=='treeforce89')){
 const messages=resultMessages(game);assert.equal(new Set(messages).size,3);
 for(const message of messages){assert.ok(message.includes(game.name));assert.ok(message.includes('https://tree-token.xyz/play/'));assert.ok(message.length<=280);assert.doesNotMatch(message,/scored|winner|verified/i);}
 }
});
