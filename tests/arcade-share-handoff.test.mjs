import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {md5,receiptIdForRun,resultShareUrl,readShareRequest} from '../scripts/arcade-share-handoff.js';
const hash=x=>createHash('sha256').update(x).digest('hex'),wallet='0x'+'a'.repeat(64),battle='0x'+'b'.repeat(64);
test('handoff IDs exactly match persisted receipts, including legacy breaker MD5 identity',async()=>{
 for(const value of ['', 'a','abc','The quick brown fox jumps over the lazy dog','9f63000e-770a-4e89-8fd8-aef90d0db727'])assert.equal(md5(value),createHash('md5').update(value).digest('hex'));
 for(const [game,id,source] of [['treeforce89','grove-'+'b'.repeat(32),'treeforce89:'+wallet+':grove-'+'b'.repeat(32)],['canopy-breaker','test-run','canopy-breaker:'+md5('test-run')],['garden-bot',battle,'garden-battles:battle:'+battle+':'+wallet],['pvp',battle,'garden-battles:battle:'+battle+':'+wallet]]){
  const key=await receiptIdForRun(game,id,wallet);assert.equal(key,hash(game+':'+hash(source)));const url=new URL(resultShareUrl(game,key));assert.deepEqual(readShareRequest(url),{gameId:game,id:key});assert.ok(!url.href.includes(wallet));assert.ok(!url.href.includes(id));assert.equal(url.hash,'#daily');
 }
});
test('malformed links and unsupported games cannot select a result',()=>{
 for(const search of ['?shareGame=other&shareRun='+'a'.repeat(64),'?shareGame=treeforce89&shareRun=https://evil.test','?shareGame=pvp&shareRun='+'A'.repeat(64)])assert.equal(readShareRequest({search}),null);
 assert.throws(()=>resultShareUrl('pvp','bad'));
});
import fs from 'node:fs';import {createArcadeMissions} from '../scripts/arcade-social-play-share.js';
const {JSDOM}=await import(process.env.ARCADE_TEST_JSDOM||'/tmp/arcade-test/node_modules/jsdom/lib/api.js');
test('handoff selects the exact older run, rejects a missing run and clears on wallet switch',async()=>{
 const id='c'.repeat(64),now=Date.parse('2026-11-11T12:00:00Z');const dom=new JSDOM(fs.readFileSync('production/arcade-play-share-static/index.html','utf8'),{url:resultShareUrl('treeforce89',id)}),w=dom.window,originalImage=globalThis.Image;
 globalThis.Image=class{set src(v){this.width=400;this.height=400;queueMicrotask(()=>this.onload?.());}};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>k in o?o[k]:()=>{}});w.HTMLElement.prototype.scrollIntoView=()=>{};
 const root=w.document.getElementById('arcade-daily-growth');let current={wallet,token:'a'.repeat(64),expiresAt:new Date(now+60000).toISOString()};
 const app=createArcadeMissions({root,getSession:()=>current,now:()=>now,fetchImpl:async()=>Response.json({wallet,entries:[],monthlyStamps:0,resetsAt:'2026-11-16T00:00:00Z'})});
 const detail=runs=>({sessionActive:true,stale:false,loading:false,wallet,dateKey:'2026-11-11',runs});const send=value=>root.dispatchEvent(new w.CustomEvent('arcade-completed-runs',{detail:value}));
 try{app.sessionChanged();await new Promise(r=>setTimeout(r,10));const recent={id:'d'.repeat(64),gameId:'treeforce89',completedAt:'2026-11-11T11:00:00Z',score:99900,stage:8,outcome:'gameover'};
  send(detail([recent]));assert.equal(root.querySelector('#result-share-controls').hidden,true);assert.match(root.textContent,/That run is not verified/);
  send(detail([recent,{...recent,id,score:25500,stage:3,completedAt:'2026-11-11T10:00:00Z'}]));assert.equal(root.querySelector('#result-share-controls').hidden,false);assert.equal(root.querySelector('#guided-share-score select').value,id);assert.match(root.querySelector('#guided-share-score .share-message').textContent,/25,500/);
  current={...current,wallet:'0x'+'f'.repeat(64)};app.sessionChanged();send(detail([{...recent,id}]));assert.equal(root.querySelector('#result-share-controls').hidden,true);
 }finally{app.destroy();w.close();globalThis.Image=originalImage;}
});

test('share handoffs target the main Arcade Daily tab',()=>{const url=new URL(resultShareUrl('pvp','a'.repeat(64)));assert.equal(url.pathname,'/play/');assert.equal(url.hash,'#daily');});
