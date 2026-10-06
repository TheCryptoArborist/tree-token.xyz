import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';
const source=fs.readFileSync(new URL('../dapp/v3-workspace.js',import.meta.url),'utf8');
test('rejected combined analytics do not hide TVL or VICTORY rewards',()=>{
 const nodes=new Map(); const state={suiDexVolumeUsd:null};
 const ctx=vm.createContext({state,Number,Date,document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)}},rememberPositionPrices:()=>{},updateCombinedV3Tvl:()=>{},updateCombinedV3Volume:()=>{},updateRangeFields:()=>{},renderAprBreakdown:()=>{},formatNumber:String});
 for(const name of ['verifiedVolume','verifiedPositive','annualizedFeeApr','renderSuiDexMetrics','renderPool']){const start=source.indexOf('function '+name+'(');vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),ctx)}
 const payload={pool:{verified:true,tvlSource:'onchain-reserves-plus-coingecko',tvlUsdEstimate:11482.62,feePercent:.25,liquidityRaw:'1'},analytics:{status:'unavailable'},incentives:{status:'estimated',rewardAprPercent:2.9688487,rewards:[{symbol:'VICTORY',aprPercent:2.9688487}]}};
 ctx.renderPool(payload);
 assert.equal(state.suiDexTvlUsd,11482.62);
 assert.equal(nodes.get('v3PoolApr').textContent,'Unavailable / 2.97%');
 assert.equal(nodes.get('v3RewardChip').textContent,'Rewards: VICTORY');
 state.suiDexVolumeUsd=0;ctx.renderSuiDexMetrics();assert.equal(nodes.get('v3PoolApr').textContent,'0.00% / 2.97%');
 state.overview.incentives=null;ctx.renderSuiDexMetrics();assert.equal(nodes.get('v3PoolApr').textContent,'0.00% / Unavailable');
 assert.match(nodes.get('v3AnalyticsNotice').textContent,/different denominators and are not summed/);
});
