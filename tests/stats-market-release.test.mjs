import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fingerprint} from '../scripts/release-preserved-production.mjs';
import {DELIVERY_PATHS,DELIVERY_SOURCES,ARBORETUM_SNIPPET,assertServedContent,verifyDelivery} from '../scripts/stats-market-delivery.mjs';

process.env.STATS_MARKET_EXPECTED_DEPLOY ||= '6afd38b699fcd142a80207f5';
const {REPLACED_HASHES,ORIGINAL_CHANGES,STATS_MARKET_PATHS,assembleFiles,publicUploadPath,
  compareBackend,functionsConfig,assertNewCandidate,validateBrowserReport,assertBrowserVerification,
  SITE_ID,BASELINE_ID,AUDITED_STALE_DEPLOYS,isAuditedInactiveDeploy}=await import('../scripts/release-stats-market.mjs');
const sha=(bytes,algorithm='sha1')=>crypto.createHash(algorithm).update(bytes).digest('hex');
const baseline=()=>({'/index.html':'a'.repeat(40),'/dapp/index.html':'b'.repeat(40),'/_headers':'c'.repeat(40),...REPLACED_HASHES});
const overlays=()=>STATS_MARKET_PATHS.map((pathname,i)=>({path:pathname,source:DELIVERY_SOURCES[pathname],sha1:String(i+1).repeat(40)}));
function backend(){
  return {id:BASELINE_ID,site_id:SITE_ID,context:'production',branch:'main',functions_region:'cmh',
    available_functions:Array.from({length:49},(_,i)=>({n:'test-'+i,d:'a'.repeat(64),id:'id-'+i,oid:'oid-'+i,a:'account',
      c:'created',r:'nodejs22.x',rg:'us-east-2',m:1024,im:'stream',s:100,bd:{bootstrapVersion:'2.24.0'},
      ro:[],er:[],tr:{action:'keep'},customProviderField:{keep:true}})),
    function_schedules:Array.from({length:5},(_,i)=>({name:'test-'+i,cron:'0 0 * * *'}))};
}
function candidate(){
  const sourceCommit='a'.repeat(40),id='b'.repeat(24);
  const plan={sourceCommit,baselineCreatedAt:'2026-11-18T04:00:00.000Z',title:'Reviewed Stats market'};
  const state={schemaVersion:1,siteId:SITE_ID,id,baselineId:BASELINE_ID,sourceCommit,planSha256:fingerprint(plan),
    requestStartedAt:'2026-11-18T05:00:00.000Z',candidateCreatedAt:'2026-11-18T05:00:01.000Z'};
  const deploy={id,site_id:SITE_ID,created_at:state.candidateCreatedAt,title:plan.title,links:{permalink:'https://'+id+'--tree-token.netlify.app'}};
  return {plan,state,deploy};
}
const browserReport=(origin,sourceCommit,candidateId)=>({baseURL:origin,sourceCommit,candidateId,results:[320,390,768,1363].map(width=>({width,passed:true}))});

test('the CLI refuses to capture without an explicitly supplied current deployment',()=>{
  const env={...process.env};delete env.STATS_MARKET_EXPECTED_DEPLOY;
  const run=spawnSync(process.execPath,[new URL('../scripts/release-stats-market.mjs',import.meta.url).pathname,'capture'],{env,encoding:'utf8'});
  assert.equal(run.status,1);
  assert.match(run.stderr,/STATS_MARKET_EXPECTED_DEPLOY must identify/);
  assert.equal(run.stdout,'');
});

test('three approved overlays replace only current dapp HTML and application code and add scoped Stats CSS',()=>{
  assert.deepEqual(STATS_MARKET_PATHS,DELIVERY_PATHS);
  assert.deepEqual(ORIGINAL_CHANGES,['/dapp/app.js','/dapp/index.html']);
  assert.equal(REPLACED_HASHES['/dapp/index.html'],'5f35a5343f4ffcd5c7a5fd4726ecd2947ab777e0');
  assert.equal(REPLACED_HASHES['/dapp/app.js'],'177fed9f6ebb4aa7f52d9be71cfaa747070c376b');
  const old=baseline(),result=assembleFiles(old,overlays());
  for(const [p,h]of Object.entries(old))if(!ORIGINAL_CHANGES.includes(p))assert.equal(result.files[p],h);
  assert.deepEqual(result.changedOriginals,ORIGINAL_CHANGES);
  assert.deepEqual(result.addedPaths,['/dapp/stats-market.css']);
  assert.equal(Object.keys(result.files).length,Object.keys(old).length+1);
  for(const [p,source]of Object.entries(result.sources))assert.equal(source,DELIVERY_SOURCES[p]);
});

test('unrelated changes, stale original hashes, missing overlays and preexisting new CSS are rejected',()=>{
  const old=baseline(),extra={path:'/index.html',source:'index.html',sha1:'f'.repeat(40)};
  assert.throws(()=>assembleFiles(old,[...overlays(),extra]),/Unapproved/);
  assert.throws(()=>assembleFiles(old,[...overlays(),{...extra,path:'/unrelated.js'}]),/Unapproved/);
  for(const p of ORIGINAL_CHANGES){
    assert.throws(()=>assembleFiles({...old,[p]:'f'.repeat(40)},overlays()),/baseline changed/);
    const absent={...old};delete absent[p];assert.throws(()=>assembleFiles(absent,overlays()),/baseline changed/);
  }
  for(let i=0;i<3;i++)assert.throws(()=>assembleFiles(old,overlays().filter((_,j)=>i!==j)));
  assert.throws(()=>assembleFiles({...old,'/dapp/stats-market.css':'e'.repeat(40)},overlays()));
  assert.throws(()=>assembleFiles(old,[...overlays(),{...overlays()[0],path:'/DAPP/index.html'}]),/Duplicate/);
  assert.throws(()=>assembleFiles(old,overlays().map((item,i)=>i?item:{...item,source:'dapp/index.html'})),/overlay source/);
  assert.throws(()=>publicUploadPath('/dapp/../other.js'));
});

test('all package identities, complete backend fields, runtime settings and five schedules are preserved',()=>{
  const old=backend();compareBackend(structuredClone(old),old);
  for(const field of ['d','id','oid','a','c','r','rg','m','im','s','bd','ro','er','tr','customProviderField']){
    const changed=structuredClone(old);changed.available_functions[0][field]='changed';
    assert.throws(()=>compareBackend(changed,old),field);
  }
  const extra=structuredClone(old);extra.available_functions[0].unexpected='new';
  assert.throws(()=>compareBackend(extra,old));
  const missing=structuredClone(old);missing.available_functions.pop();assert.throws(()=>compareBackend(missing,old));
  for(const field of ['branch','context','functions_region','functions_region_overrides','database_branch_id',
    'blobs_region','framework','edge_functions_present','server','database_migrations']){
    const changed=structuredClone(old);changed[field]='changed';assert.throws(()=>compareBackend(changed,old),field);
  }
  const schedule=structuredClone(old);schedule.function_schedules[0].cron='changed';assert.throws(()=>compareBackend(schedule,old));
  const fewer=structuredClone(old);fewer.function_schedules.pop();assert.throws(()=>compareBackend(fewer,old));
});

test('only materialized overrides equal to existing effective settings are normalized',()=>{
  const old=backend(),same=structuredClone(old);
  same.available_functions[0].mo=1024;same.available_functions[0].rgo='us-east-2';compareBackend(same,old);
  for(const [field,value]of [['mo',2048],['rgo','us-west-1']]){
    const changed=structuredClone(old);changed.available_functions[0][field]=value;assert.throws(()=>compareBackend(changed,old));
  }
  old.available_functions[0].vcpu=1;old.available_functions[0].mo=2048;
  old.available_functions[0].es=['event'];old.available_functions[0].er=[{p:'/private/*',m:['GET']}];
  const config=functionsConfig(old)['test-0'];
  assert.equal(config.vcpu,1);assert(!Object.hasOwn(config,'memory'));
  assert.deepEqual(config.event_subscriptions,['event']);
  assert.deepEqual(config.excluded_routes,[{pattern:'/private/*',methods:['GET']}]);
  assert.deepEqual(config.traffic_rules,{action:'keep'});
  assert(!Object.hasOwn(config,'runtime'));assert(!Object.hasOwn(config,'invocation_mode'));
});

test('only the newly created reviewed candidate identity can be published',()=>{
  const {plan,state,deploy}=candidate();assertNewCandidate(state,plan,deploy);
  for(const mutation of [{id:BASELINE_ID},{baselineId:'c'.repeat(24)},{sourceCommit:'c'.repeat(40)},
    {planSha256:'bad'},{candidateCreatedAt:'2020-01-01T00:00:00.000Z'}]){
    assert.throws(()=>assertNewCandidate({...state,...mutation},plan,deploy));
  }
  for(const mutation of [{id:'c'.repeat(24)},{site_id:'other'},{title:'other'},{created_at:'2020-01-01T00:00:00.000Z'}]){
    assert.throws(()=>assertNewCandidate(state,plan,{...deploy,...mutation}));
  }
});

test('only the ten exact previously audited inactive deployments may bypass the queue guard',()=>{
  assert.equal(AUDITED_STALE_DEPLOYS.size,10);
  for(const [id,[state,created_at,updated_at,context,commit_ref]]of AUDITED_STALE_DEPLOYS){
    const record={id,site_id:SITE_ID,state,created_at,updated_at,context,commit_ref,build_id:null,published_at:null,locked:null};
    assert(isAuditedInactiveDeploy(record),id);
    for(const mutation of [{state:'building'},{state:'unexpected-new-state'},{updated_at:'2026-11-18T00:00:00Z'},
      {build_id:'live-build'},{published_at:'2026-11-18T00:00:00Z'},{locked:true},{site_id:'other'},
      {commit_ref:'changed'},{context:'production'},{id:'f'.repeat(24)}]){
      assert(!isAuditedInactiveDeploy({...record,...mutation}),id+' '+JSON.stringify(mutation));
    }
  }
  assert(!isAuditedInactiveDeploy({id:'d'.repeat(24),site_id:SITE_ID,state:'queued'}));
});

test('browser evidence requires exactly four passing widths and binds the source, origin, candidate and report bytes',()=>{
  const {plan,state,deploy}=candidate(),origin=deploy.links.permalink,report=browserReport(origin,plan.sourceCommit,state.id);
  validateBrowserReport(report,origin,plan.sourceCommit,state.id);
  for(const mutation of [{results:report.results.slice(1)},{results:[...report.results,report.results[0]]},
    {results:report.results.map((r,i)=>({...r,passed:i!==0}))},{baseURL:'https://other.invalid'},{sourceCommit:'c'.repeat(40)},{candidateId:'d'.repeat(24)}]){
    assert.throws(()=>validateBrowserReport({...report,...mutation},origin,plan.sourceCommit,state.id));
  }
  const proof={candidateId:state.id,sourceCommit:plan.sourceCommit,origin,checkedAt:'2026-11-18T05:03:00Z',report,reportSha256:fingerprint(report)};
  assertBrowserVerification(proof,state,plan,deploy);
  for(const mutation of [{candidateId:'c'.repeat(24)},{sourceCommit:'c'.repeat(40)},{origin:'https://tree-token.xyz'},
    {reportSha256:'changed'},{checkedAt:'invalid'},{report:{...report,results:[]}}]){
    assert.throws(()=>assertBrowserVerification({...proof,...mutation},state,plan,deploy));
  }
  assert.throws(()=>assertBrowserVerification(null,state,plan,deploy));
});

test('served HTML retains the stored snippet and accepts only one exact additional body-end insertion',()=>{
  assert.equal(sha(ARBORETUM_SNIPPET,'sha256'),'bf05453dc91bcf9c53db98e08829c8321193495b0839021e68d458d56e5be98d');
  const source='<html>\n<body>\nStats\n'+ARBORETUM_SNIPPET+'</body>\n</html>\n',expected=Buffer.from(source);
  assertServedContent('index.html',expected,expected);
  assertServedContent('index.html',Buffer.from(source.replace('</body>',ARBORETUM_SNIPPET+'</body>')),expected);
  for(const html of [source.replace('Stats','Changed'),source.replace('</body>',ARBORETUM_SNIPPET+ARBORETUM_SNIPPET+'</body>'),
    source.replace('</body>',ARBORETUM_SNIPPET.replace('treegrow.xyz','other.invalid')+'</body>'),
    source.replace('</body>','<script>unexpected()</script>'+ARBORETUM_SNIPPET+'</body>'),
    source.replace('Stats',ARBORETUM_SNIPPET+'Stats'),source.replace(ARBORETUM_SNIPPET,'')]){
    assert.throws(()=>assertServedContent('index.html',Buffer.from(html),expected));
  }
  assert.throws(()=>assertServedContent('app.js',Buffer.from('changed'),Buffer.from('original')));
  assert.throws(()=>assertServedContent('stats-market.css',Buffer.from('changed'),Buffer.from('original')));
});

async function deliveryFixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'stats-release-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const bodies={
    '/dapp/index.html':'<!doctype html>\n<html><body>Stats<script src="app.js?v=preserved"></script><link rel="stylesheet" href="/dapp/stats-market.css">\n'+ARBORETUM_SNIPPET+'</body>\n</html>\n',
    '/dapp/app.js':'const chart = true;\n',
    '/dapp/stats-market.css':'#stats { width: 100%; }\n',
  };
  for(const [p,body]of Object.entries(bodies)){
    const filename=path.join(root,DELIVERY_SOURCES[p]);
    await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,body);
  }
  const plan={sources:{...DELIVERY_SOURCES},files:Object.fromEntries(DELIVERY_PATHS.map(p=>[p,sha(bodies[p])]))};
  const responses={},calls=[];
  const fetchImpl=async input=>{
    const p=new URL(input).pathname;calls.push(p);const entry=responses[p]||{};
    const source=p==='/dapp/'?'/dapp/index.html':p;
    let body=entry.body??bodies[source];
    if(source.endsWith('.html')&&!entry.body)body=body.replace('</body>',ARBORETUM_SNIPPET+'</body>');
    return new Response(body,{status:entry.status??200,headers:{'Content-Type':entry.type??(source.endsWith('.js')?'application/javascript':source.endsWith('.css')?'text/css':'text/html')}});
  };
  return {root,plan,bodies,responses,calls,fetchImpl};
}

test('delivery checks all three byte identities, JavaScript/CSS/HTML MIME types and the canonical dapp route',async t=>{
  const f=await deliveryFixture(t);
  await verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl);
  assert.deepEqual(f.calls,[...DELIVERY_PATHS,'/dapp/']);
  f.responses['/dapp/']={status:404};
  await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/canonical Stats route/);
  delete f.responses['/dapp/'];
  for(const p of ['/dapp/app.js','/dapp/stats-market.css']){
    f.responses[p]={type:'text/html'};
    await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/content type/);
    f.responses[p]={body:'changed'};
    await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/bytes differ/);
    delete f.responses[p];
  }
});

test('delivery refuses unrelated origins/mappings, changed source bytes, missing dependencies and lost stored snippets',async t=>{
  const f=await deliveryFixture(t);
  await assert.rejects(verifyDelivery('https://other.invalid',f.plan,f.root,assertServedContent,f.fetchImpl),/origin/);
  await assert.rejects(verifyDelivery('https://tree-token.xyz',{...f.plan,sources:{...f.plan.sources,'/other.js':'other.js'}},f.root,assertServedContent,f.fetchImpl),/path inventory/);
  await assert.rejects(verifyDelivery('https://tree-token.xyz',{...f.plan,sources:{...f.plan.sources,'/dapp/index.html':'dapp/index.html'}},f.root,assertServedContent,f.fetchImpl),/public-source mapping/);
  const script=path.join(f.root,DELIVERY_SOURCES['/dapp/app.js']);
  await fs.writeFile(script,'changed local source');
  await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/Local upload bytes/);
  await fs.writeFile(script,f.bodies['/dapp/app.js']);
  const missing={...f.plan,files:{...f.plan.files}};delete missing.files['/dapp/stats-market.css'];
  await assert.rejects(verifyDelivery('https://tree-token.xyz',missing,f.root,assertServedContent,f.fetchImpl),/absent from production inventory/);
  const htmlPath='/dapp/index.html';
  const withoutSnippet=f.bodies[htmlPath].replace(ARBORETUM_SNIPPET,'');
  await fs.writeFile(path.join(f.root,DELIVERY_SOURCES[htmlPath]),withoutSnippet);
  f.responses[htmlPath]={body:withoutSnippet};
  await assert.rejects(verifyDelivery('https://tree-token.xyz',{...f.plan,files:{...f.plan.files,[htmlPath]:sha(withoutSnippet)}},f.root,assertServedContent,f.fetchImpl),/stored baseline site snippet/);
});
