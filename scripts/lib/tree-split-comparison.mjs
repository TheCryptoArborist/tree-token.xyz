// Match total debit exactly, rather than pricing gas through an arbitrary
// exchange rate. Re-simulate if direct gas changes across an input/tick boundary.
export async function equalBudgetDirect(budget,initialGas,quote) {
  if(typeof budget!=='bigint' || typeof initialGas!=='bigint' || budget<=initialGas || initialGas<0n) throw new Error('invalid-comparison-budget');
  let amount=budget-initialGas;
  for(let attempt=0;attempt<3;attempt++) {
    const comparison=await quote(amount);
    if(!comparison.summary.success) throw new Error('equal-budget-comparator-failed');
    const gas=BigInt(comparison.summary.gasMist);
    if(amount+gas===budget) return {amountIn:String(amount),...comparison.summary,evidence:comparison.evidence};
    amount=budget-gas;
    if(amount<=0n) throw new Error('comparison-budget-exhausted');
  }
  throw new Error('equal-budget-comparator-did-not-converge');
}
