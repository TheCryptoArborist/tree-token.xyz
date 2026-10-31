import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseIdentity,previewRequestAllowed} from '../netlify/preview-lib/treeforce89-database.mjs';

test('database identity ignores credentials and pooling aliases',()=>{
  const base='postgresql://example:example@ep-preview.c-1.us-east-2.db.netlify.com/netlifydb?sslmode=require';
  assert.equal(databaseIdentity(base),databaseIdentity(base.replace('example:example','other:rotated')));
  assert.equal(databaseIdentity(base),databaseIdentity(base.replace('ep-preview.','ep-preview-pooler.')));
  assert.notEqual(databaseIdentity(base),databaseIdentity(base.replace('ep-preview.','ep-production.')));
  assert.throws(()=>databaseIdentity('postgresql://example:example@attacker.example/netlifydb'));
});
test('database probes require exact integration preview and same-origin POST',()=>{
  const build={branch:'feature/treeforce89-play-integration',context:'deploy-preview',prNumber:70};
  const context={site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'},deploy:{id:'a'.repeat(24),context:'deploy-preview'}};
  const origin='https://deploy-preview-70--tree-token.netlify.app';
  const request=(url=origin,options={})=>new Request(url+'/.netlify/functions/treeforce89-db-status',
    {method:'POST',headers:{origin},...options});
  assert.equal(previewRequestAllowed(build,context,request()),true);
  assert.equal(previewRequestAllowed({...build,branch:'main'},context,request()),false);
  assert.equal(previewRequestAllowed(build,{...context,deploy:{...context.deploy,context:'production'}},request()),false);
  assert.equal(previewRequestAllowed(build,context,request('https://www.tree-token.xyz')),false);
  assert.equal(previewRequestAllowed(build,context,request(origin,{headers:{origin:'https://attacker.example'}})),false);
  assert.equal(previewRequestAllowed(build,context,request(origin,{method:'GET'})),false);
  assert.equal(previewRequestAllowed(build,context,request('https://deploy-preview-71--tree-token.netlify.app')),false);
});
