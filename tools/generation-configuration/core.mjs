import {Transaction} from '@mysten/sui/transactions';
import {SENDER,CHAIN,NETWORK,check,decode} from '../generation-publication/core.mjs';
import {C,buildExact,canonical} from '../../contracts/nftree-generation/scripts/configuration-encoding.mjs';
import {validateConfigState,verifyConfiguration} from '../../contracts/nftree-generation/scripts/configuration-review.mjs';
export {SENDER,CHAIN,check,responseReviewClock} from '../generation-publication/core.mjs';
export function requireSigningLocation(l){check(l.origin==='https://tree-token.xyz'&&l.pathname==='/play/generation-configuration/','Use tree-token.xyz/play/generation-configuration/. Signing is disabled here.');}
export async function review(p,account,now=Date.now()){
 check(account?.address.toLowerCase()===SENDER&&account.chains.includes(CHAIN),'Select your approved Sui dev wallet on mainnet.');check(p.schema==='tree-generation-configuration-handoff-v1','Unexpected review packet.');check(now>=p.preparedAt&&now-p.preparedAt<=120000,'Review expired. Refresh before signing.');
 const bytes=decode(p.transactionBase64),tx=Transaction.from(bytes),d=tx.getData();check(d.sender===SENDER&&d.gasData.owner===SENDER&&d.gasData.budget==='100000000'&&d.gasData.payment.length===0,'Sender or gas policy changed.');
 for(const state of [p.before,p.after]){check(state.chainIdentifier===NETWORK,'Wrong chain');validateConfigState(state);}
 for(const n of ['admin','vault','oapp','channel','registration','appLibraries','appExecutor','appSend','appReceive'])check(canonical(p.before[n])===canonical(p.after[n]),'State changed during review');
 const expected=buildExact(SENDER,p.before);check(canonical([...await tx.build({onlyTransactionKind:true})])===canonical([...await expected.build({onlyTransactionKind:true})]),'Configuration commands or references changed.');
 const proof=verifyConfiguration(p.simulation),sim=p.simulation.Transaction;check(canonical(Object.values(sim.bcs))===canonical([...bytes]),'Simulation bytes differ.');check(proof.gasMist===p.estimatedNetGasMist,'Gas estimate differs.');
 const validity=d.expiration?.ValidDuring;check(validity?.chain===NETWORK&&BigInt(validity.maxEpoch)-BigInt(validity.minEpoch)===1n,'Wrong chain or validity window.');const epoch=BigInt(sim.epoch);check(epoch>=BigInt(validity.minEpoch)&&epoch<=BigInt(validity.maxEpoch),'Simulation epoch differs.');
 check(p.candidate?.nft?.address===C.nft&&p.candidate.nft.owner?.address?.address===SENDER&&p.candidate.nft.asMoveObject.contents.type.repr===C.nftType,'Original NFT identity/ownership changed.');check(p.bnb?.purchasesPaused===true&&p.bnb.state==='Unconfirmed'&&p.bnb.generation===0&&p.bnb.canPlay===false,'BNB state changed.');return tx;
}
export async function signReviewed({packet,account,sign,verifySignature,now=Date.now}){const tx=await review(packet,account,now());const signed=await sign({transaction:tx,account,chain:CHAIN});check(signed.bytes===packet.transactionBase64,'Slush changed the reviewed bytes. Nothing submitted.');await review(packet,account,now());await verifySignature(decode(signed.bytes),signed.signature);await review(packet,account,now());return {bytes:decode(signed.bytes),signature:signed.signature,digest:await tx.getDigest()};}
