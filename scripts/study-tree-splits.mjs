import {SuiGrpcClient} from '@mysten/sui/grpc';
import {Aftermath,AftermathApi,Pools} from 'aftermath-ts-sdk';
import {mkdirSync,writeFileSync} from 'node:fs';
import {SUIDEX_V3_PACKAGE,SUIDEX_V3_POOL} from '../dapp/v3-transaction-core.js';
import {SUI_TYPE,TREE_TYPE,V2_PACKAGE} from '../dapp/earn-transactions-core.js';
import {verifyBridgeObject,verifyAftermathObject,simulationSummary} from '../netlify/lib/tree-composition-validation.ts';
import {SIMULATION_SENDER,PARTNERS,BRIDGES,TAILS} from './lib/tree-composed-transaction.mjs';
import {buildSplitSimulation,smallSplitGrid} from './lib/tree-split-transaction.mjs';
import {equalBudgetDirect} from './lib/tree-split-comparison.mjs';

const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
const sdk=await Aftermath.create({network:'MAINNET'},AbortSignal.timeout(20_000));
const addresses=await sdk.getAddresses(AbortSignal.timeout(20_000));
const api=new AftermathApi(client,addresses);
const dir=process.env.TREE_SPLIT_OUTPUT_DIR || 'reports/tree-splits';
mkdirSync(dir,{recursive:true});
const json=value=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?String(v):v,2);
const report={observedAt:new Date().toISOString(),quoteAuthority:'checks-enabled-full-PTB-mainnet-simulation',sdkQuoteAuthority:false,mockedGas:true,signed:false,submitted:false,slippageBps:100,grid:'0.01/0.05/0.1/0.25/0.5/1/2/5 SUI individual legs <=20%; joint 0.05/0.1/0.25 SUI per partner',limitations:['Finite grid, not a global optimum.','Mocked gas does not prove user funding.','Pool versions must remain stable per input-size study; no common pinned checkpoint.','Only direct V3 plus verified BOOM/SHOCK paths are studied.'],cases:[]};
const save=()=>writeFileSync(`${dir}/split-study.json`,json(report));
const read=async objectId=>(await client.core.getObject({objectId,include:{json:true,owner:true},signal:AbortSignal.timeout(20_000)})).object;
const simulate=transaction=>client.core.simulateTransaction({transaction,checksEnabled:true,doGasSelection:false,include:{effects:true,events:true,balanceChanges:true},signal:AbortSignal.timeout(30_000)});
const evidence=result=>({kind:result.$kind,status:result.Transaction?.effects?.status ?? result.FailedTransaction?.status,gasUsed:result.Transaction?.effects?.gasUsed,balanceChanges:result.Transaction?.balanceChanges,events:result.Transaction?.events?.map(e=>({type:e.eventType,json:e.json}))});

async function context() {
  const startedAt=Date.now(), objects=[], pools={};
  for(const path of ['DIRECT','BOOM','SHOCK']) {
    const poolId=path==='DIRECT'?SUIDEX_V3_POOL:BRIDGES[path];
    const bridge=await read(poolId);objects.push(bridge);
    verifyBridgeObject(bridge,{poolId,packageId:path==='SHOCK'?V2_PACKAGE:SUIDEX_V3_PACKAGE,module:path==='SHOCK'?'pair':'pool',struct:path==='SHOCK'?'Pair':'Pool',coinIn:SUI_TYPE,coinOut:path==='DIRECT'?TREE_TYPE:PARTNERS[path]});
    if(path!=='DIRECT') {
      pools[path]=await sdk.Pools().getPool({objectId:TAILS[path]},AbortSignal.timeout(20_000));
      const pool=pools[path].pool,onchain=await read(TAILS[path]);objects.push(onchain);
      const wrapper=pool.daoFeePoolObject?await read(pool.daoFeePoolObject.objectId):undefined;
      const parent=wrapper?await read(onchain.owner.ObjectOwner):undefined;
      if(wrapper) objects.push(wrapper,parent);
      verifyAftermathObject(onchain,pool,wrapper,parent);
    }
  }
  let lastChecked=startedAt;
  const stabilityChecks=[];
  async function ensureStable(force=false) {
    if(!force && Date.now()-lastChecked<15_000) return;
    const checkingAt=Date.now();
    for(const object of objects) {
      const fresh=await read(object.objectId);
      if(fresh.version!==object.version || fresh.digest!==object.digest) throw new Error(`pool-state-changed:${object.objectId}`);
    }
    lastChecked=checkingAt;stabilityChecks.push(new Date(checkingAt).toISOString());
  }
  return {objects,pools,ensureStable,stabilityChecks};
}

for(const sui of [10,50,100]) {
  const total=BigInt(sui)*1_000_000_000n;
  const row={sui,total:String(total),startedAt:new Date().toISOString(),candidates:[]};
  report.cases.push(row);
  try {
    const ctx=await context();
    row.state=ctx.objects;row.sdkState=Object.fromEntries(Object.entries(ctx.pools).map(([key,pool])=>[key,pool.pool]));
    async function quote(allocation,amount=total,minOutput=1n) {
      await ctx.ensureStable();
      const built=buildSplitSimulation({total:amount,...allocation,minOutput,api,pools:ctx.pools});
      const result=await simulate(built.transaction);
      const summary=simulationSummary(result,SIMULATION_SENDER,TREE_TYPE,SUI_TYPE,amount);
      return {summary,evidence:evidence(result),minimumCommand:built.minimumCommand,transaction:built.transaction.getData()};
    }
    for(const allocation of smallSplitGrid(total)) {
      const result=await quote(allocation);
      if(!result.summary.success) throw new Error(`candidate-failed:${json(result.summary)}`);
      row.candidates.push({...allocation,...result.summary,evidence:result.evidence});
    }
    const baseline=row.candidates[0];row.baseline=baseline;
    // Equal total SUI debit comparison avoids an arbitrary gas/TREE oracle:
    // give direct V3 the split's extra gas budget as additional swap input.
    const comparators=new Map();
    for(const candidate of row.candidates.slice(1)) {
      const budget=total+BigInt(candidate.gasMist);
      const key=candidate.gasMist;
      if(!comparators.has(key)) {
        comparators.set(key,await equalBudgetDirect(budget,BigInt(baseline.gasMist),amount=>quote({boom:0n,shock:0n},amount)));
      }
      const comparison=comparators.get(key);
      candidate.grossGainRaw=String(BigInt(candidate.amountOut)-BigInt(baseline.amountOut));
      candidate.equalBudgetDirectAmountOut=comparison.amountOut;
      candidate.equalBudgetGainRaw=String(BigInt(candidate.amountOut)-BigInt(comparison.amountOut));
    }
    row.equalBudgetComparators=Object.fromEntries(comparators);
    const sorted=[...row.candidates.slice(1)].sort((a,b)=>BigInt(a.equalBudgetGainRaw)>BigInt(b.equalBudgetGainRaw)?-1:BigInt(a.equalBudgetGainRaw)<BigInt(b.equalBudgetGainRaw)?1:0);
    row.bestSplit=sorted[0];
    row.improvingSplits=sorted.filter(c=>BigInt(c.equalBudgetGainRaw)>0n).length;
    const allocation={boom:BigInt(row.bestSplit.boom),shock:BigInt(row.bestSplit.shock)};
    const minOutput=BigInt(row.bestSplit.amountOut)*9900n/10000n;
    row.protected=await quote(allocation,total,minOutput);row.protected.minOutput=String(minOutput);
    if(!row.protected.summary.success) throw new Error('protected-split-failed');
    row.negative=await quote(allocation,total,BigInt(row.bestSplit.amountOut)*2n);
    const error=row.negative.summary.error;
    if(row.negative.summary.success || error?.command!==row.negative.minimumCommand || !/InsufficientCoinBalance/.test(error?.message ?? '')) throw new Error('negative-control-failed');
    row.sdkReconciliation=[];
    // These diagnostics never determine eligibility or rank: authoritative
    // outputs and reserve acceptance now come from the complete Move simulation.
    for(const candidate of row.candidates.slice(1)) for(const path of ['BOOM','SHOCK']) {
      if(BigInt(candidate[path.toLowerCase()])===0n) continue;
      const events=candidate.evidence.events;
      const swap=events.find(e=>path==='BOOM'?e.json?.pool_id===BRIDGES.BOOM && e.type.endsWith('::trade::SwapEvent'):e.type.includes('::pair::Swap<'))?.json;
      const bridgeOutput=BigInt(path==='BOOM'?swap.amount_y:swap.amount1_out);
      const tailEvent=events.find(e=>e.json?.pool_id===TAILS[path] && e.json?.amounts_out)?.json;
      const actual=BigInt(tailEvent.amounts_out[0]);
      const diagnostic={path,allocation:{boom:candidate.boom,shock:candidate.shock},bridgeOutput:String(bridgeOutput),onchainOutput:String(actual),sdkProtocolFeeBps:Pools.constants.feePercentages.totalProtocol*10000};
      try {diagnostic.sdkOutput=String(ctx.pools[path].getTradeAmountOut({coinInType:PARTNERS[path],coinOutType:TREE_TYPE,coinInAmount:bridgeOutput}));diagnostic.errorRaw=String(BigInt(diagnostic.sdkOutput)-actual);}
      catch(error){diagnostic.sdkError=String(error);}
      row.sdkReconciliation.push(diagnostic);
    }
    await ctx.ensureStable(true);row.stabilityChecks=ctx.stabilityChecks;row.stable=true;row.complete=true;
    row.conclusion=row.improvingSplits ? 'candidate-improvement-needs-revalidation' : 'no-tested-split-beats-equal-budget-direct';
    console.log(json({sui,candidates:row.candidates.length,improving:row.improvingSplits,best:{boom:row.bestSplit.boom,shock:row.bestSplit.shock,output:row.bestSplit.amountOut,gas:row.bestSplit.gasMist,grossGain:row.bestSplit.grossGainRaw,equalBudgetGain:row.bestSplit.equalBudgetGainRaw}}));
  } catch(error){row.error=String(error);row.complete=false;console.error(row.error);process.exitCode=1;}
  save();
}
