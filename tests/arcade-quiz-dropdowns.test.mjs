import test from 'node:test';import assert from 'node:assert/strict';
import {createQuestCampaigns} from '../scripts/arcade-refresh/arcade-quest-campaigns.js';
function fixture(signed=false,weekly=false){
 const nodes=new Map();const make=()=>({disabled:false,hidden:false,textContent:'',style:{},listeners:{},setAttribute(){},before(){},reset(){},reportValidity(){return true;},addEventListener(e,h){this.listeners[e]=h;},removeEventListener(){},querySelector(){return {style:{}};},querySelectorAll(){return [];}});
 const selects=[make(),make(),make()];const node=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};node('campaign-quiz-form').querySelectorAll=()=>selects;
 const wallet='0x'+'1'.repeat(64);const session=signed?{wallet,token:'test-only',expiresAt:new Date(Date.now()+60000).toISOString()}:null;let requests=0;
 const api=createQuestCampaigns({root:{ownerDocument:{createElement:make},querySelector:sel=>node(sel.slice(1))},getSession:()=>session,checkIn:async()=>{},syncGames:async()=>{},fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({status:'ok',progress:{wallet,campaignId:'first-round-v1',canClaim:false,quizCompleteThisWeek:weekly,learningStamps:weekly?1:0,tasks:{checkIn:false,quiz:false,game:false,share:false},startedAt:null,claimedAt:null}})};}});
 return {api,selects,node,requests:()=>requests,nodes};
}
test('signed-out visitors can choose answers without enabling credit or making requests',async()=>{const f=fixture();assert.ok(f.selects.every(s=>!s.disabled));assert.equal(f.node('campaign-quiz-submit').disabled,true);await f.api.refresh();assert.equal(f.requests(),0);f.api.destroy();});
test('authenticated loaded progress enables verified submission',async()=>{const f=fixture(true);assert.ok(f.selects.every(s=>!s.disabled));assert.equal(f.node('campaign-quiz-submit').disabled,true);await f.api.refresh();assert.equal(f.node('campaign-quiz-submit').disabled,false);assert.ok(f.selects.every(s=>!s.disabled));f.api.destroy();});
test('an already saved weekly stamp still allows browsing but prevents another credit submission',async()=>{const f=fixture(true,true);await f.api.refresh();assert.ok(f.selects.every(s=>!s.disabled));assert.equal(f.node('campaign-quiz-submit').disabled,true);assert.match(f.node('campaign-quiz-feedback').textContent,/already|saved/);f.api.destroy();});
