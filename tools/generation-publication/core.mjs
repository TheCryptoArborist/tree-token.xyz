import {Transaction} from '@mysten/sui/transactions';
import build from '../../docs/multichain/generation-milestone/publication-bytecode.json' with {type:'json'};
export const SENDER='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
export const CHAIN='sui:mainnet';
export const NETWORK='4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
export const check=(ok,message)=>{if(!ok)throw Error(message);};
export const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function review(packet,account,now=Date.now()){
 check(account?.address.toLowerCase()===SENDER,'Select the approved Sui dev wallet.');
 check(account.chains.includes(CHAIN),'This account does not support Sui mainnet.');
 check(packet.schema==='tree-empty-publication-wallet-handoff-v1','Unexpected review packet.');
 check(packet.upgradePolicy==='retain-new-capabilities-in-dev-wallet-for-private-pilot','Capability policy changed.');
 check(now>=packet.preparedAt&&now-packet.preparedAt<=120000,'Review expired. Refresh before signing.');
 const bytes=decode(packet.transactionBase64),tx=Transaction.from(bytes),data=tx.getData();
 const expected=new Transaction();const [cap]=expected.publish(build);expected.transferObjects([cap],expected.pure.address(SENDER));
 check(equal([...await tx.build({onlyTransactionKind:true})],[...await expected.build({onlyTransactionKind:true})]),'Publication commands changed.');
 check(data.sender===SENDER&&data.gasData.owner===SENDER&&data.gasData.budget==='100000000'&&data.gasData.payment.length===0,'Sender or gas policy changed.');
 const v=data.expiration?.ValidDuring;
 check(v?.chain===NETWORK&&BigInt(v.maxEpoch)-BigInt(v.minEpoch)===1n,'Invalid chain or validity window.');
 const sim=packet.simulation?.Transaction;
 check(sim?.status.success===true&&equal(Object.values(sim.bcs),[...bytes]),'Simulation does not match transaction bytes.');
 const n=packet.candidateObservation?.nft;
 check(n?.owner?.address?.address===SENDER,'Candidate ownership changed.');
 check(BigInt(packet.estimatedNetGasMist)>0n&&BigInt(packet.estimatedNetGasMist)<100000000n,'Gas estimate exceeds budget.');
 return tx;
}
// Callers persist the digest before submission; a reload must never start another publication.
export async function signReviewed({packet,account,sign,verifySignature,now=Date.now}){
 const tx=await review(packet,account,now());
 const signed=await sign({transaction:tx,account,chain:CHAIN});
 check(signed.bytes===packet.transactionBase64,'Slush changed the reviewed bytes. Nothing submitted.');
 await review(packet,account,now());
 await verifySignature(decode(signed.bytes),signed.signature);
 return {bytes:decode(signed.bytes),signature:signed.signature,digest:await tx.getDigest()};
}
