import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {createQuestCampaigns} from '../scripts/arcade-quest-campaigns.js';
const require=createRequire(resolve(process.env.ARCADE_DOM_TEST_DEPS||'/tmp/arcade-campaign-tools','package.json'));const {JSDOM}=require('jsdom');
const wallet='0x'+'a'.repeat(64),other='0x'+'b'.repeat(64);const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const progress=()=>({wallet,campaignId:'first-round-v1',startedAt:null,claimedAt:null,canClaim:false,quizCompleteThisWeek:false,learningStamps:0,tasks:{checkIn:false,quiz:false,game:false,share:false}});
const session=w=>({wallet:w,token:w.slice(2),expiresAt:new Date(Date.now()+60000).toISOString()});const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(fetchImpl){const dom=new JSDOM(html,{url:'https://tree-token.xyz/play/'});let s=null;const root=dom.window.document.querySelector('#arcade-daily-growth');const controller=createQuestCampaigns({root,fetchImpl,getSession:()=>s,syncGames:async()=>{},checkIn:async()=>{}});return {root,controller,set(w){s=w?session(w):null;controller.sessionChanged();},close(){controller.destroy();dom.window.close();}};}
test('signed out never claims zeros; enrolled task/claim gates come only from saved server state',async()=>{
 let p=progress();const f=fixture(async()=>Response.json({status:'ok',progress:p}));assert.equal(f.root.querySelector('#campaign-meter').hidden,true);f.set(wallet);await f.controller.refresh();assert.equal(f.root.querySelector('#campaign-start').disabled,false);assert.equal(f.root.querySelector('#campaign-game').disabled,true);
 p={...p,startedAt:new Date().toISOString(),tasks:{checkIn:true,quiz:true,game:true,share:false}};await f.controller.refresh();assert.match(f.root.querySelector('#campaign-count').textContent,/3 \/ 4/);assert.equal(f.root.querySelector('#campaign-claim').disabled,true);
 p={...p,canClaim:true,tasks:{...p.tasks,share:true}};await f.controller.refresh();assert.equal(f.root.querySelector('#campaign-claim').disabled,false);f.close();
});
test('quiz sends answers without local passed/completed flags and wrong answers do not award progress',async()=>{
 const p={...progress(),startedAt:new Date().toISOString()};let submitted;
 const f=fixture(async(url,options)=>{if(options.method==='POST'){submitted=JSON.parse(options.body);return Response.json({status:'ok',progress:p,quizResult:{score:2,passed:false}});}return Response.json({status:'ok',progress:p});});
 f.set(wallet);await f.controller.refresh();for(const [n,v]of [[1,'chart'],[2,'attendance'],[3,'review']])f.root.querySelector(`#tree-answer-${n}`).value=v;
 f.root.querySelector('#campaign-quiz-form').dispatchEvent(new f.root.ownerDocument.defaultView.Event('submit',{cancelable:true}));await tick();
 assert.deepEqual(submitted,{action:'quiz',answers:['chart','attendance','review']});assert.match(f.root.querySelector('#campaign-quiz-feedback').textContent,/2 \/ 3 correct/);assert.equal(f.root.querySelector('#campaign-claim').disabled,true);f.close();
});
test('wallet change clears private state and ignores old-wallet late responses',async()=>{
 let release;const f=fixture(()=>new Promise(r=>{release=r}));f.set(wallet);const pending=f.controller.refresh();f.set(other);release(Response.json({status:'ok',progress:{...progress(),canClaim:true}}));await pending;assert.equal(f.root.querySelector('#campaign-meter').hidden,true);assert.equal(f.root.querySelector('#campaign-claim').disabled,true);f.close();
});
test('wrong wallet and expired sessions never show awarded campaign progress',async()=>{
 for(const response of [()=>Response.json({status:'ok',progress:{...progress(),wallet:other,canClaim:true}}),()=>Response.json({message:'Sign in again'},{status:401})]){const f=fixture(async()=>response());f.set(wallet);await f.controller.refresh();assert.equal(f.root.querySelector('#campaign-meter').hidden,true);assert.equal(f.root.querySelector('#campaign-claim').disabled,true);f.close();}
});
