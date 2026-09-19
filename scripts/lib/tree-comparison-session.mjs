import {smallSplitGrid} from './tree-split-transaction.mjs';

const uint=value=>{
  if(typeof value!=='string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('invalid-integer-evidence');
  return BigInt(value);
};
const key=c=>`${uint(c.boom)}:${uint(c.shock)}`;

// Three independent fresh studies must agree on the SAME allocation. A failed
// or missing round never becomes a "no improvement" result.
export function compareSession(rounds,{startedAt,now=Date.now()}={}) {
  if(rounds.length!==3 || !Number.isFinite(startedAt) || now<startedAt || now-startedAt>600_000) throw new Error('incomplete-or-expired-session');
  let previous=-Infinity;
  for(const round of rounds) {
    const observed=Date.parse(round.observedAt);
    if(!Number.isFinite(observed) || observed<startedAt || observed>now || observed<=previous) throw new Error('stale-or-repeated-round');
    previous=observed;
    if(round.quoteAuthority!=='checks-enabled-full-PTB-mainnet-simulation' || round.sdkQuoteAuthority!==false || round.signed!==false || round.submitted!==false || round.mockedGas!==true || round.cases?.length!==3) throw new Error('invalid-round');
  }
  const cases=[10,50,100].map(sui=>{
    const total=BigInt(sui)*1_000_000_000n;
    const expected=smallSplitGrid(total).map(c=>`${c.boom}:${c.shock}`);
    const rows=rounds.map(round=>{
      const matches=round.cases.filter(c=>c.sui===sui);
      const row=matches[0];
      if(matches.length!==1 || row.complete!==true || row.stable!==true || uint(row.total)!==total || !row.stabilityChecks?.length || row.protected?.summary?.success!==true || row.negative?.summary?.success!==false || row.negative.summary.error?.command!==row.negative.minimumCommand || !/InsufficientCoinBalance/.test(row.negative.summary.error?.message ?? '')) throw new Error('incomplete-study');
      const candidates=new Map(row.candidates.map(c=>[key(c),c]));
      if(candidates.size!==expected.length || row.candidates.length!==expected.length || expected.some(k=>!candidates.has(k))) throw new Error('incomplete-grid');
      for(const [allocation,c] of candidates) {
        if(c.success!==true || uint(c.amountOut)<=0n) throw new Error('invalid-candidate');
        if(allocation==='0:0') continue;
        const comparator=row.equalBudgetComparators?.[c.gasMist];
        if(comparator?.success!==true || uint(comparator.amountOut)<=0n || uint(comparator.amountIn)+uint(comparator.gasMist)!==total+uint(c.gasMist)) throw new Error('unequal-cost-comparison');
        const gain=uint(c.amountOut)-uint(comparator.amountOut);
        if(c.equalBudgetGainRaw!==String(gain)) throw new Error('inconsistent-gain');
      }
      return candidates;
    });
    const allocations=expected.filter(k=>k!=='0:0').map(allocation=>{
      const gains=rows.map(row=>BigInt(row.get(allocation).equalBudgetGainRaw));
      const [boom,shock]=allocation.split(':');
      return {boom,shock,gainsRaw:gains.map(String),minimumGainRaw:String(gains.reduce((a,b)=>a<b?a:b)),repeatedImprovement:gains.every(g=>g>0n)};
    }).sort((a,b)=>BigInt(a.minimumGainRaw)>BigInt(b.minimumGainRaw)?-1:BigInt(a.minimumGainRaw)<BigInt(b.minimumGainRaw)?1:0);
    return {sui,testedAllocations:allocations.length,repeatedImprovements:allocations.filter(a=>a.repeatedImprovement),closest:allocations[0]};
  });
  return {complete:true,rounds:3,startedAt:new Date(startedAt).toISOString(),completedAt:new Date(now).toISOString(),status:cases.some(c=>c.repeatedImprovements.length)?'repeated-improvement-observed':'no-repeated-improvement',cases,productionChanged:false,submitted:false,limitations:['Three fresh observations of a finite grid; not a guarantee of future execution or a global optimum.','Only direct V3 and the verified BOOM/SHOCK paths; gas is mocked and pool state is checked, not pinned.','A positive result is a research flag, not authorization to execute or change Best Swap.']};
}
