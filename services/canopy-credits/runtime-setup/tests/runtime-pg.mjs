/** Actual PostgreSQL/SCRAM credentials; loopback only. No Management API or cloud TLS test. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {inspectConnections,PROJECT,MODES} from '../runtime-check/check.mjs';
if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='tree_setup_ci')throw Error('disposable-loopback-only');
const require=createRequire(process.env.DIRECT_TEST_PACKAGE||import.meta.url);
const {Pool,Client}=require('pg');
const owner=new Client();await owner.connect();
const generate=spawnSync('python3',['-c',`import json,uuid,tree_runtime_setup as s
p,v=s.credentials(s.Pooler('aws-0-us-east-2.pooler.supabase.com',6543,s.PROJECT))
b=str(uuid.uuid4())
print(json.dumps({'create':s.create_roles_sql(p,b),'activate':s.switch_logins_sql(b,True),'disable':s.switch_logins_sql(b,False),'env':v}))`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
assert.equal(generate.status,0,'fixture generator must succeed without network');
const fixture=JSON.parse(generate.stdout);const clients=[];
const createPool=config=>{
 assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.port,6543);
 // Only the CI factory maps the verified cloud descriptor to a local DB. The deployed factory keeps verified TLS.
 const pool=new Pool({host:'127.0.0.1',port:5432,database:'tree_setup_ci',user:config.user.replace('.'+PROJECT,''),password:config.password,max:1,connectionTimeoutMillis:5000});
 clients.push(pool);return pool;
};
try{
 await owner.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;');
 for(const path of ['direct-continue-schema.sql','migrations/flight-storage-v1.sql','migrations/paid-delivery-v1.sql','migrations/purchase-recovery-v1.sql','migrations/scoped-commerce-v1.sql']){
  await owner.query(await readFile(new URL('../../'+path,import.meta.url),'utf8'));
 }
 await test('bootstrap creates five NOLOGIN roles using actual SCRAM verifiers',async()=>{
  await owner.query(fixture.create);
  const rows=(await owner.query("SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname LIKE 'tree_continue_%_app_v1' ORDER BY rolname")).rows;
  assert.equal(rows.length,5);assert.ok(rows.every(r=>r.rolcanlogin===false));
 });
 await test('disabled application login cannot authenticate to PostgreSQL',async()=>{
  const u=new URL(fixture.env.TREE_CONTINUE_ORDERS_DB_URL);
  const pool=new Pool({host:'127.0.0.1',database:'tree_setup_ci',user:'tree_continue_orders_app_v1',password:u.password});
  try{await assert.rejects(pool.query('SELECT 1'),/not permitted to log in/);}finally{await pool.end();}
 });
 await test('all five actual restricted-login connections pass the runtime inspector',async()=>{
  await owner.query(fixture.activate);
  const r=await inspectConnections({getEnv:k=>fixture.env[k],createPool});
  assert.equal(r.credentialsVerified,true);assert.equal(r.policyDisabled,true);assert.deepEqual(r.checkedRoles,MODES);
  assert.equal(r.paymentsEnabled,false);assert.equal(r.restoreAuthorized,false);
 });
 await test('incorrect password cannot pass credential acceptance',async()=>{
  const changed={...fixture.env,TREE_CONTINUE_ORDERS_DB_URL:fixture.env.TREE_CONTINUE_ORDERS_DB_URL.replace(/:[A-Za-z0-9_-]{48}@/,':'+ 'Z'.repeat(48)+'@')};
  await assert.rejects(inspectConnections({getEnv:k=>changed[k],createPool}),/password authentication failed/);
 });
 await test('an unexpected inherited role is refused by actual inspector',async()=>{
  await owner.query('GRANT tree_continue_settlement TO tree_continue_orders_app_v1');
  try{await assert.rejects(inspectConnections({getEnv:k=>fixture.env[k],createPool}),/role-verification/);}
  finally{await owner.query('REVOKE tree_continue_settlement FROM tree_continue_orders_app_v1');}
 });
 await test('rerunning creation cannot reset existing credentials',async()=>{
  await assert.rejects(owner.query(fixture.create),/tree_setup_existing_login/);await owner.query('ROLLBACK');
  const r=await inspectConnections({getEnv:k=>fixture.env[k],createPool});assert.equal(r.credentialsVerified,true);
 });
 await test('batch-scoped cleanup disables new logins without activating purchases',async()=>{
  await owner.query(fixture.disable);
  const rows=(await owner.query("SELECT rolcanlogin FROM pg_roles WHERE rolname LIKE 'tree_continue_%_app_v1'")).rows;
  assert.equal(rows.length,5);assert.ok(rows.every(r=>r.rolcanlogin===false));
  const p=(await owner.query('SELECT new_orders_enabled,settlement_enabled,total_limit_raw::text FROM tree_continue_v1.commerce_policy')).rows[0];
  assert.deepEqual(p,{new_orders_enabled:false,settlement_enabled:false,total_limit_raw:'0'});
 });
}finally{await Promise.allSettled(clients.map(p=>p.end()));await owner.end();}
