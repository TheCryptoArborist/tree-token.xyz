// Read-only public status and invalid-credential probes; never grants progress.
// Usage: node [--use-env-proxy] tests/treeforce-participation-hosted.mjs HTTPS_ORIGIN [REPORT_PATH]
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const [base,output]=process.argv.slice(2);
assert(/^https:\/\/(?:[a-f0-9]{24}--tree-token\.netlify\.app|tree-token\.xyz)$/.test(base));
const runId='grove-'+randomBytes(16).toString('hex');
const fakeToken=randomBytes(32).toString('hex');
const outcomes=[];
async function check(name,action,status,{method='POST',origin='https://tree-token.xyz',authorization,body={runId},headers={}}={}){
 const started=Date.now();
 const h={...headers};if(origin)h.Origin=origin;if(authorization)h.Authorization='Bearer '+authorization;
 if(method==='POST')h['Content-Type']='application/json';
 const response=await fetch(base+'/api/arcade-growth?action='+action,{method,headers:h,...(method==='POST'?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});
 const data=await response.json();
 const row={name,status:response.status,error:data.error||null,milliseconds:Date.now()-started};
 outcomes.push(row);console.log(JSON.stringify(row));
 assert.equal(response.status,status,name+': '+(data.error||'unexpected status'));
 assert(!JSON.stringify(data).includes(fakeToken),'Credential leaked');
 assert(!data.participation&&!data.progress,'Negative/read-only check must not expose credit');
 return data;
}
const status=await check('public configuration','status',200,{method:'GET',origin:null});
assert.equal(status.authenticated,false);
assert.equal(status.configuration.enabledGames.length,3);
assert.equal(status.configuration.eligibleGames.length,4);
assert(status.configuration.eligibleGames.some(game=>game.id==='treeforce89'&&game.creditRule==='start-run'));
await check('wrong method','treeforce-play',405,{method:'GET'});
await check('missing origin','treeforce-play',403,{origin:null});
await check('foreign origin','treeforce-play',403,{origin:'https://example.com'});
await check('cross-site metadata','treeforce-play',403,{headers:{'Sec-Fetch-Site':'cross-site'}});
await check('missing game credential','treeforce-play',401);
await check('client identity rejected','treeforce-play',400,{body:{runId,wallet:'0x'+'a'.repeat(64)}});
await check('unknown game credential reaches isolated database','treeforce-play',401,{authorization:fakeToken});
const report={checkedAt:new Date().toISOString(),base,passed:true,productionProgressWrites:0,transactions:0,outcomes};
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:outcomes.length,productionProgressWrites:0,transactions:0}));
