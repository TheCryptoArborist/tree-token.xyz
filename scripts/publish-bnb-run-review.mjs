// Publishes only the exact verified new disabled candidate. Never restores history.
import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {fingerprint,readToken} from './release-preserved-production.mjs';
import {apiClient} from './release-sti-purchase.mjs';
import {waitForAllBuilds} from './release-arcade-cutoff.mjs';
import {capture,inventory,SITE,BASE} from './prepare-bnb-run-release.mjs';
import {compare,checkEndpoint} from './create-bnb-run-candidate.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const eq=(a,b,label)=>assert.equal(fingerprint(a),fingerprint(b),label+' changed');
export const CANDIDATE='6b053b8285e0ee251b84ad06';
export function publicationAPI(raw){return (p,m='GET',b)=>{assert(m==='GET'||(m==='POST'&&p===`deploys/${CANDIDATE}/lock`&&b===undefined),'Only exact reviewed candidate lock is permitted');return raw(p,m,b);};}
export function verifyRecord(d,plan,v,published=false){
 assert.equal(d.id,CANDIDATE);assert.equal(d.site_id,SITE);assert.equal(d.created_at,v.createdAt);assert.equal(d.state,'ready');assert.equal(v.id,CANDIDATE);assert.equal(v.baselineId,BASE);assert.equal(v.planHash,fingerprint(plan));
 if(published){assert.equal(d.locked,true);assert(d.published_at);}else{assert(!d.locked&&!d.published_at);}
 const f=compare({...d,locked:false,published_at:null},plan.baseline,plan.package.sha256);eq(f,v.functionProviderRecord,'Pinned new provider record');
}
export async function main(){
 const out=process.argv[2];assert(out&&!fs.existsSync(out),'Use a fresh evidence directory');
 const plan=read('docs/multichain/generation-milestone/run-release/plan.json'),v=read('docs/multichain/generation-milestone/run-candidate/verified.json');
 const proof=read('docs/multichain/generation-milestone/run-release/validation.json');assert.equal(fingerprint(plan),proof.planHash);assert.equal(v.packageSha256,plan.package.sha256);
 const api=publicationAPI(apiClient(readToken()));
 const verify=async published=>{const d=await api('deploys/'+CANDIDATE);verifyRecord(d,plan,v,published);eq(await inventory(api,CANDIDATE),plan.baseline.files,'All static paths');return d;};
 const site=await api('sites/'+SITE);let switched=false;
 if(site.published_deploy?.id!==CANDIDATE){
  eq(await capture(api),plan.baseline,'Live baseline and protected settings');await verify(false);
  await checkEndpoint(`https://${CANDIDATE}--tree-token.netlify.app`);
  await waitForAllBuilds(api,CANDIDATE);
  eq(await capture(api),plan.baseline,'Live baseline immediately before switch');await verify(false);
  // User approved proceeding to publication of this disabled candidate.
  await api(`deploys/${CANDIDATE}/lock`,'POST');switched=true;
 }
 const live=await capture(api,CANDIDATE),d=await verify(true);eq(live.protected,plan.baseline.protected,'Protected settings after switch');eq(live.files,plan.baseline.files,'Live static inventory');
 const endpoint=await checkEndpoint('https://tree-token.xyz');
 const result={id:CANDIDATE,baselineId:BASE,planHash:fingerprint(plan),publishedAt:d.published_at,locked:true,state:d.state,switchedThisRun:switched,preservedStaticPaths:691,preservedFunctions:60,totalFunctions:61,schedules:5,endpoint,packageSha256:plan.package.sha256,environmentUnchanged:true,migrationApplied:false,gameplayAuthorized:false};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'published.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log('BNB_RUN_PUBLISHED '+JSON.stringify(result));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
