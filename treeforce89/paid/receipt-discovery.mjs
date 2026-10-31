import {TREE_COIN_TYPE,TREE_RECIPIENT,normalizedAddress} from './contract.mjs';

// A lost wallet response can be recovered without copying a transaction ID.
// These public-chain candidates grant nothing: the existing authenticated
// backend independently verifies the offer, amount, checkpoint and single use.
export async function findRecentContinueReceipts({client,archivalClient,wallet,startedAt,now=Date.now()}) {
 wallet=normalizedAddress(wallet);
 const since=Number.isSafeInteger(startedAt)&&startedAt>0?startedAt-30_000:now-2*60*60*1000;
 for(const source of [client,archivalClient].filter(Boolean)){
  if(source.network!=='mainnet'||typeof source.core?.listTransactions!=='function')throw Error('Mainnet payment lookup is unavailable.');
  const candidates=[];let before;
  try{
   for(let page=0;page<2;page++){
    const result=await source.core.listTransactions({filter:{sender:wallet},order:'descending',limit:50,
     ...(before?{before}:{}),include:{transaction:true,effects:true,balanceChanges:true},signal:AbortSignal.timeout(15000)});
    let passedStart=false;
    for(const value of result.transactions){
     const tx=value.$kind==='Transaction'?value.Transaction:undefined;
     if(!tx||!Number.isSafeInteger(tx.timestampMs))continue;
     if(tx.timestampMs<since){passedStart=true;continue;}
     try{
      if(tx.status?.success!==true||tx.effects?.status?.success!==true||
       normalizedAddress(tx.transaction?.sender)!==wallet||!/^\d+$/.test(tx.checkpoint||''))continue;
      const received=(tx.balanceChanges||[]).reduce((sum,c)=>c.coinType===TREE_COIN_TYPE&&
       normalizedAddress(c.address)===TREE_RECIPIENT?sum+BigInt(c.amount):sum,0n);
      if(received>0n)candidates.push(tx.digest);
     }catch{/* Ignore malformed/unrelated rows; the server verifies actual receipts. */}
    }
    if(candidates.length>=5||passedStart||!result.hasNextPage||!result.endCursor)break;
    before=result.endCursor;
   }
   if(candidates.length)return candidates.slice(0,5);
  }catch(e){if(source===archivalClient||!archivalClient)throw e;}
 }
 return [];
}
