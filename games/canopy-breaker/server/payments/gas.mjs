import {paymentError} from './errors.mjs';
export const MAX_GAS_BUDGET=50000000n; // 0.05 SUI; never raise this for format compatibility.
export function inspectGasSettings(data,wallet){
 if(data.gasData.owner!==wallet)throw paymentError('GAS_OWNER');
 const budget=String(data.gasData.budget??'0'),payment=data.gasData.payment;
 if(!/^\d+$/.test(budget)||BigInt(budget)<=0n||BigInt(budget)>MAX_GAS_BUDGET)throw Object.assign(paymentError('GAS_BUDGET'),{gasBudgetMist:/^\d{1,20}$/.test(budget)?budget:'unknown',gasPaymentCount:Array.isArray(payment)?payment.length:0});
 if(!Array.isArray(payment))throw paymentError('GAS_MODE');
 return {budget:BigInt(budget),addressBalance:payment.length===0};
}
export async function verifyAddressBalanceGas(client,data,wallet,budget){
 const validity=data.expiration?.ValidDuring;
 if(!validity||validity.minEpoch==null||validity.maxEpoch==null||validity.minTimestamp!=null||validity.maxTimestamp!=null)throw paymentError('GAS_REPLAY');
 const min=BigInt(validity.minEpoch),max=BigInt(validity.maxEpoch);
 if(max<min||max>min+1n)throw paymentError('GAS_REPLAY');
 let config,chain,state,balance;
 try{[config,chain,state,balance]=await Promise.all([
  client.getProtocolConfig({signal:AbortSignal.timeout(20000)}),
  client.getChainIdentifier({signal:AbortSignal.timeout(20000)}),
  client.getCurrentSystemState({signal:AbortSignal.timeout(20000)}),
  client.getBalance({owner:wallet,coinType:'0x2::sui::SUI',signal:AbortSignal.timeout(20000)})
 ]);}catch(error){throw paymentError('GAS_LOOKUP',error);}
 if(config.protocolConfig?.featureFlags?.enable_address_balance_gas_payments!==true)throw paymentError('GAS_MODE');
 if(validity.chain!==chain.chainIdentifier||!/^\d+$/.test(state.systemState?.epoch??''))throw paymentError('GAS_REPLAY');
 const epoch=BigInt(state.systemState.epoch);if(epoch<min||epoch>max)throw paymentError('GAS_REPLAY');
 const available=balance.balance?.addressBalance;if(typeof available!=='string'||!/^\d+$/.test(available))throw paymentError('GAS_LOOKUP');
 if(BigInt(available)<budget)throw paymentError('GAS_BALANCE');
}
