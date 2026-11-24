import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const {JSDOM}=await import(process.env.ARCADE_TEST_JSDOM||'/tmp/arcade-test/node_modules/jsdom/lib/api.js');
import {createCompletedRunTracking,validateRuns} from '../scripts/arcade-completed-run-tracking.js';
import {resultMessages,shareGames} from '../scripts/arcade-result-share-builder.js';
const now=Date.parse('2026-11-11T12:00:00Z'),wallet='0x'+'a'.repeat(64),other='0x'+'b'.repeat(64),dateKey='2026-11-11';
const run={id:'e'.repeat(64),gameId:'canopy-breaker',completedAt:'2026-11-11T11:59:00.000Z',score:18500,stage:2,outcome:'gameover'};
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
test('client rejects another wallet, stale UTC days, duplicate receipts and malformed scores',()=>{
 assert.equal(validateRuns({wallet,dateKey,runs:[run]},wallet,now).runs[0].score,18500);
 for(const value of [{wallet:other,dateKey,runs:[run]},{wallet,dateKey:'2026-11-10',runs:[run]},{wallet,dateKey,runs:[run,run]},{wallet,dateKey,runs:[{...run,score:-1}]}])assert.throws(()=>validateRuns(value,wallet,now));
});
test('switching wallets discards an in-flight prior wallet result',async()=>{
 const dom=new JSDOM(fs.readFileSync('production/arcade-play-share-static/index.html','utf8'),{url:'https://tree-token.xyz/play/quests/preview/'}),root=dom.window.document.getElementById('arcade-daily-growth');
 let current={wallet,token:'a'.repeat(64),expiresAt:new Date(now+60000).toISOString()},resolveOld;const events=[];root.addEventListener('arcade-completed-runs',event=>events.push(event.detail));
 const app=createCompletedRunTracking({root,getSession:()=>current,now:()=>now,fetchImpl:async(url,options)=>options.headers.Authorization.endsWith('a'.repeat(64))?await new Promise(resolve=>resolveOld=resolve):new Response(JSON.stringify({wallet:other,dateKey,runs:[]}))});
 try{app.sessionChanged();await tick();current={...current,wallet:other,token:'b'.repeat(64)};app.sessionChanged();await tick();const index=events.length;resolveOld(new Response(JSON.stringify({wallet,dateKey,runs:[run]})));await tick();assert.ok(events.slice(index).every(event=>event.wallet===other&&event.runs.length===0));assert.equal(root.querySelector('#completed-runs-status').textContent.includes('No completed runs'),true);}finally{app.destroy();dom.window.close();}
});
test('share captions include only the selected saved run’s actual score',()=>{
 const game=shareGames.find(game=>game.id==='canopy-breaker');for(const text of resultMessages(game,run)){assert.match(text,/18,500/);assert.ok(text.length<=280);assert.ok(text.includes('https://tree-token.xyz/play/'));}
 for(const text of resultMessages(shareGames.find(game=>game.id==='garden-bot'),{score:null}))assert.doesNotMatch(text,/points/);
});
