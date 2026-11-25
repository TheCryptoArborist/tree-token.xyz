// Generate a review-only proposal; never connects to a database or deploys.
import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root='docs/multichain/generation-milestone/';
const sources=['native-sui-session/schema.sql','shared-delivery/schema.sql','native-sui-payments/schema.sql','mixed-chain-store/schema.sql'];
const provenance=sources.map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(root+path)).digest('hex')}));
let sql=`-- REVIEW PROPOSAL ONLY. Outside automatic migration directories.
-- Target: the existing pinned Netlify game database, not the site's default DB.
-- No native table, native grant or existing payment row is modified.
begin;
do $$ begin
 if current_user <> 'netlifydb_owner' then raise exception 'native_schema_owner_required'; end if;
end $$;
create schema private authorization netlifydb_owner;
revoke all on schema private from public,netlifydb_readonly;
`;
for(const p of sources){
 const text=fs.readFileSync(root+p,'utf8');
 sql+='\n-- Source: '+p+'\n'+text.split('\n').filter(line=>!/^\s*(begin;|commit;|grant\b|revoke\b|--)/i.test(line)).join('\n')+'\n';
}
sql+=`
-- Owner-role DML needs explicit guards previously supplied by column privileges.
create function private.reject_native_evidence_mutation() returns trigger language plpgsql as $$
begin raise exception 'native_payment_evidence_immutable'; end $$;
create trigger native_evidence_immutable before update or delete or truncate
on private.arcade_native_sui_payments for each statement
execute function private.reject_native_evidence_mutation();
-- The existing backend already uses this owner connection. Owner access is
-- broad and is NOT a sandbox; application validation and immutable triggers
-- remain required. No browser or public role receives private data access.
revoke all on all tables in schema private from public,netlifydb_readonly;
revoke all on all sequences in schema private from public,netlifydb_readonly;
revoke all on all functions in schema private from public,netlifydb_readonly;
commit;
`;
assert(!/\b(anon|authenticated|service_role)\b/.test(sql));
const target=root+'netlify-gateway/schema.sql',manifest=root+'netlify-gateway/schema-sources.json';
if(process.argv.includes('--check')){assert.equal(fs.readFileSync(target,'utf8'),sql);assert.deepEqual(JSON.parse(fs.readFileSync(manifest)),provenance);}
else{fs.writeFileSync(target,sql);fs.writeFileSync(manifest,JSON.stringify(provenance,null,2)+'\n');}
console.log('Verified Netlify shared-schema proposal from four pinned components.');
