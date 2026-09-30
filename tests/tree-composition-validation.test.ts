import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {verifyBridgeObject,verifyAftermathObject,simulationSummary} from '../netlify/lib/tree-composition-validation.ts';
import {buildComposedSimulation,SIMULATION_SENDER,PARTNERS,BRIDGES} from '../scripts/lib/tree-composed-transaction.mjs';
import {SUIDEX_V3_PACKAGE} from '../dapp/v3-transaction-core.js';
import {SUI_TYPE,TREE_TYPE} from '../dapp/earn-transactions-core.js';
const evidence=JSON.parse(readFileSync(new URL('../reports/tree-composition/composed-simulation.json',import.meta.url),'utf8'));
const boom=evidence.results.find((r:any)=>r.sui===10 && r.path==='BOOM');
const expected={poolId:BRIDGES.BOOM,packageId:SUIDEX_V3_PACKAGE,module:'pool',struct:'Pool',coinIn:SUI_TYPE,coinOut:PARTNERS.BOOM};

test('on-chain bridge identity, direction and positive liquidity are mandatory',()=>{
  assert.equal(verifyBridgeObject(boom.bridge,expected).verified,true);
  assert.throws(()=>verifyBridgeObject({...boom.bridge,type:boom.bridge.type.replace('::boom::BOOM','::boom::boom')},expected),/identity/);
  assert.throws(()=>verifyBridgeObject({...boom.bridge,owner:{$kind:'AddressOwner'}},expected),/identity/);
  assert.throws(()=>verifyBridgeObject({...boom.bridge,json:{...boom.bridge.json,liquidity:'0'}},expected),/empty/);
  assert.throws(()=>verifyBridgeObject({...boom.bridge,json:{...boom.bridge.json,swap_fee_rate:'1000000'}},expected),/fee/);
});

test('Aftermath SDK reserves and DAO wrapper must match independent chain objects',()=>{
  const {onchain,sdk,wrapper,parent}=boom.tail;
  assert.equal(verifyAftermathObject(onchain,sdk,wrapper,parent).daoFeeBps,200);
  assert.throws(()=>verifyAftermathObject(onchain,sdk,{...wrapper,json:{...wrapper.json,fee_bps:0}},parent),/wrapper/);
  assert.throws(()=>verifyAftermathObject(onchain,sdk,wrapper,{...parent,json:{...parent.json,value:BRIDGES.BOOM}}),/ownership/);
  assert.throws(()=>verifyAftermathObject({...onchain,json:{...onchain.json,normalized_balances:['1','2']}},sdk,wrapper,parent),/normalized_balances/);
  assert.throws(()=>verifyAftermathObject({...onchain,type:onchain.type.replace('0xefe','0xabc')},sdk,wrapper,parent),/identity/);
});

test('recorded successes conserve SUI input plus gas and obey final floors; negative controls fail at final split',()=>{
  assert.equal(evidence.results.length,9);
  for(const row of evidence.results) {
    const summary=simulationSummary(row.protected.simulation,SIMULATION_SENDER,TREE_TYPE,SUI_TYPE,BigInt(row.amountIn));
    assert.equal(summary.success,true);
    assert.ok(BigInt(summary.amountOut!)>=BigInt(row.protected.minOutput));
    assert.equal(summary.gasMist,row.protected.summary.gasMist);
    assert.equal(row.negative.summary.success,false);
    assert.equal(row.negative.summary.error.command,row.negative.minimumCommand);
    assert.match(row.negative.summary.error.message,/InsufficientCoinBalance/);
  }
  const bad=structuredClone(boom.protected.simulation);
  bad.Transaction.balanceChanges.find((c:any)=>c.address===SIMULATION_SENDER && c.coinType.endsWith('::sui::SUI')).amount='-1';
  assert.throws(()=>simulationSummary(bad,SIMULATION_SENDER,TREE_TYPE,SUI_TYPE,10_000_000_000n),/conservation/);
});

test('simulation builder enforces bounded inputs and a final-output floor before its sole transfer',()=>{
  assert.throws(()=>buildComposedSimulation({path:'DIRECT',amount:101_000_000_000n,minOutput:1n}),/invalid/);
  assert.throws(()=>buildComposedSimulation({path:'DIRECT',amount:10n,minOutput:0n}),/invalid/);
  assert.throws(()=>buildComposedSimulation({path:'BOOM',amount:10n,minOutput:1n,pool:{pool:{objectId:'bad'}}}),/unexpected/);
  const {transaction,minimumCommand}=buildComposedSimulation({path:'DIRECT',amount:10_000_000_000n,minOutput:123n});
  const data=transaction.getData();
  assert.equal(data.sender,SIMULATION_SENDER);
  assert.equal(data.gasData.payment,null);
  assert.equal(data.commands[minimumCommand].$kind,'SplitCoins');
  assert.equal(data.commands[minimumCommand+1].$kind,'MergeCoins');
  assert.equal(data.commands.at(-1)?.$kind,'TransferObjects');
  assert.equal(data.commands.filter((c:any)=>c.$kind==='TransferObjects').length,1);
});

test('recorded SDK rejections do not imply Move rejection and SDK estimates are not authoritative',()=>{
  for(const sui of [50,100]) {
    const row=evidence.results.find((r:any)=>r.sui===sui && r.path==='SHOCK');
    assert.match(row.sdkComparison.error,/maxTradePercentageOfPoolBalance/);
    assert.equal(row.protected.summary.success,true);
  }
  assert.ok(boom.sdkComparison.overstatementBps>0);
  assert.equal(boom.feeEvidence.sdkProtocolFeeBps,0.5);
  assert.ok(Math.abs(boom.feeEvidence.observedDeductionBps-5)<0.001);
});
