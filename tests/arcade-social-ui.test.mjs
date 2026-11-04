import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createArcadeMissions} from '../scripts/arcade-social-missions.js';
const require=createRequire(resolve(process.env.ARCADE_DOM_TEST_DEPS || '/tmp/arcade-mission-tools','package.json'));
const {JSDOM}=require('jsdom');
const wallet='0x'+'a'.repeat(64),other='0x'+'b'.repeat(64);
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(fetchImpl){const dom=new JSDOM(html,{url:'https://tree-token.xyz/play/'});let session=null;const root=dom.window.document.querySelector('#arcade-daily-growth');const controller=createArcadeMissions({root,fetchImpl,getSession:()=>session});return {root,controller,set(value){session=value;controller.sessionChanged()},close(){controller.destroy();dom.window.close()}};}
const session=(address=wallet)=>({wallet:address,token:address.slice(2),expiresAt:new Date(Date.now()+60000).toISOString()});
const snapshot=()=>({wallet,entries:[{mission:'share-score',status:'pending',proof:'https://x.com/player/status/123'}],monthlyStamps:0,resetsAt:'2026-11-09T00:00:00Z'});
test('opening composer grants no stamp; pending proof locks repeat submissions',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return Response.json(snapshot())});
 assert.equal(f.root.querySelector('[type=submit]').disabled,true);
 f.set(session());assert.equal(calls,0);await f.controller.refresh();
 assert.match(f.root.querySelector('.mission-state').textContent,/Pending review/);
 assert.equal(f.root.querySelector('[type=submit]').disabled,true);
 assert.match(f.root.querySelector('#missions-progress').textContent,/0 community stamps/);f.close();
});
test('account switch clears proof and ignores in-flight results for the old wallet',async()=>{
 let resolveResponse;const f=fixture(()=>new Promise(resolve=>{resolveResponse=resolve}));f.set(session());const pending=f.controller.refresh();
 f.set(session(other));resolveResponse(Response.json(snapshot()));await pending;
 assert.equal(f.root.querySelector('#missions-progress').textContent,'');assert.equal(f.root.querySelector('[name=proof]').value,'');
 assert.doesNotMatch(f.root.querySelector('.mission-state').textContent,/Pending/);f.close();
});
test('unavailable service and wrong-wallet receipts cannot show completed progress',async()=>{
 for(const response of [()=>Response.json({message:'Missions unavailable'},{status:503}),()=>Response.json({...snapshot(),wallet:other})]){
 const f=fixture(async()=>response());f.set(session());await f.controller.refresh();assert.equal(f.root.querySelector('#missions-progress').textContent,'');assert.equal(f.root.querySelector('[type=submit]').disabled,false);f.close();
 }
});
