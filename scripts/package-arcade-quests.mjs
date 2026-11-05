// Packages only the two new quest handlers. Never use this as a full-site build.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const deps=resolve(process.argv[2]||'/tmp/arcade-quest-build/node_modules');
const output=resolve(root,'.netlify/arcade-quest-functions');
const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
for(const name of ['@netlify/zip-it-and-ship-it','@mysten/sui']){
 const installed=JSON.parse(await readFile(join(deps,name,'package.json'),'utf8'));
 assert.equal(installed.version,lock.packages['node_modules/'+name].version,'Pinned dependency mismatch: '+name);
}
await mkdir(output,{recursive:true});
const {zipFunction}=await import(pathToFileURL(join(deps,'@netlify/zip-it-and-ship-it/dist/main.js')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const records=[];
for(const name of ['arcade-social','arcade-campaign']){
 const fn=await zipFunction(join(root,'netlify/functions',name+'.ts'),output,{basePath:root,repositoryRoot:root,config:{'*':{nodeBundler:'esbuild',nodeVersion:'22.x'}}});
 assert.equal(fn.name,name);assert.equal(fn.runtimeVersion,'nodejs22.x');assert.equal(fn.invocationMode,'stream');assert.equal(fn.schedule,undefined);
 assert.deepEqual(fn.routes.map(r=>r.pattern),['/api/'+name]);
 execFileSync('python3',['-c',`import zipfile,sys,posixpath\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n for n in z.infolist():\n  assert not n.filename.startswith('/') and '..' not in n.filename.split('/')\n  assert ((n.external_attr >> 16) & 0o170000) != 0o120000\n assert len(z.namelist())>0`,fn.path]);
 const sourceFiles=[];
 for(const input of fn.inputs||[]){const path=relative(root,input);if(path.startsWith('..')||path.startsWith('node_modules/'))continue;sourceFiles.push({path,sha256:hash(await readFile(input))});}
 const bytes=await readFile(fn.path);
 records.push({name,path:relative(root,fn.path),sha256:hash(bytes),size:bytes.length,runtimeVersion:fn.runtimeVersion,invocationMode:fn.invocationMode,routes:fn.routes,buildData:fn.buildData,trafficRules:fn.trafficRules,sourceFiles});
}
const manifest={version:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),expectedBaselineDeploy:'6ae971bd73f65c3f86a9e887',preserveExistingFunctionCount:41,preserveScheduledJobCount:5,functions:records};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({manifest:relative(root,join(output,'manifest.json')),functions:records.map(({name,sha256,size,runtimeVersion})=>({name,sha256,size,runtimeVersion})),existingFunctionsRebuilt:0,productionChanged:false}));
