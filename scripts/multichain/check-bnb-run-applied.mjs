// Verify committed hosted migration evidence offline. No database connection.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const dir='docs/multichain/generation-milestone/database-applied/';const read=p=>JSON.parse(fs.readFileSync(p));
const before=read(dir+'before.json'),after=read(dir+'after-identity.json');
assert.equal(before.new_table,null);assert.equal(before.new_rpc,null);
assert.equal(after.new_table,'private.arcade_bnb_run_reviews');assert.equal(after.new_rpc,'arcade_bnb_run_review_v1(text,jsonb)');
for(const k of ['checked_at','new_table','new_rpc']){delete before[k];delete after[k];}assert.deepEqual(after,before);
const r=read(dir+'after-review.json');assert.equal(r.rows,0);assert.equal(r.rls,true);assert.equal(r.rpc.security_definer,false);assert.deepEqual(r.rpc.config,['search_path=""']);
for(const p of r.privileges){const service=p.role==='service_role';for(const k of ['schema_usage','select','insert','update','execute'])assert.equal(p[k],service);assert.equal(p.delete,false);}
assert.equal(r.privileges.length,3);assert.equal(r.indexes.length,2);
assert(r.indexes.some(x=>x.endsWith('USING btree (session_hash, issued_at)')));
const file='supabase/migrations/20261124060157_arcade_bnb_run_review.sql',sql=fs.readFileSync(file,'utf8');
assert.equal(createHash('sha256').update(sql).digest('hex'),'15a8f418df1b9155d4d54833c51a40811e39aa80405c4a0464edba03cbfcfe3e');
const body=sql.match(/as \$\$([\s\S]*?)\$\$/)[1];assert.equal(createHash('md5').update(body).digest('hex'),r.rpc.source_md5);
const history=read(dir+'migration-history.json').filter(x=>x.name==='arcade_bnb_run_review');assert.deepEqual(history,[{version:'20261124184014',name:'arcade_bnb_run_review'}]);
console.log(JSON.stringify({migrationVersion:history[0].version,sqlHashVerified:true,hostedFunctionBodyMatches:true,existingIdentityUnchanged:true,tableEmpty:true,serviceOnly:true,gameplayAuthorized:false},null,2));
