import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(new URL('../dapp/v3-workspace.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map();const state={suiDexVolumeUsd:null,cetusVolumeUsd:null,turbosVolumeUsd:null};
 const ctx=vm.createContext({state,document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}},Number,Date,
  formatUsd:n=>Number.isFinite(n)?'$'+n.toFixed(2):'Not verified',formatNumber:String,rememberPositionPrices:()=>{},renderAprBreakdown:()=>{},updateRangeFields:()=>{},updateCombinedV3Tvl:()=>{},formatPoolApr:String,formatPoolPrice:String,V3_ENDPOINT:'/api/tree-v3-overview',V3_POOL_ID:'suidex',CETUS_POOL_ID:'cetus',TURBOS_TREE_POOL_ID:'turbos'});
 for(const name of ['verifiedVolume','verifiedPositive','annualizedFeeApr','updateCombinedV3Volume','renderPool','loadPool','loadExternalPoolMetrics']){
  const start=source.indexOf((name.startsWith('load')?'async ':'')+'function '+name+'(');assert(start>=0);vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),ctx);
 }
 const pool=id=>({poolId:id,tvlUsd:1000,active:true,feePercent:0.3,priceSuiPerTree:0.01});
 const liquidity={status:'ok',liquidity:{cetusPool:pool('cetus'),turbosPools:[pool('turbos')]}};
 const external=async(cetus=20,turbos=30)=>{ctx.fetch=async url=>({ok:true,json:async()=>url.includes('liquidity')?liquidity:{status:'ok',pools:{cetus:{volume24hUsd:cetus},turbos:{volume24hUsd:turbos}}}});await ctx.loadExternalPoolMetrics();};
 const suidex=async(value=100,status='verified')=>{ctx.fetch=async()=>({ok:true,json:async()=>({status:'ok',pool:{...pool('suidex'),liquidityRaw:100},analytics:{status,volume24hUsd:value}})});await ctx.loadPool();};
 return {ctx,state,external,suidex,headline:()=>nodes.get('v3PoolVolume')?.textContent};
}
test('verified volumes sum in either response order, including zero',async()=>{for(const first of ['suidex','external']){const t=setup();await t[first]();assert.equal(t.headline(),'Not verified');await t[first==='suidex'?'external':'suidex']();assert.equal(t.headline(),'$150.00',JSON.stringify(t.ctx.document.getElementById('v3PoolStatus')));await t.external(0,0);await t.suidex(0);assert.equal(t.headline(),'$0.00');}});
for(const venue of ['suidex','cetus','turbos'])test(venue+' rejects missing and invalid volume',async()=>{for(const value of [null,undefined,'',' ',false,{},-1,Infinity,NaN,'invalid']){const t=setup();await t.external();await t.suidex();if(venue==='suidex')await t.suidex(value);else await t.external(venue==='cetus'?value:20,venue==='turbos'?value:30);if(value===undefined){assert.equal(t.ctx.verifiedVolume(value),null);continue;}assert.equal(t.headline(),'Not verified',venue+' '+String(value));}});
for(const loader of ['loadPool','loadExternalPoolMetrics'])test(loader+' clears stale totals immediately and on network failure',async()=>{const t=setup();await t.external();await t.suidex();let reject;t.ctx.fetch=()=>new Promise((_,r)=>{reject=r;});const pending=t.ctx[loader]();assert.equal(t.headline(),'Not verified');reject(Error('Unavailable'));await pending;assert.equal(t.headline(),'Not verified');});
test('unverified SuiDex analytics do not contribute',async()=>{const t=setup();await t.external();await t.suidex(100,'unavailable');assert.equal(t.headline(),'Not verified');});


