import test from 'node:test';import assert from 'node:assert/strict';
import {makeDraft,economics,suiToMist,mistToSui,localToUtc,phase,checkEvidence,standings,launchChecks} from '../scripts/arcade-events/core.mjs';
test('Canopy Crown name replaces only the previous Tree Force default and preserves saved draft identity',()=>{
 assert.equal(makeDraft().title,'Canopy Crown ’89');
 const saved={id:'treeforce89-defend-the-canopy-01',title:'Defend the Canopy',startLocal:'2026-11-13T18:00',endLocal:'2026-11-15T18:00'};
 const migrated=makeDraft(saved);assert.equal(migrated.title,'Canopy Crown ’89');assert.equal(migrated.id,saved.id);assert.equal(migrated.startLocal,saved.startLocal);assert.equal(migrated.endLocal,saved.endLocal);
 for(const title of ['My Canopy Championship','Defend the Canopy — November','defend the canopy'])assert.equal(makeDraft({...saved,title}).title,title);
 assert.equal(makeDraft({...saved,gameId:'canopy-breaker'}).title,'Defend the Canopy');
 assert.equal(migrated.paymentEnabled,false);
});
test('5 SUI entry and guaranteed/80% prize arithmetic uses integer MIST',()=>{
 for(const [n,prize,net]of [[0,'25','-25'],[4,'25','-5'],[5,'25','0'],[6,'25','5'],[7,'28','7'],[10,'40','10'],[100,'400','100']]){const x=economics(n);assert.equal(mistToSui(x.prizeMist),prize);assert.equal(mistToSui(x.organizerNetBeforeCostsMist),net);}
 assert.equal(suiToMist('0.000000001'),1n);assert.equal(mistToSui('5000000000'),'5');
 for(const x of ['-5','5e9','5.0000000001','NaN',' 5','01'])assert.throws(()=>suiToMist(x));assert.throws(()=>economics(-1));
});
test('Central Time conversion respects DST and rejects nonexistent and duplicate local times',()=>{
 assert.equal(localToUtc('2026-11-13T18:00'),'2026-11-14T00:00:00.000Z');
 assert.equal(localToUtc('2026-07-10T18:00'),'2026-07-10T23:00:00.000Z');
 assert.throws(()=>localToUtc('2026-03-08T02:30'),/does not exist/);assert.throws(()=>localToUtc('2026-11-01T01:30'),/twice/);
 assert.throws(()=>localToUtc('2026-02-30T12:00'));assert.equal(localToUtc('2026-11-13T18:00','UTC'),'2026-11-13T18:00:00.000Z');
});
const base=makeDraft({id:'test-event-one',startLocal:'2026-11-13T18:00',endLocal:'2026-11-15T18:00'}),event={...base,status:'scheduled'},begin=Date.parse(event.startsAt),end=Date.parse(event.endsAt),wallet='0x'+'a'.repeat(64);
const run=(extra={})=>({eventId:event.id,gameId:'treeforce89',wallet,proofId:'proof-1',trust:'server-reviewed',review:'verified',startingLives:3,continues:0,debug:false,score:100,startedAt:new Date(begin).toISOString(),completedAt:new Date(begin+60000).toISOString(),...extra});
test('event boundary is start-inclusive/end-exclusive and a draft never opens just because dates pass',()=>{
 assert.equal(phase(base,begin+1000),'draft');assert.equal(phase(event,begin-1),'upcoming');assert.equal(phase(event,begin),'live');assert.equal(phase(event,end),'closed');
 assert.equal(checkEvidence(event,run(),end).eligible,true);assert.equal(checkEvidence(event,run({completedAt:event.endsAt}),end).eligible,false);
 assert.equal(checkEvidence(event,run({startedAt:new Date(begin-1).toISOString()}),end).eligible,false);
 for(const patch of [{continues:1},{debug:true},{trust:'browser'},{startingLives:4},{gameId:'root-rage'},{score:Infinity},{completedAt:new Date(end+1).toISOString()}])assert.equal(checkEvidence(event,run(patch),end).eligible,false);
});
test('leaderboard keeps a wallet’s best verified score, breaks ties by achievement time, and isolates events',()=>{
 const rows=[run(),run({score:500,proofId:'proof-2'}),run({score:9999,review:'pending',proofId:'pending'}),run({eventId:'another-event',score:9999,proofId:'other'}),run({wallet:'0x'+'b'.repeat(64),score:500,proofId:'proof-3',completedAt:new Date(begin+30000).toISOString()})];
 const ranked=standings(event,rows,end);assert.equal(ranked.length,2);assert.equal(ranked[0].wallet,'0x'+'b'.repeat(64));assert.equal(ranked[1].score,500);
 assert.throws(()=>standings(event,[run(),run()],end),/Duplicate/);
});
test('the agreed entry bundle is permanent and dates alone cannot enable payments',()=>{
 assert.equal(base.cosmetics.permanent,true);assert.equal(new Set(Object.values(base.cosmetics).filter(x=>typeof x==='string')).size,3);
 assert.equal(base.paymentEnabled,false);assert.equal(launchChecks(base).filter(x=>!x.ready).length,4);
 assert.throws(()=>makeDraft({startLocal:'2026-11-13T18:00'}));assert.throws(()=>makeDraft({startLocal:'2026-11-15T18:00',endLocal:'2026-11-13T18:00'}));
});
