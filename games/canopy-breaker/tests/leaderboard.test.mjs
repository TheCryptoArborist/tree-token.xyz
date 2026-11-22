import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {NetlifyDB} from '@netlify/database-dev';
import {normalizeUsername,recordBestScore,createLeaderboardService} from '../server/leaderboard.mjs';
import {TREE_PAYMENT_RECIPIENT} from '../server/payments/config.mjs';

const db=new NetlifyDB({logger:()=>{}});
before(async()=>{await db.start();await db.applyMigrations('netlify/database/migrations');});
after(async()=>db.stop());
beforeEach(async()=>{await db.query('TRUNCATE breaker.leaderboard_scores,breaker.player_profiles');});

async function player(){
 let time=1000000,active=true,expiresAt=9000000;
 const address='0x'+randomBytes(32).toString('hex');
 await db.query('INSERT INTO breaker.accounts(wallet) VALUES($1)',[address]);
 const service=createLeaderboardService({database:db,now:()=>time,authorize:async()=>{
  if(!active)throw Object.assign(Error('No session'),{status:401});return {address,expiresAt};
 }});
 return {address,service,setTime:value=>time=value,expire:()=>expiresAt=time,logout:()=>active=false};
}
async function savedRun(owner,score,level=1,updatedAt=1000){
 const run={id:randomUUID(),state:{score,level,status:'playing',privateField:'not public'}};
 await db.query('INSERT INTO breaker.runs(id,wallet,state,updated_at) VALUES($1,$2,$3,$4)',[run.id,owner.address,JSON.stringify(run.state),updatedAt]);
 return run;
}
async function record(owner,run,time=1000){return db.transaction(tx=>recordBestScore(tx,owner.address,run,time));}
async function runState(run,changes){run.state={...run.state,...changes};await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify(run.state),run.id]);return run;}
async function paidLink(owner,prior,next,{receipt=true}={}){
 const id=randomUUID();
 await db.query("INSERT INTO breaker.invoices(id,wallet,run_id,recipient,amount,decimals,created_at,expires_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'paid')",[id,owner.address,prior.id,TREE_PAYMENT_RECIPIENT,'20000000000',6,1,10]);
 if(receipt)await db.query('INSERT INTO breaker.receipts(digest,invoice_id,checkpoint,timestamp_ms) VALUES($1,$2,$3,$4)',[randomUUID(),id,'123',2]);
 await db.query('INSERT INTO breaker.restarts(invoice_id,new_run) VALUES($1,$2)',[id,next.id]);return id;
}
const isStatus=status=>error=>error.status===status;

test('username normalization is limited to a clear 3–20 character ASCII display name',()=>{
 assert.equal(normalizeUsername('  Root   Hero  '),'Root Hero');
 assert.equal(normalizeUsername('Oak_89-Player'),'Oak_89-Player');
 assert.equal(normalizeUsername('A'.repeat(20)),'A'.repeat(20));
 for(const value of [undefined,null,42,[],{},'','aa','A'.repeat(21),'_root','-root','<script>','Root\tHero','Root\nHero','José','🌲 Tree'])assert.throws(()=>normalizeUsername(value),isStatus(400));
});

test('the public board works without authentication and exposes only named positive-score players',async()=>{
 const anonymous=await player(),named=await player(),zero=await player();
 await record(anonymous,await savedRun(anonymous,9000,20));
 await record(named,await savedRun(named,500,3));
 await zero.service.setUsername(null,{username:'Zero Score'});
 await named.service.setUsername(null,{username:'Canopy Hero'});
 const service=createLeaderboardService({database:db,now:()=>1234,authorize:()=>{throw Error('Public reads must not authorize');}});
 assert.deepEqual(await service.leaderboard(),{entries:[{rank:1,username:'Canopy Hero',score:500,level:3}],limit:20,updatedAt:1234});
 const publicText=JSON.stringify(await service.leaderboard());
 for(const forbidden of [anonymous.address,named.address,'privateField','wallet','run_id','signature','invoice'])assert(!publicText.includes(forbidden));
});

test('saving a username backfills the wallet’s best saved score and ignores request score or wallet fields',async()=>{
 const own=await player(),other=await player();
 await savedRun(own,100,2,500);await savedRun(own,700,5,600);await savedRun(other,9000,20,100);
 assert.deepEqual(await own.service.profile(),{username:null});
 assert.deepEqual(await own.service.setUsername(null,{username:'  Best   Oak  ',score:999999,wallet:other.address}),{username:'Best Oak'});
 assert.deepEqual(await own.service.profile(),{username:'Best Oak'});
 assert.deepEqual(await other.service.profile(),{username:null});
 assert.deepEqual((await own.service.leaderboard()).entries,[{rank:1,username:'Best Oak',score:700,level:5}]);
 const stored=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[own.address])).rows[0];
 assert.equal(Number(stored.achieved_at),600);
});

test('a new holder can choose a name before playing without creating a score entry',async()=>{
 const address='0x'+randomBytes(32).toString('hex');
 const service=createLeaderboardService({database:db,authorize:async()=>({address,expiresAt:9000000}),now:()=>1000});
 assert.deepEqual(await service.setUsername(null,{username:'Future Canopy'}),{username:'Future Canopy'});
 assert.equal((await db.query('SELECT * FROM breaker.accounts WHERE wallet=$1',[address])).rows.length,1);
 assert.deepEqual((await service.leaderboard()).entries,[]);
});

test('enrollment reconstructs a historical legacy campaign’s cumulative score after a new challenge began',async()=>{
 const own=await player();
 const prior=await runState(await savedRun(own,1000,6,100),{status:'gameover',lives:0});
 const continued=await runState(await savedRun(own,800,30,200),{status:'won',lives:2});
 const current=await savedRun(own,0,1,300);await paidLink(own,prior,continued);
 await db.query('UPDATE breaker.accounts SET current_run=$1 WHERE wallet=$2',[current.id,own.address]);
 await own.service.setUsername(null,{username:'Historical Oak'});
 assert.deepEqual((await own.service.leaderboard()).entries,[{rank:1,username:'Historical Oak',score:1800,level:30}]);
 await own.service.setUsername(null,{username:'Historical Oak'});
 assert.equal((await own.service.leaderboard()).entries[0].score,1800);
 const stored=await db.query('SELECT id,state FROM breaker.runs WHERE wallet=$1',[own.address]);
 assert.deepEqual(Object.fromEntries(stored.rows.map(run=>[run.id,run.state.score])),{[prior.id]:1000,[continued.id]:800,[current.id]:0});
 assert.equal((await db.query('SELECT * FROM breaker.invoices WHERE wallet=$1',[own.address])).rows.length,1);
});

test('a marked ancestor contributes its existing total without double counting earlier paid segments',async()=>{
 const own=await player();
 const first=await runState(await savedRun(own,1000,6,100),{status:'gameover',lives:0});
 const marked=await runState(await savedRun(own,1600,8,200),{status:'gameover',lives:0,scoreCarryVersion:1,carriedScore:1000});
 const legacy=await savedRun(own,200,9,300);await paidLink(own,first,marked);await paidLink(own,marked,legacy);
 await own.service.setUsername(null,{username:'Repaired Oak'});
 assert.deepEqual((await own.service.leaderboard()).entries,[{rank:1,username:'Repaired Oak',score:1800,level:9}]);
});

test('missing receipts and foreign-wallet paid links cannot add inherited leaderboard credit',async()=>{
 const own=await player(),other=await player();
 const prior=await runState(await savedRun(own,1000,6),{status:'gameover',lives:0});
 const child=await savedRun(own,800,8);await paidLink(own,prior,child,{receipt:false});
 await own.service.setUsername(null,{username:'Receipt Guard'});
 assert.equal((await own.service.leaderboard()).entries[0].score,1000);
 const foreign=await runState(await savedRun(other,9000,20),{status:'gameover',lives:0});
 const ownSecond=await savedRun(own,1200,10);await paidLink(other,foreign,ownSecond);
 await own.service.setUsername(null,{username:'Receipt Guard'});
 assert.equal((await own.service.leaderboard()).entries[0].score,1200);
});

test('cyclic legacy restart history rolls enrollment back without mutating runs or payment history',async()=>{
 const own=await player();
 const first=await runState(await savedRun(own,1000,6),{status:'gameover',lives:0});
 const second=await runState(await savedRun(own,800,8),{status:'gameover',lives:0});
 await paidLink(own,first,second);await paidLink(own,second,first);
 await assert.rejects(own.service.setUsername(null,{username:'Cycle Guard'}),/Saved restart history is invalid/);
 assert.deepEqual(await own.service.profile(),{username:null});
 assert.equal((await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[own.address])).rows.length,0);
 assert.equal((await db.query('SELECT * FROM breaker.invoices WHERE wallet=$1',[own.address])).rows.length,2);
 const runs=await db.query('SELECT state FROM breaker.runs WHERE wallet=$1',[own.address]);assert.deepEqual(runs.rows.map(run=>run.state.score).sort((a,b)=>a-b),[800,1000]);
});

test('one wallet keeps one best score across paid restarts, replays and fresh completed-run challenges',async()=>{
 const own=await player();await own.service.setUsername(null,{username:'Steady Oak'});
 const original=await savedRun(own,1000,9),restart=await savedRun(own,1000,1),newChallenge=await savedRun(own,0,1);
 await record(own,original,100);await record(own,restart,200);await record(own,newChallenge,300);await record(own,original,400);
 let rows=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[own.address])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].run_id,original.id);assert.equal(Number(rows[0].achieved_at),100);
 assert.deepEqual((await own.service.leaderboard()).entries,[{rank:1,username:'Steady Oak',score:1000,level:9}]);
 await record(own,await savedRun(own,1500,2),500);
 await record(own,await savedRun(own,1500,4),600);
 await record(own,await savedRun(own,1500,3),700);
 assert.deepEqual((await own.service.leaderboard()).entries,[{rank:1,username:'Steady Oak',score:1500,level:4}]);
 rows=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[own.address])).rows;
 assert.equal(Number(rows[0].achieved_at),600);
});

test('ranking uses score, then grove, then first recorded achievement, with stable positions',async()=>{
 const rows=[];
 for(const [username,score,level,time] of [['Early Oak',1000,5,100],['Late Oak',1000,5,200],['Deeper Oak',1000,6,300],['Higher Score',1200,1,400]]){
  const owner=await player();await record(owner,await savedRun(owner,score,level),time);await owner.service.setUsername(null,{username});rows.push(owner);
 }
 const first=await rows[0].service.leaderboard();
 assert.deepEqual(first.entries.map(row=>[row.rank,row.username]),[[1,'Higher Score'],[2,'Deeper Oak'],[3,'Early Oak'],[4,'Late Oak']]);
 assert.deepEqual((await rows[1].service.leaderboard()).entries,first.entries);
});

test('historical backfill corrects an exact tie to the earliest saved achievement time',async()=>{
 const own=await player(),other=await player();
 const earlier=await savedRun(own,1000,5,100),later=await savedRun(own,1000,5,1000);
 await record(own,later,1000);
 await record(other,await savedRun(other,1000,5,500),500);await other.service.setUsername(null,{username:'Middle Oak'});
 await own.service.setUsername(null,{username:'Earliest Oak'});
 const stored=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[own.address])).rows[0];
 assert.equal(Number(stored.achieved_at),100);assert.equal(stored.run_id,earlier.id);
 assert.deepEqual((await own.service.leaderboard()).entries.map(row=>row.username),['Earliest Oak','Middle Oak']);
});

test('the public board is bounded to the top twenty without duplicate wallets',async()=>{
 const owners=[];
 for(let index=0;index<25;index++){
  const owner=await player();await record(owner,await savedRun(owner,index+1,1));await owner.service.setUsername(null,{username:'Player '+String(index).padStart(2,'0')});owners.push(owner);
 }
 const board=await owners[0].service.leaderboard();
 assert.equal(board.entries.length,20);assert.equal(board.limit,20);
 assert.equal(board.entries[0].score,25);assert.equal(board.entries[19].score,6);
 assert.deepEqual(board.entries.map(row=>row.rank),Array.from({length:20},(_,index)=>index+1));
 assert.equal(new Set(board.entries.map(row=>row.username)).size,20);
});

test('username uniqueness is case insensitive and a failed rename preserves the original profile',async()=>{
 const first=await player(),second=await player();
 await first.service.setUsername(null,{username:'Canopy King'});await second.service.setUsername(null,{username:'Second Oak'});
 await assert.rejects(second.service.setUsername(null,{username:'canopy king'}),isStatus(409));
 assert.deepEqual(await second.service.profile(),{username:'Second Oak'});
 assert.deepEqual(await first.service.setUsername(null,{username:'CANOPY KING'}),{username:'CANOPY KING'});
});

test('concurrent claims for one username have exactly one winner',async()=>{
 const first=await player(),second=await player();
 const results=await Promise.allSettled([first.service.setUsername(null,{username:'Shared Crown'}),second.service.setUsername(null,{username:'shared crown'})]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.status===409).length,1);
 const profiles=await db.query('SELECT username FROM breaker.player_profiles WHERE lower(username)=$1',['shared crown']);assert.equal(profiles.rows.length,1);
});

test('renaming updates the public display while keeping one existing best result',async()=>{
 const own=await player();await record(own,await savedRun(own,900,4));
 await own.service.setUsername(null,{username:'First Oak'});await own.service.setUsername(null,{username:'New Oak'});
 assert.deepEqual((await own.service.leaderboard()).entries,[{rank:1,username:'New Oak',score:900,level:4}]);
 assert.equal((await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[own.address])).rows.length,1);
});

test('private profiles require an active holder session and cannot select a different wallet',async()=>{
 const own=await player(),other=await player();await own.service.setUsername(null,{username:'Own Name'});await other.service.setUsername(null,{username:'Other Name'});
 assert.deepEqual(await own.service.profile({wallet:other.address}),{username:'Own Name'});
 own.expire();await assert.rejects(own.service.profile(),isStatus(401));await assert.rejects(own.service.setUsername(null,{username:'Expired Name'}),isStatus(401));
 other.logout();await assert.rejects(other.service.profile(),isStatus(401));await assert.rejects(other.service.setUsername(null,{username:'Logged Out'}),isStatus(401));
 const names=await db.query('SELECT username FROM breaker.player_profiles ORDER BY username');assert.deepEqual(names.rows.map(row=>row.username),['Other Name','Own Name']);
});

test('the composite run ownership constraint rejects another wallet’s saved run',async()=>{
 const own=await player(),other=await player(),foreign=await savedRun(other,9000,20);
 await assert.rejects(record(own,foreign),error=>error.code==='23503');
 assert.equal((await db.query('SELECT * FROM breaker.leaderboard_scores')).rows.length,0);
});

test('invalid saved scores fail closed and safe maximum integers retain exact public values',async()=>{
 const own=await player(),run=await savedRun(own,10,1);
 for(const score of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])await assert.rejects(record(own,{...run,state:{score,level:1}}),/Invalid saved leaderboard score/);
 for(const level of [0,31,1.5])await assert.rejects(record(own,{...run,state:{score:100,level}}),/Invalid saved leaderboard score/);
 await assert.rejects(record(own,{id:'fake',state:{score:100,level:1}}),/Invalid saved leaderboard score/);
 const max=await savedRun(own,Number.MAX_SAFE_INTEGER,30);await record(own,max);await own.service.setUsername(null,{username:'Maximum Oak'});
 assert.equal((await own.service.leaderboard()).entries[0].score,Number.MAX_SAFE_INTEGER);
});
