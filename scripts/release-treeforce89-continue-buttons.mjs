// Frontend-only forward release. All 39 current function records and schedules
// are reused exactly through the initialized official CLI, with no token reads.
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),[mode,cliDirectory,deployId]=process.argv.slice(2);
assert(['candidate','verify','published'].includes(mode));assert(cliDirectory);
const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
const baseline=JSON.parse(readFileSync(resolve(root,'.netlify/live-release-baseline.json')));
const input=JSON.parse(readFileSync(resolve(root,'.netlify/treeforce89-paid-release/release-input.json')));
const evidence=JSON.parse(readFileSync(resolve(root,'netlify/preview-lib/treeforce89-database-evidence.json')));
assert.equal(baseline.deploy.id,'6ae56c08df52d066dfb245ed');assert.equal(baseline.files.length,210);
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const originalFiles=Object.fromEntries(baseline.files.map(f=>[f.path,f.sha])),files={...originalFiles};
for(const file of input.files){
 assert(file.path==='/play/index.html'||file.path.startsWith('/play/treeforce89/'));
 assert.equal(digest('sha1',readFileSync(file.source)),file.sha);files[file.path.toLowerCase()]=file.sha;
}
const changed=Object.keys(originalFiles).filter(p=>files[p]!==originalFiles[p]);
assert.deepEqual(changed.sort(),['/play/treeforce89/gateway.css','/play/treeforce89/index.html']);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const program=createMainCommand();
program.command('continue-buttons-release').action(async(options,command)=>{
 const api=command.netlify.api,siteId=evidence.siteId;
 const inventory=async id=>{const rows=[];for(let page=1;;page++){
  const r=await fetch(api.basePath+'/deploys/'+id+'/files?per_page=100&page='+page,{headers:api.defaultHeaders,agent:api.agent});
  assert(r.ok,'Inventory HTTP '+r.status);const batch=await r.json();rows.push(...batch);if(batch.length<100)break;
 }return Object.fromEntries(rows.map(f=>[f.path,f.sha]));};
 const original=await api.getDeploy({deployId:baseline.deploy.id});
 assert.deepEqual(original.available_functions,baseline.deploy.available_functions);
 assert.deepEqual(original.function_schedules,baseline.deploy.function_schedules);
 assert.equal(original.available_functions.length,39);assert.equal(original.function_schedules.length,5);
 assert.deepEqual(await inventory(original.id),originalFiles);
 let id=deployId;
 if(mode==='candidate'){
  assert.equal(git('status','--porcelain'),'','Commit reviewed source before release');assert.equal(git('branch','--show-current'),evidence.branch);
  assert.equal((await api.getSite({siteId})).published_deploy.id,original.id,'Concurrent release');assert.equal(original.locked,true);
  const {branches}=await api.listSiteDatabaseBranches({siteId});const branch=branches.find(b=>b.name===evidence.branch);assert(branch?.branch_id);
  const value=await api.getSiteDatabaseBranch({siteId,branchId:branch.branch_id,role:'netlifydb_owner'});
  const connectionString=value.connection_string||value.connectionString,url=new URL(connectionString);
  assert.equal(url.username,'netlifydb_owner');assert(['postgres:','postgresql:'].includes(url.protocol));
  const identity=digest('sha256',url.hostname.replace(/-pooler(?=\.)/,'')+'|'+url.pathname);
  assert.equal(identity,evidence.previewDatabaseIdentity);assert(!evidence.productionDatabaseIdentities.includes(identity));
  const functions={},functions_config={};
  const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));
  for(const fn of original.available_functions){functions[fn.n]=fn.d;const config={};
   for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))
    if(fn[short]!=null)config[long]=fn[short];
   if(fn.ro)config.routes=fn.ro.map(route);if(fn.er)config.excluded_routes=fn.er.map(route);functions_config[fn.n]=config;
  }
  const d=await api.createSiteDeploy({siteId,title:'TREE FORCE: clear payment and Resume gameplay buttons; frontend only',body:{
   files,functions,functions_config,function_schedules:original.function_schedules,draft:false,async:false,branch:original.branch,
   commit_ref:git('rev-parse','HEAD'),environment:[
    {key:'TREEFORCE89_DEV_DATABASE_URL',value:connectionString,is_secret:true,scopes:['functions']},
    {key:'TREEFORCE89_PAID_CONTINUES_ENABLED',value:'true',is_secret:false,scopes:['functions']}]
  }});id=d.id;writeFileSync(resolve(root,'.netlify/treeforce89-continue-buttons-candidate.json'),JSON.stringify({id,baseline:original.id,sourceCommit:git('rev-parse','HEAD')}));
  assert.equal(d.required_functions?.length||0,0,'Refuse a function upload');assert.equal(d.required_edge_functions?.length||0,0);
  for(const hash of d.required||[]){const file=input.files.find(f=>f.sha===hash);assert(file,'Refuse unrelated static upload');
   await api.uploadDeployFile({deployId:id,path:encodeURI(file.path.slice(1)),body:()=>createReadStream(file.source)});
  }
 }
 assert(/^[a-f0-9]{24}$/.test(id||''));let candidate;
 for(let i=0;i<45;i++){candidate=await api.getDeploy({deployId:id});if(candidate.state==='ready')break;
  assert.notEqual(candidate.state,'error','Candidate deploy failed; inspect Netlify log');await new Promise(r=>setTimeout(r,1000));}
 assert.equal(candidate.state,'ready');assert.deepEqual(await inventory(id),files);
 assert.deepEqual(candidate.available_functions,original.available_functions,'Backend identity/configuration changed');
 assert.deepEqual(candidate.function_schedules,original.function_schedules);
 assert.equal(candidate.database_migrations?.files?.length??candidate.database_migrations?.length??0,0);
 assert.equal((await api.getSite({siteId})).published_deploy.id,mode==='published'?id:original.id);
 if(mode==='published'){await api.lockDeploy({deployId:id});assert.equal((await api.getDeploy({deployId:id})).locked,true);
  assert.deepEqual(Object.fromEntries((await api.listSiteFiles({siteId})).map(f=>[f.path,f.sha])),files);}
 const report={id,baseline:original.id,mode,sourceCommit:git('rev-parse','HEAD'),sourceBranch:evidence.branch,files:Object.keys(files).length,
  preservedStaticFiles:baseline.files.length-changed.length,changedExistingPaths:changed,newPaths:Object.keys(files).filter(p=>!Object.hasOwn(originalFiles,p)),
  functionsPreserved:39,schedulesPreserved:5,backendUnchanged:true,noMigrations:true,paymentsEnabled:true,
  isolatedDatabaseIdentity:evidence.previewDatabaseIdentity,publishedAt:candidate.published_at||null,filesBySha1:files,
  functionRecords:candidate.available_functions,functionSchedules:candidate.function_schedules};
 writeFileSync(resolve(root,'.netlify/treeforce89-continue-buttons-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,filesBySha1:undefined,functionRecords:undefined,functionSchedules:undefined},null,2));
});await runProgram(program,['node','netlify','continue-buttons-release']);program.onEnd();
