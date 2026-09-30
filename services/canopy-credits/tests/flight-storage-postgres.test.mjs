// Actual pg Pool + application service adapters, only on a disposable loopback DB.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createFlightStorage,encodeCheckpoint} from '../flight-storage.mjs';
import {createDirectContinueService} from '../direct-continue-service.mjs';
import {postgresDirectRepository} from '../direct-continue-repository.mjs';
import {DIRECT_CONTINUE as P,commitment} from '../continue-product.mjs';
if(!['127.0.0.1','localhost','::1'].includes(process.env.PGHOST)||process.env.PGDATABASE!=='tree_flight_ci')throw Error('disposable-loopback-database-required');
const require=createRequire(process.env.FLIGHT_PG_PACKAGE);
const {Pool}=require('pg');
const origin='https://release.example.org',environment='release-candidate';
const actor=()=>({authenticated:true,identityMappingReviewed:true,authOrigin:origin,environment,accountId:randomUUID(),
  wallet:{family:'sui',address:'0x'+randomUUID().replaceAll('-','').repeat(2)}});
const snapshot=runId=>({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:3,score:7713,lives:0,continuesUsed:0,scene:{enemies:[],player:{x:240,y:570}}});
test('persistent flight and checkout integration using actual PostgreSQL',async t=>{
 const pool=new Pool({max:12});t.after(()=>pool.end());
 await pool.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
 await pool.query(await readFile(new URL('../direct-continue-schema.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../migrations/flight-storage-v1.sql',import.meta.url),'utf8');
 const migrationClient=await pool.connect();
 try{await migrationClient.query('BEGIN');await migrationClient.query(migration);await migrationClient.query('COMMIT');}
 catch(e){await migrationClient.query('ROLLBACK');throw e;}finally{migrationClient.release();}
 const scoped={async query(sql,values){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE tree_continue_storage');const r=await c.query(sql,values);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
 const makeStorage=()=>createFlightStorage(scoped,{authOrigin:origin,environment});
 const store=makeStorage();
 async function saved(){const a=actor(),run=randomUUID(),s=snapshot(run);await store.register(a,run);const c=await store.save(a,run,randomUUID(),s);return{a,run,s,c};}
 async function review(f){await pool.query("INSERT INTO tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) VALUES($1,'validated','CI-SYNTHETIC-NOT-GAME-VALIDATION',$2)",[f.c.checkpointId,'f'.repeat(64)]);}
 const config={paymentsEnabled:true,deployment:{network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),keyEpoch:'1'},metadata:{network:P.network,coinType:P.coinType,decimals:6}};
 let verifyEnabled=false,signatures=0;
 function service(){return createDirectContinueService({repository:postgresDirectRepository(pool),resolveFlight:(a,r)=>store.resolveValidatedFlight(a,r),loadConfiguration:async()=>config,
  authorizeQuote:async()=>{signatures++;return{quoteBase64:'CI-FIXTURE',signatureBase64:'NOT-A-VALID-SIGNATURE',payable:false};},
  verifyPayment:async(terms,digest)=>{if(!verifyEnabled)throw Error('fixture-unverified');const e={source:'chain-reader',status:'success',finalized:true,digest,eventIndex:'0',
    orderId:terms.orderId,accountId:terms.accountId,payer:terms.payer,recipient:terms.recipient,coinType:terms.coinType,amountRaw:terms.requiredRaw,quoteHash:terms.quoteHash,
    checkoutId:terms.checkoutId,keyEpoch:terms.keyEpoch,network:terms.network};return{...e,evidenceHash:commitment(e)};}});}
 await t.test('all seven private tables use RLS and public roles cannot use schema',async()=>{
  const r=await pool.query("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='tree_continue_v1'::regnamespace AND relkind='r'");assert.equal(r.rows.length,7);assert.ok(r.rows.every(x=>x.relrowsecurity));
  for(const role of ['anon','authenticated','service_role'])assert.equal((await pool.query("SELECT has_schema_privilege($1,'tree_continue_v1','USAGE') allowed",[role])).rows[0].allowed,false);
 });
 await t.test('storage role has no login, privilege escalation or RLS bypass',async()=>{
  const r=(await pool.query("SELECT rolcanlogin,rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='tree_continue_storage'")).rows[0];assert.ok(Object.values(r).every(x=>x===false));
 });
 await t.test('concurrent register is idempotent',async()=>{const a=actor(),run=randomUUID();await Promise.all(Array.from({length:8},()=>store.register(a,run)));assert.equal((await pool.query('SELECT count(*) n FROM tree_continue_v1.flights WHERE run_id=$1',[run])).rows[0].n,'1');});
 await t.test('same account cannot change issuer, payer or environment',async()=>{const f=await saved();for(const patch of [{wallet:actor().wallet},{authOrigin:'https://other.example'},{environment:'mainnet'}]){const a={...f.a,...patch};const alt=createFlightStorage(scoped,{authOrigin:a.authOrigin,environment:a.environment});await assert.rejects(alt.register(a,f.run),/identity_mismatch/);}});
 await t.test('run ownership conflict rolls back new identity binding',async()=>{const f=await saved(),a=actor();await assert.rejects(store.register(a,f.run),/identity_mismatch/);assert.equal((await pool.query('SELECT count(*) n FROM tree_continue_v1.accounts WHERE account_id=$1',[a.accountId])).rows[0].n,'0');});
 await t.test('snapshot survives adapter and connection recreation with exact hash',async()=>{const f=await saved(),r=await makeStorage().recover(f.a,f.run);assert.deepEqual(JSON.parse(r.snapshotText),f.s);assert.equal(r.checkpointHash,f.c.checkpointHash);assert.equal(r.restoreAuthorized,false);});
 await t.test('concurrent duplicate checkpoint saves retain one immutable snapshot',async()=>{const f=await saved();const r=await Promise.all(Array.from({length:8},()=>store.save(f.a,f.run,randomUUID(),f.s)));assert.ok(r.every(x=>x.checkpointId===f.c.checkpointId));await assert.rejects(store.save(f.a,f.run,randomUUID(),{...f.s,score:999}),/already_fixed/);});
 await t.test('SQL independently verifies checksum, not just JavaScript',async()=>{const a=actor(),run=randomUUID();await store.register(a,run);const e=encodeCheckpoint(run,snapshot(run));await assert.rejects(scoped.query('SELECT tree_continue_v1.store_checkpoint($1,$2,$3,$4,$5,$6,$7,$8)',[a.accountId,a.wallet.address,origin,environment,run,randomUUID(),e.text,'0'.repeat(64)]),/check constraint/);});
 await t.test('storage role cannot access raw tables, attest state, or forge receipts',async()=>{for(const sql of ['SELECT * FROM tree_continue_v1.accounts','SELECT * FROM tree_continue_v1.orders','INSERT INTO tree_continue_v1.checkpoint_reviews DEFAULT VALUES','INSERT INTO tree_continue_v1.receipts DEFAULT VALUES'])await assert.rejects(scoped.query(sql),/permission denied/);});
 await t.test('snapshot updates and deletions are blocked even through owner connection',async()=>{const f=await saved();await assert.rejects(pool.query('DELETE FROM tree_continue_v1.checkpoints WHERE checkpoint_id=$1',[f.c.checkpointId]),/immutable/);await assert.rejects(pool.query('UPDATE tree_continue_v1.checkpoints SET request_id=$1 WHERE checkpoint_id=$2',[randomUUID(),f.c.checkpointId]),/immutable/);});
 await t.test('actual service rejects a merely stored browser checkpoint before signing',async()=>{const f=await saved(),before=signatures;await assert.rejects(service()(f.a,{action:'order',runId:f.run,requestId:randomUUID()}),/validation-required/);assert.equal(signatures,before);});
 const f=await saved();await review(f);let order;
 await t.test('actual PostgreSQL repository serializes concurrent orders and signatures',async()=>{const before=signatures;const results=await Promise.all(Array.from({length:6},()=>service()(f.a,{action:'order',runId:f.run,requestId:randomUUID()})));order=results[0].order;assert.ok(results.every(x=>x.order.orderId===order.orderId));assert.equal(signatures,before+1);assert.equal(order.amountRaw,'20000000000');assert.equal(order.recipient,P.recipient);});
 await t.test('unverified transaction hint creates no receipt in persistent storage',async()=>{await assert.rejects(service()(f.a,{action:'reconcile',runId:f.run,requestId:randomUUID(),orderId:order.orderId,digest:'A'.repeat(43)}),/fixture-unverified/);assert.equal((await store.recover(f.a,f.run)).purchaseState,'ordered');});
 await t.test('cancelled order is retained and can reconcile late completed payment',async()=>{await service()(f.a,{action:'cancel',runId:f.run,requestId:randomUUID(),orderId:order.orderId});assert.equal((await store.recover(f.a,f.run)).purchaseState,'cancelled');verifyEnabled=true;const r=await service()(f.a,{action:'reconcile',runId:f.run,requestId:randomUUID(),orderId:order.orderId,digest:'A'.repeat(43)});assert.equal(r.status,'verified');assert.equal(r.authorization.lives,3);});
 await t.test('service recreation and duplicate delivery retain one receipt and audit transition',async()=>{const recover=await store.recover(f.a,f.run);const command={action:'deliver',runId:f.run,requestId:randomUUID(),orderId:order.orderId,receiptId:recover.receiptId};await service()(f.a,command);await service()(f.a,{...command,requestId:randomUUID()});assert.equal((await store.recover(f.a,f.run)).purchaseState,'delivered');assert.equal((await pool.query('SELECT count(*) n FROM tree_continue_v1.receipts WHERE order_id=$1',[order.orderId])).rows[0].n,'1');assert.equal((await pool.query("SELECT count(*) n FROM tree_continue_v1.journal WHERE order_id=$1 AND state='delivered'",[order.orderId])).rows[0].n,'1');});
 await t.test('recovery information does not silently replay already-delivered gameplay',async()=>{const r=await makeStorage().recover(f.a,f.run);assert.equal(r.purchaseState,'delivered');assert.equal(r.restoreAuthorized,false);assert.equal(r.paymentsEnabled,false);});
 await t.test('cross-account read never exposes a saved flight',async()=>{const other=await saved();await assert.rejects(store.recover(other.a,f.run),/flight_not_found/);});
 await t.test('SQL order guard rejects a substituted checkpoint even with valid fixed price',async()=>{const another=await saved();await review(another);const terms={...order.terms,accountId:another.a.accountId,runId:another.run,orderId:randomUUID(),payer:another.a.wallet.address,flightHash:'0'.repeat(64)};await assert.rejects(pool.query('INSERT INTO tree_continue_v1.orders(account_id,run_id,order_id,terms,state) VALUES($1,$2,$3,$4,\'ordered\')',[another.a.accountId,another.run,terms.orderId,JSON.stringify(terms)]),/validated_flight_required/);});
});
