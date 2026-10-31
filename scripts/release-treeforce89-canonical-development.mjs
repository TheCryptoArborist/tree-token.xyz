// Run inside the user's authenticated, official Netlify CLI context. This
// script never reads credential configuration or creates API access tokens.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const [mode,cliDirectory,deployId]=process.argv.slice(2);
assert(['candidate','verify','published'].includes(mode));
assert(cliDirectory,'Pass the installed official netlify-cli directory');
const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
const baseline=JSON.parse(readFileSync(resolve(root,'.netlify/live-release-baseline.json')));
const input=JSON.parse(readFileSync(resolve(root,'.netlify/treeforce89-canonical-development/release-input.json')));
const evidence=JSON.parse(readFileSync(resolve(root,'netlify/preview-lib/treeforce89-database-evidence.json')));
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const program=createMainCommand();
program.command('treeforce-release').action(async(options,command)=>{
 const api=command.netlify.api;
 // Netlify's deploy-file inventory endpoint is documented by Netlify support;
 // retain the CLI's initialized transport and authentication without extracting tokens.
 const inventory=async id=>{
   const rows=[];
   for(let page=1;;page++){
     const response=await fetch(api.basePath+'/deploys/'+id+'/files?per_page=100&page='+page,
       {headers:api.defaultHeaders,agent:api.agent});
     assert(response.ok,'Deploy inventory HTTP '+response.status);
     const batch=await response.json();rows.push(...batch);if(batch.length<100)break;
   }
   return Object.fromEntries(rows.map(f=>[f.path,f.sha]));
 };
 const originalFiles=Object.fromEntries(baseline.files.map(f=>[f.path,f.sha]));
 const files={...originalFiles};
 for(const file of input.files){
   assert(file.path==='/play/index.html'||file.path.startsWith('/play/treeforce89/'));
   if(file.path!=='/play/index.html')assert(!Object.hasOwn(files,file.path),'Refuse an existing path overwrite');
   // Netlify normalizes uploaded asset paths to lowercase in its inventory.
   assert.equal(digest('sha1',readFileSync(file.source)),file.sha);files[file.path.toLowerCase()]=file.sha;
 }
 const current=await api.getSite({siteId});
 const original=await api.getDeploy({deployId:baseline.deploy.id});
 assert.equal(original.available_functions.length,38);assert.equal(original.function_schedules.length,5);
 assert.deepEqual(original.available_functions,baseline.deploy.available_functions);
 assert.deepEqual(original.function_schedules,baseline.deploy.function_schedules);
 assert.deepEqual(await inventory(original.id),originalFiles);
 let id=deployId;
 if(mode==='candidate'){
   assert.equal(git('status','--porcelain'),'','Commit the reviewed source before release');
   assert.equal(git('branch','--show-current'),evidence.branch);
   assert.equal(current.published_deploy.id,original.id,'Concurrent production change');
   assert.equal(original.locked,true,'Production publishing must stay locked');
   const secretFile=process.env.TREEFORCE89_DEV_DATABASE_FILE;
   assert(secretFile,'Provide the temporary server-only development binding file');
   const connectionString=readFileSync(secretFile,'utf8').trim();
   const url=new URL(connectionString);
   assert(['postgres:','postgresql:'].includes(url.protocol));
   const identity=digest('sha256',url.hostname.replace(/-pooler(?=\.)/,'')+'|'+url.pathname);
   assert(evidence.isolationVerified);assert.equal(identity,evidence.previewDatabaseIdentity);
   assert(!evidence.productionDatabaseIdentities.includes(identity));
   const functions={},functions_config={};
   const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));
   for(const fn of original.available_functions){
     functions[fn.n]=fn.d;
     const config={};
     for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))
       if(fn[short]!=null)config[long]=fn[short];
     if(fn.ro)config.routes=fn.ro.map(route);
     if(fn.er)config.excluded_routes=fn.er.map(route);
     functions_config[fn.n]=config;
   }
   const fn=input.function;
   assert.equal(digest('sha256',readFileSync(fn.path)),fn.sha256);
   functions[fn.name]=fn.sha256;
   const limit=fn.trafficRules.action.config;
   assert.deepEqual(limit.aggregate.keys,[{type:'ip'}]);
   functions_config[fn.name]={routes:fn.routes,build_data:fn.buildData,priority:10,
     traffic_rules:{action:{type:'rate_limit',config:{aggregate:limit.aggregate,
       rate_limit_config:{algorithm:limit.rateLimitConfig.algorithm,
         window_size:limit.rateLimitConfig.windowSize,window_limit:limit.rateLimitConfig.windowLimit}}}}};
   const deploy=await api.createSiteDeploy({siteId,title:'TREE Arcade native TREE FORCE development Gateway; isolated DB; payments off',
     body:{files,functions,functions_config,function_schedules:original.function_schedules,
       draft:false,async:false,branch:original.branch,commit_ref:git('rev-parse','HEAD'),
       environment:[{key:'TREEFORCE89_DEV_DATABASE_URL',value:connectionString,is_secret:true,scopes:['functions']}]}});
   id=deploy.id;
   writeFileSync(resolve(root,'.netlify/treeforce89-canonical-candidate.json'),JSON.stringify({id,commit:git('rev-parse','HEAD'),baseline:original.id},null,2));
   assert((deploy.required_functions||[]).every(hash=>hash===fn.sha256),'Refuse an unrelated backend upload');
   assert.equal(deploy.required_edge_functions?.length||0,0);
   for(const hash of deploy.required_functions||[])
     await api.uploadDeployFunction({deployId:id,name:fn.name,runtime:fn.runtime,invocationMode:fn.invocationMode,body:()=>createReadStream(fn.path)});
   for(const hash of deploy.required||[]){
     const file=input.files.find(f=>f.sha===hash);assert(file,'Refuse an unrelated static upload');
     await api.uploadDeployFile({deployId:id,path:encodeURI(file.path.slice(1)),body:()=>createReadStream(file.source)});
   }
 }
 assert(/^[a-f0-9]{24}$/.test(id||''),'Candidate ID required');
 let candidate;
 for(let i=0;i<40;i++){
   candidate=await api.getDeploy({deployId:id});
   if(candidate.state==='ready')break;
   assert.notEqual(candidate.state,'error','Candidate deploy failed; inspect the Netlify log');
   await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.equal(candidate.state,'ready');
 assert.deepEqual(await inventory(id),files,'Candidate static inventory differs');
 const preserved=candidate.available_functions.filter(fn=>fn.n!=='treeforce89-dev');
 assert.deepEqual(preserved,original.available_functions,'Existing backend identity/configuration changed');
 assert.equal(candidate.available_functions.length,39);
 assert.equal(candidate.available_functions.find(fn=>fn.n==='treeforce89-dev').d,input.function.sha256);
 assert.deepEqual(candidate.function_schedules,original.function_schedules);
 const live=await api.getSite({siteId});
 assert.equal(live.published_deploy.id,mode==='published'?id:original.id,'Unexpected publication state');
 if(mode==='published'){
   await api.lockDeploy({deployId:id});
   assert.deepEqual(Object.fromEntries((await api.listSiteFiles({siteId})).map(f=>[f.path,f.sha])),files);
 }
 const report={id,baseline:original.id,mode,context:candidate.context,branchLabel:candidate.branch,
   sourceBranch:evidence.branch,sourceCommit:git('rev-parse','HEAD'),files:Object.keys(files).length,
   originalStaticFilesPreserved:baseline.files.length-1,changedExistingPaths:['/play/index.html'],
   newPaths:input.files.filter(f=>!Object.hasOwn(originalFiles,f.path)).map(f=>f.path.toLowerCase()),
   existingFunctionsPreserved:38,schedulesPreserved:5,newFunctions:['treeforce89-dev'],
   databaseIdentity:evidence.previewDatabaseIdentity,serverOnlySecret:true,paymentsEnabled:false};
 writeFileSync(resolve(root,'.netlify/treeforce89-canonical-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
});
await runProgram(program,['node','netlify','treeforce-release']);
program.onEnd();
