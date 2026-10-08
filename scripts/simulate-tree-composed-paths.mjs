import {SuiGrpcClient} from '@mysten/sui/grpc';
import {Aftermath,AftermathApi,Pools} from 'aftermath-ts-sdk';
import {mkdirSync,writeFileSync} from 'node:fs';
import {SUIDEX_V3_PACKAGE,SUIDEX_V3_POOL} from '../dapp/v3-transaction-core.js';
import {SUI_TYPE,TREE_TYPE,V2_PACKAGE} from '../dapp/earn-transactions-core.js';
import {verifyBridgeObject,verifyAftermathObject,simulationSummary} from '../netlify/lib/tree-composition-validation.ts';
import {buildComposedSimulation,SIMULATION_SENDER,PARTNERS,BRIDGES,TAILS} from './lib/tree-composed-transaction.mjs';
const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
const sdk=await Aftermath.create({network:'MAINNET'},AbortSignal.timeout(20_000));
const addresses=await sdk.getAddresses(AbortSignal.timeout(20_000));
const api=new AftermathApi(client,addresses);
const dir=process.env.TREE_COMPOSITION_OUTPUT_DIR || 'reports/tree-composition';
mkdirSync(dir,{recursive:true});
const json=value=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?String(v):v instanceof Uint8Array?Buffer.from(v).toString('base64'):v,2);
const usedAddresses=Object.fromEntries(['pools','daoFeePools','referralVault'].map(key=>[key,{packages:addresses[key]?.packages,objects:addresses[key]?.objects}]));
const report={observedAt:new Date().toISOString(),sender:SIMULATION_SENDER,mockedGas:true,checksEnabled:true,signed:false,submitted:false,slippageBps:100,addresses:usedAddresses,results:[]};
const readObject=async objectId=>(await client.core.getObject({objectId,include:{json:true,owner:true},signal:AbortSignal.timeout(20_000)})).object;
const simulate=transaction=>client.core.simulateTransaction({transaction,checksEnabled:true,doGasSelection:false,include:{effects:true,events:true,balanceChanges:true},signal:AbortSignal.timeout(30_000)});
const summarize=(result,amount)=>simulationSummary(result,SIMULATION_SENDER,TREE_TYPE,SUI_TYPE,amount);
const compact=result=>({$kind:result.$kind,Transaction:result.Transaction?{...result.Transaction,effects:{...result.Transaction.effects,bcs:undefined},events:result.Transaction.events?.map(({bcs,...event})=>event)}:undefined,FailedTransaction:result.FailedTransaction});
for(const sui of [10,50,100]) for(const path of ['DIRECT','BOOM','SHOCK']) {
  const amount=BigInt(sui)*1_000_000_000n;
  const row={sui,path,startedAt:new Date().toISOString(),amountIn:String(amount)};
  try {
    const bridge=await readObject(path==='DIRECT'?SUIDEX_V3_POOL:BRIDGES[path]);
    row.bridge=bridge;
    row.bridgeVerification=verifyBridgeObject(bridge,{poolId:path==='DIRECT'?SUIDEX_V3_POOL:BRIDGES[path],packageId:path==='SHOCK'?V2_PACKAGE:SUIDEX_V3_PACKAGE,module:path==='SHOCK'?'pair':'pool',struct:path==='SHOCK'?'Pair':'Pool',coinIn:SUI_TYPE,coinOut:path==='DIRECT'?TREE_TYPE:PARTNERS[path]});
    let pool;
    if(path!=='DIRECT') {
      pool=await sdk.Pools().getPool({objectId:TAILS[path]},AbortSignal.timeout(20_000));
      const onchain=await readObject(TAILS[path]);
      const wrapper=pool.pool.daoFeePoolObject?await readObject(pool.pool.daoFeePoolObject.objectId):undefined;
      const parent=wrapper?await readObject(onchain.owner.ObjectOwner):undefined;
      row.tail={onchain,sdk:pool.pool,wrapper,parent};
      row.tailVerification=verifyAftermathObject(onchain,pool.pool,wrapper,parent);
    }
    const build=minOutput=>{
      if(Date.now()-Date.parse(row.startedAt)>30_000) throw new Error('state-validation-expired');
      return buildComposedSimulation({path,amount,minOutput,api,pool});
    };
    const discovery=build(1n);
    const discoveryResult=await simulate(discovery.transaction);
    row.discovery={summary:summarize(discoveryResult,amount),simulation:compact(discoveryResult)};
    if(!row.discovery.summary.success) throw new Error('discovery-simulation-failed');
    const output=BigInt(row.discovery.summary.amountOut);
    const minOutput=output*9900n/10000n;
    const protectedTx=build(minOutput);
    const protectedResult=await simulate(protectedTx.transaction);
    row.protected={minOutput:String(minOutput),summary:summarize(protectedResult,amount),simulation:compact(protectedResult),transaction:protectedTx.transaction.getData()};
    if(!row.protected.summary.success || BigInt(row.protected.summary.amountOut)<minOutput) throw new Error('slippage-protected-simulation-failed');
    const negativeTx=build(output*2n);
    const negativeResult=await simulate(negativeTx.transaction);
    row.negative={minOutput:String(output*2n),minimumCommand:negativeTx.minimumCommand,summary:summarize(negativeResult,amount),simulation:compact(negativeResult)};
    const error=row.negative.summary.error;
    row.negative.expectedFailure=!row.negative.summary.success && error?.command===negativeTx.minimumCommand && /InsufficientCoinBalance/.test(error?.message ?? '');
    if(path!=='DIRECT') {
      const swap=discoveryResult.Transaction.events.find(e=>path==='BOOM'?e.eventType.endsWith('::trade::SwapEvent'):e.eventType.includes('::pair::Swap<'))?.json;
      const bridgeOut=path==='BOOM'?swap?.amount_y:swap?.amount1_out;
      row.bridgeAmountOut=String(bridgeOut);
      const tailEvent=discoveryResult.Transaction.events.find(e=>e.json?.pool_id===TAILS[path] && e.json?.amounts_in)?.json;
      const daoBps=pool.pool.daoFeePoolObject?.feeBps ?? 0n;
      const afterDao=BigInt(bridgeOut)-BigInt(bridgeOut)*daoBps/10000n;
      const eventInput=BigInt(tailEvent.amounts_in[0]);
      row.feeEvidence={bridgeOutputRaw:String(bridgeOut),afterDaoRaw:String(afterDao),poolEventInputRaw:String(eventInput),observedDeductionBps:Number(afterDao-eventInput)/Number(afterDao)*10000,sdkProtocolFeeBps:Pools.constants.feePercentages.totalProtocol*10000,note:'Observed deduction inferred from bridge output, verified DAO fee and pool event input; SDK constant is not a verified current on-chain fee.'};
      try {
        const estimate=pool.getTradeAmountOut({coinInType:PARTNERS[path],coinOutType:TREE_TYPE,coinInAmount:BigInt(bridgeOut)});
        row.sdkComparison={amountOut:String(estimate),differenceRaw:String(estimate-output),overstatementBps:Number(estimate-output)/Number(output)*10_000};
      } catch(error) {row.sdkComparison={error:String(error),onchainSucceeded:true};}
    }
    row.verified=row.negative.expectedFailure;
  } catch(error){row.error=String(error);row.verified=false;}
  report.results.push(row);
  writeFileSync(`${dir}/composed-simulation.json`,json(report));
  console.log(json({sui,path,verified:row.verified,output:row.protected?.summary,negative:row.negative?.summary,sdk:row.sdkComparison,error:row.error}));
}
if(report.results.some(row=>!row.verified)) process.exitCode=1;
