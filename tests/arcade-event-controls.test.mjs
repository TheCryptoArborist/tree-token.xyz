import {test} from 'node:test';import assert from 'node:assert/strict';
import {installEventServerControls} from '../scripts/arcade-events/server-controls.mjs';
const wallet='0x'+'a'.repeat(64),session={token:'a'.repeat(64),wallet,expiresAt:'2099-01-01T00:00Z'};
function setup(fetchImpl){const elements=Object.fromEntries(['holder-check','server-load','server-save','holder-status','server-status'].map(id=>[id,{disabled:false,textContent:'',addEventListener(_event,callback){this.click=callback;}}]));let ticket=session,applied;
 const view={document:{getElementById:id=>elements[id]},localStorage:{getItem:()=>JSON.stringify(ticket)},sessionStorage:{getItem:()=>null}};
 installEventServerControls({view,fetchImpl,readDraft:()=>({id:'defend-the-canopy-01',title:'Defend the Canopy',gameId:'treeforce89',timeZone:'America/Chicago',startLocal:'',endLocal:'',terms:{access:'nftree-holder-only'}}),applyDraft:d=>{applied=d;}});
 return {elements,setSession:s=>{ticket=s;},getApplied:()=>applied};
}
const ok=data=>Response.json({status:'ok',...data});
test('server controls use an authenticated check, never a local ownership flag or payment action',async()=>{
 const requests=[],s=setup(async(url,options)=>{requests.push({url,options});return ok({nftreeCount:1,entryOpen:false});});await s.elements['holder-check'].click();
 assert.match(s.elements['holder-status'].textContent,/Entry remains closed/);assert.equal(requests[0].url,'/api/arcade-events?action=eligibility');assert.equal(requests[0].options.headers.Authorization,'Bearer '+session.token);assert.equal(requests[0].options.cache,'no-store');
 s.setSession(null);await s.elements['holder-check'].click();assert.match(s.elements['holder-status'].textContent,/Sign in/);assert.equal(requests.length,1);
});
test('load/save round trip carries server revision and sends only editable settings',async()=>{
 const requests=[],s=setup(async(url,options)=>{requests.push({url,options});return ok({event:url.includes('admin-load')?{event_id:'defend-the-canopy-01',version:3,title:'Saved event',game_id:'treeforce89',time_zone:'America/Chicago',starts_at:'2026-11-14T00:00Z',ends_at:'2026-11-16T00:00Z'}:{version:4}});});
 await s.elements['server-load'].click();assert.equal(s.getApplied().startLocal,'2026-11-13T18:00');assert.equal(s.getApplied().endLocal,'2026-11-15T18:00');
 await s.elements['server-save'].click();const payload=JSON.parse(requests[1].options.body);assert.equal(payload.expectedVersion,3);assert.equal('terms' in payload.draft,false);assert.match(s.elements['server-status'].textContent,/Version 4/);
});
test('wallet switches discard stale server replies and do not apply someone else’s draft',async()=>{
 let s;s=setup(async()=>{s.setSession({...session,token:'b'.repeat(64),wallet:'0x'+'b'.repeat(64)});return ok({event:{event_id:'defend-the-canopy-01',version:9}});});
 await s.elements['server-load'].click();assert.match(s.elements['server-status'].textContent,/wallet changed/);assert.equal(s.getApplied(),undefined);assert.equal(s.elements['server-load'].disabled,false);
});
test('save conflicts and verification failures remain visible and never claim success',async()=>{
 const s=setup(async()=>Response.json({status:'error',message:'This event changed. Reload it before saving.'},{status:409}));await s.elements['server-save'].click();assert.match(s.elements['server-status'].textContent,/Reload/);assert.doesNotMatch(s.elements['server-status'].textContent,/Saved on the server/);
});
