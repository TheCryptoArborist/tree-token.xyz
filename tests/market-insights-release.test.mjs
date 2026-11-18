import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fingerprint} from '../scripts/release-preserved-production.mjs';
import {DELIVERY_PATHS,ARBORETUM_SNIPPET,assertServedContent,assertResourcesLink,verifyDelivery} from '../scripts/market-insights-delivery.mjs';

process.env.MARKET_INSIGHTS_EXPECTED_DEPLOY ||= '6afd22ad90e2e583fed38ea7';
const {REPLACED_HASHES,ORIGINAL_CHANGES,MARKET_INSIGHTS_PATHS,assembleFiles,publicUploadPath,
  compareBackend,functionsConfig,assertNewCandidate,validateBrowserReport,assertBrowserVerification,
  SITE_ID,BASELINE_ID,AUDITED_STALE_DEPLOYS,isAuditedInactiveDeploy}=await import('../scripts/release-market-insights.mjs');
const sha=(bytes,algorithm='sha1')=>crypto.createHash(algorithm).update(bytes).digest('hex');
const baseline=()=>({'/index.html':'a'.repeat(40),'/dapp/index.html':'b'.repeat(40),'/_headers':'c'.repeat(40),...REPLACED_HASHES});
const overlays=()=>MARKET_INSIGHTS_PATHS.map((pathname,i)=>({path:pathname,source:pathname.slice(1),sha1:String(i+1).repeat(40)}));
function backend(){
  return {id:BASELINE_ID,site_id:SITE_ID,context:'production',branch:'main',functions_region:'cmh',
    available_functions:Array.from({length:49},(_,i)=>({n:'test-'+i,d:'a'.repeat(64),id:'id-'+i,oid:'oid-'+i,a:'account',
      c:'created',r:'nodejs22.x',rg:'us-east-2',m:1024,im:'stream',s:100,bd:{bootstrapVersion:'2.24.0'},
      ro:[],er:[],tr:{action:'keep'},customProviderField:{keep:true}})),
    function_schedules:Array.from({length:5},(_,i)=>({name:'test-'+i,cron:'0 0 * * *'}))};
}
function candidate(){
  const sourceCommit='a'.repeat(40),id='b'.repeat(24);
  const plan={sourceCommit,baselineCreatedAt:'2026-11-18T04:00:00.000Z',title:'Reviewed Market Insights'};
  const state={schemaVersion:1,siteId:SITE_ID,id,baselineId:BASELINE_ID,sourceCommit,planSha256:fingerprint(plan),
    requestStartedAt:'2026-11-18T05:00:00.000Z',candidateCreatedAt:'2026-11-18T05:00:01.000Z'};
  const deploy={id,site_id:SITE_ID,created_at:state.candidateCreatedAt,title:plan.title,links:{permalink:'https://'+id+'--tree-token.netlify.app'}};
  return {plan,state,deploy};
}
const browserReport=(origin,sourceCommit)=>({baseURL:origin,sourceCommit,results:[320,390,768,1363].map(width=>({width,passed:true}))});

test('the CLI refuses to capture without an explicitly supplied current deployment',()=>{
  const env={...process.env};delete env.MARKET_INSIGHTS_EXPECTED_DEPLOY;
  const run=spawnSync(process.execPath,[new URL('../scripts/release-market-insights.mjs',import.meta.url).pathname,'capture'],{env,encoding:'utf8'});
  assert.equal(run.status,1);
  assert.match(run.stderr,/MARKET_INSIGHTS_EXPECTED_DEPLOY must identify/);
  assert.equal(run.stdout,'');
});

test('four approved overlays change only the current homepage script and add the three Market Insights files',()=>{
  assert.deepEqual(MARKET_INSIGHTS_PATHS,DELIVERY_PATHS);
  assert.deepEqual(ORIGINAL_CHANGES,['/scripts/homepage-refresh.js']);
  assert.equal(REPLACED_HASHES['/scripts/homepage-refresh.js'],'73f4ffb8773ad531dd42a7bcf2bde60e4cc9c761');
  const old=baseline(),result=assembleFiles(old,overlays());
  for(const [p,h]of Object.entries(old))if(!ORIGINAL_CHANGES.includes(p))assert.equal(result.files[p],h);
  assert.deepEqual(result.changedOriginals,ORIGINAL_CHANGES);
  assert.deepEqual(result.addedPaths,['/market-insights/index.html','/market-insights/insights.js','/market-insights/sentiment.js']);
  assert.equal(Object.keys(result.files).length,Object.keys(old).length+3);
});

test('unrelated replacement/upload, stale homepage hash, missing overlay and existing new route are rejected',()=>{
  const old=baseline(),extra={path:'/dapp/index.html',source:'dapp/index.html',sha1:'f'.repeat(40)};
  assert.throws(()=>assembleFiles(old,[...overlays(),extra]),/Unapproved/);
  assert.throws(()=>assembleFiles(old,[...overlays(),{...extra,path:'/unrelated.js'}]),/Unapproved/);
  assert.throws(()=>assembleFiles({...old,'/scripts/homepage-refresh.js':'f'.repeat(40)},overlays()),/baseline changed/);
  const absent={...old};delete absent['/scripts/homepage-refresh.js'];
  assert.throws(()=>assembleFiles(absent,overlays()),/baseline changed/);
  for(let i=0;i<4;i++)assert.throws(()=>assembleFiles(old,overlays().filter((_,j)=>i!==j)));
  for(const p of MARKET_INSIGHTS_PATHS.filter(p=>!ORIGINAL_CHANGES.includes(p))){
    assert.throws(()=>assembleFiles({...old,[p]:'e'.repeat(40)},overlays()));
  }
  assert.throws(()=>assembleFiles(old,[...overlays(),{...overlays()[0],path:'/MARKET-INSIGHTS/index.html'}]),/Duplicate/);
  assert.throws(()=>publicUploadPath('/market-insights/../other.js'));
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
  const {plan,state,deploy}=candidate(),origin=deploy.links.permalink,report=browserReport(origin,plan.sourceCommit);
  validateBrowserReport(report,origin,plan.sourceCommit);
  for(const mutation of [{results:report.results.slice(1)},{results:[...report.results,report.results[0]]},
    {results:report.results.map((r,i)=>({...r,passed:i!==0}))},{baseURL:'https://other.invalid'},{sourceCommit:'c'.repeat(40)}]){
    assert.throws(()=>validateBrowserReport({...report,...mutation},origin,plan.sourceCommit));
  }
  const proof={candidateId:state.id,sourceCommit:plan.sourceCommit,origin,checkedAt:'2026-11-18T05:03:00Z',report,reportSha256:fingerprint(report)};
  assertBrowserVerification(proof,state,plan,deploy);
  for(const mutation of [{candidateId:'c'.repeat(24)},{sourceCommit:'c'.repeat(40)},{origin:'https://tree-token.xyz'},
    {reportSha256:'changed'},{checkedAt:'invalid'},{report:{...report,results:[]}}]){
    assert.throws(()=>assertBrowserVerification({...proof,...mutation},state,plan,deploy));
  }
  assert.throws(()=>assertBrowserVerification(null,state,plan,deploy));
});

test('served HTML retains source whitespace and accepts only the exact one body-end snippet',()=>{
  assert.equal(sha(ARBORETUM_SNIPPET,'sha256'),'bf05453dc91bcf9c53db98e08829c8321193495b0839021e68d458d56e5be98d');
  const source='<html>\n<body>\nMarket Insights\n</body>\n</html>\n',expected=Buffer.from(source);
  assertServedContent('index.html',expected,expected);
  assertServedContent('index.html',Buffer.from(source.replace('</body>',ARBORETUM_SNIPPET+'</body>')),expected);
  for(const html of [source.replace('Market Insights','Changed'),source.replace('</body>',ARBORETUM_SNIPPET+ARBORETUM_SNIPPET+'</body>'),
    source.replace('</body>',ARBORETUM_SNIPPET.replace('treegrow.xyz','other.invalid')+'</body>'),
    source.replace('</body>','<script>unexpected()</script>'+ARBORETUM_SNIPPET+'</body>'),
    source.replace('Market Insights',ARBORETUM_SNIPPET+'Market Insights')]){
    assert.throws(()=>assertServedContent('index.html',Buffer.from(html),expected));
  }
  assert.throws(()=>assertServedContent('insights.js',Buffer.from('changed'),Buffer.from('original')));
});

test('the homepage link must be inside the Resources menu and use the public route',()=>{
  const valid='<details class="home-resources"><summary>Resources</summary><div><a href="/market-insights/">Market Insights</a></div></details>';
  assertResourcesLink(valid);
  for(const changed of [valid.replace('/market-insights/','/market/bitcoin-rainbow/'),valid.replace('Resources','Other'),
    valid.replace('<a href="/market-insights/">Market Insights</a>','')+'<a href="/market-insights/">Market Insights</a>',valid+valid]){
    assert.throws(()=>assertResourcesLink(changed));
  }
});

async function deliveryFixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'market-release-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const bodies={
    '/market-insights/index.html':'<!doctype html>\n<html><body>Market Insights<script src="/market-insights/insights.js"></script><script src="/market-insights/sentiment.js"></script>\n</body>\n</html>\n',
    '/market-insights/insights.js':'const chart = true;\n',
    '/market-insights/sentiment.js':'const sentiment = true;\n',
    '/scripts/homepage-refresh.js':'const menu = \'<details class="home-resources"><summary>Resources</summary><div><a href="/market-insights/">Market Insights</a></div></details>\';\n'
  };
  for(const [p,body]of Object.entries(bodies)){await fs.mkdir(path.dirname(path.join(root,p)),{recursive:true});await fs.writeFile(path.join(root,p),body);}
  const plan={sources:Object.fromEntries(DELIVERY_PATHS.map(p=>[p,p.slice(1)])),files:Object.fromEntries(DELIVERY_PATHS.map(p=>[p,sha(bodies[p])]))};
  const responses={},calls=[];
  const fetchImpl=async input=>{
    const p=new URL(input).pathname;calls.push(p);const entry=responses[p]||{};
    const source=p==='/market-insights/'?'/market-insights/index.html':p;
    let body=entry.body??bodies[source];
    if(source.endsWith('.html')&&!entry.body)body=body.replace('</body>',ARBORETUM_SNIPPET+'</body>');
    return new Response(body,{status:entry.status??200,headers:{'Content-Type':entry.type??(source.endsWith('.js')?'application/javascript':'text/html')}});
  };
  return {root,plan,bodies,responses,calls,fetchImpl};
}

test('delivery checks all four byte identities, correct MIME types and canonical route status',async t=>{
  const f=await deliveryFixture(t);
  await verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl);
  assert.deepEqual(f.calls,[...DELIVERY_PATHS,'/market-insights/']);
  f.responses['/market-insights/']={status:404};
  await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/canonical Market Insights route/);
  delete f.responses['/market-insights/'];
  f.responses['/market-insights/insights.js']={type:'text/html'};
  await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/content type/);
  f.responses['/market-insights/insights.js']={body:'changed'};
  await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/bytes differ/);
});

test('delivery refuses unrelated origins/paths, changed local bytes and missing script dependencies',async t=>{
  const f=await deliveryFixture(t);
  await assert.rejects(verifyDelivery('https://other.invalid',f.plan,f.root,assertServedContent,f.fetchImpl),/origin/);
  await assert.rejects(verifyDelivery('https://tree-token.xyz',{...f.plan,sources:{...f.plan.sources,'/other.js':'other.js'}},f.root,assertServedContent,f.fetchImpl),/path inventory/);
  await fs.writeFile(path.join(f.root,'market-insights/insights.js'),'changed local source');
  await assert.rejects(verifyDelivery('https://tree-token.xyz',f.plan,f.root,assertServedContent,f.fetchImpl),/Local upload bytes/);
  await fs.writeFile(path.join(f.root,'market-insights/insights.js'),f.bodies['/market-insights/insights.js']);
  const missing={...f.plan,files:{...f.plan.files}};delete missing.files['/market-insights/sentiment.js'];
  await assert.rejects(verifyDelivery('https://tree-token.xyz',missing,f.root,assertServedContent,f.fetchImpl),/absent from production inventory/);
});

