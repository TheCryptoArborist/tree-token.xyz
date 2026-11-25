import fs from 'node:fs';import assert from 'node:assert/strict';import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';
import {nativeDatabaseIdentity,inspectNativeDatabaseIdentity,auditNativeDatabase,assertNativeAuditReadPath} from './native-database-audit.mjs';
const SITE='aa62f324-b880-47d6-85b8-4ba0700ff5bf',ACCOUNT='69800888d1a3d0483003ae9e';
const BRANCH='feature/treeforce89-play-integration';
const NATIVE_HASH='af1bc6f03de12e0ee77b10cd118ab346e8f5fa3c9e92cb05ee8ed8a264532a63';
const root='docs/multichain/generation-milestone/native-database-audit/';let pool,bindingCheck,bindingSource,phase='metadata';
async function get(path){
 const r=await fetch('https://api.netlify.com/api/v1/'+assertNativeAuditReadPath(path),{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+process.env.NETLIFY_AUTH_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Object.assign(Error('netlify-read-failed'),{safeCode:'NETLIFY_HTTP_'+r.status});return r.json();
}
async function current(){const s=await get('sites/'+SITE);assert.equal(s.account_id,ACCOUNT);const d=await get('deploys/'+s.published_deploy.id);assert.equal(d.locked,true);assert.equal(d.state,'ready');assert.equal(d.available_functions.find(f=>f.n==='treeforce89-dev')?.d,NATIVE_HASH);return d.id;}
try{
 assert(process.env.NETLIFY_AUTH_TOKEN,'missing-netlify-connection');const before=await current();
 phase='readonly-branch-binding';
 const binding=await get(`sites/${SITE}/database/branch/${encodeURIComponent(BRANCH)}?role=netlifydb_readonly`);
 const connectionString=binding.connection_string;const bindingContext=BRANCH;
 bindingSource='documented existing Netlify database branch, netlifydb_readonly role';
 phase='binding-value';assert(typeof connectionString==='string'&&connectionString.length>0);phase='binding-identity';bindingCheck=inspectNativeDatabaseIdentity(connectionString);const identity=nativeDatabaseIdentity(connectionString);assert.equal(new URL(connectionString).username,'netlifydb_readonly');
 phase='catalog';pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:10000,options:'-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=15000'});
 const db=await pool.connect();let result;try{result=await auditNativeDatabase(db,JSON.parse(fs.readFileSync(root+'expected-catalog.json')));}finally{db.release();}
 phase='recheck';const after=await current();assert.equal(after,before,'deployment-changed');
 const report={checkedAt:new Date().toISOString(),deployId:after,nativePackageSha256:NATIVE_HASH,databaseIdentity:identity,bindingContext,bindingSource,
  bindingEvidence:'release-recorded existing branch; database identity verified; read-only role; no environment-variable access',...result};
 fs.mkdirSync('/tmp/native-database-audit',{recursive:true});fs.writeFileSync('/tmp/native-database-audit/report.json',JSON.stringify(report,null,2)+'\n');
 console.log('NATIVE_DATABASE_AUDIT '+JSON.stringify(report));
}catch(error){console.error(JSON.stringify({auditCompleted:false,phase,bindingSource,bindingCheck,httpCode:/^NETLIFY_HTTP_[0-9]{3}$/.test(error.safeCode||'')?error.safeCode:undefined,reason:'Read-only audit failed; no credentials or database error details emitted.',runtimeAuthorized:false}));process.exitCode=1;}
finally{await pool?.end();}
