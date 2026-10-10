/** Disposable CI PostgreSQL only. No hosted credentials or fake hosted purchases. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'paid_delivery_ci');
const {Pool}=createRequire(process.env.PAID_TEST_PACKAGE)('pg');const pool=new Pool({max:20});
const payer='0x'+'c'.repeat(64),account=randomUUID();
const sql='SELECT public.tree_continue_preview_lookup($1::uuid,$2,$3,$4::uuid,$5::uuid) AS result';
async function asRole(role,query,params){const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE '+role);const r=await db.query(query,params);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
const call=(action='status',run=null,after=null,owner=account)=>asRole('service_role',sql,[owner,payer,action,run,after]).then(r=>r.rows[0].result);
const counts=async()=> (await pool.query('SELECT (SELECT count(*) FROM tree_continue_v1.orders) orders,(SELECT count(*) FROM tree_continue_v1.receipts) receipts,(SELECT count(*) FROM tree_continue_v1.paid_deliveries) deliveries,(SELECT count(*) FROM tree_continue_v1.checkpoint_reviews) reviews')).rows[0];
await test('hosted read-only wrapper actual PostgreSQL',async t=>{try{
 await pool.query(await readFile(new URL('../migrations/hosted-preview-lookup-v1.sql',import.meta.url),'utf8'));const before=await counts();
 await t.test('status works through only the platform wrapper',async()=>assert.deepEqual(await call(),{allowed:true,result:null}));
 await t.test('unknown signed account has a genuine empty lookup without registration',async()=>{assert.deepEqual(await call('list_purchases'),{allowed:true,result:{rows:[],hasMore:false}});assert.equal((await pool.query('SELECT count(*)::int n FROM tree_continue_v1.accounts WHERE account_id=$1',[account])).rows[0].n,0);});
 await t.test('missing run is distinct from an unresolved order',async()=>assert.deepEqual(await call('recover_purchase',randomUUID()),{allowed:true,result:{record:null}}));
 await t.test('no monetary SQL command exists',async()=>{for(const action of ['order','reconcile','cancel','deliver','delivery_status','prepare_delivery','activate_delivery'])await assert.rejects(call(action,randomUUID()),/invalid_preview_lookup/);});
 await t.test('invalid identity and mismatched arguments are rejected',async()=>{await assert.rejects(asRole('service_role',sql,[null,payer,'status',null,null]),/invalid_preview_lookup/);await assert.rejects(asRole('service_role',sql,[account,'0x'+'0'.repeat(64),'status',null,null]),/invalid_preview_lookup/);await assert.rejects(call('status',randomUUID()),/invalid_preview_lookup/);});
 await t.test('browser roles and direct table or financial access stay denied',async()=>{for(const r of ['anon','authenticated'])await assert.rejects(asRole(r,sql,[account,payer,'status',null,null]),/permission denied/);for(const query of ['SELECT * FROM tree_continue_v1.orders','SELECT * FROM tree_continue_v1.preview_lookup_limits',"SELECT tree_continue_v1.paid_delivery(NULL,NULL,NULL,NULL,NULL,'status')"])await assert.rejects(asRole('service_role',query),/permission denied/);});
 await t.test('65 concurrent attempts allow exactly 60 with persisted quota',async()=>{const actor=randomUUID();const rows=await Promise.all(Array.from({length:65},()=>call('status',null,null,actor)));assert.equal(rows.filter(r=>r.allowed).length,60);assert.equal((await pool.query('SELECT requests FROM tree_continue_v1.preview_lookup_limits WHERE account_id=$1',[actor])).rows[0].requests,60);});
 await t.test('elapsed quota window resets to one',async()=>{await pool.query("UPDATE tree_continue_v1.preview_lookup_limits SET window_start=clock_timestamp()-interval '2 minutes' WHERE account_id=$1",[account]);assert.equal((await call()).allowed,true);assert.equal((await pool.query('SELECT requests FROM tree_continue_v1.preview_lookup_limits WHERE account_id=$1',[account])).rows[0].requests,1);});
 await t.test('all purchase receipt delivery and review counts are unchanged',async()=>assert.deepEqual(await counts(),before));
 }finally{await pool.end();}});
