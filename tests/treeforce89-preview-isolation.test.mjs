import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTreeForcePreviewIsolation,TREE_TOKEN_SITE_ID} from '../netlify/preview-lib/treeforce89-isolation.mjs';

const url='https://deploy-preview-82--tree-token.netlify.app/.netlify/functions/tree-session';
const build={branch:'feature/treeforce89-play-integration',context:'deploy-preview',prNumber:82};
const context={deploy:{context:'deploy-preview',id:'deploy-abc'},site:{id:TREE_TOKEN_SITE_ID}};
const request=()=>new Request(url,{method:'POST',headers:{origin:new URL(url).origin}});
const base=()=>({build,context,request:request(),databaseIdentity:'isolated-treeforce-preview',
  productionDatabaseIdentities:['tree-token-prod','treeforce89-prod'],isolationVerified:true});

test('approved preview origin and independently verified distinct DB pass',()=>{
 assert.equal(assertTreeForcePreviewIsolation(base()).approved,true);
});
test('rejects production and branch deployment contexts',()=>{
 for(const contextName of ['production','branch-deploy']){
  assert.throws(()=>assertTreeForcePreviewIsolation({...base(),context:{...context,deploy:{...context.deploy,context:contextName}}}),/deployment identity/);
 }
});
test('rejects source game site ID and wrong branch',()=>{
 assert.throws(()=>assertTreeForcePreviewIsolation({...base(),context:{...context,site:{id:'35f5591a-5c7d-4bc6-ae9a-3e61e816b641'}}}),/deployment identity/);
 assert.throws(()=>assertTreeForcePreviewIsolation({...base(),build:{...build,branch:'main'}}),/deployment identity/);
});
test('rejects unapproved origin, HTTP and forged browser origin',()=>{
 for(const bad of ['https://www.tree-token.xyz/play/treeforce89/','https://treeforce89.netlify.app/','http://deploy-preview-82--tree-token.netlify.app/']){
  assert.throws(()=>assertTreeForcePreviewIsolation({...base(),request:new Request(bad,{method:'POST',headers:{origin:new URL(bad).origin}})}),/origin/);
 }
 assert.throws(()=>assertTreeForcePreviewIsolation({...base(),request:new Request(url,{method:'POST',headers:{origin:'https://attacker.example'}})}),/origin/);
});
test('rejects DB identity reused by either production site',()=>{
 for(const identity of ['tree-token-prod','treeforce89-prod']){
  assert.throws(()=>assertTreeForcePreviewIsolation({...base(),databaseIdentity:identity}),/database isolation/);
 }
});
test('rejects missing proof, missing production IDs and missing DB identity',()=>{
 for(const patch of [{isolationVerified:false},{databaseIdentity:''},{productionDatabaseIdentities:[]},{productionDatabaseIdentities:['tree-token-prod','']}])
  assert.throws(()=>assertTreeForcePreviewIsolation({...base(),...patch}),/database isolation/);
});
test('rejects cross-site fetch metadata',()=>{
 const req=new Request(url,{method:'POST',headers:{origin:new URL(url).origin,'sec-fetch-site':'cross-site'}});
 assert.throws(()=>assertTreeForcePreviewIsolation({...base(),request:req}),/origin/);
});
