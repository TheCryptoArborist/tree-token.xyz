import {Transaction} from '@mysten/sui/transactions';
export {SENDER,CHAIN,NETWORK,check,decode,responseReviewClock} from '../generation-publication/core.mjs';
import {SENDER,CHAIN,NETWORK,check,decode} from '../generation-publication/core.mjs';
export const PACKAGE='0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92';
export const REGISTRY='0x298204d60d1a886e72f1ece18de179065d487a76420f93b19bf7f61c7275c210';
export const ADMIN='0x4e7fde0fa22d78a2916f7ea8d2e7d4688d04ee4c60152d8a09d4a334e89f6aac';
export const NFT='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
export const TYPE='0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
export function requireSigningLocation(location){check(location.origin==='https://tree-token.xyz'&&location.pathname==='/play/generation-slot/','Use the approved tree-token.xyz/play/generation-slot/ page. Signing is disabled here.');}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function review(packet,account,now=Date.now()){
 check(account?.address.toLowerCase()===SENDER&&account.chains.includes(CHAIN),'Select your approved Sui dev wallet on mainnet.');
 check(packet.schema==='tree-empty-slot-wallet-handoff-v1','Unexpected review packet.');
 check(now>=packet.preparedAt&&now-packet.preparedAt<=120000,'Review expired. Refresh before signing.');
 const bytes=decode(packet.transactionBase64),tx=Transaction.from(bytes),data=tx.getData();
 check(data.sender===SENDER&&data.gasData.owner===SENDER&&data.gasData.budget==='20000000'&&data.gasData.payment.length===0,'Sender or gas policy changed.');
 check(data.inputs.length===2&&data.commands.length===1,'Unexpected commands or inputs.');
 const registry=data.inputs[0].Object?.SharedObject,admin=data.inputs[1].Object?.ImmOrOwnedObject;
 check(registry?.objectId===REGISTRY&&registry.initialSharedVersion==='1'&&registry.mutable===true,'Registry changed.');
 check(admin?.objectId===ADMIN&&admin.version==='1'&&admin.digest==='CXYbjFxRkbB7SDn82yNUgTdRGbjvNPpE8dBsyq13genK','Admin reference changed.');
 const expected=new Transaction();expected.moveCall({target:PACKAGE+'::vault::create_slot',typeArguments:[TYPE],arguments:[expected.sharedObjectRef(registry),expected.objectRef(admin)]});
 check(equal([...await tx.build({onlyTransactionKind:true})],[...await expected.build({onlyTransactionKind:true})]),'Slot commands changed.');
 const validity=data.expiration?.ValidDuring;
 check(validity?.chain===NETWORK&&BigInt(validity.maxEpoch)-BigInt(validity.minEpoch)===1n,'Wrong chain or validity window.');
 const sim=packet.simulation?.Transaction;check(sim?.status.success===true&&equal(Object.values(sim.bcs),[...bytes]),'Simulation bytes differ.');
 const epoch=BigInt(sim.epoch);check(epoch>=BigInt(validity.minEpoch)&&epoch<=BigInt(validity.maxEpoch),'Simulation epoch differs.');
 const n=packet.after?.candidate?.nft;check(n?.address===NFT&&n?.owner?.address?.address===SENDER&&n?.asMoveObject?.contents?.type?.repr===TYPE,'Original identity or ownership changed.');
 check(packet.after?.objects?.data?.o1?.asMoveObject?.contents?.json?.slot===null,'Slot already exists.');
 check(BigInt(packet.estimatedNetGasMist)>0n&&BigInt(packet.estimatedNetGasMist)<20000000n,'Gas estimate exceeds budget.');
 return tx;
}
export async function signReviewed({packet,account,sign,verifySignature,now=Date.now}){
 const tx=await review(packet,account,now());const signed=await sign({transaction:tx,account,chain:CHAIN});
 check(signed.bytes===packet.transactionBase64,'Slush changed the reviewed bytes. Nothing submitted.');
 await review(packet,account,now());await verifySignature(decode(signed.bytes),signed.signature);await review(packet,account,now());
 return {bytes:decode(signed.bytes),signature:signed.signature,digest:await tx.getDigest()};
}
