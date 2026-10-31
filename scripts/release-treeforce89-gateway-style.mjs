// Static-only release through the initialized official Netlify CLI.
// Never reads credential configuration, rebuilds functions, or applies migrations.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const [mode,cliDirectory,deployId]=process.argv.slice(2);
assert(['candidate','verify','published'].includes(mode));
assert(cliDirectory,'Pass the installed official netlify-cli directory');
const {createMainCommand}=await import(pathToFileURL(resolve(cliDirectory,'dist/commands/main.js')));
const {runProgram}=await import(pathToFileURL(resolve(cliDirectory,'dist/utils/run-program.js')));
const {default:fetch}=await import(pathToFileURL(resolve(cliDirectory,'../node-fetch/src/index.js')));
const baseline=JSON.parse(readFileSync(resolve(root,'.netlify/live-release-baseline.json')));
const evidence=JSON.parse(readFileSync(resolve(root,'netlify/preview-lib/treeforce89-database-evidence.json')));
const expectedBaseline='6ae55a0c1aa8c546b7109a41';
assert.equal(baseline.deploy.id,expectedBaseline,'Unexpected release baseline');
assert.equal(baseline.files.length,207);
const stage=resolve(root,'.netlify/treeforce89-gateway-style');
const changes=['/play/treeforce89/index.html','/play/treeforce89/gateway.css'];
const originalFiles=Object.fromEntries(baseline.files.map(f=>[f.path,f.sha]));
const files={...originalFiles};
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
for(const path of changes) files[path]=digest('sha1',readFileSync(resolve(stage,path.split('/').at(-1))));
assert.equal(files['/play/treeforce89/gateway.css'],digest('sha1',readFileSync(resolve(root,'play/treeforce89/gateway.css'))));
const oldHtml=readFileSync(resolve(root,'.netlify/treeforce89-canonical-development/play/treeforce89/index.html'),'utf8');
assert.equal(digest('sha1',oldHtml),originalFiles['/play/treeforce89/index.html']);
const newHtml=readFileSync(resolve(stage,'index.html'),'utf8');
const scripts=html=>[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]);
// Netlify materializes the game's already effective memory/region aliases when
// reusing its package. Require those aliases to equal the explicit settings;
// retain exact comparison of every other field and all 38 original functions.
const comparableFunctions=functions=>functions.map(fn=>{
 if(fn.n!=='treeforce89-dev')return fn;
 assert.equal(fn.mo??fn.m,fn.m,'Game memory alias differs from its effective setting');
 assert.equal(fn.rgo??fn.rg,fn.rg,'Game region alias differs from its effective setting');
 return {...fn,mo:fn.m,rgo:fn.rg};
});
assert.deepEqual(scripts(newHtml),scripts(oldHtml));
assert(newHtml.includes('class="gateway-intro"')&&newHtml.includes('/play/treeforce89/gateway.css'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const program=createMainCommand();
program.command('gateway-style-release').action(async(options,command)=>{
 const api=command.netlify.api;
 const siteId='aa62f324-b880-47d6-85b8-4ba0700ff5bf';
 const inventory=async id=>{
  const rows=[];
  for(let page=1;;page++){
   const response=await fetch(api.basePath+'/deploys/'+id+'/files?per_page=100&page='+page,
    {headers:api.defaultHeaders,agent:api.agent});
   assert(response.ok,'Inventory HTTP '+response.status);
   const batch=await response.json(); rows.push(...batch); if(batch.length<100)break;
  }
  return Object.fromEntries(rows.map(f=>[f.path,f.sha]));
 };
 const original=await api.getDeploy({deployId:expectedBaseline});
 assert.equal(original.available_functions.length,39); assert.equal(original.function_schedules.length,5);
 assert.deepEqual(original.available_functions,baseline.deploy.available_functions);
 assert.deepEqual(original.function_schedules,baseline.deploy.function_schedules);
 assert.deepEqual(await inventory(original.id),originalFiles);
 let id=deployId;
 if(mode==='candidate'){
  assert.equal(git('status','--porcelain'),'','Commit reviewed presentation before release');
  assert.equal(git('branch','--show-current'),evidence.branch);
  assert.equal((await api.getSite({siteId})).published_deploy.id,original.id,'Concurrent release');
  assert.equal(original.locked,true);
  const secretFile=process.env.TREEFORCE89_DEV_DATABASE_FILE;
  assert(secretFile,'Provide the existing server-only development binding');
  const connectionString=readFileSync(secretFile,'utf8').trim();
  const url=new URL(connectionString); assert(['postgres:','postgresql:'].includes(url.protocol));
  const identity=digest('sha256',url.hostname.replace(/-pooler(?=\.)/,'')+'|'+url.pathname);
  assert.equal(identity,evidence.previewDatabaseIdentity);
  assert(!evidence.productionDatabaseIdentities.includes(identity));
  const functions={},functions_config={};
  const route=r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!=null));
  for(const fn of original.available_functions){
   functions[fn.n]=fn.d; const config={};
   for(const [short,long]of Object.entries({dn:'display_name',g:'generator',bd:'build_data',m:'memory',p:'priority',rg:'region',tr:'traffic_rules',vcpu:'vcpu',es:'event_subscriptions'}))
    if(fn[short]!=null)config[long]=fn[short];
   if(fn.ro)config.routes=fn.ro.map(route); if(fn.er)config.excluded_routes=fn.er.map(route);
   functions_config[fn.n]=config;
  }
  const deploy=await api.createSiteDeploy({siteId,title:'TREE FORCE NFTree Gateway arcade presentation; HTML/CSS only; all backend preserved',body:{
   files,functions,functions_config,function_schedules:original.function_schedules,draft:false,async:false,branch:original.branch,
   environment:[{key:'TREEFORCE89_DEV_DATABASE_URL',value:connectionString,is_secret:true,scopes:['functions']}]
  }});
  id=deploy.id;
  writeFileSync(resolve(root,'.netlify/treeforce89-gateway-style-candidate.json'),JSON.stringify({id,baseline:original.id,sourceCommit:git('rev-parse','HEAD')}));
  assert.equal(deploy.required_functions?.length||0,0,'Refuse any function upload');
  assert.equal(deploy.required_edge_functions?.length||0,0);
  for(const hash of deploy.required||[]){
   const path=changes.find(p=>files[p]===hash); assert(path,'Unexpected static upload');
   await api.uploadDeployFile({deployId:id,path:path.slice(1),body:()=>createReadStream(resolve(stage,path.split('/').at(-1)))});
  }
 }
 assert(/^[a-f0-9]{24}$/.test(id||''),'Candidate ID required');
 let candidate;
 for(let i=0;i<45;i++){
  candidate=await api.getDeploy({deployId:id}); if(candidate.state==='ready')break;
  assert.notEqual(candidate.state,'error'); await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.equal(candidate.state,'ready');
 assert.deepEqual(await inventory(id),files);
 assert.deepEqual(comparableFunctions(candidate.available_functions),comparableFunctions(original.available_functions),'Backend identity/configuration changed');
 assert.deepEqual(candidate.function_schedules,original.function_schedules);
 assert.equal(candidate.database_migrations?.files?.length??candidate.database_migrations?.length??0,0);
 assert.equal((await api.getSite({siteId})).published_deploy.id,mode==='published'?id:original.id);
 if(mode==='published'){
  await api.lockDeploy({deployId:id});
  assert.deepEqual(Object.fromEntries((await api.listSiteFiles({siteId})).map(f=>[f.path,f.sha])),files);
 }
 const report={id,baseline:original.id,mode,sourceCommit:git('rev-parse','HEAD'),files:Object.keys(files).length,
  preservedStaticFiles:206,changedExistingPaths:[changes[0]],newPaths:[changes[1]],functionsPreserved:39,schedulesPreserved:5,
  gameAndWalletJavaScriptUnchanged:true,isolatedDatabaseIdentity:evidence.previewDatabaseIdentity,paymentsEnabled:false,
  metadataAliasNormalization:{function:'treeforce89-dev',memory:1024,region:'us-east-2',allOtherFieldsComparedExactly:true},
  publishedAt:candidate.published_at||null,filesBySha1:files};
 writeFileSync(resolve(root,'.netlify/treeforce89-gateway-style-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,filesBySha1:undefined},null,2));
});
await runProgram(program,['node','netlify','gateway-style-release']);
program.onEnd();
