// Staged server-only payment primitives. Not an HTTP endpoint or a redemption authority.
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {isValidTransactionDigest} from '@mysten/sui/utils';
import {addressOf} from '../ownership.mjs';
import {TREE_PAYMENT_RECIPIENT} from './config.mjs';
export const TREE_TYPE='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const PRICES=Object.freeze({shield:3000,fertilizer:5000,storm:8000,continue:20000,'growth:2':5000,'growth:3':10000});
export function treeAmount(product,decimals){
 if(!Object.hasOwn(PRICES,product))throw Error('Unknown TREE product');
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw Error('Verified coin decimals required');
 return (BigInt(PRICES[product])*10n**BigInt(decimals)).toString();
}
function address(value){const a=addressOf(value);if(!a||/^0x0+$/.test(a))throw Error('Invalid payment address');return a;}
// Only call with an authenticated wallet and a server-owned invoice loaded from durable storage.
// expectedDigest must be bound to that invoice before execution, never copied from a claim.
export function verifyTreeReceipt(result,invoice,now=Date.now(),{allowLateRecovery=false}={}){
 if(!invoice||invoice.network!=='mainnet'||!isValidTransactionDigest(invoice.expectedDigest))throw Error('Bound Mainnet invoice required');
 const buyer=address(invoice.wallet),recipient=address(invoice.recipient);
 if(recipient!==TREE_PAYMENT_RECIPIENT)throw Error('Payment recipient is not configured for Canopy Defense');
 if(buyer===recipient)throw Error('Self-payment is not a purchase');
 if(!Number.isSafeInteger(invoice.createdAt)||!Number.isSafeInteger(invoice.expiresAt)||invoice.expiresAt<=invoice.createdAt||!Number.isSafeInteger(now)||(!allowLateRecovery&&now>=invoice.expiresAt))throw Error('Invoice expired or invalid');
 const expected=BigInt(treeAmount(invoice.product,invoice.decimals));
 const boundRecovery=allowLateRecovery&&Number.isSafeInteger(invoice.boundAt)&&invoice.boundAt>=invoice.createdAt&&invoice.boundAt<invoice.expiresAt;
 const tx=result?.$kind==='Transaction'?result.Transaction:null;
 if(!tx||tx.digest!==invoice.expectedDigest||tx.status?.success!==true||tx.effects?.status?.success!==true)throw Error('Payment did not succeed');
 if(!/^\d+$/.test(tx.checkpoint??'')||!Number.isSafeInteger(tx.timestampMs)||tx.timestampMs<invoice.createdAt||(tx.timestampMs>=invoice.expiresAt&&!boundRecovery)||tx.timestampMs>now)throw Error('Payment is not checkpointed in the invoice window');
 if(address(tx.transaction?.sender)!==buyer)throw Error('Payment wallet mismatch');
 if(!Array.isArray(tx.balanceChanges))throw Error('Payment changes unavailable');
 let credit=0n,debit=0n;
 for(const change of tx.balanceChanges){
  if(change.coinType!==TREE_TYPE)continue;
  if(typeof change.amount!=='string'||! /^-?\d+$/.test(change.amount))throw Error('Invalid chain amount');
  const owner=address(change.address),amount=BigInt(change.amount);
  if(owner===recipient)credit+=amount;
  if(owner===buyer)debit+=amount;
 }
 // Accept only the exact intended net transfer, not a swap, arbitrary bundle or unrelated credit.
 if(credit!==expected||debit!==-expected)throw Error('TREE transfer does not match the invoice');
 return Object.freeze({digest:tx.digest,wallet:buyer,recipient,coinType:TREE_TYPE,amount:expected.toString(),checkpoint:tx.checkpoint,timestampMs:tx.timestampMs});
}
export function createTreeReader(client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'})){
 if(client.network!=='mainnet')throw Error('Mainnet required');
 return Object.freeze({
  async decimals(){const {coinMetadata}=await client.getCoinMetadata({coinType:TREE_TYPE,signal:AbortSignal.timeout(20000)});if(!coinMetadata||!Number.isInteger(coinMetadata.decimals)||coinMetadata.decimals<0||coinMetadata.decimals>18)throw Error('TREE metadata unavailable');return coinMetadata.decimals;},
  async failed(invoice){
   const result=await client.getTransaction({digest:invoice.expectedDigest,include:{effects:true,transaction:true},signal:AbortSignal.timeout(20000)});
   const tx=result.$kind==='FailedTransaction'?result.FailedTransaction:null;
   return !!(tx&&tx.digest===invoice.expectedDigest&&tx.status.success===false&&tx.effects.status.success===false&&/^\d+$/.test(tx.checkpoint??'')&&addressOf(tx.transaction?.sender)===invoice.wallet);
  },
  async receipt(invoice,now=Date.now,options={}){
   // The caller supplies an invoice from its database, never a browser receipt payload.
   if(!isValidTransactionDigest(invoice?.expectedDigest))throw Error('Bound digest required');
   const result=await client.getTransaction({digest:invoice.expectedDigest,include:{effects:true,balanceChanges:true,transaction:true},signal:AbortSignal.timeout(20000)});
   return verifyTreeReceipt(result,invoice,now(),options);
  }
 });
}
