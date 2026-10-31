import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDevelopmentRequestAllowed,gatewayRequestAllowed,getCanonicalDevelopmentDatabase} from '../netlify/preview-lib/treeforce89-database.mjs';
const build={branch:'feature/treeforce89-play-integration',mode:'canonical-development'};
const context={deploy:{id:'6ae534bcd660ba4ea4235172',context:'production'},site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'}};
const request=(origin='https://tree-token.xyz',path='/play/treeforce89/api/tree-challenge',headers={})=>
  new Request(origin+path,{method:'POST',headers:{Origin:origin,...headers}});
test('native development Gateway requires the approved release, site, game path and same origin',()=>{
  assert(canonicalDevelopmentRequestAllowed(build,context,request()));
  assert(gatewayRequestAllowed(build,context,request()));
  for(const invalid of [
    [{...build,branch:'main'},context,request()],
    [{...build,mode:'production'},context,request()],
    [build,{...context,site:{id:'35f5591a-5c7d-4bc6-ae9a-3e61e816b641'}},request()],
    [build,{...context,deploy:{...context.deploy,context:'deploy-preview'}},request()],
    [build,context,request('https://attacker.example')],
    [build,context,request('https://tree-token.xyz','/.netlify/functions/treeforce89-dev')],
    [build,context,request('https://tree-token.xyz','/api/tree-challenge')],
    [build,context,request('https://tree-token.xyz',undefined,{Origin:'https://attacker.example'})],
    [build,context,request('https://tree-token.xyz',undefined,{'Sec-Fetch-Site':'cross-site'})],
  ])assert.equal(canonicalDevelopmentRequestAllowed(...invalid),false);
});
test('only the current immutable candidate is allowed for pre-publication smoke checks',()=>{
  assert(canonicalDevelopmentRequestAllowed(build,context,request('https://'+context.deploy.id+'--tree-token.netlify.app')));
  assert.equal(canonicalDevelopmentRequestAllowed(build,context,request('https://deploy-preview-70--tree-token.netlify.app')),false);
  assert.equal(canonicalDevelopmentRequestAllowed(build,context,request('https://6ae5553373fe3d939dfa603f--tree-token.netlify.app')),false);
});
test('native release never falls back to an automatic production database binding',()=>{
  const before=process.env.TREEFORCE89_DEV_DATABASE_URL;
  try {
    delete process.env.TREEFORCE89_DEV_DATABASE_URL;
    assert.throws(()=>getCanonicalDevelopmentDatabase(),/binding unavailable/);
    for(const host of ['ep-dawn-cloud-b5aonmys.c-7.us-east-2.db.netlify.com','ep-aged-breeze-b4u2my7v.c-6.us-east-2.db.netlify.com','unverified.db.netlify.com']) {
      process.env.TREEFORCE89_DEV_DATABASE_URL='postgresql://fixture:fixture@'+host+'/netlifydb';
      assert.throws(()=>getCanonicalDevelopmentDatabase(),/isolation unverified/);
    }
  } finally {if(before===undefined)delete process.env.TREEFORCE89_DEV_DATABASE_URL;else process.env.TREEFORCE89_DEV_DATABASE_URL=before;}
});
