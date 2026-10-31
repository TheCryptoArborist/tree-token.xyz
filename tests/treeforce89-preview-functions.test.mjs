import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createIntegratedGatewayHandler} from '../netlify/preview-lib/treeforce89-gateway.mjs';
const toml=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
test('Netlify deploy previews use an isolated function directory',()=>{
 assert.match(toml,/\[context\.deploy-preview\.functions\]\s*directory = "netlify\/preview-functions"/);
 assert.match(toml,/\[functions\]\s*directory = "netlify\/functions"/);
});
for(const name of ['tree-continue','tree-continue-offer'])test(name+' remains disabled',()=>{
 const source=readFileSync(new URL('../netlify/preview-functions/'+name+'.ts',import.meta.url),'utf8');
 assert.match(source,/status:503/);assert.match(source,/authorized:false/);assert.match(source,/enabled:false/);
 assert.doesNotMatch(source,/fetch\s*\(|signPersonalMessage|signAndExecute/);
});
const build={branch:'feature/treeforce89-play-integration',context:'deploy-preview',prNumber:70};
const context={site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'},deploy:{id:'a'.repeat(24),context:'deploy-preview'}};
const origin='https://deploy-preview-70--tree-token.netlify.app';
for(const action of ['challenge','enter','logout','restart'])test(action+' rejects invalid deployment and origin before accessing services',async()=>{
 let accesses=0;
 const handler=createIntegratedGatewayHandler({action,build,services:async()=>{accesses++;throw Error('Must not connect');}});
 const request=(url=origin,headers={origin})=>new Request(url+'/.netlify/functions/tree-test',{method:'POST',headers});
 for(const [req,ctx] of [
  [request('https://www.tree-token.xyz'),context],
  [request(origin,{origin:'https://attacker.example'}),context],
  [request(origin,{}),context],
  [request(origin,{origin,'sec-fetch-site':'cross-site'}),context],
  [request(),{...context,deploy:{...context.deploy,context:'production'}}],
  [request(),{...context,site:{id:'35f5591a-5c7d-4bc6-ae9a-3e61e816b641'}}],
 ])assert.equal((await handler(req,ctx)).status,503);
 assert.equal(accesses,0);
});
test('preview authentication never creates production function files',()=>{
 for(const name of ['tree-challenge','tree-session','tree-logout','tree-run'])
  assert.equal(existsSync(new URL('../netlify/functions/'+name+'.ts',import.meta.url)),false);
});
