// Only disposable local/CI PostgreSQL. Never reads hosted credentials.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createPaidContinueService,paidContinueSchemaReady,createPaidContinueHttpHandler} from '../netlify/preview-lib/treeforce89-paid-continue.mjs';
import {createAuthenticatedSessionResolver} from '../netlify/preview-lib/treeforce89-source/game/authenticated-session.mjs';
import {TREE_COIN_TYPE,TREE_RECIPIENT} from '../treeforce89/paid/contract.mjs';
import {prepareAuthorizedContinue} from '../treeforce89/paid/authorized-continue-resume.mjs';
import {toBase58} from '../netlify/preview-lib/treeforce89-source/node_modules/@mysten/sui/dist/utils/index.mjs';
const require=createRequire(import.meta.url),pg=require('pg');
let emulator,pool;
if(process.env.PGHOST){
 assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'treeforce89_paid_test');pool=new pg.Pool({max:5});
}else{
 const {NetlifyDB}=await import(pathToFileURL(resolve('../local-db-harness/node_modules/@netlify/database-dev/dist/main.js')));
 emulator=new NetlifyDB({logger:()=>{}});pool=new pg.Pool({connectionString:await emulator.start(),max:1});
}
const wallet='0x'+'8'.repeat(64),different='0x'+'9'.repeat(64),digest=()=>toBase58(randomBytes(32));
const snapshots=new Map();
const snapshot=runId=>{if(!snapshots.has(runId))snapshots.set(runId,{runId,seed:42,score:12500,wave:4,kills:39,perfect:2,maxStage:3,shotsFired:100,shotsHit:60,start:Date.now()-60000,mode:'ARCADE'});return snapshots.get(runId);};
const seed=async(w=wallet)=>{
 const sessionToken=randomBytes(32).toString('hex'),runId='grove-'+randomBytes(16).toString('hex'),sessionId=randomBytes(24).toString('hex');
 await pool.query(`INSERT INTO tree_game_sessions(session_id,wallet,run_id,session_token_hash,expires_at)
  VALUES($1,$2,$3,$4,now()+interval '2 hours')`,[sessionId,w,runId,createHash('sha256').update(sessionToken).digest('hex')]);
 return {sessionToken,runId,sessionId,wallet:w};
};
const receipt=(d,patch={})=>({$kind:'Transaction',Transaction:{digest:d,status:{success:true},effects:{status:{success:true}},
 checkpoint:'123456',timestampMs:Date.now(),transaction:{sender:wallet},
 balanceChanges:[{coinType:TREE_COIN_TYPE,address:wallet,amount:'-20000000000'},{coinType:TREE_COIN_TYPE,address:TREE_RECIPIENT,amount:'20000000000'}],...patch}});
const service=(read=async d=>receipt(d),options={})=>createPaidContinueService({pool,
 client:{network:'mainnet',ledgerService:{getCheckpoint:async()=>({response:{checkpoint:{sequenceNumber:1n}}})},
  core:{getCoinMetadata:async()=>({coinMetadata:{decimals:6}}),getTransaction:({digest:d})=>read(d)}},
 ownershipChecker:async()=>true,enabled:true,...options});
const open=async(s,api=service())=>api.offer({sessionToken:s.sessionToken,runId:s.runId,lives:0,snapshot:snapshot(s.runId)});
const claim=(s,o,d)=>({sessionToken:s.sessionToken,offerId:o.offerId,digest:d});
const count=async id=>Number((await pool.query('SELECT count(*) AS n FROM tree_continue_redemptions WHERE session_id=$1',[id])).rows[0].n);
const resolver=createAuthenticatedSessionResolver(pool);
try{
 await pool.query(await readFile(new URL('../db/staged-migrations/20261016030500_tree_authentication.sql',import.meta.url),'utf8'));
 assert.equal(await paidContinueSchemaReady(pool),false);
 await pool.query(await readFile(new URL('../db/staged-migrations/20261031045000_tree_paid_continue.sql',import.meta.url),'utf8'));
 assert.equal(await paidContinueSchemaReady(pool),true);
 await pool.query('DROP INDEX tree_continue_redemptions_offer_idx');
 assert.equal(await paidContinueSchemaReady(pool),false);
 await pool.query('CREATE UNIQUE INDEX tree_continue_redemptions_offer_idx ON tree_continue_redemptions(offer_id) WHERE offer_id IS NOT NULL');
 assert.equal(await paidContinueSchemaReady(pool),true);
 const s=await seed(),api=service(),o=await open(s,api),d=digest();
 assert.equal(o.amountBaseUnits,'20000000000');assert.equal(o.enabled,true);assert.equal(o.recipient,TREE_RECIPIENT);
 assert.equal((await open(s,api)).offerId,o.offerId);
 await assert.rejects(api.offer({sessionToken:s.sessionToken,runId:s.runId,lives:1,snapshot:snapshot(s.runId)}));
 const grants=await Promise.all([api.redeem(claim(s,o,d)),api.redeem(claim(s,o,d))]);
 assert.equal(await count(s.sessionId),1);assert.equal(grants[0].continuationNumber,1);assert.equal(grants[1].continuationNumber,1);
 const resumed=prepareAuthorizedContinue(grants[0].snapshot,grants[0]);assert.equal(resumed.wave,4);assert.equal(resumed.score,12500);
 assert.equal(grants[0].lives,3);assert.equal(grants[0].runId,s.runId);
 const next=await open(s,api);assert.notEqual(next.offerId,o.offerId);
 await assert.rejects(api.redeem(claim(s,o,d)));
 await assert.rejects(api.redeem(claim(s,next,d)));
 assert.equal(await count(s.sessionId),1);
 const second=await api.redeem(claim(s,next,digest()));assert.equal(second.continuationNumber,2);
 assert.equal(await count(s.sessionId),2);
 // Independent chain lookup must reject every mismatching or unfinished receipt.
 const pending=await seed(),pendingOffer=await open(pending);
 for(const patch of [
  {transaction:{sender:different}},
  {balanceChanges:[{coinType:TREE_COIN_TYPE,address:different,amount:'20000000000'}]},
  {balanceChanges:[{coinType:'0x2::sui::SUI',address:TREE_RECIPIENT,amount:'20000000000'}]},
  {balanceChanges:[{coinType:TREE_COIN_TYPE,address:TREE_RECIPIENT,amount:'19999999999'}]},
  {timestampMs:1},{checkpoint:'1'},{checkpoint:null},{status:{success:false}},{effects:{status:{success:false}}}
 ])await assert.rejects(service(async d=>receipt(d,patch)).redeem(claim(pending,pendingOffer,digest())));
 assert.equal(await count(pending.sessionId),0);
 const other=await seed(different);await assert.rejects(api.redeem(claim(other,pendingOffer,digest())));
 await assert.rejects(service(undefined,{enabled:false}).offer({sessionToken:pending.sessionToken,runId:pending.runId,lives:0,snapshot:snapshot(pending.runId)}));
 const rival=await seed(),rivalOffer=await open(rival);
 const raced=await Promise.allSettled([api.redeem(claim(rival,rivalOffer,digest())),api.redeem(claim(rival,rivalOffer,digest()))]);
 assert.equal(raced.filter(x=>x.status==='fulfilled').length,1);assert.equal(await count(rival.sessionId),1);
 // Logout during a chain read must beat redemption under the SQL row lock.
 const logout=await seed(),logoutOffer=await open(logout);let begin,finish;
 const started=new Promise(r=>{begin=r;});
 const slow=service(async d=>{const tx=receipt(d);begin();await new Promise(r=>{finish=r;});return tx;});
 const attempt=slow.redeem(claim(logout,logoutOffer,digest()));await started;
 await pool.query('UPDATE tree_game_sessions SET expires_at=clock_timestamp() WHERE session_id=$1',[logout.sessionId]);
 finish();await assert.rejects(attempt);assert.equal(await count(logout.sessionId),0);
 // Refresh: signed-in wallet gets a fresh lease, recovers the paid flight and
 // cannot resurrect or expose the old raw credential.
 const recovery=await seed(),recoveryOffer=await open(recovery),recoveryDigest=digest();
 await api.redeem(claim(recovery,recoveryOffer,recoveryDigest));
 await pool.query('UPDATE tree_game_sessions SET expires_at=clock_timestamp() WHERE session_id=$1',[recovery.sessionId]);
 const fresh=await seed(),recovered=await api.redeem(claim(fresh,recoveryOffer,recoveryDigest));
 assert.equal(recovered.runId,recovery.runId);assert.equal(recovered.session.sessionToken,fresh.sessionToken);
 assert.equal((await resolver({sessionToken:fresh.sessionToken})).runId,recovery.runId);
 await assert.rejects(resolver({sessionToken:recovery.sessionToken}));assert.equal(await count(recovery.sessionId),1);
 // Exact HTTP contract, bounded body, origin and bearer requirements.
 const http=createPaidContinueHttpHandler({action:'offer',getService:async()=>api});
 const origin='https://tree-token.xyz',url=origin+'/play/treeforce89/api/tree-continue-offer';
 const req=(body,token=pending.sessionToken,requestOrigin=origin)=>new Request(url,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
 assert.equal((await http(req({runId:pending.runId,snapshot:snapshot(pending.runId),lives:0}))).status,200);
 assert.equal((await http(req({runId:pending.runId,snapshot:snapshot(pending.runId),lives:0,authorized:true}))).status,400);
 assert.equal((await http(req({x:'a'.repeat(3000)}))).status,400);
 assert.equal((await http(req({},'invalid'))).status,401);
 assert.equal((await http(req({},pending.sessionToken,'https://attacker.example'))).status,403);
 const result={engine:emulator?'Netlify PostgreSQL emulator':'PostgreSQL 16',localOnly:true,
  schemaReady:true,exactPrice:true,serverRecipient:true,sameRun:true,scoreAndWavePreserved:true,restoredLives:3,
  repeatedContinues:true,idempotentConfirmation:true,singleReceiptPerContinue:true,wrongWalletRejected:true,
  wrongRecipientRejected:true,wrongCoinRejected:true,underpaymentRejected:true,failedTransactionsRejected:true,
  staleReceiptRejected:true,unfinishedReceiptRejected:true,concurrentDifferentPaymentsOneWinner:true,
  logoutRaceRejected:true,freshLoginPaymentRecovery:true,oldTokenRejected:true,exactHttpInputs:true,
  crossOriginRejected:true,disabledModeRejected:true,realFundsTransferred:false,fixtureChainReceipts:true};
 await mkdir('.netlify',{recursive:true});
 await writeFile('.netlify/treeforce89-paid-database-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await pool.end();if(emulator)await emulator.stop();}
