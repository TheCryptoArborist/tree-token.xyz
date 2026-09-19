import {Transaction} from '@mysten/sui/transactions';
import {SUIDEX_V3_PACKAGE,SUIDEX_V3_VERSION,SUIDEX_V3_POOL,SUI_CLOCK} from '../../dapp/v3-transaction-core.js';
import {SUI_TYPE,TREE_TYPE,V2_PACKAGE,V2_ROUTER,V2_FACTORY} from '../../dapp/earn-transactions-core.js';
export const SIMULATION_SENDER='0x'+'0'.repeat(63)+'1';
export const PARTNERS={BOOM:'0x3766e534b5dc6cdb7defd998debf19f72565f4a7b8224e36b050f690b71a8819::boom::BOOM',SHOCK:'0x2fbed1da424da88f0bd56fab2d1a29a67c06bc1dc72c86428b40a1e5ce312941::shock::SHOCK'};
export const BRIDGES={BOOM:'0x21e920ad49b2b3e49e1fe8e6d5bcb721378833178e1d3b50dc077799513876ac',SHOCK:'0x3f155c4c82d36b85dd36de72a922626188e20643048b6b8ab972ffee9bb0c158'};
export const TAILS={BOOM:'0x2eb0b762b9625ddb82b296542662c74d297cfc508e04523f69f3ebf73c372334',SHOCK:'0x637c93e47274c1d5cf2f8f230dfebf22875e227c220c2156469578f8f4504c53'};
function v3(tx,pool,outType,coin,amount) {
  const balance=tx.moveCall({target:'0x2::coin::into_balance',typeArguments:[SUI_TYPE],arguments:[coin]});
  const [a,b,receipt]=tx.moveCall({target:`${SUIDEX_V3_PACKAGE}::trade::flash_swap`,typeArguments:[SUI_TYPE,outType],arguments:[tx.object(pool),tx.pure.bool(true),tx.pure.bool(true),tx.pure.u64(amount),tx.pure.u128(4295048017n),tx.object(SUI_CLOCK),tx.object(SUIDEX_V3_VERSION)]});
  const zero=tx.moveCall({target:'0x2::balance::zero',typeArguments:[outType],arguments:[]});
  tx.moveCall({target:`${SUIDEX_V3_PACKAGE}::trade::repay_flash_swap`,typeArguments:[SUI_TYPE,outType],arguments:[tx.object(pool),receipt,balance,zero,tx.object(SUIDEX_V3_VERSION)]});
  tx.moveCall({target:'0x2::balance::destroy_zero',typeArguments:[SUI_TYPE],arguments:[a]});
  return tx.moveCall({target:'0x2::coin::from_balance',typeArguments:[outType],arguments:[b]});
}
// Simulation-only: fixed dummy sender, server-mocked gas; no public API imports.
export function buildComposedSimulation({path,amount,minOutput,api,pool}) {
  if (!['DIRECT','BOOM','SHOCK'].includes(path) || typeof amount!=='bigint' || amount<=0n || amount>100_000_000_000n || typeof minOutput!=='bigint' || minOutput<=0n || minOutput>=2n**64n) throw new Error('invalid-simulation-input');
  if(path!=='DIRECT' && pool?.pool?.objectId!==TAILS[path]) throw new Error('unexpected-tail-pool');
  const tx=new Transaction();tx.setSender(SIMULATION_SENDER);tx.setGasBudget(1_000_000_000n);
  const [input]=tx.splitCoins(tx.gas,[tx.pure.u64(amount)]);
  let output;
  if(path==='DIRECT') output=v3(tx,SUIDEX_V3_POOL,TREE_TYPE,input,amount);
  else {
    const bridge=path==='BOOM'?v3(tx,BRIDGES.BOOM,PARTNERS.BOOM,input,amount):tx.moveCall({target:`${V2_PACKAGE}::router::swap_exact_tokens0_for_tokens1_composable`,typeArguments:[SUI_TYPE,PARTNERS.SHOCK],arguments:[tx.object(V2_ROUTER),tx.object(V2_FACTORY),tx.object(BRIDGES.SHOCK),input,tx.pure.u256(1n),tx.object(SUI_CLOCK)]});
    // The whole-route minimum below protects the final output. A 1-unit leg
    // minimum lets this probe investigate SDK-rejected sizes directly in Move.
    const params={tx,coinInId:bridge,coinInType:PARTNERS[path],coinOutType:TREE_TYPE,lpCoinType:pool.pool.lpCoinType,expectedCoinOutAmount:1n,slippage:0,withTransfer:false};
    output=pool.pool.daoFeePoolObject?api.Pools().daoFeePoolTradeTx({...params,daoFeePoolId:pool.pool.daoFeePoolObject.objectId}):api.Pools().tradeTx({...params,poolId:pool.pool.objectId});
  }
  // An insufficient output aborts the entire PTB at this split. Merging restores
  // the full output before transfer. No intermediate token is transferred away.
  const minimumCommand=tx.getData().commands.length;
  const [floor]=tx.splitCoins(output,[tx.pure.u64(minOutput)]);
  tx.mergeCoins(output,[floor]);
  tx.transferObjects([output],SIMULATION_SENDER);
  return {transaction:tx,minimumCommand};
}
