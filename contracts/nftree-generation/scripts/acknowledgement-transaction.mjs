// Review-only construction. No signing or submission.
import assert from 'node:assert/strict';import {Transaction} from '@mysten/sui/transactions';
import quote from '../../../docs/multichain/generation-milestone/reserve-review/quote-protocol-template.json' with {type:'json'};
import send from '../../../docs/multichain/generation-milestone/reserve-review/send-protocol-template.json' with {type:'json'};
export const MESSAGE_CAP=150000000n,GAS_CAP=50000000n;
export function acknowledgementTransaction(kind,fee=0n){
 assert(['quote','send'].includes(kind));const d=structuredClone(kind==='quote'?quote:send);d.inputs[kind==='quote'?4:5]={Pure:{bytes:'Aw=='}};
 if(kind==='send'){assert(fee>0n&&fee<=MESSAGE_CAP);d.inputs[4]={FundsWithdrawal:{reservation:{MaxAmountU64:String(fee)},typeArg:{Balance:'0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'},withdrawFrom:{Sender:true}}};d.commands[0]={MoveCall:{package:'0x0000000000000000000000000000000000000000000000000000000000000002',module:'coin',function:'redeem_funds',typeArguments:['0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'],arguments:[{Input:4}]}};}
 const tx=Transaction.from(JSON.stringify(d));tx.setGasBudget(GAS_CAP);tx.setGasPayment([]);return tx;
}
