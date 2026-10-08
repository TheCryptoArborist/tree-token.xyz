import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {Pool} from 'aftermath-ts-sdk';
import {aftermathSimulationPool} from '../netlify/lib/aftermath-route-simulation.ts';
import {simulateRoute} from '../netlify/lib/tree-route-simulation.ts';
import {simulateBridgedRoute} from '../netlify/lib/tree-bridge-quotes.ts';
const report=JSON.parse(readFileSync(new URL('../reports/tree-liquidity/simulation.json',import.meta.url),'utf8'));
const bigintKeys=new Set(['weight','balance','tradeFeeIn','tradeFeeOut','depositFee','withdrawFee','normalizedBalance','decimalsScalar','feeBps','lpCoinSupply','illiquidLpCoinSupply','flatness']);
for(const row of report.cases) test(`replay ${row.sui} SUI evidence with locked official Aftermath math`,async()=>{
  const snapshot=JSON.parse(readFileSync(new URL(`../reports/tree-liquidity/snapshot-${row.sui}-sui.json`,import.meta.url),'utf8'),(key,value)=>bigintKeys.has(key)?BigInt(value):value);
  const pools=new Map<string,any>(snapshot.pools.map((p:any)=>[p.objectId,aftermathSimulationPool(new Pool(p),snapshot.verifiedAt)]));
  const options={now:Date.parse(snapshot.verifiedAt),maxAgeMs:30000};
  for(const recorded of row.bridgeResults.filter((r:any)=>r.status==='quoted')) {
    const [bridge,...tail]=recorded.hops;
    const route=tail.map((h:any)=>({pool:pools.get(h.poolId),coinIn:h.coinIn,coinOut:h.coinOut}));
    const replay=await simulateBridgedRoute(bridge,route,options);
    assert.equal(replay.status,'quoted');
    assert.equal(replay.amountOut,recorded.amountOut);
  }
  for(const diagnostic of row.priorityDiagnostics) {
    const p=pools.get(diagnostic.poolIds[0]);
    if(diagnostic.poolIds.length!==1) continue;
    const route=[{pool:p,coinIn:p.coinTypes.find((c:string)=>c.endsWith('::sui::SUI')),coinOut:p.coinTypes.find((c:string)=>c.endsWith('::tree::TREE'))}];
    const replay=await simulateRoute(route,BigInt(row.amountIn),options);
    assert.equal(replay.status,'rejected');
    assert.match(replay.reason ?? '',/maxTradePercentageOfPoolBalance/);
  }
});
