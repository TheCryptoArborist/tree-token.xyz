import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {AftermathApi,Pool} from 'aftermath-ts-sdk';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {splitAmounts,smallSplitGrid,buildSplitSimulation} from '../scripts/lib/tree-split-transaction.mjs';
import {equalBudgetDirect} from '../scripts/lib/tree-split-comparison.mjs';
import {SIMULATION_SENDER} from '../scripts/lib/tree-composed-transaction.mjs';

test('split allocations conserve base units and reject negative, exhausted and oversized inputs',()=>{
  for(const total of [10n,50n,100n].map(n=>n*1_000_000_000n)) {
    for(const allocation of smallSplitGrid(total)) {
      const legs=splitAmounts(total,allocation.boom,allocation.shock);
      assert.equal(legs.reduce((sum:any,leg:any)=>sum+leg.amount,0n),total);
      assert.ok(allocation.boom+allocation.shock<=total/5n);
      assert.equal(new Set(legs.map((leg:any)=>leg.path)).size,legs.length);
    }
  }
  for(const args of [[10n,-1n,0n],[10n,5n,5n],[0n,0n,0n],[101_000_000_000n,0n,0n]]) assert.throws(()=>splitAmounts(...args),/invalid/);
});

test('equal-cost comparison re-quotes when gas changes and binds the output to the actual quoted amount',async()=>{
  const inputs:bigint[]=[];
  const result=await equalBudgetDirect(1000n,10n,async(amount:bigint)=>{
    inputs.push(amount);return {summary:{success:true,gasMist:'20',amountOut:String(amount*2n)},evidence:{}};
  });
  assert.deepEqual(inputs,[990n,980n]);
  assert.equal(result.amountIn,'980');assert.equal(result.amountOut,'1960');
  assert.equal(BigInt(result.amountIn)+BigInt(result.gasMist),1000n);
});

test('equal-cost comparison fails closed on oscillating gas, rejection or exhausted budget',async()=>{
  let count=0;
  await assert.rejects(equalBudgetDirect(1000n,10n,async()=>({summary:{success:true,gasMist:String(++count%2?20:10),amountOut:'1'}})),/did-not-converge/);
  await assert.rejects(equalBudgetDirect(1000n,10n,async()=>({summary:{success:false}})),/failed/);
  await assert.rejects(equalBudgetDirect(10n,10n,async()=>{}),/invalid/);
});

const report=JSON.parse(readFileSync(new URL('../reports/tree-splits/split-study.json',import.meta.url),'utf8'));
test('captured study comparisons use identical total SUI debit and retain protected/negative evidence',()=>{
  assert.equal(report.quoteAuthority,'checks-enabled-full-PTB-mainnet-simulation');
  assert.equal(report.sdkQuoteAuthority,false);
  assert.equal(report.cases.length,3);
  for(const row of report.cases) {
    assert.equal(row.complete,true);assert.equal(row.stable,true);assert.ok(row.stabilityChecks.length);
    for(const candidate of row.candidates.slice(1)) {
      const reference=row.equalBudgetComparators[candidate.gasMist];
      assert.equal(BigInt(row.total)+BigInt(candidate.gasMist),BigInt(reference.amountIn)+BigInt(reference.gasMist));
      assert.equal(BigInt(candidate.equalBudgetGainRaw),BigInt(candidate.amountOut)-BigInt(reference.amountOut));
    }
    assert.equal(row.protected.summary.success,true);
    assert.ok(BigInt(row.protected.summary.amountOut)>=BigInt(row.protected.minOutput));
    assert.equal(row.negative.summary.success,false);
    assert.equal(row.negative.summary.error.command,row.negative.minimumCommand);
  }
});

test('three-leg builder merges TREE and enforces one final floor before its only transfer',()=>{
  const composition=JSON.parse(readFileSync(new URL('../reports/tree-composition/composed-simulation.json',import.meta.url),'utf8'));
  const bigKeys=new Set(['weight','balance','tradeFeeIn','tradeFeeOut','depositFee','withdrawFee','normalizedBalance','decimalsScalar','feeBps','lpCoinSupply','illiquidLpCoinSupply','flatness']);
  const poolData=JSON.parse(JSON.stringify(report.cases[0].sdkState),(key,value)=>bigKeys.has(key)?BigInt(value):value);
  const pools=Object.fromEntries(Object.entries(poolData).map(([key,pool])=>[key,new Pool(pool as any)]));
  const api=new AftermathApi(new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'}),composition.addresses);
  const result=buildSplitSimulation({total:10_000_000_000n,boom:100_000_000n,shock:100_000_000n,minOutput:100n,api,pools});
  const data=result.transaction.getData();
  assert.equal(result.legs.length,3);assert.equal(data.sender,SIMULATION_SENDER);
  assert.equal(data.gasData.payment,null);
  assert.equal(data.commands[result.minimumCommand-1].$kind,'MergeCoins');
  assert.equal(data.commands[result.minimumCommand].$kind,'SplitCoins');
  assert.equal(data.commands.filter((c:any)=>c.$kind==='TransferObjects').length,1);
  assert.equal(data.commands.at(-1)?.$kind,'TransferObjects');
});
