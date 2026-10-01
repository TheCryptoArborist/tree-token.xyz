import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHostedPreview, AUTH_ORIGIN } from './gateway.mjs';
import { validateProbe, createProbe, GENESIS, TREE_TYPE } from './probe.mjs';
const now = 1800000000000, token = 'a'.repeat(64), account = randomUUID(), run = randomUUID();
const identity = { authenticated: true, environment: 'preview', accountId: account, wallet: { family: 'sui', address: '0x' + 'b'.repeat(64) }, expiresAt: now + 10000 };
function setup(overrides = {}) {
 const state = { auth: 0, db: 0, probes: 0, params: null };
 const handler = createHostedPreview({ now: () => now,
  fetcher: async (url, options) => { state.auth++; assert.equal(url, AUTH_ORIGIN + '/api/tree-account'); assert.equal(options.redirect,'error'); assert.equal(JSON.parse(options.body).token,token); return Response.json({ status:'ok',identity }); },
  lookup: async params => { state.db++;state.params=params;return { allowed:true,result:params.p_action==='list_purchases'?{rows:[],hasMore:false}:{record:null} }; },
  probe: async()=>{state.probes++;return {ready:true};}, ...overrides });
 return { handler,state };
}
const req = (command, headers = {}) => new Request('https://edge.example/continue', { method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(command) });
for(const action of ['status','list_purchases','recover_purchase']) test('verified '+action+' uses issuer identity and remains disabled', async()=>{
 const {handler,state}=setup();const r=await handler(req({action,...(action==='recover_purchase'?{runId:run}:{})}));const p=await r.json();assert.equal(r.status,200);assert.equal(p.enabled,false);assert.equal(p.restoreAuthorized,false);assert.equal(p.accountId,account);assert.equal(state.params.p_account,account);assert.equal(state.params.p_payer,identity.wallet.address);assert.equal(state.auth,1);assert.equal(state.db,1);assert.equal(p.requiresPayment,false);assert.equal(p.deliveryProtocol,'tree-paid-delivery.v1');
});
for(const action of ['order','reconcile','cancel','deliver','delivery_status','prepare_delivery','activate_delivery']) test('hosted route cannot '+action,async()=>{
 const {handler,state}=setup();const r=await handler(req({action,runId:run}));assert.equal(r.status,503);assert.equal((await r.json()).error,'checkout-not-enabled');assert.equal(state.db,0);assert.equal(state.probes,0);
});
for(const field of ['accountId','payer','token','actor','evidence','verified','restoreAuthorized','serviceUrl','paymentsEnabled']) test('reject identity/config injection '+field,async()=>{
 const {handler,state}=setup();const r=await handler(req({action:'status',[field]:true}));assert.equal(r.status,400);assert.equal(state.auth,0);assert.equal(state.db,0);
});
test('expired identity cannot reach storage',async()=>{const {handler,state}=setup({fetcher:async()=>Response.json({status:'ok',identity:{...identity,expiresAt:now}})});assert.equal((await handler(req({action:'status'}))).status,401);assert.equal(state.db,0);});
test('EVM identity cannot reach storage',async()=>{const {handler,state}=setup({fetcher:async()=>Response.json({status:'ok',identity:{...identity,wallet:{family:'evm',address:identity.wallet.address}}})});assert.equal((await handler(req({action:'status'}))).status,401);assert.equal(state.db,0);});
test('sign-in outage is not an empty purchase list',async()=>{const {handler,state}=setup({fetcher:async()=>new Response('',{status:503})});const r=await handler(req({action:'list_purchases'}));assert.equal(r.status,503);assert.equal(state.db,0);assert.equal((await r.json()).purchases,undefined);});
test('direct browser calls rejected',async()=>{const {handler,state}=setup();assert.equal((await handler(req({action:'status'},{Origin:'https://game.example'}))).status,403);assert.equal(state.auth,0);});
test('malformed command and oversized stream rejected',async()=>{const {handler,state}=setup();for(const command of [[],null,{action:'status',unexpected:true},{action:'list_purchases',afterOrderId:''},{action:'recover_purchase',runId:'x'},{action:'status',junk:'x'.repeat(5000)}]){assert.ok([400,413].includes((await handler(req(command))).status));}assert.equal(state.auth,0);});
test('quota rejection performs no chain read',async()=>{const {handler,state}=setup({lookup:async()=>({allowed:false})});assert.equal((await handler(req({action:'status'}))).status,429);assert.equal(state.probes,0);});
test('DB outage does not fabricate purchase absence',async()=>{const {handler}=setup({lookup:async()=>{throw Error('credential-secret');}});const r=await handler(req({action:'list_purchases'}));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/credential-secret/);});
test('existing stored order is not reverified or activated in readonly mode',async()=>{const {handler}=setup({lookup:async()=>({allowed:true,result:{record:{state:'verified'}}})});const r=await handler(req({action:'recover_purchase',runId:run}));const p=await r.json();assert.equal(r.status,503);assert.equal(p.purchaseFound,true);assert.equal(p.restoreAuthorized,false);assert.equal(p.authorization,null);});
test('chain outage leaves status disabled without stale success',async()=>{const {handler}=setup({probe:async()=>{throw Error('unavailable');}});const r=await handler(req({action:'status'}));const p=await r.json();assert.equal(r.status,200);assert.equal(p.chain.ready,false);assert.equal(p.enabled,false);});
const info={chain:'mainnet',chainId:GENESIS,timestamp:{seconds:BigInt(now/1000),nanos:0},checkpointHeight:5000n};
const coin={coinType:TREE_TYPE,metadata:{decimals:6,name:'Thickquidity',symbol:'Tree'}};
test('probe verifies exact genesis, fresh timestamp and fixed TREE precision',()=>{const r=validateProbe(info,coin,now);assert.equal(r.ready,true);assert.equal(r.paymentAmountRaw,'20000000000');assert.equal(r.receiptVerificationConfigured,false);for(const [i,c] of [[{...info,chain:'testnet'},coin],[{...info,chainId:'wrong'},coin],[{...info,timestamp:{seconds:1n,nanos:0}},coin],[info,{...coin,coinType:'other'}],[info,{...coin,metadata:{...coin.metadata,decimals:9}}]])assert.throws(()=>validateProbe(i,c,now));});
test('probe makes only fixed metadata/network calls, coalesces and caches',async()=>{let calls=0;const client={ledgerService:{async getServiceInfo(){calls++;return{response:info};}},stateService:{async getCoinInfo(r){calls++;assert.equal(r.coinType,TREE_TYPE);return{response:coin};}}};const probe=createProbe(client,()=>now);await Promise.all([probe(),probe()]);await probe();assert.equal(calls,2);});
