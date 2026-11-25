// Disposable database only. Builds the reference catalog from pinned native SQL.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';import {readNativeCatalog,auditNativeDatabase,compareNativeCatalog,nativeDatabaseIdentity} from './native-database-audit.mjs';
const bin=process.env.BNB_PG_BIN;assert(bin);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-audit-')),data=path.join(dir,'data'),exe=n=>path.join(bin,n);let started=false,pool;const checks=[];
try{
 const args=['-D',data,'-A','trust','--no-locale','--encoding=UTF8'];if(process.env.BNB_PG_SHARE)args.push('-L',process.env.BNB_PG_SHARE);
 execFileSync(exe('initdb'),args,{stdio:'pipe'});execFileSync(exe('pg_ctl'),['-D',data,'-l',path.join(dir,'log'),'-o',`-k "${dir}" -h "" -p 5432`,'-w','start'],{stdio:'pipe'});started=true;
 pool=new pg.Pool({host:dir,port:5432,user:os.userInfo().username,database:'postgres',ssl:false});
 const db=await pool.connect();try{
  for(const file of ['20261016030500_tree_authentication.sql','20261031045000_tree_paid_continue.sql'])await db.query(fs.readFileSync('docs/multichain/generation-milestone/native-sui-session/upstream/'+file,'utf8'));
  const expected=await readNativeCatalog(db),file='docs/multichain/generation-milestone/native-database-audit/expected-catalog.json';
  if(process.argv.includes('--write-reference'))fs.writeFileSync(file,JSON.stringify(expected,null,2)+'\n');else assert.deepEqual(expected,JSON.parse(fs.readFileSync(file)));
  checks.push('reference matches exact pinned native SQL');
  const result=await auditNativeDatabase(db,expected);assert(result.nativeSchemaMatches&&result.readOnly);assert.equal(result.applicationRowsRead,0);assert.equal(result.missingProposedTables.length,7);checks.push('actual catalog verifies native structure and seven absent proposed tables');
  await db.query('BEGIN READ ONLY');await assert.rejects(db.query("insert into tree_wallet_logins values('x','x',now(),null,now())"),e=>e.code==='25006');await db.query('ROLLBACK');checks.push('PostgreSQL enforces read-only writes denial');
  for(const [name,sql] of [
   ['column','alter table tree_game_sessions alter column wallet drop not null'],
   ['constraint','alter table tree_game_sessions drop constraint tree_game_sessions_run_id_key'],
   ['index','drop index tree_game_sessions_wallet_idx'],
   ['RLS','alter table tree_game_sessions enable row level security'],
  ]){await db.query('BEGIN');await db.query(sql);assert.equal(compareNativeCatalog(await readNativeCatalog(db),expected).nativeSchemaMatches,false);await db.query('ROLLBACK');checks.push(name+' drift denied');}
  const broken={query:async sql=>{if(sql==='ROLLBACK')return {rows:[]};if(sql.startsWith('BEGIN'))return {rows:[]};return {rows:[{read_only:'off'}]};}};await assert.rejects(auditNativeDatabase(broken,expected),/read-only/);checks.push('read-only mode must be independently observed');
  for(const url of ['postgres://user:secret@other.example/netlifydb','postgres://user:secret@wrong.db.netlify.com/netlifydb','postgres://user:secret@wrong.db.netlify.com/other'])assert.throws(()=>nativeDatabaseIdentity(url));checks.push('wrong provider path and database identity denied');
  let rollback=false;await assert.rejects(auditNativeDatabase({query:async sql=>{if(sql==='ROLLBACK'){rollback=true;return;}if(sql.startsWith('BEGIN'))return {};if(sql.includes('current_setting'))return {rows:[{read_only:'on'}]};throw Error('catalog unavailable');}},expected));assert(rollback);checks.push('catalog failure always rolls back');
  console.log(JSON.stringify({localOnly:true,passed:checks.length,checks},null,2));
 }finally{db.release();}
}finally{await pool?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
