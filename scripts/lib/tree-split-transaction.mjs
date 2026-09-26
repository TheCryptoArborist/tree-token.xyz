import {Transaction} from '@mysten/sui/transactions';
import {appendComposedLeg,SIMULATION_SENDER} from './tree-composed-transaction.mjs';

export function splitAmounts(total,boom=0n,shock=0n) {
  if([total,boom,shock].some(n=>typeof n!=='bigint') || total<=0n || total>100_100_000_000n || boom<0n || shock<0n || boom+shock>=total) throw new Error('invalid-split-allocation');
  return [{path:'DIRECT',amount:total-boom-shock},{path:'BOOM',amount:boom},{path:'SHOCK',amount:shock}].filter(leg=>leg.amount>0n);
}

export function buildSplitSimulation({total,boom=0n,shock=0n,minOutput=1n,api,pools}) {
  const legs=splitAmounts(total,boom,shock);
  if(typeof minOutput!=='bigint' || minOutput<=0n || minOutput>=2n**64n) throw new Error('invalid-output-floor');
  const tx=new Transaction();tx.setSender(SIMULATION_SENDER);tx.setGasBudget(1_000_000_000n);
  const outputs=legs.map(({path,amount})=>{
    const [input]=tx.splitCoins(tx.gas,[tx.pure.u64(amount)]);
    return appendComposedLeg({tx,path,amount,input,api,pool:pools?.[path]});
  });
  if(outputs.length>1) tx.mergeCoins(outputs[0],outputs.slice(1));
  const minimumCommand=tx.getData().commands.length;
  const [floor]=tx.splitCoins(outputs[0],[tx.pure.u64(minOutput)]);
  tx.mergeCoins(outputs[0],[floor]);
  tx.transferObjects([outputs[0]],SIMULATION_SENDER);
  return {transaction:tx,minimumCommand,legs};
}

// Finite exploration, not an optimizer or a guarantee of a global optimum.
export function smallSplitGrid(total) {
  const small=[10_000_000n,50_000_000n,100_000_000n,250_000_000n,500_000_000n,1_000_000_000n,2_000_000_000n,5_000_000_000n];
  const allocations=[{boom:0n,shock:0n}];
  for(const amount of small) if(amount<=total/5n) allocations.push({boom:amount,shock:0n},{boom:0n,shock:amount});
  for(const boom of small.slice(1,4)) for(const shock of small.slice(1,4)) if(boom+shock<=total/5n) allocations.push({boom,shock});
  return allocations;
}
