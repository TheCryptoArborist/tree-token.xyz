import {getWallets} from '@wallet-standard/app';
import {Transaction} from '@mysten/sui/transactions';
import {SuiGrpcClient} from '@mysten/sui/grpc';
const TREE='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const RECIPIENT='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f';
const normalize=a=>typeof a==='string'&&/^0x[0-9a-f]{1,64}$/i.test(a)?'0x'+a.slice(2).toLowerCase().padStart(64,'0'):'';
export async function payForRecovery(intent,identity){
 if(intent.wallet!==identity.wallet||intent.coinType!==TREE||intent.recipient!==RECIPIENT||intent.price!=='20000'||intent.decimals!==6||intent.amountBaseUnits!=='20000000000'||Date.parse(intent.expiresAt)<=Date.now()||intent.memo!==`TREE:CHECKIN-RECOVERY:v1:${intent.id}:${intent.dateKey}`)throw Error('The recovery checkout could not be verified. Refresh before paying.');
 const matches=getWallets().get().filter(w=>w.name===identity.walletId);if(matches.length!==1)throw Error('Reconnect your original Sui wallet.');
 const wallet=matches[0],account=wallet.accounts.find(a=>normalize(a.address)===identity.wallet&&a.chains.includes('sui:mainnet'));
 if(!account)throw Error('The wallet account changed. Reconnect before paying.');
 const feature=wallet.features['sui:signAndExecuteTransaction'];if(!feature?.signAndExecuteTransaction)throw Error('This wallet cannot submit this payment. Use a supported Sui wallet.');
 const tx=new Transaction();tx.setSender(identity.wallet);
 const coin=tx.coin({type:TREE,balance:20000000000n});tx.transferObjects([coin],tx.pure.address(RECIPIENT));
 tx.moveCall({target:'0x1::string::utf8',arguments:[tx.pure.vector('u8',Array.from(new TextEncoder().encode(intent.memo)))]});
 const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
 // Resolve coin selection before wallet approval, on the same pinned mainnet client.
 const transaction={toJSON:()=>tx.toJSON({client}),serialize:()=>tx.serialize()};
 const result=await feature.signAndExecuteTransaction({transaction,account,chain:'sui:mainnet',options:{showEffects:true}});
 if(typeof result?.digest!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(result.digest))throw Error('The wallet did not return a transaction digest. Check wallet history before paying again.');
 return result.digest;
}
