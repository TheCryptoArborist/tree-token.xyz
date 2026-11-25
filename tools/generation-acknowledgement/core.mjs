import {validateAcknowledgementBefore} from '../../contracts/nftree-generation/scripts/acknowledgement-state.mjs';
import {Transaction} from '@mysten/sui/transactions';
import {SENDER,CHAIN,NETWORK,check,decode} from '../generation-publication/core.mjs';
import {canonical} from '../../contracts/nftree-generation/scripts/configuration-encoding.mjs';
import {acknowledgementTransaction} from '../../contracts/nftree-generation/scripts/acknowledgement-transaction.mjs';
import {verifyAcknowledgement} from '../../contracts/nftree-generation/scripts/acknowledgement-review.mjs';
export {SENDER,CHAIN,check,responseReviewClock} from '../generation-publication/core.mjs';
export function requireSigningLocation(l){check(l.origin==='https://tree-token.xyz'&&l.pathname==='/play/generation-acknowledgement/','Use tree-token.xyz/play/generation-acknowledgement/. Signing is disabled here.');}
export async function review(p,account,now=Date.now()){
 check(account?.address.toLowerCase()===SENDER&&account.chains.includes(CHAIN),'Select your approved Sui dev wallet on mainnet.');
 check(p.schema==='tree-generation-acknowledgement-handoff-v1','Unexpected review packet.');check(now>=p.preparedAt&&now-p.preparedAt<=120000,'Review expired. Refresh before signing.');
 const bytes=decode(p.transactionBase64),tx=Transaction.from(bytes),d=tx.getData();check(d.sender===SENDER&&d.gasData.owner===SENDER&&d.gasData.budget==='50000000'&&d.gasData.payment.length===0,'Sender or gas policy changed.');
 validateAcknowledgementBefore(p.before);validateAcknowledgementBefore(p.after);
 for(const n of ['vault','oapp','channel','admin','registration','appSend','appReceive','appLibraries','appExecutor'])check(canonical(p.before.current[n])===canonical(p.after.current[n]),'State changed during review');
 check(canonical(p.before.candidate.nft)===canonical(p.after.candidate.nft),'NFT changed during review');
 const fee=BigInt(p.messageFeeMist),expected=acknowledgementTransaction('send',fee);
 check(canonical([...await tx.build({onlyTransactionKind:true})])===canonical([...await expected.build({onlyTransactionKind:true})]),'Acknowledgement commands or references changed.');
 const proof=verifyAcknowledgement(p.simulation,JSON.parse(await expected.toJSON()),p.before,p.post,fee),sim=p.simulation.Transaction;
 check(canonical(Object.values(sim.bcs))===canonical([...bytes]),'Simulation bytes differ.');
 check(proof.netGasMist===p.estimatedNetGasMist&&proof.estimatedTotalMist===p.estimatedTotalMist,'Fee estimate differs.');
 const validity=d.expiration?.ValidDuring;check(validity?.chain===NETWORK&&BigInt(validity.maxEpoch)-BigInt(validity.minEpoch)===1n,'Wrong chain or validity window.');const epoch=BigInt(sim.epoch);check(epoch>=BigInt(validity.minEpoch)&&epoch<=BigInt(validity.maxEpoch),'Simulation epoch differs.');return tx;
}
export async function signReviewed({packet,account,sign,verifySignature,now=Date.now}){const tx=await review(packet,account,now());const signed=await sign({transaction:tx,account,chain:CHAIN});check(signed.bytes===packet.transactionBase64,'Slush changed the reviewed bytes. Nothing submitted.');await review(packet,account,now());await verifySignature(decode(signed.bytes),signed.signature);await review(packet,account,now());return {bytes:decode(signed.bytes),signature:signed.signature,digest:await tx.getDigest()};}
