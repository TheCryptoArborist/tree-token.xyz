import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {canonical,fingerprint,readOnlyApi,readToken,SITE_ID,ACCOUNT_ID} from './lib/treeforce89-production-inventory.mjs';
const previous=JSON.parse(readFileSync('production/treeforce89-scoped-api-manifest.json'));
const current=JSON.parse(readFileSync('.netlify/treeforce89-chapters-baseline.json'));
for(const key of ['functions','schedules','runtime'])assert.equal(canonical(current[key]),canonical(previous[key]),'Review newer '+key+' before proceeding');
for(const [path,sha]of Object.entries(previous.files))if(path.startsWith('/play/treeforce89/'))assert.equal(current.files[path],sha,'Newer TREE FORCE frontend needs reconciliation: '+path);
// Three unrelated Canopy flags were added since the previous TREE FORCE release.
// Verify all older visible records byte-for-byte and preserve the new branch-only flags.
const get=readOnlyApi(readToken()),rows=await get(`accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}`),extraKeys=['CANOPY_INDIVIDUAL_DEFENDERS','CANOPY_CHECKOUT_ENABLED','CANOPY_CANONICAL_CHECKOUT_PREVIEW'];
const extras=rows.filter(row=>extraKeys.includes(row.key));assert.equal(extras.length,3);
for(const row of extras)assert(row.values.length>0&&row.values.every(v=>v.context==='branch'),'Unexpected production-scoped Canopy flag');
const older=rows.filter(row=>!extraKeys.includes(row.key)).sort((a,b)=>a.key.localeCompare(b.key,'en'));
assert.equal(fingerprint(older),previous.environment.site.sha256,'An older environment record changed; stop');
for(const key of ['shared','sharedFunctions','requiredBinding','buildSettingsSha256','buildSettingsFieldsSha256'])assert.equal(canonical(current.environment[key]),canonical(previous.environment[key]),'Protected environment '+key+' changed');
assert.equal(current.environment.site.entries,53);assert.equal(current.environment.siteFunctions.entries,53);
const changed=Object.keys(previous.files).filter(p=>current.files[p]!==previous.files[p]),added=Object.keys(current.files).filter(p=>!Object.hasOwn(previous.files,p));
const report={previous:previous.deployId,current:current.deployId,all43FunctionsIdentical:true,fiveSchedulesIdentical:true,runtimeIdentical:true,olderEnvironmentRecordsIdentical:true,preservedNewBranchOnlyFlags:extraKeys,treeForceFrontendIdentical:true,newerChangedPaths:changed,newerAddedPaths:added,preserveAllNewerFiles:true};
writeFileSync('.netlify/treeforce89-chapters-baseline-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
