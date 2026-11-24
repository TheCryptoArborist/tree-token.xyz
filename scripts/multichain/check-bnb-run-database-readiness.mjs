// Offline verification of a metadata-only hosted capture; never connects to SQL.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root='docs/multichain/generation-milestone/database-readiness/';
const read=p=>JSON.parse(fs.readFileSync(p));const c=read(root+'catalog.json'),project=read(root+'project.json'),migrations=read(root+'migrations.json'),collision=read(root+'collision-check.json');
assert.equal(project.id,'lehswszuekjqottolmsf');assert.equal(project.status,'ACTIVE_HEALTHY');
assert.equal(c.new_table,null);assert.equal(c.new_rpc,null);assert.equal(collision.conflicting_index,null);assert.equal(collision.review_rpc_overloads,0);
assert(!migrations.some(m=>m.name==='arcade_bnb_run_review'||m.version==='20261124060157'));
assert(migrations.some(m=>m.name==='arcade_bnb_test_auth'));
const source=fs.readFileSync('supabase/migrations/20261120193912_arcade_bnb_test_auth.sql','utf8');
assert.equal(c.functions.length,5);
for(const f of c.functions){const match=source.match(new RegExp('create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.'+f.name+'\\(.*?\\bas\\s*\\$\\$(.*?)\\$\\$','is'));assert(match);assert.equal(createHash('md5').update(match[1]).digest('hex'),f.source_md5);assert.equal(f.security_definer,false);assert.deepEqual(f.config,['search_path=""']);assert.equal(f.anon_execute,false);assert.equal(f.authenticated_execute,false);assert.equal(f.service_execute,true);}
const required={token_sha256:'text',wallet:'text',chain_id:'integer',scope:'text',origin:'text',issued_at:'timestamp with time zone',expires_at:'timestamp with time zone',revoked_at:'timestamp with time zone'};
for(const [name,type]of Object.entries(required)){const col=c.columns.find(x=>x.table==='arcade_bnb_test_sessions'&&x.name===name);assert(col);assert.equal(col.type,type);assert.equal(col.nullable,name==='revoked_at'?'YES':'NO');}
assert.equal(c.tables.length,2);for(const t of c.tables)assert.equal(t.rls,true);
assert(c.tables.find(t=>t.name==='arcade_bnb_test_sessions').constraints.includes('PRIMARY KEY (token_sha256)'));
assert.deepEqual(c.private_usage,{anon:false,authenticated:false,service:true});
assert.deepEqual(c.session_privileges,{anon_select:false,authenticated_select:false,service_select:true,service_update:true});
assert.deepEqual(c.service_role,{superuser:false,bypass_rls:true});
const reviewed=read('docs/multichain/generation-milestone/run-endpoint/package-review.json').migration;
assert.equal(createHash('sha256').update(fs.readFileSync(reviewed.path)).digest('hex'),reviewed.sha256);
console.log(JSON.stringify({project:project.id,capturedAt:c.checked_at,readiness:'compatible for reviewed migration; not applied',identityFunctionsMatchSource:5,requiredSessionColumns:Object.keys(required).length,objectCollisions:false,migrationSha256:reviewed.sha256,hostedWrites:0,gameplayAuthorized:false},null,2));
