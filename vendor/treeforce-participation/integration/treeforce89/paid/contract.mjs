// Shared public checkout contract. No credentials or signing authority.
export const TREE_COIN_TYPE='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const TREE_RECIPIENT='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f';
export const PRICE='20000';
export const baseUnits=decimals=>{
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw Error('Unverified TREE decimals');
 return 20_000n*10n**BigInt(decimals);
};
export const normalizedAddress=value=>{
 if(typeof value!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(value))throw Error('Invalid Sui address');
 return '0x'+value.slice(2).toLowerCase().padStart(64,'0');
};
export function validateSnapshot(value,runId) {
 const fields=['runId','seed','score','wave','kills','perfect','maxStage','shotsFired','shotsHit','start','mode'];
 if(!value||Array.isArray(value)||Object.keys(value).length!==fields.length||
  !fields.every(k=>Object.hasOwn(value,k))||value.runId!==runId||
  !/^grove-[a-f0-9]{32}$/.test(runId)||value.mode!=='ARCADE')throw Error('Invalid interrupted run');
 for(const k of fields.filter(k=>!['runId','mode'].includes(k)))
  if(!Number.isSafeInteger(value[k])||value[k]<0)throw Error('Invalid interrupted run');
 if(value.seed>0xffffffff||value.wave>9||value.maxStage>4||value.shotsHit>value.shotsFired)
  throw Error('Invalid interrupted run');
 return Object.fromEntries(fields.map(k=>[k,value[k]]));
}
export function validateOffer(offer,wallet,runId) {
 if(!offer||offer.enabled!==true||offer.recipientConfirmed!==true||offer.wallet!==normalizedAddress(wallet)||
  offer.runId!==runId||offer.network!=='sui:mainnet'||offer.coinType!==TREE_COIN_TYPE||
  offer.recipient!==TREE_RECIPIENT||offer.price!==PRICE||offer.lives!==3||
  !/^[a-f0-9]{48}$/.test(offer.offerId)||!Number.isSafeInteger(offer.expiresAt)||
  offer.amountBaseUnits!==baseUnits(offer.decimals).toString())throw Error('Checkout could not be verified');
 return offer;
}
export function buildContinueTransaction(Transaction,offer) {
 if(typeof Transaction!=='function'||offer?.recipient!==TREE_RECIPIENT||
  offer.coinType!==TREE_COIN_TYPE||offer.amountBaseUnits!==baseUnits(offer.decimals).toString())throw Error('Invalid checkout');
 const tx=new Transaction();
 const coin=tx.coin({type:TREE_COIN_TYPE,balance:baseUnits(offer.decimals)});
 tx.transferObjects([coin],tx.pure.address(TREE_RECIPIENT));
 return tx;
}
