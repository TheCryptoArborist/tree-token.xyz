import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { coinKey, poolEligibility, terminalReserveEligibility, enumerateRoutes, simulateRoute, type SimulationPool } from '../netlify/lib/tree-route-simulation.ts';
import { aftermathStateError } from '../netlify/lib/aftermath-route-simulation.ts';
import { SUI_TYPE, TREE_TYPE } from '../netlify/lib/tree-swap-route.ts';

const now = Date.parse('2026-09-19T01:46:36.000Z');
const policy = {now,maxAgeMs:30_000};
const S = SUI_TYPE, T = TREE_TYPE, B = '0xb::boom::BOOM', H = '0xc::shock::SHOCK';
function pool(poolId: string, coinTypes: string[], quote = (_a:string,_b:string,n:bigint)=>n * 2n): SimulationPool {
  return {venue:'aftermath',poolId,coinTypes,reserves:Object.fromEntries(coinTypes.map(c=>[c,'10000000000000000000'])),verifiedAt:new Date(now).toISOString(),quote};
}

test('eligibility rejects missing, stale, future, zero and malformed state', () => {
  const p = pool('p',[S,T]);
  assert.equal(poolEligibility(p,now,30_000).eligible,true);
  for (const verifiedAt of ['',new Date(now-30_001).toISOString(),new Date(now+1).toISOString()]) assert.equal(poolEligibility({...p,verifiedAt},now,30_000).eligible,false);
  for (const value of ['0','-1','1.5','not-a-number']) assert.equal(poolEligibility({...p,reserves:{...p.reserves,[T]:value}},now,30_000).eligible,false);
  assert.equal(poolEligibility({...p,stateError:'bad-fees'},now,30_000).reason,'bad-fees');
});

test('canonical address equality preserves case-sensitive Move identifiers', () => {
  assert.equal(coinKey('0x0002::sui::SUI'),coinKey(S));
  assert.notEqual(coinKey('0x2::sui::sui'),coinKey(S));
  assert.throws(()=>coinKey('SUI'));
});

test('enumeration retains bridge pools, parallel venues and caps at three hops without cycles or repeated multiasset pools', () => {
  const pools = [pool('st',[S,T]),pool('sb',[S,B]),pool('bt',[B,T]),pool('sh',[S,H]),pool('ht',[H,T]),pool('bh',[B,H]),pool('multi',[S,B,T])];
  const result = enumerateRoutes(pools,S,T,{preferredIntermediates:[B,H]});
  assert.ok(result.routes.some(r=>r.map(h=>h.pool.poolId).join(',')==='sb,bt'));
  assert.ok(result.routes.some(r=>r.map(h=>h.pool.poolId).join(',')==='sh,ht'));
  assert.ok(result.routes.some(r=>r.length===3));
  for (const route of result.routes) {
    assert.ok(route.length<=3);
    assert.equal(new Set(route.map(h=>h.pool.poolId)).size,route.length);
    assert.equal(new Set([coinKey(S),...route.map(h=>coinKey(h.coinOut))]).size,route.length+1);
  }
  assert.equal(enumerateRoutes(pools,S,T,{maxRoutes:1}).truncated,true);
  assert.equal(enumerateRoutes([pools[0]],S,T,{maxRoutes:1}).truncated,false);
  assert.equal(enumerateRoutes([pools[0],pools[0]],S,T).routes.length,1);
  assert.throws(()=>enumerateRoutes(pools,S,T,{maxHops:4}));
});

test('simulation propagates exact bigint output, isolates quote failure, and rejects reserve exhaustion', async () => {
  const p = pool('sb',[S,B]), q=pool('bt',[B,T]);
  const route = [{pool:p,coinIn:S,coinOut:B},{pool:q,coinIn:B,coinOut:T}];
  const result=await simulateRoute(route,9007199254740993n,policy);
  assert.equal(result.amountOut,'36028797018963972');
  assert.equal(result.hops[1].amountIn,'18014398509481986');
  q.quote=()=>{throw new Error('reserve-ratio-bound');};
  assert.equal((await simulateRoute(route,10n,policy)).reason,'reserve-ratio-bound');
  q.quote=()=>0n;
  assert.equal((await simulateRoute(route,10n,policy)).status,'rejected');
  q.quote=()=>BigInt(q.reserves[T]);
  assert.equal((await simulateRoute(route,10n,policy)).status,'rejected');
  assert.equal((await simulateRoute([{pool:p,coinIn:S,coinOut:B},{pool:p,coinIn:B,coinOut:S}],10n,policy)).reason,'invalid-or-repeated-hop');
});

test('completed 19-pool health scan excludes dust by an actual 10-SUI baseline, independent of TVL', () => {
  const scan=JSON.parse(readFileSync(new URL('./fixtures/aftermath-tree-health-2026-09-19.json',import.meta.url),'utf8'));
  assert.equal(scan.pools.length,19);
  const eligible=[];
  for (const row of scan.pools) {
    assert.equal(aftermathStateError(row.coins,row.daoFeePercentage),undefined);
    const p={...pool(row.poolId,row.coinTypes),reserves:Object.fromEntries(Object.entries(row.coins).map(([type,c]:[string,any])=>[type,c.balance]))};
    // Recorded SuiDex V3 quote from the first live probe, in TREE base units.
    if (terminalReserveEligibility(p,T,362664795859n).eligible) eligible.push(row.coinTypes.map((c:string)=>c.split('::').at(-1)).sort().join('/'));
    assert.equal(terminalReserveEligibility(p,T,0n).eligible,true,'no baseline must not invent an economic cutoff');
  }
  assert.deepEqual(eligible.sort(),['BOOM/TREE','SHOCK/TREE']);
});

test('state validation rejects invalid fees, weights and DAO fees', () => {
  const coin={balance:'1000',weight:'500000000000000000',tradeFeeIn:'0',tradeFeeOut:'0',decimalsScalar:'1000000000000000000'};
  assert.equal(aftermathStateError({[S]:coin,[T]:coin}),undefined);
  assert.equal(aftermathStateError({[S]:{...coin,tradeFeeIn:'1000000000000000000'},[T]:coin}),'invalid-fee');
  assert.equal(aftermathStateError({[S]:{...coin,weight:'0'},[T]:coin}),'invalid-weight');
  assert.equal(aftermathStateError({[S]:coin,[T]:coin},NaN),'invalid-dao-fee');
});
