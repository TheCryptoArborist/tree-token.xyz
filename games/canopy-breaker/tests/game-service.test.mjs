import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {NetlifyDB} from '@netlify/database-dev';import {toBase58} from '@mysten/sui/utils';
import {createGameService} from '../server/game-service.mjs';import {TREE_TYPE} from '../server/payments/tree.mjs';
import {createGame,layout,step} from '../src/engine.js';
const db=new NetlifyDB({logger:()=>{}});before(async()=>{await db.start();await db.applyMigrations('netlify/database/migrations');});after(async()=>db.stop());
function setup(){let time=100000,active=true,failReceipt=false;const address='0x'+randomBytes(32).toString('hex'),submits=[];
 const deps={database:db,authorize:async()=>{if(!active)throw Object.assign(Error('No session'),{status:401});return {address,expiresAt:9000000};},now:()=>time,seed:()=>42,
 reader:{decimals:async()=>6,failed:async()=>false,receipt:async i=>{if(failReceipt)throw Error('No chain');return {digest:i.expectedDigest,wallet:i.wallet,recipient:i.recipient,coinType:TREE_TYPE,amount:i.amount,checkpoint:'123',timestampMs:i.createdAt+1};}},
 inspectSigned:async signed=>{if(!signed.valid)throw Error('Bad signature');return signed.digest;},executeSigned:async(signed,digest)=>submits.push({signed,digest})};
 return {service:createGameService(deps),deps,address,submits,setTime:t=>time=t,logout:()=>active=false,failReceipt:()=>failReceipt=true};}
async function defeated(s,score,progress={}){const r=await s.service.open();Object.assign(r.state,progress);r.state.status='gameover';r.state.lives=0;r.state.balls=[];if(score!==undefined)r.state.score=score;await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify(r.state),r.id]);return r;}
async function bound(s,score,progress){const r=await defeated(s,score,progress),q=await s.service.quote(),signed={valid:true,digest:toBase58(randomBytes(32)),bytes:'recorded-bytes',signature:'verified-signature'};await s.service.bind(null,{id:q.id,signed});s.setTime(q.createdAt+10);return {r,q,signed};}
function damagedBoard(level){const bricks=layout(level).slice(5),armored=bricks.find(brick=>brick.hp>1);if(armored)armored.hp--;return bricks;}
async function storedRun(id){return (await db.query('SELECT * FROM breaker.runs WHERE id=$1',[id])).rows[0];}
// Reproduce the previously deployed state shape: each paid restart began a
// new score segment and had no carry marker. Payment/receipt links stay real.
async function legacyRun(id,changes){const row=await storedRun(id),state={...row.state,...changes};delete state.scoreCarryVersion;delete state.carriedScore;await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify(state),id]);return storedRun(id);}
async function purchased(s,score){const {r,q}=await bound(s,score);return {prior:r,invoice:q,run:await s.service.redeem(null,{id:q.id})};}
test('a wallet gets one durable first run; refresh and a new service cannot reset a defeat',async()=>{const s=setup(),a=await s.service.open(),b=await s.service.open();assert.equal(a.id,b.id);await defeated(s);const r=await createGameService(s.deps).open();assert.equal(r.id,a.id);assert.equal(r.state.lives,0);assert.equal(r.state.status,'gameover');await assert.rejects(s.service.next());});
test('only inputs are accepted; the server replays lives, score and progression',async()=>{const s=setup(),r=await s.service.open();const result=await s.service.frames(null,{id:r.id,revision:0,inputs:[{x:400,launch:true,fire:false}]});assert.equal(result.revision,1);assert.equal(result.state.status,'playing');await assert.rejects(s.service.frames(null,{id:r.id,revision:1,inputs:[{x:400,launch:true,fire:false,lives:99}]}));assert.equal((await s.service.open()).state.lives,3);});
test('duplicate and competing input batches cannot advance the simulation twice',async()=>{const s=setup(),r=await s.service.open(),input={id:r.id,revision:0,inputs:[{x:400,launch:true,fire:false}]};const a=await s.service.frames(null,input),b=await s.service.frames(null,input);assert.equal(a.state.tick,b.state.tick);assert.equal(b.resync,true);});
test('a new run keeps 120 frames of initial credit and cannot immediately run ahead of the clock',async()=>{
 const s=setup(),r=await s.service.open(),frame={x:400,launch:false,fire:false};
 assert.equal((await storedRun(r.id)).credit,120);
 const saved=await s.service.frames(null,{id:r.id,revision:0,inputs:Array(120).fill(frame)});
 assert.equal(saved.revision,1);assert.equal(saved.state.tick,120);
 const before=await storedRun(r.id);assert.equal(before.credit,0);
 await assert.rejects(s.service.frames(null,{id:r.id,revision:1,inputs:[frame]}),error=>error.status===429);
 assert.deepEqual(await storedRun(r.id),before);
});
test('a delayed 600-frame backlog replays after enough elapsed time without granting faster gameplay',async()=>{
 const s=setup(),r=await s.service.open(),frame={x:400,launch:false,fire:false};
 await s.service.frames(null,{id:r.id,revision:0,inputs:Array(120).fill(frame)});
 s.setTime(110000);
 const saved=await s.service.frames(null,{id:r.id,revision:1,inputs:Array(600).fill(frame)});
 assert.equal(saved.revision,2);assert.equal(saved.state.tick,720);
 assert.equal(saved.state.status,'ready');assert.equal(saved.state.lives,3);assert.equal(saved.state.score,0);
 const stored=await storedRun(r.id);assert.equal(stored.credit,0);assert.equal(Number(stored.updated_at),110000);
 await assert.rejects(s.service.frames(null,{id:r.id,revision:2,inputs:[frame]}),error=>error.status===429);
 assert.deepEqual(await storedRun(r.id),stored);
});
test('sustained 60 Hz gameplay refills exactly as quickly as it consumes clock credit',async()=>{
 const s=setup(),r=await s.service.open(),frame={x:400,launch:false,fire:false};
 let saved=await s.service.frames(null,{id:r.id,revision:0,inputs:Array(120).fill(frame)});
 for(let second=1;second<=20;second++){
  s.setTime(100000+second*1000);
  saved=await s.service.frames(null,{id:r.id,revision:saved.revision,inputs:Array(60).fill(frame)});
  assert.equal(saved.state.tick,120+second*60);
  assert.equal((await storedRun(r.id)).credit,0);
 }
 assert.equal(saved.revision,21);
 await assert.rejects(s.service.frames(null,{id:r.id,revision:saved.revision,inputs:[frame]}),error=>error.status===429);
});
test('long idle time caps stored replay allowance at 900 frames across bounded batches',async()=>{
 const s=setup(),r=await s.service.open(),frame={x:400,launch:false,fire:false};
 s.setTime(160000);
 const first=await s.service.frames(null,{id:r.id,revision:0,inputs:Array(600).fill(frame)});
 assert.equal(first.state.tick,600);assert.equal((await storedRun(r.id)).credit,300);
 const before=await storedRun(r.id);
 await assert.rejects(s.service.frames(null,{id:r.id,revision:first.revision,inputs:Array(301).fill(frame)}),error=>error.status===429);
 assert.deepEqual(await storedRun(r.id),before);
 const second=await s.service.frames(null,{id:r.id,revision:first.revision,inputs:Array(300).fill(frame)});
 assert.equal(second.state.tick,900);assert.equal((await storedRun(r.id)).credit,0);
 await assert.rejects(s.service.frames(null,{id:r.id,revision:second.revision,inputs:[frame]}),error=>error.status===429);
});
test('an oversized 601-frame batch is rejected without advancing the run or changing its credit',async()=>{
 const s=setup(),r=await s.service.open(),frame={x:400,launch:false,fire:false},before=await storedRun(r.id);
 s.setTime(160000);
 await assert.rejects(s.service.frames(null,{id:r.id,revision:0,inputs:Array(601).fill(frame)}),error=>error.status===400&&/Invalid game inputs/.test(error.message));
 assert.deepEqual(await storedRun(r.id),before);
 const valid=await s.service.frames(null,{id:r.id,revision:0,inputs:Array(600).fill(frame)});
 assert.equal(valid.revision,1);assert.equal(valid.state.tick,600);assert.equal((await storedRun(r.id)).credit,300);
});
test('competing and retried 600-frame batches resync after exactly one simulation advance',async()=>{
 const s=setup(),r=await s.service.open(),frame={x:400,launch:false,fire:false};
 s.setTime(108000);
 const batch={id:r.id,revision:0,inputs:Array(600).fill(frame)};
 const results=await Promise.all([s.service.frames(null,batch),createGameService(s.deps).frames(null,batch)]);
 assert.equal(results.filter(result=>result.resync===true).length,1);
 assert.equal(results[0].revision,1);assert.equal(results[1].revision,1);
 assert.equal(results[0].state.tick,600);assert.deepEqual(results[0].state,results[1].state);
 const before=await storedRun(r.id);assert.equal(before.credit,0);assert.equal(Number(before.updated_at),108000);
 s.setTime(118000);
 const retry=await createGameService(s.deps).frames(null,batch);
 assert.equal(retry.resync,true);assert.equal(retry.revision,1);assert.deepEqual(retry.state,results[0].state);
 assert.deepEqual(await storedRun(r.id),before);
});
test('a restart requires zero lives and quotes exactly 20,000 TREE using chain decimals',async()=>{const s=setup();await s.service.open();await assert.rejects(s.service.quote());await defeated(s);const [a,b]=await Promise.all([s.service.quote(),s.service.quote()]);assert.equal(a.id,b.id);assert.equal(a.amount,'20000000000');assert.equal(a.product,'continue');});
test('unverified receipts, foreign-wallet invoices and unsigned claims cannot restart',async()=>{const s=setup(),other=setup(),{q}=await bound(s);await other.service.open();await assert.rejects(other.service.redeem(null,{id:q.id}));s.failReceipt();await assert.rejects(s.service.redeem(null,{id:q.id}));assert.equal((await s.service.open()).state.status,'gameover');});
test('paid continue retains score, grove and damaged bricks through repeated recovery and reopening',async()=>{
 const s=setup(),bricks=damagedBoard(17),{r,q,signed}=await bound(s,4321,{level:17,bricks,tick:12345,levelTicks:777});
 assert(bricks.length<layout(17).length);assert(bricks.some(brick=>brick.hp<brick.maxHp));
 const defeatedRow=await storedRun(r.id);
 await s.service.submit(null,{id:q.id});await s.service.submit(null,{id:q.id});
 assert.deepEqual(s.submits[0],s.submits[1]);assert.equal(s.submits[0].signed.bytes,signed.bytes);
 const a=await s.service.redeem(null,{id:q.id}),b=await s.service.redeem(null,{id:q.id});
 assert.notEqual(a.id,r.id);assert.equal(a.id,b.id);assert.equal(a.state.lives,3);assert.equal(a.state.status,'ready');
 assert.equal(a.state.level,17);assert.equal(a.state.score,4321);assert.equal(a.state.carriedScore,4321);
 assert.deepEqual(a.state.bricks,bricks);assert.equal(a.applied,true);assert.equal(b.applied,false);assert.deepEqual(b.state,a.state);
 const reopened=await createGameService(s.deps).open();
 assert.equal(reopened.id,a.id);assert.deepEqual(reopened.state,a.state);
 assert.deepEqual(await storedRun(r.id),defeatedRow);
 const best=(await db.query('SELECT score,level FROM breaker.leaderboard_scores WHERE wallet=$1',[s.address])).rows;
 assert.equal(best.length,1);assert.equal(Number(best[0].score),4321);assert.equal(best[0].level,17);
 assert.equal((await db.query('SELECT * FROM breaker.receipts WHERE invoice_id=$1',[q.id])).rows.length,1);
 assert.equal((await db.query('SELECT * FROM breaker.restarts WHERE invoice_id=$1',[q.id])).rows.length,1);
 assert.equal((await s.service.history())[0].status,'paid');
});
test('paid continue restores three lives at the final boss with its remaining health preserved',async()=>{
 const progress=createGame(42);Object.assign(progress,{level:30,bricks:[],status:'playing'});step(progress,{x:400});
 assert.equal(progress.boss.hp,45);progress.boss.hp=7;
 const s=setup(),{r,q}=await bound(s,29800,progress),before=await storedRun(r.id);
 const continued=await s.service.redeem(null,{id:q.id});
 assert.equal(continued.state.level,30);assert.equal(continued.state.score,29800);assert.equal(continued.state.carriedScore,29800);
 assert.equal(continued.state.lives,3);assert.equal(continued.state.status,'ready');assert.deepEqual(continued.state.bricks,[]);
 assert.equal(continued.state.boss.hp,7);assert.equal(continued.state.boss.maxHp,45);
 const recovered=await createGameService(s.deps).redeem(null,{id:q.id}),reopened=await s.service.open();
 assert.equal(recovered.id,continued.id);assert.equal(recovered.applied,false);assert.deepEqual(recovered.state,continued.state);
 assert.equal(reopened.id,continued.id);assert.deepEqual(reopened.state,continued.state);assert.deepEqual(await storedRun(r.id),before);
 assert.equal((await db.query('SELECT * FROM breaker.receipts WHERE invoice_id=$1',[q.id])).rows.length,1);
});
test('two legacy paid resets restore all earlier score segments and retain points earned since the latest restart',async()=>{const s=setup(),first=await purchased(s,1000),second=await purchased(s,1600);await legacyRun(first.prior.id,{score:1000});await legacyRun(first.run.id,{score:600});const before=await legacyRun(second.run.id,{score:75,tick:42});const [a,b]=await Promise.all([s.service.open(),createGameService(s.deps).open()]);assert.equal(a.state.score,1675);assert.equal(b.state.score,1675);assert.equal(a.state.carriedScore,1600);assert.equal(a.state.tick,42);assert.equal(a.state.lives,3);assert.equal(a.state.level,1);assert.equal(a.revision,b.revision);assert.equal(a.revision,before.revision+1);const reopened=await s.service.open();assert.equal(reopened.revision,a.revision);assert.equal(reopened.state.score,1675);assert.equal((await s.service.history()).length,2);assert.equal(s.submits.length,0);});
test('a previously repaired ancestor contributes its total once without recounting older paid runs',async()=>{const s=setup(),first=await purchased(s,1000),second=await purchased(s,1600);await legacyRun(second.run.id,{score:75});const repaired=await s.service.open();assert.equal(repaired.state.score,1675);assert.equal(repaired.state.carriedScore,1600);assert.equal((await storedRun(first.run.id)).state.score,1600);assert.equal((await storedRun(first.prior.id)).state.score,1000);});
test('historical receipt recovery and current-run repair cannot add inherited score twice',async()=>{const s=setup(),first=await purchased(s,1000),second=await purchased(s,1600);await legacyRun(first.prior.id,{score:1000});await legacyRun(first.run.id,{score:600});await legacyRun(second.run.id,{score:75});const old=await s.service.redeem(null,{id:first.invoice.id});assert.equal(old.applied,false);assert.equal(old.state.score,1600);const current=await s.service.open();assert.equal(current.id,second.run.id);assert.equal(current.state.score,1675);const repeated=await s.service.redeem(null,{id:first.invoice.id});assert.equal(repeated.state.score,1600);assert.equal((await s.service.open()).state.score,1675);});
test('a score repair resyncs stale frames without advancing the simulation or changing clock credit',async()=>{const s=setup(),paid=await purchased(s,1000);await legacyRun(paid.run.id,{score:75,tick:42});await db.query('UPDATE breaker.runs SET revision=$1,credit=$2,updated_at=$3 WHERE id=$4',[7,17,12345,paid.run.id]);const result=await s.service.frames(null,{id:paid.run.id,revision:7,inputs:[{x:400,launch:true,fire:false}]});assert.equal(result.resync,true);assert.equal(result.revision,8);assert.equal(result.state.score,1075);assert.equal(result.state.tick,42);assert.equal(result.state.status,'ready');const stored=await storedRun(paid.run.id);assert.equal(stored.credit,17);assert.equal(Number(stored.updated_at),12345);assert.equal(stored.revision,8);});
test('finishing a campaign starts the next challenge at zero without carrying a prior paid score',async()=>{const s=setup(),paid=await purchased(s,1000),state={...paid.run.state,status:'won',score:12000,level:30};await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify(state),paid.run.id]);const next=await s.service.next();assert.notEqual(next.id,paid.run.id);assert.equal(next.state.score,0);assert.equal(next.state.carriedScore,0);assert.equal(next.state.lives,3);assert.equal(next.state.level,1);assert.equal((await s.service.history()).length,1);});
test('a legacy restart without a recorded receipt cannot contribute inherited score',async()=>{const s=setup(),paid=await purchased(s,1000);await legacyRun(paid.run.id,{score:75});await db.query('DELETE FROM breaker.receipts WHERE invoice_id=$1',[paid.invoice.id]);const run=await s.service.open();assert.equal(run.state.score,75);assert.equal(run.state.carriedScore,0);});
test('a foreign-wallet payment link cannot contribute inherited score',async()=>{const s=setup(),other=setup(),own=await purchased(s,1000),foreign=await purchased(other,9000);await legacyRun(own.run.id,{score:75});await db.query('DELETE FROM breaker.restarts WHERE invoice_id=$1',[foreign.invoice.id]);await db.query('UPDATE breaker.restarts SET invoice_id=$1 WHERE new_run=$2',[foreign.invoice.id,own.run.id]);const run=await s.service.open();assert.equal(run.state.score,75);assert.equal(run.state.carriedScore,0);assert.equal((await other.service.open()).state.score,9000);});
test('cyclic legacy payment history fails without changing the saved run',async()=>{const s=setup(),paid=await purchased(s,1000),before=await legacyRun(paid.run.id,{score:75,status:'gameover',lives:0,balls:[]});await db.query('UPDATE breaker.invoices SET run_id=$1 WHERE id=$2',[paid.run.id,paid.invoice.id]);await assert.rejects(s.service.open(),/Saved restart history is invalid/);const after=await storedRun(paid.run.id);assert.deepEqual(after.state,before.state);assert.equal(after.revision,before.revision);});
test('a signed digest cannot be reused by a different wallet',async()=>{const s=setup(),{signed}=await bound(s),other=setup();await defeated(other);const q=await other.service.quote();await assert.rejects(other.service.bind(null,{id:q.id,signed}));});
test('restart transaction rollback preserves the defeat and unpaid recoverable invoice',async()=>{const s=setup(),{q,r}=await bound(s);const bad={...s.deps,database:{query:(...a)=>db.query(...a),transaction:fn=>db.transaction(tx=>fn({query:(sql,args)=>{if(sql.startsWith('INSERT INTO breaker.restarts'))throw Error('Injected write failure');return tx.query(sql,args);}}))}};await assert.rejects(createGameService(bad).redeem(null,{id:q.id}),/Injected/);assert.equal((await s.service.open()).id,r.id);assert.equal((await s.service.open()).state.status,'gameover');assert.equal((await s.service.history())[0].status,'bound');assert.equal((await db.query('SELECT * FROM breaker.receipts WHERE invoice_id=$1',[q.id])).rows.length,0);});
test('logout and expired unsigned invoices cannot authorize a restart',async()=>{const s=setup();await defeated(s);const q=await s.service.quote();s.setTime(q.expiresAt);await assert.rejects(s.service.bind(null,{id:q.id,signed:{valid:true,digest:toBase58(randomBytes(32)),bytes:'b',signature:'s'}}));s.logout();await assert.rejects(s.service.open());});
test('signed invoice survives its quote window so a completed transfer remains recoverable',async()=>{const s=setup(),{q}=await bound(s);s.setTime(q.expiresAt+5000);const restored=await s.service.redeem(null,{id:q.id});assert.equal(restored.state.lives,3);});
test('saved gameplay updates one best leaderboard score and paid restarts or new challenges cannot lower it',async()=>{const s=setup(),run=await s.service.open();assert.equal((await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[s.address])).rows.length,0);const state={...run.state,score:2000,level:8};await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify(state),run.id]);await s.service.frames(null,{id:run.id,revision:run.revision,inputs:[{x:400,launch:true,fire:false}]});let best=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[s.address])).rows;assert.equal(best.length,1);assert.equal(Number(best[0].score),2000);assert.equal(best[0].level,8);const paid=await purchased(s,2000);best=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[s.address])).rows;assert.equal(best.length,1);assert.equal(Number(best[0].score),2000);assert.equal(best[0].level,8);await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify({...paid.run.state,status:'won',score:10000,level:30}),paid.run.id]);const next=await s.service.next();assert.equal(next.state.score,0);best=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[s.address])).rows;assert.equal(best.length,1);assert.equal(Number(best[0].score),10000);assert.equal(best[0].level,30);});

test('a free new game from an advanced grove resets to grove one while preserving the defeat, username and best score',async()=>{
 const s=setup(),old=await defeated(s,18500,{level:17,bricks:damagedBoard(17)});
 await db.query('INSERT INTO breaker.player_profiles(wallet,username,updated_at) VALUES($1,$2,$3)',[s.address,'Fresh '+s.address.slice(-8),100000]);
 const before=await storedRun(old.id),next=await s.service.newGame(null,{id:old.id});
 assert.notEqual(next.id,old.id);assert.equal(next.state.score,0);assert.equal(next.state.carriedScore,0);
 assert.equal(next.state.level,1);assert.equal(next.state.lives,3);assert.equal(next.state.status,'ready');assert.deepEqual(next.state.bricks,layout(1));
 assert.equal(next.state.newGameFrom,old.id);assert.deepEqual(await storedRun(old.id),before);
 assert.equal((await s.service.open()).id,next.id);
 const best=(await db.query('SELECT * FROM breaker.leaderboard_scores WHERE wallet=$1',[s.address])).rows;
 assert.equal(best.length,1);assert.equal(Number(best[0].score),18500);assert.equal(best[0].level,17);
 assert.equal((await db.query('SELECT username FROM breaker.player_profiles WHERE wallet=$1',[s.address])).rows[0].username,'Fresh '+s.address.slice(-8));
 assert.deepEqual(await s.service.history(),[]);assert.equal(s.submits.length,0);
});

test('concurrent free-new-game clicks and lost-response retries return the same run without erasing its progress',async()=>{
 const s=setup(),old=await defeated(s,700);
 const [a,b]=await Promise.all([s.service.newGame(null,{id:old.id}),createGameService(s.deps).newGame(null,{id:old.id})]);
 assert.equal(a.id,b.id);assert.equal((await db.query('SELECT id FROM breaker.runs WHERE wallet=$1',[s.address])).rows.length,2);
 const playing=await s.service.frames(null,{id:a.id,revision:a.revision,inputs:[{x:400,launch:true,fire:false}]});
 const retry=await createGameService(s.deps).newGame(null,{id:old.id});
 assert.equal(retry.id,playing.id);assert.equal(retry.revision,playing.revision);assert.deepEqual(retry.state,playing.state);
 assert.equal(retry.state.status,'playing');assert(retry.state.tick>0);assert.equal(s.submits.length,0);
});

test('free new games reject invalid, active, completed, foreign and stale run requests',async()=>{
 const s=setup(),initial=await s.service.open();
 await assert.rejects(s.service.newGame(null,{id:'not-a-run'}),error=>error.status===400);
 await assert.rejects(s.service.newGame(null,{id:initial.id}),error=>error.status===409);
 await db.query('UPDATE breaker.runs SET state=$1 WHERE id=$2',[JSON.stringify({...initial.state,status:'won',level:30}),initial.id]);
 await assert.rejects(s.service.newGame(null,{id:initial.id}),error=>error.status===409);
 const own=await defeated(s,100),other=setup(),foreign=await defeated(other,9999);
 await assert.rejects(s.service.newGame(null,{id:foreign.id}),error=>error.status===409);
 const first=await s.service.newGame(null,{id:own.id}),secondDefeat=await defeated(s,20);
 const second=await s.service.newGame(null,{id:secondDefeat.id});
 assert.notEqual(first.id,second.id);
 await assert.rejects(s.service.newGame(null,{id:own.id}),error=>error.status===409);
 assert.equal((await s.service.open()).id,second.id);
});

test('a free new game cancels an unsigned quote and prevents its later signature from binding',async()=>{
 const s=setup(),old=await defeated(s,500),quote=await s.service.quote();
 const next=await s.service.newGame(null,{id:old.id});
 assert.equal(next.state.score,0);assert.equal((await s.service.history())[0].status,'cancelled');
 await assert.rejects(s.service.bind(null,{id:quote.id,signed:{valid:true,digest:toBase58(randomBytes(32)),bytes:'late-bytes',signature:'late-signature'}}));
 assert.equal((await s.service.open()).id,next.id);assert.equal(s.submits.length,0);
 assert.equal((await db.query('SELECT * FROM breaker.receipts WHERE invoice_id=$1',[quote.id])).rows.length,0);
});

test('a recorded signed payment blocks a free reset and remains recoverable through the paid continue',async()=>{
 const s=setup(),{r,q}=await bound(s,4321),before=await storedRun(r.id);
 await assert.rejects(s.service.newGame(null,{id:r.id}),error=>error.status===409&&/recover|payment/i.test(error.message));
 assert.deepEqual(await storedRun(r.id),before);assert.equal((await s.service.open()).id,r.id);
 assert.equal((await s.service.history())[0].status,'bound');
 assert.equal((await db.query('SELECT * FROM breaker.receipts WHERE invoice_id=$1',[q.id])).rows.length,0);
 await s.service.submit(null,{id:q.id});const paid=await s.service.redeem(null,{id:q.id});
 assert.equal(paid.state.score,4321);assert.equal(paid.state.lives,3);assert.equal(s.submits.length,1);
 assert.equal((await s.service.history())[0].status,'paid');
});

test('an unsigned bind racing a free reset cannot record a payment after its quote is cancelled',async()=>{
 const s=setup(),old=await defeated(s,500),q=await s.service.quote();let inspected,release;
 const inspecting=new Promise(resolve=>inspected=resolve),resume=new Promise(resolve=>release=resolve);
 const racing=createGameService({...s.deps,inspectSigned:async(...args)=>{inspected();await resume;return s.deps.inspectSigned(...args);}});
 const binding=racing.bind(null,{id:q.id,signed:{valid:true,digest:toBase58(randomBytes(32)),bytes:'racing-bytes',signature:'racing-signature'}});
 await inspecting;const next=await s.service.newGame(null,{id:old.id});release();
 await assert.rejects(binding);assert.equal((await s.service.history())[0].status,'cancelled');
 assert.equal((await s.service.open()).id,next.id);assert.equal(s.submits.length,0);
});

test('a concurrent paid redemption and free reset cannot strand a verified transfer',async()=>{
 const s=setup(),{r,q}=await bound(s,2500);
 const [free,paid]=await Promise.allSettled([s.service.newGame(null,{id:r.id}),s.service.redeem(null,{id:q.id})]);
 assert.equal(free.status,'rejected');assert.equal(free.reason.status,409);assert.equal(paid.status,'fulfilled');
 assert.equal(paid.value.state.score,2500);assert.equal((await s.service.open()).id,paid.value.id);
 assert.equal((await s.service.history())[0].status,'paid');
 assert.equal((await db.query('SELECT * FROM breaker.receipts WHERE invoice_id=$1',[q.id])).rows.length,1);
});

test('failed free-game creation rolls back quote cancellation and preserves the finished run',async()=>{
 const s=setup(),old=await defeated(s,500),q=await s.service.quote();
 const broken=createGameService({...s.deps,database:{query:(...args)=>db.query(...args),transaction:fn=>db.transaction(tx=>fn({query:(sql,args)=>{if(sql.startsWith('INSERT INTO breaker.runs'))throw Error('Injected new-game write failure');return tx.query(sql,args);}}))}});
 await assert.rejects(broken.newGame(null,{id:old.id}),/Injected new-game/);
 assert.equal((await s.service.open()).id,old.id);assert.equal((await s.service.history())[0].id,q.id);
 assert.equal((await s.service.history())[0].status,'quoted');assert.equal(s.submits.length,0);
});

test('free resets require an active holder session and roll back if it expires before commit',async()=>{
 const loggedOut=setup(),old=await defeated(loggedOut,500);loggedOut.logout();
 await assert.rejects(loggedOut.service.newGame(null,{id:old.id}),error=>error.status===401);
 const expired=setup(),defeat=await defeated(expired,500);
 const service=createGameService({...expired.deps,database:{query:(...args)=>db.query(...args),transaction:fn=>db.transaction(tx=>fn({query:async(sql,args)=>{const result=await tx.query(sql,args);if(sql.startsWith('INSERT INTO breaker.runs'))expired.setTime(9000000);return result;}}))}});
 await assert.rejects(service.newGame(null,{id:defeat.id}),error=>error.status===401);
 assert.equal((await db.query('SELECT current_run FROM breaker.accounts WHERE wallet=$1',[expired.address])).rows[0].current_run,defeat.id);
 assert.equal((await db.query('SELECT id FROM breaker.runs WHERE wallet=$1',[expired.address])).rows.length,1);
});
