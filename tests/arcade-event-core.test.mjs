import test from 'node:test';import assert from 'node:assert/strict';
import {TERMS,USDC_COIN_TYPE,makeDraft,economics,usdcToUnits,unitsToUsdc,localToUtc,phase,checkEvidence,standings,launchChecks} from '../scripts/arcade-events/core.mjs';
test('Canopy Crown name replaces only the previous Tree Force default and preserves saved draft identity',()=>{
 assert.equal(makeDraft().title,'Canopy Crown ’89');
 const saved={id:'treeforce89-defend-the-canopy-01',title:'Defend the Canopy',startLocal:'2026-11-13T18:00',endLocal:'2026-11-15T18:00'};
 const migrated=makeDraft(saved);assert.equal(migrated.title,'Canopy Crown ’89');assert.equal(migrated.id,saved.id);assert.equal(migrated.startLocal,saved.startLocal);assert.equal(migrated.endLocal,saved.endLocal);
 for(const title of ['My Canopy Championship','Defend the Canopy — November','defend the canopy'])assert.equal(makeDraft({...saved,title}).title,title);
 assert.equal(makeDraft({...saved,gameId:'canopy-breaker'}).title,'Defend the Canopy');
 assert.equal(migrated.paymentEnabled,false);
});
test('native USDC uses six-decimal integer units and rejects ambiguous monetary inputs',()=>{
 assert.equal(TERMS.currency,'USDC');assert.equal(TERMS.decimals,6);assert.equal(TERMS.coinType,USDC_COIN_TYPE);
 assert.equal(usdcToUnits('0.000001'),1n);assert.equal(usdcToUnits('5'),5000000n);assert.equal(usdcToUnits('25.000000'),25000000n);
 for(const [units,amount]of [['0','0'],['1','0.000001'],['5000000','5'],['122400000','122.4'],['-20000000','-20'],['-1','-0.000001']])assert.equal(unitsToUsdc(units),amount);
 assert.equal(unitsToUsdc(5000000n),'5');
 for(const x of ['-5','5e6','5.0000001','NaN','Infinity',' 5','01','+5','5.',5,null])assert.throws(()=>usdcToUnits(x));
 for(const x of ['1.5','1e6',' 1','01','-0','+1',5000000,NaN,null])assert.throws(()=>unitsToUsdc(x));
});
test('USDC prize tiers, minimum subsidy and organizer net are exact at every transition',()=>{
 const cases=[
  [0,'0','0','0','0','0','0','0',0,'none'],
  [1,'4','25','0','0','1','21','-20',1,'winner-only'],
  [5,'20','25','0','0','5','5','0',1,'winner-only'],
  [6,'24','25','0','0','6','1','5',1,'winner-only'],
  [7,'28','28','0','0','7','0','7',1,'winner-only'],
  [24,'96','96','0','0','24','0','24',1,'winner-only'],
  [25,'100','75','25','0','25','0','25',2,'top-two'],
  [49,'196','147','49','0','49','0','49',2,'top-two'],
  [50,'200','120','50','30','50','0','50',3,'top-three'],
  [51,'204','122.4','51','30.6','51','0','51',3,'top-three'],
  [100,'400','240','100','60','100','0','100',3,'top-three']
 ];
 for(const [n,pool,first,second,third,allocation,topUp,net,places,tier]of cases){
  const x=economics(n),expected={feePrizePoolUnits:pool,firstPrizeUnits:first,secondPrizeUnits:second,thirdPrizeUnits:third,organizerAllocationUnits:allocation,guaranteeTopUpUnits:topUp,organizerNetBeforeCostsUnits:net};
  for(const [field,amount]of Object.entries(expected))assert.equal(unitsToUsdc(x[field]),amount,`${n} entrants: ${field}`);
  assert.equal(x.revenueUnits,String(usdcToUnits(String(n*5))));assert.equal(x.paidPlaces,places);assert.equal(x.tier,tier);assert.equal(x.currency,'USDC');assert.equal(x.decimals,6);
  assert.equal(x.splitBps.reduce((sum,bps)=>sum+bps,0),n?10000:0);
  const b=key=>BigInt(x[key]);
  assert.equal(b('firstPrizeUnits')+b('secondPrizeUnits')+b('thirdPrizeUnits'),b('prizePoolUnits'));
  assert.equal(b('feePrizePoolUnits')+b('organizerAllocationUnits'),b('revenueUnits'));
  assert.equal(b('feePrizePoolUnits')+b('guaranteeTopUpUnits'),b('prizePoolUnits'));
  assert.equal(b('prizePoolUnits')+b('organizerNetBeforeCostsUnits'),b('revenueUnits'));
  assert.equal(b('organizerAllocationUnits')-b('guaranteeTopUpUnits'),b('organizerNetBeforeCostsUnits'));
 }
});
test('economics rejects invalid counts, old MIST terms and changes to approved USDC policy',()=>{
 for(const n of [-1,1.5,NaN,Infinity,'25',null,1000001,Number.MAX_SAFE_INTEGER])assert.throws(()=>economics(n));
 assert.equal(economics(1000000).revenueUnits,'5000000000000');
 for(const patch of [{version:1},{currency:'SUI'},{decimals:9},{coinType:'bridged::USDC'},{entryFeeUnits:'6000000'},{minimumPrizeUnits:'20000000'},{prizeShareBps:9000},{organizerShareBps:1000},{entryFeeMist:'5000000000'},{access:'public'},{paidContinues:true},{lives:4}])assert.throws(()=>economics(25,{...TERMS,...patch}));
 const changed=structuredClone(TERMS);changed.payoutTiers[1].minEntrants=20;assert.throws(()=>economics(25,changed));
 const legacy={entryFeeMist:'5000000000',minimumPrizeMist:'25000000000',prizeShareBps:8000};assert.throws(()=>economics(25,legacy));
 // JSONB/object field ordering must not alter policy validation.
 const reordered=Object.fromEntries(Object.entries(structuredClone(TERMS)).reverse());reordered.payoutTiers=reordered.payoutTiers.map(t=>Object.fromEntries(Object.entries(t).reverse()));
 assert.deepEqual(economics(50,reordered),economics(50));
});
test('legacy unpaid drafts adopt the approved USDC policy without losing their identity or schedule',()=>{
 const old={version:1,id:'saved-canopy-event',title:'Peter’s championship',gameId:'treeforce89',timeZone:'America/Chicago',startLocal:'2026-11-13T18:00',endLocal:'2026-11-15T18:00',status:'draft',paymentEnabled:false,terms:{entryFeeMist:'5000000000',minimumPrizeMist:'25000000000',prizeShareBps:8000,lives:3,paidContinues:false,attempts:'unlimited',payout:'manual-after-review',access:'nftree-holder-only'}};
 const updated=makeDraft(old);assert.equal(updated.version,2);assert.equal(updated.terms.version,2);assert.equal(updated.terms.entryFeeUnits,'5000000');assert.equal(updated.terms.minimumPrizeUnits,'25000000');assert.equal(updated.terms.coinType,USDC_COIN_TYPE);
 for(const key of ['id','title','gameId','timeZone','startLocal','endLocal'])assert.equal(updated[key],old[key]);
 assert.equal(updated.startsAt,'2026-11-14T00:00:00.000Z');assert.equal(updated.endsAt,'2026-11-16T00:00:00.000Z');assert.equal(updated.status,'draft');assert.equal(updated.paymentEnabled,false);
 assert.deepEqual(makeDraft(updated),updated);assert.equal(old.version,1);assert.equal(old.terms.entryFeeMist,'5000000000');assert.equal('entryFeeMist' in updated.terms,false);
 const customCosmetics={frame:'saved-frame-01',badge:'saved-contender-01',champion:'saved-champion-01',permanent:true};assert.deepEqual(makeDraft({...old,cosmetics:customCosmetics}).cosmetics,customCosmetics);
});
test('draft migration refuses scheduled, active, paid or unknown-policy records',()=>{
 for(const status of ['scheduled','active','live','closed','locked','cancelled','finalized','paid'])assert.throws(()=>makeDraft({status}),/unpaid draft/);
 for(const patch of [{paymentEnabled:true},{payment_enabled:true},{entryOpen:true},{entriesOpen:true},{scoringEnabled:true},{paid:true},{hasPayments:true},{paidEntrants:1},{paidEntryCount:2},{paid_entry_count:'1'},{paid_entries:1},{revenueUnits:'1'},{entryFeesCollectedUnits:'5000000'},{totalPaidUnits:1n},{paidAmountUnits:1},{payments:[{id:'payment'}]},{entries:[{id:'entrant'}]}])assert.throws(()=>makeDraft(patch));
 assert.throws(()=>makeDraft({version:3}),/format version/);assert.throws(()=>makeDraft({terms:{currency:'USDT'}}),/unrecognized/);assert.throws(()=>makeDraft({terms:{...TERMS,entryFeeUnits:'1'}}),/unrecognized/);
 const draft=makeDraft({status:'draft',paymentEnabled:false,paidEntrants:0,paidEntryCount:'0',entries:[],payments:[]});assert.equal(draft.paymentEnabled,false);
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
