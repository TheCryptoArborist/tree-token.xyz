// Disposable integration bundle from immutable Git sources; not a Netlify release.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {build} from '../../vendor/continue-browser-test/node_modules/esbuild/lib/main.js';
export async function loadNativeContinueTestBundle(){
 const commit='bf4537220bb9a9b096cfaab9598fa2cd13556db9',dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-host-bundle-'));
 const files=['netlify/preview-lib/treeforce89-paid-continue.mjs','netlify/preview-lib/treeforce89-source/game/authenticated-session.mjs','netlify/preview-lib/treeforce89-source/game/tree-payment.mjs','treeforce89/paid/mainnet-transaction-reader.mjs','treeforce89/paid/contract.mjs'];
 try{
  const sources=files.map(file=>{const bytes=execFileSync('git',['show',commit+':'+file]);const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);return {file,sha256:createHash('sha256').update(bytes).digest('hex')};});
  const outfile=path.join(dir,'bundle.mjs');
  await build({stdin:{contents:`export {createPaidContinueService} from ${JSON.stringify(path.join(dir,files[0]))};export {createNativeContinueHost} from ${JSON.stringify(path.resolve('scripts/multichain/native-continue-host.mjs'))};`,resolveDir:process.cwd()},outfile,bundle:true,format:'esm',platform:'node',target:'node22',logLevel:'silent'});
  const module=await import(pathToFileURL(outfile));
  return {module,evidence:{commit,sources,bundleSha256:createHash('sha256').update(fs.readFileSync(outfile)).digest('hex'),deployable:false},close:()=>fs.rmSync(dir,{recursive:true,force:true})};
 }catch(error){fs.rmSync(dir,{recursive:true,force:true});throw error;}
}
