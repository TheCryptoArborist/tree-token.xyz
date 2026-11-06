import {Transaction} from '@mysten/sui/transactions';
import {verifyTransactionSignature} from '@mysten/sui/verify';
import {fromBase64,normalizeStructTag} from '@mysten/sui/utils';
import {bcs} from '@mysten/sui/bcs';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {TREE_TYPE,treeAmount} from './tree.mjs';
import {TREE_PAYMENT_RECIPIENT} from './config.mjs';
import {addressOf} from '../ownership.mjs';
import {paymentError} from './errors.mjs';
import {inspectGasSettings,verifyAddressBalanceGas} from './gas.mjs';
const signatureClient=new SuiGraphQLClient({network:'mainnet',url:'https://graphql.mainnet.sui.io/graphql'});
const index=a=>a?.$kind==='Input'?a.Input:-1;
export function createSignedInspector(client){
 if(client?.network!=='mainnet'||!client.getObjects)throw Error('Mainnet object reader required');
 return async(signed,invoice)=>{
  if(typeof signed?.bytes!=='string'||signed.bytes.length>64000||!/^[A-Za-z0-9+/]+={0,2}$/.test(signed.bytes)||typeof signed.signature!=='string'||signed.signature.length>8000)throw paymentError('SIGNED_FORMAT');
  let bytes,tx,d;try{bytes=fromBase64(signed.bytes);tx=Transaction.from(bytes);d=tx.getData();}catch(error){throw paymentError('SIGNED_FORMAT',error);}
  if(addressOf(d.sender)!==invoice.wallet||invoice.recipient!==TREE_PAYMENT_RECIPIENT||invoice.network!=='mainnet'||invoice.amount!==treeAmount(invoice.product,invoice.decimals))throw paymentError('INVOICE_MISMATCH');
  const gasSettings=inspectGasSettings({...d,gasData:{...d.gasData,owner:addressOf(d.gasData.owner)}},invoice.wallet);
  const commands=d.commands;let merge=null,splitAt=0;
  if(commands[0]?.$kind==='MergeCoins'){merge=commands[0].MergeCoins;splitAt=1;}
  if(commands.length!==splitAt+2||commands[splitAt]?.$kind!=='SplitCoins'||commands.at(-1)?.$kind!=='TransferObjects')throw paymentError('TRANSFER_COMMANDS');
  const split=commands[splitAt].SplitCoins,transfer=commands.at(-1).TransferObjects;
  const main=index(split.coin),amount=index(split.amounts?.[0]),recipient=index(transfer.address);
  const objects=[main,...(merge?.sources?.map(index)??[])];
  if(main<0||split.amounts.length!==1||amount<0||recipient<0||amount===recipient||new Set(objects).size!==objects.length||objects.some(i=>i<0)||d.inputs.length!==objects.length+2||(merge&&index(merge.destination)!==main))throw paymentError('TRANSFER_INPUTS');
  if(transfer.objects.length!==1||transfer.objects[0].$kind!=='NestedResult'||transfer.objects[0].NestedResult[0]!==splitAt||transfer.objects[0].NestedResult[1]!==0)throw paymentError('TRANSFER_RESULT');
  const amountBytes=d.inputs[amount]?.Pure?.bytes,recipientBytes=d.inputs[recipient]?.Pure?.bytes;
  if(!amountBytes||!recipientBytes||bcs.u64().parse(fromBase64(amountBytes))!==invoice.amount||addressOf(bcs.Address.parse(fromBase64(recipientBytes)))!==invoice.recipient)throw paymentError('TRANSFER_AMOUNT');
  const refs=objects.map(i=>d.inputs[i]?.Object?.ImmOrOwnedObject);
  if(refs.some(r=>!r)||refs.length>100)throw paymentError('COIN_INPUTS');
  const gas=d.gasData.payment,all=[...refs,...gas];if(new Set(all.map(r=>r.objectId)).size!==all.length)throw paymentError('COIN_INPUTS');
  try{await verifyTransactionSignature(bytes,signed.signature,{address:invoice.wallet,client:signatureClient});}catch(error){throw paymentError(/Signature is not valid|Public key bytes do not match the provided address/i.test(error.message)?'SIGNATURE_INVALID':'SIGNATURE_LOOKUP',error);}
  if(gasSettings.addressBalance)await verifyAddressBalanceGas(client,d,invoice.wallet,gasSettings.budget);
  let response;try{response=await client.getObjects({objectIds:all.map(r=>r.objectId),signal:AbortSignal.timeout(20000)});}catch(error){throw paymentError('COIN_LOOKUP',error);}
  if(response.objects.length!==all.length)throw paymentError('COIN_LOOKUP');
  for(let i=0;i<all.length;i++){
   const o=response.objects[i],ref=all[i],type=i<refs.length?`0x2::coin::Coin<${TREE_TYPE}>`:'0x2::coin::Coin<0x2::sui::SUI>';
   if(o instanceof Error||o.objectId!==ref.objectId||o.version!==ref.version||o.digest!==ref.digest||o.owner?.$kind!=='AddressOwner'||addressOf(o.owner.AddressOwner)!==invoice.wallet||normalizeStructTag(o.type)!==normalizeStructTag(type))throw paymentError('COIN_CHANGED');
  }
  return tx.getDigest();
 };
}
