import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'../..'),vendor=root+'/vendor/arcade-completed',destination=root+'/.netlify/arcade-completed-functions';
const {zipFunction}=await import(pathToFileURL(vendor+'/node_modules/@netlify/zip-it-and-ship-it/dist/main.js'));
await fs.mkdir(destination,{recursive:true});
const built=await zipFunction(root+'/netlify/completed-functions/arcade-completed-runs.mjs',destination,{basePath:root,repositoryRoot:root,config:{'*':{nodeBundler:'esbuild',nodeVersion:'22.x'}}});
const bytes=await fs.readFile(built.path),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const manifest={name:built.name,path:path.relative(root,built.path),sha256,runtimeVersion:built.runtimeVersion,invocationMode:built.invocationMode,buildData:built.buildData,routes:built.routes,trafficRules:built.trafficRules};
await fs.writeFile(destination+'/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
