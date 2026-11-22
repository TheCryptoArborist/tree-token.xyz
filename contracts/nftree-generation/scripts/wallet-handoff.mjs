// Build and simulate only. No signer or submission API is available here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Transaction} from '@mysten/sui/transactions';
import {C,newClient,readCandidate,verifyCandidate,verifyPublication} from './readiness.mjs';
import {publicationTransaction,MAX_AGE,GAS_BUDGET} from './publication-packet.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyResolvedBytes(bytes) {
 const tx=Transaction.from(bytes),data=tx.getData();
 const expected=publicationTransaction();
 assert.deepEqual(await tx.build({onlyTransactionKind:true}),await expected.build({onlyTransactionKind:true}),'Changed publication commands');
 assert.equal(data.sender,C.sender);assert.equal(data.gasData.owner,C.sender);
 assert.equal(data.gasData.budget,String(GAS_BUDGET));
 assert(BigInt(data.gasData.price)>0n,'Missing gas price');
 // No extra object can enter through gas payment. Require Sui address-balance gas.
 assert.deepEqual(data.gasData.payment,[],'Unexpected gas coin inputs');
 const validity=data.expiration?.ValidDuring;
 assert(validity,'Address-balance gas requires bounded validity');
 assert.equal(validity.chain,C.chain);
 assert.equal(BigInt(validity.maxEpoch)-BigInt(validity.minEpoch),1n);
 assert.equal(validity.minTimestamp,null);assert.equal(validity.maxTimestamp,null);
 assert(Number.isInteger(validity.nonce)&&validity.nonce>=0);
 return tx;
}
export async function verifyHandoff(packet,{address,chain,now=Date.now()}={}) {
 assert.equal(address?.toLowerCase(),C.sender);assert.equal(chain,'sui:mainnet');
 assert.equal(packet.schema,'tree-empty-publication-wallet-handoff-v1');
 assert.equal(packet.upgradePolicy,'retain-new-capabilities-in-dev-wallet-for-private-pilot');
 assert.equal(packet.authorized,false);assert.equal(packet.submitted,false);
 assert(now>=packet.preparedAt&&now-packet.preparedAt<=MAX_AGE,'Refresh expired handoff');
 const bytes=Uint8Array.from(Buffer.from(packet.transactionBase64,'base64'));
 assert.equal(hash(bytes),packet.transactionSha256);
 const tx=await verifyResolvedBytes(bytes);
 verifyCandidate(packet.candidateObservation,now);
 const proof=verifyPublication(packet.simulation);
 const epoch=BigInt(packet.simulation.Transaction.epoch);
 const validity=tx.getData().expiration.ValidDuring;
 assert(epoch>=BigInt(validity.minEpoch)&&epoch<=BigInt(validity.maxEpoch),'Simulation outside validity epochs');
 assert.equal(proof.gasMist,packet.estimatedNetGasMist);
 assert(BigInt(proof.gasMist)<GAS_BUDGET);
 // Require the simulation to refer to the same full BCS transaction.
 assert.deepEqual(Uint8Array.from(Object.values(packet.simulation.Transaction.bcs)),bytes,'Simulation bytes differ');
 return tx;
}
export async function prepareHandoff(client=newClient()) {
 const before=await readCandidate(client);
 const tx=publicationTransaction();
 // Sui supports gas from address balance; avoid selecting/merging owned coins.
 tx.setGasPayment([]);
 const bytes=await tx.build({client});await verifyResolvedBytes(bytes);
 const simulation=await client.core.simulateTransaction({transaction:bytes,doGasSelection:false,checksEnabled:true,
  include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,bcs:true},signal:AbortSignal.timeout(45000)});
 const proof=verifyPublication(simulation);
 const after=await readCandidate(client);assert.deepEqual(before.nft,after.nft,'Candidate changed');
 const packet={schema:'tree-empty-publication-wallet-handoff-v1',preparedAt:Date.now(),
  upgradePolicy:'retain-new-capabilities-in-dev-wallet-for-private-pilot',authorized:false,submitted:false,
  transactionBase64:Buffer.from(bytes).toString('base64'),transactionSha256:hash(bytes),
  estimatedNetGasMist:proof.gasMist,candidateObservation:after,simulation,
  warning:'Unsigned mainnet publication only. On-chain validity is bounded to the resolved two-epoch window; the stricter two-minute review gate is enforced by this verifier. Regenerate immediately before any separately approved wallet signature.'};
 await verifyHandoff(packet,{address:C.sender,chain:'sui:mainnet'});return packet;
}
