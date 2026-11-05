import {Transaction} from '@mysten/sui/transactions';
const TREE='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const RECIPIENT='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f';
export async function paymentTransaction(client,invoice,wallet){
 if(client.network!=='mainnet'||invoice.wallet!==wallet||invoice.network!=='mainnet'||invoice.recipient!==RECIPIENT||!/^\d+$/.test(invoice.amount)||BigInt(invoice.amount)<=0n||invoice.expiresAt<=Date.now()||invoice.status!=='quoted')throw Error('Invalid or expired TREE checkout');
 const coins=[];let total=0n,cursor=null;const seen=new Set();
 for(let page=0;page<100;page++){
  const result=await client.listCoins({owner:wallet,coinType:TREE,limit:50,cursor});
  for(const coin of result.objects){if(seen.has(coin.objectId))throw Error('Duplicate coin data');seen.add(coin.objectId);coins.push(coin);total+=BigInt(coin.balance);if(total>=BigInt(invoice.amount))break;}
  if(total>=BigInt(invoice.amount))break;if(!result.cursor)break;if(result.cursor===cursor)throw Error('Invalid coin page');cursor=result.cursor;
 }
 if(total<BigInt(invoice.amount))throw Error('Not enough TREE in transferable coin objects. No payment was submitted.');
 if(coins.length>100)throw Error('Consolidate TREE coin objects before checkout.');
 const tx=new Transaction();tx.setSender(wallet);tx.setGasBudget(10000000);
 const main=tx.object(coins[0].objectId);if(coins.length>1)tx.mergeCoins(main,coins.slice(1).map(c=>tx.object(c.objectId)));
 const[coin]=tx.splitCoins(main,[tx.pure.u64(BigInt(invoice.amount))]);tx.transferObjects([coin],tx.pure.address(RECIPIENT));
 return tx;
}
