// Metadata only. No application-row reads, migrations, credential output or activation.
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
export const NATIVE_TABLES=['tree_wallet_challenges','tree_wallet_logins','tree_game_sessions','tree_continue_redemptions'];
export const PROPOSED_TABLES=['arcade_native_sui_accounts','arcade_native_sui_runs','arcade_native_paid_recoveries','arcade_native_sui_payments','arcade_continue_payments_v2','arcade_continue_claims_v2','arcade_continue_events_v2'];
export const EXPECTED_IDENTITY='df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065';
export function inspectNativeDatabaseIdentity(connectionString){
 let u;try{u=new URL(connectionString);}catch{return {parseable:false,matchesPinnedIdentity:false};}
 const providerAllowed=['postgres:','postgresql:'].includes(u.protocol)&&u.hostname.endsWith('.db.netlify.com')&&u.pathname==='/netlifydb';
 const identity=providerAllowed?createHash('sha256').update(u.hostname.replace(/-pooler(?=\.)/,'')+'|'+u.pathname).digest('hex'):null;
 return {parseable:true,providerAllowed,identity,matchesPinnedIdentity:identity===EXPECTED_IDENTITY};
}
export function nativeDatabaseIdentity(connectionString){
 const check=inspectNativeDatabaseIdentity(connectionString);
 assert(check.matchesPinnedIdentity,'database-identity-mismatch');return check.identity;
}
export async function readNativeCatalog(db){
 const columns=(await db.query(`select table_name,column_name,data_type,udt_name,is_nullable,column_default
  from information_schema.columns where table_schema='public' and table_name=any($1::text[]) order by table_name,ordinal_position`,[NATIVE_TABLES])).rows;
 const constraints=(await db.query(`select c.relname as table_name,con.conname as name,con.contype as type,pg_get_constraintdef(con.oid) as definition
  from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any($1::text[]) order by c.relname,con.conname`,[NATIVE_TABLES])).rows;
 const indexes=(await db.query(`select tablename as table_name,indexname as name,indexdef as definition from pg_indexes
  where schemaname='public' and tablename=any($1::text[]) order by tablename,indexname`,[NATIVE_TABLES])).rows;
 const tables=(await db.query(`select c.relname as name,c.relkind as kind,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,
  has_table_privilege(c.oid,'SELECT') as can_select,has_table_privilege(c.oid,'INSERT') as can_insert,has_table_privilege(c.oid,'UPDATE') as can_update,has_table_privilege(c.oid,'DELETE') as can_delete
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[]) order by c.relname`,[NATIVE_TABLES])).rows;
 const proposed=(await db.query(`select c.relname as name,c.relkind as kind,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and c.relname=any($1::text[]) order by c.relname`,[PROPOSED_TABLES])).rows;
 const triggers=(await db.query(`select c.relname as table_name,t.tgname as name,t.tgenabled as enabled,pg_get_triggerdef(t.oid) as definition
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and n.nspname='public' and c.relname=any($1::text[]) order by c.relname,t.tgname`,[NATIVE_TABLES])).rows;
 const policies=(await db.query(`select tablename as table_name,policyname as name,permissive,roles,cmd,qual,with_check from pg_policies
  where schemaname='public' and tablename=any($1::text[]) order by tablename,policyname`,[NATIVE_TABLES])).rows;
 return {columns,constraints,indexes,tables,proposed,triggers,policies};
}
export function compareNativeCatalog(actual,expected){
 const same=k=>JSON.stringify(actual[k])===JSON.stringify(expected[k]);
 // PG18 adds contype=n rows for NOT NULL already represented in columns.
 // Ignore only exact redundant constraints on a known non-null column.
 const constraints=c=>{
  for(const row of c.constraints.filter(r=>r.type==='n')){
   const column=c.columns.find(v=>v.table_name===row.table_name&&v.is_nullable==='NO'&&row.definition==='NOT NULL '+v.column_name);
   if(!column)return null;
  }
  return c.constraints.filter(r=>r.type!=='n');
 };
 const actualConstraints=constraints(actual),expectedConstraints=constraints(expected);
 const equivalentConstraints=actualConstraints!==null&&expectedConstraints!==null&&JSON.stringify(actualConstraints)===JSON.stringify(expectedConstraints);
 const checks={columns:same('columns'),constraints:equivalentConstraints,indexes:same('indexes'),triggers:same('triggers'),policies:same('policies'),rowSecurity:JSON.stringify(actual.tables.map(t=>[t.name,t.rls,t.force_rls]))===JSON.stringify(expected.tables.map(t=>[t.name,t.rls,t.force_rls])),tables:NATIVE_TABLES.every(n=>actual.tables.some(t=>t.name===n&&t.kind==='r'))};
 return {checks,nativeSchemaMatches:Object.values(checks).every(Boolean),proposedTablesPresent:actual.proposed.map(t=>t.name),
  missingProposedTables:PROPOSED_TABLES.filter(n=>!actual.proposed.some(t=>t.name===n)),runtimeAuthorized:false,migrationApplied:false};
}
export async function auditNativeDatabase(db,expected){
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  const flags=(await db.query("select current_setting('transaction_read_only') as read_only,current_setting('server_version_num') as server_version_num")).rows[0];assert.equal(flags.read_only,'on','read-only-transaction-required');
  const catalog=await readNativeCatalog(db);
  const roles=(await db.query("select rolname from pg_roles where rolname=any($1::text[]) order by rolname",[['anon','authenticated','service_role']])).rows.map(r=>r.rolname);
  const privateSchema=(await db.query("select has_schema_privilege(oid,'USAGE') as can_use,has_schema_privilege(oid,'CREATE') as can_create from pg_namespace where nspname='private'")).rows;
  return {readOnly:true,serverVersionNumber:flags.server_version_num,applicationRowsRead:0,catalog,proposedRolesPresent:roles,privateSchema,...compareNativeCatalog(catalog,expected)};
 }finally{await db.query('ROLLBACK');}
}

export function assertNativeAuditReadPath(path){
 assert(path==='sites/aa62f324-b880-47d6-85b8-4ba0700ff5bf'||
  /^deploys\/[a-f0-9]{24}$/.test(path)||
  path==='sites/aa62f324-b880-47d6-85b8-4ba0700ff5bf/database/branch/feature%2Ftreeforce89-play-integration?role=netlifydb_readonly','audit-path-denied');
 return path;
}
