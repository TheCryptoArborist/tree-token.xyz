// Publish only the exact reviewed replacement candidate. No environment writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {capture,inventory,ACCOUNT} from './prepare-bnb-run-release.mjs';import {compare,LIVE} from './create-bnb-fixed-review-candidate.mjs';
import {fingerprint,readToken} from './release-preserved-production.mjs';import {apiClient} from './release-sti-purchase.mjs';import {waitForAllBuilds} from './release-arcade-cutoff.mjs';
import {sha256,sourceEvidence,toolingEvidence} from './package-bnb-run-review.mjs';import {checkEnabled} from './publish-bnb-run-enablement.mjs';
export const CANDIDATE='6b05eac4008e25aba5f361e1';
const eq=(a,b)=>assert.equal(fingerprint(a),fingerprint(b),'Preservation mismatch');
export function publicationAPI(raw){return async(p,m='GET',b)=>{assert(m==='GET'||m==='POST'&&p===`deploys/${CANDIDATE}/lock`&&b===undefined,'Only exact candidate publication permitted');const r=await raw(p,m,b);if(m==='GET'&&p.startsWith(`accounts/${ACCOUNT}/env`))for(const row of r)assert(!['BNB_RUN_REVIEW_ENABLED','BNB_RUN_REVIEW_GENERATION'].includes(row.key),'Legacy review setting present');return r;};}
export function verifyRecord(d,baseline,m,v,published){assert.equal(d.id,CANDIDATE);assert.equal(v.candidateId,CANDIDATE);assert.equal(v.baselineId,LIVE);assert.equal(Boolean(d.locked),published);assert.equal(Boolean(d.published_at),published);const record=compare({...d,locked:false,published_at:null},baseline,m);eq(record,v.functionProviderRecord);}
export async function main(){
 const [directory,out]=process.argv.slice(2);assert(directory&&out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const read=p=>JSON.parse(fs.readFileSync(p));const baseline=read(directory+'/bnb-fixed-candidate/baseline.json'),m=read(directory+'/bnb-fixed-package/manifest.json'),v=read('docs/multichain/generation-milestone/fixed-review-candidate/verified.json');
 const bytes=fs.readFileSync(directory+'/bnb-fixed-package/arcade-bnb-run-review.zip');assert.equal(sha256(bytes),v.packageSha256);assert.equal(m.sha256,v.packageSha256);assert.equal(m.bytes,v.packageBytes);eq(m.reviewPolicy,v.reviewPolicy);eq(m.sourceFiles,sourceEvidence());eq(m.tooling,toolingEvidence());for(const f of m.tracedFiles)assert.equal(sha256(fs.readFileSync(f.path)),f.sha256);
 const api=publicationAPI(apiClient(readToken()));
 const verify=async published=>{const d=await api('deploys/'+CANDIDATE);verifyRecord(d,baseline,m,v,published);eq(await inventory(api,CANDIDATE),baseline.files);return d;};
 eq(await capture(api,LIVE),baseline);await verify(false);await checkEnabled(`https://${CANDIDATE}--tree-token.netlify.app`);
 const chain=label=>{execFileSync(process.execPath,['contracts/bnb-generation/scripts/check-generation-access.mjs',out+'/'+label+'.json'],{stdio:'inherit',timeout:90000});return read(out+'/'+label+'.json').result;};
 chain('backing-before');await waitForAllBuilds(api,CANDIDATE);eq(await capture(api,LIVE),baseline);await verify(false);
 await api(`deploys/${CANDIDATE}/lock`,'POST');
 const d=await verify(true),live=await capture(api,CANDIDATE);eq(live.protected,baseline.protected);eq(live.files,baseline.files);
 const checks=await checkEnabled();const auth=await fetch('https://tree-token.xyz/api/arcade-bnb-test',{method:'POST',headers:{Origin:'https://tree-token.xyz','Content-Type':'application/json'},body:'{"action":"entitlement"}',redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(auth.status,401);assert.equal((await auth.json()).error,'invalid-session');
 const result={id:CANDIDATE,baselineId:LIVE,publishedAt:d.published_at,locked:true,staticPaths:691,unchangedFunctions:60,totalFunctions:61,schedules:5,environmentUnchanged:true,packageSha256:m.sha256,reviewPolicy:m.reviewPolicy,checks,existingAuthStatus:401,backing:chain('backing-after'),gameplayAuthorized:false,paymentsEnabled:false,authenticatedWalletTest:false};
 fs.writeFileSync(out+'/published.json',JSON.stringify(result,null,2)+'\n');console.log('BNB_FIXED_PUBLISHED '+JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
