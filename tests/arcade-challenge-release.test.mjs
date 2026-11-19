import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SITE_ID, ACCOUNT_ID, PILOT, DB_PROJECT, DB_PROOF, MIGRATION, CONTROL_FILE, REVIEW_FILE, PACKAGE_SOURCES,
  DELIVERY_SOURCES, ADDED_PATHS, REQUIRED_CHANGES, assembleFiles, compareBackend, validateBaseline, validateUploadRequirements,
  validatePublicationControl, validateControlCommit, validateBrowserReview, validateDBProof, pilotPackage, scopedAPI } from '../scripts/release-arcade-challenge.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';
import { makePilotRules } from '../scripts/arcade-campaigns/pilot-rules.mjs';
import { contentHash } from '../scripts/arcade-campaigns/core.mjs';

const hash = (value, alg = 'sha256') => createHash(alg).update(value).digest('hex');
const copy = structuredClone, ROOT = path.resolve(import.meta.dirname, '..');
const BASE = 'a'.repeat(24), CANDIDATE = 'b'.repeat(24), SOURCE = 'c'.repeat(40), TREE = 'd'.repeat(40), MAIN = 'e'.repeat(40);
const NOW = Date.parse('2026-11-19T00:00:00.000Z');
function baseline() {
  const recorded = JSON.parse(fs.readFileSync(path.join(ROOT, 'production/arcade-polish-deployment-20261118.json')));
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'production/arcade-polish-release-20261118.json')));
  return { schemaVersion: 1, siteId: SITE_ID, accountId: ACCOUNT_ID,
    deploy: { id: BASE, site_id: SITE_ID, state: 'ready', locked: true, created_at: '2026-11-18T22:00:00.000Z', published_at: '2026-11-18T22:01:00.000Z',
      available_functions: recorded.available_functions, function_schedules: recorded.function_schedules, ...recorded.runtime },
    files: report.files, playSHA1: report.files['/play/index.html'],
    environment: { site: { entries: 5, sha256: hash('site') }, snippetsSha256: hash('snippets') } };
}
const overlays = () => Object.entries(DELIVERY_SOURCES).map(([path, source]) => ({path,source,sha1:hash('new ' + path,'sha1')}));
function pilot() {
  return { sha256:hash('pilot'),bytes:1234,runtimeVersion:'nodejs24.x',invocationMode:'stream',
    buildData:{bootstrapVersion:'2.24.0',runtimeAPIVersion:2},
    routes:[{pattern:'/api/arcade-challenge-pilot',literal:'/api/arcade-challenge-pilot',methods:['GET','POST']}],
    trafficRules:{action:{type:'rate_limit',config:{aggregate:{keys:[{type:'domain'},{type:'ip'}]},rateLimitConfig:{algorithm:'sliding_window',windowSize:60,windowLimit:60}}}} };
}
function added() {
  const p=pilot(), b=baseline().deploy, actual=copy(b), f=copy(b.available_functions.find(f=>f.n==='arcade-monthly'));
  Object.assign(f,{n:PILOT,d:p.sha256,s:p.bytes,r:p.runtimeVersion,im:p.invocationMode,bd:p.buildData,
    ro:[{p:'/api/arcade-challenge-pilot',l:'/api/arcade-challenge-pilot',e:null,m:['GET','POST'],ps:false}]});
  actual.available_functions.push(f); return {before:b,actual,pilot:p,record:f};
}
function proof() {
  const rules=makePilotRules({pilotId:'arborist-trials-november-2026',challengeDate:'2026-11-18',startsAt:'2026-11-19T00:00:00.000Z',endsAt:'2026-12-01T00:00:00.000Z'});
  return {schemaVersion:1,projectId:DB_PROJECT,sourceMigration:MIGRATION,sourceMigrationSHA256:hash('migration'),
    appliedMigration:{version:'20261119000000',name:'arcade_challenge_pilot'},verifiedAt:new Date(NOW).toISOString(),
    rpcDefinitions:['load_config','start','load_attempt','commit_move'].map(n=>({name:'arcade_challenge_pilot_'+n+'_v1',sha256:hash(n),securityDefiner:false,searchPath:'',executeRoles:['postgres','service_role'],deniedRoles:['PUBLIC','anon','authenticated']})),
    tables:['configs','attempts','requests'].map(n=>({name:'arcade_challenge_pilot_'+n,schema:'private',rls:true,browserAccess:false})),
    pilot:{pilotId:rules.pilotId,status:'enabled',rulesHash:contentHash(rules),rules}};
}
function boundReview() {
  const plan={sourceCommit:SOURCE,sourceTree:TREE,baselineId:BASE}, state={id:CANDIDATE,candidateCreatedAt:'2026-11-18T23:00:00.000Z'};
  const report={schemaVersion:1,result:'passed',sourceCommit:SOURCE,sourceTree:TREE,candidateId:CANDIDATE,planSha256:fingerprint(plan),
    origin:`https://${CANDIDATE}--tree-token.netlify.app`,checkedAt:new Date(NOW).toISOString(),viewportWidths:[390,1280],noWalletOrPaymentActions:true,
    checks:Object.fromEntries(['pilotPage','campaignLink','mobileLayout','keyboardFocus','noMissingAssets','noPrizeLabel','previewOriginBlocked'].map(n=>[n,true]))};
  return {plan,state,report};
}

test('adds exactly five static assets, changes only Campaigns link module, and preserves future current paths',()=>{
  const b=baseline(); b.files['/future-game/index.html']=hash('future','sha1'); validateBaseline(b,BASE);
  const plan=assembleFiles(b.files,overlays()); assert.deepEqual(plan.changedOriginals,REQUIRED_CHANGES); assert.deepEqual(plan.addedPaths,[...ADDED_PATHS].sort());
  assert.equal(Object.keys(plan.files).length,Object.keys(b.files).length+5);
  for(const p of Object.keys(b.files)) if(!REQUIRED_CHANGES.includes(p)) assert.equal(plan.files[p],b.files[p]);
});
test('rejects omitted, repeated, replaced-new, unapproved and source-substituted paths',()=>{
  const b=baseline(), rows=overlays();
  assert.throws(()=>assembleFiles(b.files,rows.slice(1))); assert.throws(()=>assembleFiles(b.files,[...rows,rows[0]]));
  const existing=copy(b.files); existing[ADDED_PATHS[0]]=hash('existing','sha1'); assert.throws(()=>assembleFiles(existing,rows));
  for(const path of ['/play/index.html','/scripts/arcade-monthly.js','/scripts/payout.js']) assert.throws(()=>assembleFiles(b.files,[...rows,{path,source:path.slice(1),sha1:hash(path,'sha1')}]));
  const bad=copy(rows); bad[0].source='dist/index.html'; assert.throws(()=>assembleFiles(b.files,bad));
});
test('new pilot preserves every old provider, package and unknown field exactly',()=>{
  const f=added(); compareBackend(f.actual,f.before,f.pilot); compareBackend(copy(f.before),f.before);
  for(const name of ['arcade-monthly',f.before.available_functions[0].n]) for(const field of ['id','oid','a','r','rg','m','im','bd','d','s','futureField']) {
    const bad=copy(f.actual); bad.available_functions.find(f=>f.n===name)[field]=field==='d'?hash('changed'):'changed';
    assert.throws(()=>compareBackend(bad,f.before,f.pilot),undefined,name+'.'+field);
  }
});
test('new pilot route, runtime, package, rate limit and final provisioned record are pinned',()=>{
  const f=added(); assert.deepEqual(compareBackend(f.actual,f.before,f.pilot),f.record);
  for(const field of ['d','s','r','im','rg','m','bd','ro','tr','er','es','p']) {
    const bad=copy(f.actual), record=bad.available_functions.find(f=>f.n===PILOT); record[field]=field==='d'?hash('changed'):field==='er'||field==='es'?['changed']:'changed';
    assert.throws(()=>compareBackend(bad,f.before,f.pilot));
  }
  const bad=copy(f.actual); bad.available_functions.find(f=>f.n===PILOT).oid='different-provider';
  assert.throws(()=>compareBackend(bad,f.before,f.pilot,f.record),/Pinned/);
});
test('backend deletion, extra function, schedule and deployment runtime drift fail closed',()=>{
  const f=added();
  for(const mutate of [d=>d.available_functions.shift(),d=>d.available_functions.push({...copy(f.record),n:'unreviewed'}),d=>d.function_schedules.pop(),d=>{d.functions_region='iad';},d=>{d.database_branch_id='other';},d=>{d.server={id:'new'};}]) {
    const bad=copy(f.actual);mutate(bad);assert.throws(()=>compareBackend(bad,f.before,f.pilot));
  }
});
test('only reviewed static bytes and the one new function package may upload',()=>{
  const plan={...assembleFiles(baseline().files,overlays()),pilot:pilot()};
  const good={required:Object.keys(plan.sources).map(p=>plan.files[p]),required_functions:[plan.pilot.sha256],required_edge_functions:[],required_server:[]};
  validateUploadRequirements(good,plan);
  for(const key of ['required_functions','required_edge_functions','required_server']) assert.throws(()=>validateUploadRequirements({...good,[key]:[hash('other')]},plan));
  assert.throws(()=>validateUploadRequirements({...good,required:[baseline().files['/play/index.html']]},plan));
  assert.throws(()=>validateUploadRequirements({...good,required_functions:[plan.pilot.sha256,plan.pilot.sha256]},plan));
});
test('DB proof binds actual migration, private service-only RPCs and explicit no-prize rules',()=>{
  assert.equal(validateDBProof(proof(),Buffer.from('migration'),NOW).path,DB_PROOF);
  for(const mutate of [p=>{p.projectId='other';},p=>{p.sourceMigrationSHA256=hash('other');},p=>p.rpcDefinitions.pop(),p=>{p.rpcDefinitions[0].securityDefiner=true;},p=>p.rpcDefinitions[0].executeRoles.push('anon'),p=>{p.tables[0].browserAccess=true;},p=>{p.tables[0].rls=false;},p=>{p.pilot.rules.payable=true;},p=>{p.pilot.status='draft';},p=>{p.pilot.rulesHash=hash('wrong');}]) {
    const p=proof();mutate(p);assert.throws(()=>validateDBProof(p,Buffer.from('migration'),NOW));
  }
  assert.throws(()=>validateDBProof(proof(),Buffer.from('migration'),NOW+86400001));
});
test('candidate review requires exact artifact/source identity, phone/desktop and visible no-prize state',()=>{
  const f=boundReview();validateBrowserReview(f.report,f.plan,f.state,NOW);
  for(const mutate of [r=>{r.candidateId=BASE;},r=>{r.planSha256=hash('wrong');},r=>{r.sourceTree=MAIN;},r=>{r.viewportWidths=[1280];},r=>{r.checks.noPrizeLabel=false;},r=>{r.checks.previewOriginBlocked=false;},r=>{r.noWalletOrPaymentActions=false;}]) {
    const r=copy(f.report);mutate(r);assert.throws(()=>validateBrowserReview(r,f.plan,f.state,NOW));
  }
});
test('publication requires a narrow two-file control commit bound to reviewed main and immutable run artifact',()=>{
  const c={schemaVersion:1,action:'publish-arcade-challenge',sourceCommit:SOURCE,sourceTree:TREE,mainCommit:MAIN,expectedDeploy:BASE,candidateId:CANDIDATE,planSha256:hash('plan'),candidateRunId:101,candidateArtifactId:202,candidateArtifactSHA256:hash('artifact'),browserReview:REVIEW_FILE};
  validatePublicationControl(c);
  const evidence={mode:'publish',parents:[MAIN],mainTree:TREE,changedFiles:[CONTROL_FILE,REVIEW_FILE],message:'Publish [publish arcade challenge] [skip netlify]'};
  validateControlCommit(c,evidence);
  assert.throws(()=>validateControlCommit(c,{...evidence,changedFiles:[...evidence.changedFiles,'scripts/payment.js']}));
  assert.throws(()=>validatePublicationControl({...c,candidateId:BASE}));
  assert.throws(()=>validatePublicationControl({...c,candidateArtifactSHA256:''}));
});
test('capture, plan, verification and audit have no remote mutation capability',async()=>{
  for(const mode of ['capture','plan','verify','audit']) {
    const calls=[],api=scopedAPI(async(...args)=>{calls.push(args);return {};},mode);await api('deploys/'+CANDIDATE);
    for(const method of ['POST','PUT','PATCH','DELETE']) assert.throws(()=>api(`deploys/${CANDIDATE}/lock`,method));
    assert.equal(calls.length,1);
  }
});
test('isolated package manifest binds all source files, lock, ZIP, runtime and allowed route',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pilot-package-guard-'));
  try {
    const p=pilot(),bytes=Buffer.from('fixture zip bytes'),manifest={...p,schemaVersion:1,kind:'arcade-challenge-pilot-review-package',name:PILOT,path:'.netlify/arcade-challenge-pilot-functions/arcade-challenge-pilot.zip',deployed:false,productionEnabled:false,payable:false,awardsEnabled:false,
      sha256:hash(bytes),sourceFiles:PACKAGE_SOURCES.map(path=>({path,sha256:hash(fs.readFileSync(ROOT+'/'+path))})),
      tooling:{package:'vendor/arcade-events/package.json',packageSha256:hash(fs.readFileSync(ROOT+'/vendor/arcade-events/package.json')),lockSha256:hash(fs.readFileSync(ROOT+'/vendor/arcade-events/package-lock.json'))}};
    const write=m=>fs.writeFileSync(temp+'/pilot-manifest.json',JSON.stringify(m));write(manifest);fs.writeFileSync(temp+'/pilot-function.zip',bytes);pilotPackage(temp);
    for(const mutate of [m=>m.sourceFiles.pop(),m=>{m.sourceFiles[0].sha256=hash('wrong');},m=>{m.tooling.lockSha256=hash('wrong');},m=>{m.routes[0].pattern='/api/pay';},m=>{m.runtimeVersion='nodejs22.x';},m=>{m.payable=true;}]) {
      const m=copy(manifest);mutate(m);write(m);assert.throws(()=>pilotPackage(temp));
    }
    write(manifest);fs.writeFileSync(temp+'/pilot-function.zip','changed');assert.throws(()=>pilotPackage(temp));
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
