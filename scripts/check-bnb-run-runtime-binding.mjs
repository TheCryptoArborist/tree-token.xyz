import fs from 'node:fs';import assert from 'node:assert/strict';import {zipFunction} from '@netlify/zip-it-and-ship-it';import {createHash} from 'node:crypto';
import {apiClient} from './release-sti-purchase.mjs';import {readToken,fingerprint} from './release-preserved-production.mjs';
import {capture,inventory,SITE} from './prepare-bnb-run-release.mjs';import {functionsConfig,packageTrafficRules} from './release-arcade-cutoff.mjs';
const LIVE='6b053b8285e0ee251b84ad06',FN='arcade-bnb-binding-audit',OUT='/tmp/bnb-runtime-binding';
const eq=(a,b)=>assert.equal(fingerprint(a),fingerprint(b),'Preservation mismatch');
const token=readToken(),raw=apiClient(token);const api=(p,m='GET',b)=>{assert(m==='GET'||(m==='POST'&&p.startsWith(`sites/${SITE}/deploys?title=`)));return raw(p,m,b);};
try{
 assert(!fs.existsSync(OUT));fs.mkdirSync(OUT);
 const baseline=await capture(api,LIVE);assert.equal(baseline.deploy.available_functions.length,61);assert(!baseline.deploy.available_functions.some(f=>f.n===FN));
 const b=await zipFunction('netlify/bnb-binding-audit-functions/'+FN+'.mjs',OUT,{basePath:process.cwd(),repositoryRoot:process.cwd(),config:{'*':{nodeBundler:'esbuild',nodeVersion:'24.x'}}});
 const bytes=fs.readFileSync(b.path),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(b.runtimeVersion,'nodejs24.x');assert.equal(b.invocationMode,'stream');assert(b.trafficRules);assert.equal(b.routes[0].pattern,'/api/arcade-bnb-test/binding-check');
 const cfg=functionsConfig(baseline.deploy);cfg[FN]={build_data:b.buildData,routes:b.routes,traffic_rules:packageTrafficRules(b.trafficRules)};
 eq(await capture(api,LIVE),baseline);
 const d=await api(`sites/${SITE}/deploys?title=Unpublished%20BNB%20binding%20audit`,'POST',{files:baseline.files,functions:{...Object.fromEntries(baseline.deploy.available_functions.map(f=>[f.n,f.d])),[FN]:hash},functions_config:cfg,function_schedules:baseline.deploy.function_schedules,draft:false,async:false,branch:'main'});
 fs.writeFileSync(OUT+'/candidate.json',JSON.stringify({id:d.id,baselineId:LIVE}));console.log('BNB_BINDING_CANDIDATE '+d.id);
 assert(/^[a-f0-9]{24}$/.test(d.id)&&d.id!==LIVE);assert(!d.published_at&&!d.locked);for(const k of ['required','required_edge_functions','required_server'])assert.equal(d[k].length,0);assert(d.required_functions.length<=1&&d.required_functions.every(h=>h===hash));
 if(d.required_functions.length){const r=await fetch(`https://api.netlify.com/api/v1/deploys/${d.id}/functions/${FN}?runtime=nodejs24.x&invocation_mode=stream`,{method:'PUT',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(45000)});assert(r.ok);}
 let ready;for(let i=0;i<90;i++){ready=await api('deploys/'+d.id);if(ready.state==='ready')break;assert(!['error','canceled','rejected'].includes(ready.state));await new Promise(r=>setTimeout(r,1000));}assert.equal(ready.state,'ready');assert(!ready.published_at&&!ready.locked);
 assert.equal(ready.available_functions.length,62);for(const f of baseline.deploy.available_functions)eq(ready.available_functions.find(n=>n.n===f.n),f);eq(ready.function_schedules,baseline.deploy.function_schedules);eq(await inventory(api,d.id),baseline.files);
 for(const k of ['branch','context','functions_region','functions_region_overrides','database_branch_id','blobs_region','framework','edge_functions_present','server','database_migrations'])eq(ready[k]??null,baseline.deploy[k]??null);
 const r=await fetch(`https://${d.id}--tree-token.netlify.app/api/arcade-bnb-test/binding-check`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000)});assert.equal(r.status,200,'Runtime binding check failed');const result=await r.json();assert.deepEqual(result,{verified:true,project:'lehswszuekjqottolmsf',runRead:true,identityRead:true,userRowsWritten:0,enabled:false,gameplayAuthorized:false});
 eq(await capture(api,LIVE),baseline);
 const live=await fetch('https://tree-token.xyz/api/arcade-bnb-test/run-review',{redirect:'error'});assert.equal(live.status,503);assert.equal((await live.json()).error,'review-disabled');
 const report={...result,candidateId:d.id,baselineId:LIVE,checkedAt:new Date().toISOString(),execution:'Netlify production-context unpublished candidate',productionUnchanged:true,published:false,credentialsExported:false};fs.writeFileSync(OUT+'/verified.json',JSON.stringify(report,null,2));console.log('BNB_RUNTIME_BINDING_VERIFIED '+JSON.stringify(report));
}catch(e){console.error(e.message);process.exitCode=1;}
