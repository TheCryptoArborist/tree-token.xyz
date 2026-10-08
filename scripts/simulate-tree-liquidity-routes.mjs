import { Aftermath } from 'aftermath-ts-sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SUI_TYPE, TREE_TYPE, normalizeTreeSwapQuote } from '../netlify/lib/tree-swap-route.ts';
import { TREE_PARTNER_TYPES } from '../netlify/lib/tree-liquidity-graph.ts';
import { quoteTurbosTreeSwap } from '../netlify/lib/turbos-tree-swap.ts';
import { aftermathSimulationPool } from '../netlify/lib/aftermath-route-simulation.ts';
import { coinKey, poolEligibility, terminalReserveEligibility, enumerateRoutes, simulateRoute } from '../netlify/lib/tree-route-simulation.ts';
import { parseBridgeQuotes, simulateBridgedRoute, QUOTE_CLOCK_SKEW_MS } from '../netlify/lib/tree-bridge-quotes.ts';

const SHOCK = '0x2fbed1da424da88f0bd56fab2d1a29a67c06bc1dc72c86428b40a1e5ce312941::shock::SHOCK';
const outputDir = process.env.TREE_SIMULATION_OUTPUT_DIR || 'reports/tree-liquidity';
const maxAgeMs = 30_000;
const timeoutMs = 20_000;
const stringify = value => JSON.stringify(value, (_,v) => typeof v === 'bigint' ? v.toString() : v, 2);
const timeout = (promise, ms) => new Promise((resolve,reject) => {
  const timer = setTimeout(() => reject(new Error('quote-timeout')), ms);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
const label = route => [route[0].coinIn, ...route.map(h => h.coinOut)].map(c => c.split('::').at(-1)).join(' → ');

async function bridgeQuotes(coinOut,amountIn) {
  const url=new URL('https://dex.suidex.org/api/v3/route');
  for (const [k,v] of Object.entries({tokenIn:SUI_TYPE,tokenOut:coinOut,amountIn,slippageBps:'100'})) url.searchParams.set(k,v);
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs),cache:'no-store'});
    if (!response.ok) throw new Error(`bridge HTTP ${response.status}`);
    const payload=await response.json();
    const quotes=parseBridgeQuotes(payload,{coinIn:SUI_TYPE,coinOut,amountIn},Date.now(),maxAgeMs);
    return {coinOut,quotes,raw:payload,error:quotes.length ? null : 'no-valid-direct-bridge'};
  } catch(error) { return {coinOut,quotes:[],error:String(error)}; }
}

async function directQuotes(amountIn) {
  const startedAt = new Date().toISOString();
  const request = { tokenIn:SUI_TYPE, tokenOut:TREE_TYPE, amountIn, slippageBps:100 };
  const url = new URL('https://dex.suidex.org/api/v3/route');
  for (const [key,value] of Object.entries(request)) url.searchParams.set(key,String(value));
  const [suidex, turbos] = await Promise.allSettled([
    fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache:'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`SuiDex HTTP ${response.status}`);
      const payload = await response.json();
      const age = Date.now() - Date.parse(payload.timestamp);
      if (!Number.isFinite(age) || age < -QUOTE_CLOCK_SKEW_MS || age > maxAgeMs) throw new Error('stale-or-missing-SuiDex-timestamp');
      return payload;
    }),
    timeout(quoteTurbosTreeSwap(request), timeoutMs),
  ]);
  let routes = [], normalizationError;
  try { routes = normalizeTreeSwapQuote(suidex.status === 'fulfilled' ? suidex.value : {}, request, turbos.status === 'fulfilled' ? [turbos.value] : []).routes; }
  catch (error) { normalizationError = String(error); }
  return {
    observedAt: new Date().toISOString(),
    oldestEvidenceAt: suidex.status === 'fulfilled' && Date.parse(suidex.value.timestamp) < Date.parse(startedAt) ? suidex.value.timestamp : startedAt,
    routes,
    failures: [...[suidex,turbos].flatMap((result,index) => result.status === 'rejected' ? [{venue:index ? 'turbos':'suidex', reason:String(result.reason)}] : []), ...(normalizationError ? [{venue:'baseline',reason:normalizationError}] : [])],
    rawSuidex: suidex.status === 'fulfilled' ? suidex.value : null,
  };
}

const sdk = await timeout(Aftermath.create({ network:'MAINNET' }), timeoutMs);
const report = { generatedAt:new Date().toISOString(), mode:'read-only-local-sdk-estimates', maxAgeMs, quoteClockSkewMs:QUOTE_CLOCK_SKEW_MS, maxHops:3, sdkVersion:'locked-by-package-lock',
  limitations:['No transaction signed or submitted.', 'Aftermath estimates are SDK math, not on-chain execution validation.', 'Cross-service snapshots are not atomic; fetched-at time does not prove upstream checkpoint freshness.', 'Outputs are gross of gas. No split optimization or gas-adjusted winner.', 'Terminal reserve pruning applies only to full-size routes, not split legs.', 'Bridge coverage: Aftermath graph plus SuiDex service direct SUI/BOOM and SUI/SHOCK estimates. Service bridge identities/reserves and transaction composability are not independently verified.'], cases:[] };
mkdirSync(outputDir, {recursive:true});
for (const sui of [10,50,100]) {
  const amountIn = (BigInt(sui) * 1_000_000_000n).toString();
  // Fetch a fresh pool snapshot for each size alongside the independent baselines.
  const [allPools,direct,boomBridges,shockBridges] = await Promise.all([
    timeout(sdk.Pools().getAllPools(), timeoutMs).then(pools => ({pools,verifiedAt:new Date().toISOString()})),
    directQuotes(amountIn),
    bridgeQuotes(TREE_PARTNER_TYPES.BOOM,amountIn),
    bridgeQuotes(SHOCK,amountIn),
  ]);
  const now = Date.now();
  const directFresh = now - Date.parse(direct.oldestEvidenceAt) <= maxAgeMs;
  const baselineRoutes = directFresh ? direct.routes : [];
  const bestOutput = baselineRoutes.reduce((best,r) => BigInt(r.amountOut) > best ? BigInt(r.amountOut) : best,0n);
  const pools = allPools.pools.map(pool => aftermathSimulationPool(pool,allPools.verifiedAt));
  const dropped = [], valid = [];
  for (const pool of pools) {
    const state = poolEligibility(pool,now,maxAgeMs);
    if (!state.eligible) dropped.push({poolId:pool.poolId, reason:state.reason});
    else valid.push(pool);
  }
  const treePools = valid.filter(p => p.coinTypes.some(c => coinKey(c) === coinKey(TREE_TYPE)));
  const eligible = valid.filter(pool => {
    const bound = terminalReserveEligibility(pool,TREE_TYPE,bestOutput);
    if (!bound.eligible) dropped.push({poolId:pool.poolId,reason:bound.reason});
    return bound.eligible;
  });
  const enumeration = enumerateRoutes(eligible,SUI_TYPE,TREE_TYPE,{preferredIntermediates:[TREE_PARTNER_TYPES.BOOM,SHOCK]});
  const results = [];
  for (const route of enumeration.routes) results.push({path:label(route),poolIds:route.map(h => h.pool.poolId), ...await simulateRoute(route,BigInt(amountIn),{now:Date.now(),maxAgeMs})});
  // Keep the requested direct/BOOM/SHOCK diagnostics even when a terminal
  // reserve bound already proves the path cannot win at this input size.
  const priorities = enumerateRoutes(valid,SUI_TYPE,TREE_TYPE,{maxHops:2,preferredIntermediates:[TREE_PARTNER_TYPES.BOOM,SHOCK]}).routes
    .filter(route => route.length === 1 || [TREE_PARTNER_TYPES.BOOM,SHOCK].some(type => coinKey(route[0].coinOut) === coinKey(type)));
  const diagnostics = [];
  for (const route of priorities) diagnostics.push({path:label(route),poolIds:route.map(h => h.pool.poolId),terminalEligibility:terminalReserveEligibility(route.at(-1).pool,TREE_TYPE,bestOutput), ...await simulateRoute(route,BigInt(amountIn),{now:Date.now(),maxAgeMs})});
  const bridgeResults=[], bridgeTailIds=new Set();
  for (const group of [boomBridges,shockBridges]) {
    const tails=enumerateRoutes(valid,group.coinOut,TREE_TYPE,{maxHops:2,preferredIntermediates:[TREE_PARTNER_TYPES.BOOM,SHOCK]});
    for (const bridge of group.quotes) for (const tail of tails.routes) {
      if (tail.some(h=>coinKey(h.coinOut)===coinKey(SUI_TYPE) || h.pool.poolId.toLowerCase()===bridge.poolId.toLowerCase())) continue;
      tail.forEach(h=>bridgeTailIds.add(h.pool.poolId));
      const context={path:'SUI → '+label(tail),poolIds:[bridge.poolId,...tail.map(h=>h.pool.poolId)],terminalEligibility:terminalReserveEligibility(tail.at(-1).pool,TREE_TYPE,bestOutput)};
      try { bridgeResults.push({...context,...await simulateBridgedRoute(bridge,tail,{now:Date.now(),maxAgeMs})}); }
      catch(error) { bridgeResults.push({...context,status:'rejected',amountOut:null,reason:String(error)}); }
    }
    group.tailsTruncated=tails.truncated;
  }
  const quoted = results.filter(r => r.status === 'quoted').sort((a,b) => BigInt(a.amountOut) > BigInt(b.amountOut) ? -1 : BigInt(a.amountOut) < BigInt(b.amountOut) ? 1 : 0);
  const relevantIds = new Set([...bridgeTailIds,...treePools.map(p=>p.poolId), ...enumeration.routes.flatMap(r=>r.map(h=>h.pool.poolId)), ...priorities.flatMap(r=>r.map(h=>h.pool.poolId))]);
  writeFileSync(`${outputDir}/snapshot-${sui}-sui.json`,stringify({verifiedAt:allPools.verifiedAt,pools:allPools.pools.filter(p=>relevantIds.has(p.pool.objectId)).map(p=>p.pool)}));
  const row = {sui,amountIn,observedAt:allPools.verifiedAt,allPoolCount:pools.length,treePoolCount:treePools.length,directFresh,direct,bestDirectAmountOut:bestOutput.toString(),treePoolEligibility:treePools.map(p=>({poolId:p.poolId,coinTypes:p.coinTypes,treeReserve:p.reserves[p.coinTypes.find(c=>coinKey(c)===coinKey(TREE_TYPE))],...terminalReserveEligibility(p,TREE_TYPE,bestOutput)})),dropped,routeCount:results.length,truncated:enumeration.truncated,quotedCount:quoted.length,bestAftermath:quoted[0] ?? null,priorityDiagnostics:diagnostics,results};
  row.bridgeSources=[boomBridges,shockBridges];
  row.bridgeResults=bridgeResults;
  report.cases.push(row);
  writeFileSync(`${outputDir}/simulation.json`,stringify(report));
  console.log(stringify({sui,direct:baselineRoutes.map(r=>({venue:r.venue,amountOut:r.amountOut})),routeCount:results.length,quotedCount:quoted.length,bestAftermath:quoted[0],priorityDiagnostics:diagnostics,failures:direct.failures}));
}
