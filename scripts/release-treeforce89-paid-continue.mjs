// Preserve the current production inventory through the initialized official
// Netlify CLI. No credential files, token extraction, or hosted DDL.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const [mode,cliDirectory,deployId]=process.argv.slice(2);
assert(['candidate','verify','published'].includes(mode));assert(cliDirectory);
const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
const baseline=JSON.parse(readFileSync(resolve(root,'.netlify/live-release-baseline.json')));
const input=JSON.parse(readFileSync(resolve(root,'.netlify/treeforce89-paid-release/release-input.json')));
const evidence=JSON.parse(readFileSync(resolve(root,'netlify/preview-lib/treeforce89-database-evidence.json')));
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(baseline.deploy.id,'6ae5626d7f0e8b6dd74b6ce8');assert.equal(baseline.files.length,208);
const originalFiles=Object.fromEntries(baseline.files.map(f=>[f.path,f.sha])),files={...originalFiles};
for(const file of input.files){
 assert(file.path==='/play/index.html'||file.path.startsWith('/play/treeforce89/'));
 assert.equal(digest('sha1',readFileSync(file.source)),file.sha);files[file.path.toLowerCase()]=file.sha;
}
const changed=Object.keys(originalFiles).filter(p=>files[p]!==originalFiles[p]);
assert.deepEqual(changed.sort(),['/play/index.html','/play/treeforce89/gateway.css','/play/treeforce89/index.html']);
const fn=input.function;assert.equal(fn.name,'treeforce89-dev');
assert.equal(digest('sha256',readFileSync(fn.path)),fn.sha256);
const program=createMainCommand();
program.command('paid-release').action(async(options,command)=>{
 const api=command.netlify.api,siteId=evidence.siteId;
 const inventory=async id=>{
  const rows=[];for(let page=1;;page++){
   const response=await fetch(api.basePath+'/deploys/'+id+'/files?per_page=100&page='+page,{headers:api.defaultHeaders,agent:api.agent});
   assert(response.ok,'Inventory HTTP '+response.status);const batch=await response.json();rows.push(...batch);if(batch.length<100)break;
  }return Object.fromEntries(rows.map(f=>[f.path,f.sha]));
 };
 const original=await api.getDeploy({deployId:baseline.deploy.id});
 assert.deepEqual(original.available_functions,baseline.deploy.available_functions);
 assert.deepEqual(original.function_schedules,baseline.deploy.function_schedules);
 assert.equal(original.available_functions.length,39);assert.equal(original.function_schedules.length,5);
 assert.deepEqual(await inventory(original.id),originalFiles);
 const oldGame=original.available_functions.find(f=>f.n===fn.name);assert.equal(oldGame.r,fn.runtime);
 let id=deployId;
 if(mode==='candidate'){
  assert.equal(git('status','--porcelain'),'','Commit reviewed code before release');
  assert.equal(git('branch','--show-current'),evidence.branch);
  assert.equal((await api.getSite({siteId})).published_deploy.id,original.id,'Concurrent release');assert.equal(original.locked,true);
  const {branches}=await api.listSiteDatabaseBranches({siteId});
  const branch=branches.find(b=>b.name===evidence.branch);assert(branch?.branch_id);
  const binding=await api.getSiteDatabaseBranch({siteId,branchId:branch.branch_id,role:'netlifydb_owner'});
  const connectionString=binding.connection_string||binding.connectionString,url=new URL(connectionString);
  assert(['postgres:','postgresql:'].includes(url.protocol));assert.equal(url.username,'netlifydb_owner');
  const identity=digest('sha256',url.hostname.replace(/-pooler(?=\.)/,'')+'|'+url.pathname);
  assert.equal(identity,evidence.previewDatabaseIdentity);assert(!evidence.productionDatabaseIdentities.includes(identity));
  const functions={},functions_config={};
  const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));
  for(const record of original.available_functions){
   functions[record.n]=record.n===fn.name?fn.sha256:record.d;const config={};
   for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))
    if(record[short]!=null)config[long]=record[short];
   if(record.ro)config.routes=record.ro.map(route);if(record.er)config.excluded_routes=record.er.map(route);
   functions_config[record.n]=config;
  }
  assert.deepEqual(functions_config[fn.name].routes,fn.routes);assert.deepEqual(oldGame.bd,fn.buildData);
  const deploy=await api.createSiteDeploy({siteId,title:'TREE FORCE: 20,000 TREE paid continue; verified isolated DB; original backend preserved',body:{
   files,functions,functions_config,function_schedules:original.function_schedules,draft:false,async:false,branch:original.branch,
   commit_ref:git('rev-parse','HEAD'),environment:[
    {key:'TREEFORCE89_DEV_DATABASE_URL',value:connectionString,is_secret:true,scopes:['functions']},
    {key:'TREEFORCE89_PAID_CONTINUES_ENABLED',value:'true',is_secret:false,scopes:['functions']}]
  }});
  id=deploy.id;writeFileSync(resolve(root,'.netlify/treeforce89-paid-candidate.json'),JSON.stringify({id,baseline:original.id,sourceCommit:git('rev-parse','HEAD')}));
  assert((deploy.required_functions||[]).every(hash=>hash===fn.sha256),'Unrelated function upload requested');
  assert.equal(deploy.required_edge_functions?.length||0,0);
  for(const hash of deploy.required_functions||[])
   await api.uploadDeployFunction({deployId:id,name:fn.name,runtime:fn.runtime,invocationMode:fn.invocationMode,body:()=>createReadStream(fn.path)});
  for(const hash of deploy.required||[]){
   const file=input.files.find(f=>f.sha===hash);assert(file,'Unrelated static upload requested');
   await api.uploadDeployFile({deployId:id,path:encodeURI(file.path.slice(1)),body:()=>createReadStream(file.source)});
  }
 }
 assert(/^[a-f0-9]{24}$/.test(id||''));let candidate;
 for(let i=0;i<45;i++){
  candidate=await api.getDeploy({deployId:id});if(candidate.state==='ready')break;
  assert.notEqual(candidate.state,'error','Candidate failed; inspect its deploy log');await new Promise(r=>setTimeout(r,1000));
 }
 assert.equal(candidate.state,'ready');assert.deepEqual(await inventory(id),files);
 assert.deepEqual(candidate.available_functions.filter(f=>f.n!==fn.name),original.available_functions.filter(f=>f.n!==fn.name));
 assert.equal(candidate.available_functions.length,39);const game=candidate.available_functions.find(f=>f.n===fn.name);
 assert.equal(game.d,fn.sha256);
 for(const key of ['n','r','im','m','rg','p','ro','tr','bd','es','vcpu','dn','g'])assert.deepEqual(game[key],oldGame[key],'Game runtime/configuration changed: '+key);
 assert.deepEqual(candidate.function_schedules,original.function_schedules);
 assert.equal(candidate.database_migrations?.files?.length??candidate.database_migrations?.length??0,0,'Canonical release must not apply production migrations');
 assert.equal((await api.getSite({siteId})).published_deploy.id,mode==='published'?id:original.id);
 if(mode==='published'){
  await api.lockDeploy({deployId:id});assert.equal((await api.getDeploy({deployId:id})).locked,true);
  assert.deepEqual(Object.fromEntries((await api.listSiteFiles({siteId})).map(f=>[f.path,f.sha])),files);
 }
 const report={id,baseline:original.id,mode,sourceBranch:evidence.branch,sourceCommit:git('rev-parse','HEAD'),files:Object.keys(files).length,
  preservedStaticFiles:baseline.files.length-changed.length,changedExistingPaths:changed,
  newPaths:Object.keys(files).filter(p=>!Object.hasOwn(originalFiles,p)),originalFunctionsPreserved:38,
  changedFunction:fn.name,changedFunctionSha256:fn.sha256,schedulesPreserved:5,
  isolatedDatabaseIdentity:evidence.previewDatabaseIdentity,serverOnlySecret:true,paymentsEnabled:true,
  publishedAt:candidate.published_at||null,filesBySha1:files};
 writeFileSync(resolve(root,'.netlify/treeforce89-paid-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,filesBySha1:undefined},null,2));
});await runProgram(program,['node','netlify','paid-release']);program.onEnd();
