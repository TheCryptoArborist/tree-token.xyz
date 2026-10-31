import {coinKey} from './tree-route-simulation.ts';

const canonical = (type: string) => type.replace(/0x0*([0-9a-f]+)/gi, (_match,address) => `0x${address.toLowerCase()}`);
const namedType = (type:string) => coinKey(type.startsWith('0x') ? type : `0x${type}`);
const positive = (value:unknown) => /^\d+$/.test(String(value ?? '')) && BigInt(String(value)) > 0n;

export function verifyBridgeObject(object:any, expected:{poolId:string;packageId:string;module:string;struct:string;coinIn:string;coinOut:string}) {
  const type=`${expected.packageId}::${expected.module}::${expected.struct}<${expected.coinIn},${expected.coinOut}>`;
  if (object?.objectId !== expected.poolId || canonical(object.type ?? '') !== canonical(type) || object.owner?.$kind !== 'Shared') throw new Error('bridge-identity-mismatch');
  const state=object.json;
  if (!state || state.id !== expected.poolId) throw new Error('missing-bridge-state');
  if (expected.struct === 'Pool') {
    if (namedType(state.type_x) !== coinKey(expected.coinIn) || namedType(state.type_y) !== coinKey(expected.coinOut)) throw new Error('bridge-state-coin-mismatch');
    if (![state.reserve_x,state.reserve_y,state.liquidity,state.sqrt_price].every(positive)) throw new Error('empty-v3-state');
    if (!/^\d+$/.test(String(state.swap_fee_rate)) || BigInt(state.swap_fee_rate) >= 1_000_000n) throw new Error('invalid-v3-fee');
  } else if (![state.reserve0,state.reserve1,state.balance0,state.balance1].every(positive)) throw new Error('empty-v2-state');
  return {verified:true,poolId:object.objectId,version:object.version,digest:object.digest,coinTypes:[expected.coinIn,expected.coinOut]};
}

export function verifyAftermathObject(object:any, sdkPool:any, wrapper?:any, parent?:any) {
  const state=object?.json;
  const expectedType=`0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::pool::Pool<${sdkPool.lpCoinType}>`;
  if (object?.objectId !== sdkPool.objectId || !state || state.id !== sdkPool.objectId || canonical(object.type ?? '') !== canonical(expectedType)) throw new Error('aftermath-identity-mismatch');
  if (String(state.flatness) !== String(sdkPool.flatness) || state.type_names?.length !== Object.keys(sdkPool.coins).length) throw new Error('aftermath-state-mismatch');
  const sdkCoins=new Map(Object.entries(sdkPool.coins).map(([type,value])=>[coinKey(type),value as any]));
  if (new Set(state.type_names.map(namedType)).size !== sdkCoins.size) throw new Error('aftermath-duplicate-types');
  state.type_names.forEach((type:string,index:number)=>{
    const coin=sdkCoins.get(namedType(type));
    if (!coin) throw new Error('aftermath-coin-mismatch');
    for (const [onchain,sdk] of [['normalized_balances','normalizedBalance'],['decimal_scalars','decimalsScalar'],['weights','weight'],['fees_swap_in','tradeFeeIn'],['fees_swap_out','tradeFeeOut']]) {
      if (String(state[onchain]?.[index]) !== String(coin[sdk])) throw new Error(`aftermath-${onchain}-mismatch`);
    }
    if (!positive(coin.balance) || BigInt(coin.normalizedBalance) !== BigInt(coin.balance)*BigInt(coin.decimalsScalar)) throw new Error('aftermath-reserve-mismatch');
  });
  if (sdkPool.daoFeePoolObject) {
    const dao=sdkPool.daoFeePoolObject;
    if (wrapper?.objectId !== dao.objectId || wrapper.owner?.$kind !== 'Shared' || canonical(wrapper.type ?? '') !== canonical(dao.objectType.replace(/<([0-9a-f]+::)/,'<0x$1')) || wrapper.json?.pool_id !== object.objectId || String(wrapper.json?.fee_bps) !== String(dao.feeBps) || wrapper.json?.fee_recipient !== dao.feeRecipient) throw new Error('dao-wrapper-mismatch');
    if (object.owner?.ObjectOwner !== parent?.objectId || parent?.owner?.ObjectOwner !== wrapper.objectId || parent.json?.value !== object.objectId) throw new Error('dao-ownership-mismatch');
  } else if (object.owner?.$kind !== 'Shared') throw new Error('unexpected-pool-owner');
  return {verified:true,poolId:object.objectId,version:object.version,digest:object.digest,daoFeeBps:wrapper?.json?.fee_bps ?? 0};
}

export function simulationSummary(result:any, sender:string, treeType:string, suiType:string, amountIn:bigint) {
  const transaction=result?.Transaction;
  const success=result?.$kind==='Transaction' && transaction?.effects?.status?.success===true;
  if (!success) return {success:false,error:result?.FailedTransaction?.status?.error ?? transaction?.effects?.status?.error ?? 'simulation-failed'};
  const sum=(type:string)=>(transaction.balanceChanges ?? []).filter((c:any)=>c.address===sender && coinKey(c.coinType)===coinKey(type)).reduce((total:bigint,c:any)=>total+BigInt(c.amount),0n);
  const output=sum(treeType), suiDelta=sum(suiType), gas=transaction.effects.gasUsed;
  const netGas=BigInt(gas.computationCost)+BigInt(gas.storageCost)-BigInt(gas.storageRebate);
  if (output<=0n || suiDelta !== -amountIn-netGas) throw new Error('simulation-balance-conservation-failed');
  return {success:true,amountOut:output.toString(),gasMist:netGas.toString(),gas,suiDebitMist:(-suiDelta).toString()};
}
