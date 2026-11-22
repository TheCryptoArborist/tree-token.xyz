// Unsigned, review-only packet. There is intentionally no signing or submission API.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Transaction} from '@mysten/sui/transactions';
import {C,publication,newClient,readCandidate,verifyCandidate,verifyPublication} from './readiness.mjs';
export const GAS_BUDGET=100_000_000n;
export const MAX_AGE=120_000;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function publicationTransaction() {
 const tx=publication();tx.setGasOwner(C.sender);tx.setGasBudget(GAS_BUDGET);return tx;
}
export async function verifyPacket(packet,{address,chain,now=Date.now()}={}) {
 assert.equal(address?.toLowerCase(),C.sender,'Wrong publication wallet');
 assert.equal(chain,'sui:mainnet','Wrong wallet network');
 assert.equal(packet.schema,'tree-generation-publication-review-v1');
 assert.equal(packet.purpose,'publish-empty-package-only');
 assert.equal(packet.upgradePolicy,'retain-new-capabilities-in-dev-wallet-for-private-pilot');
 assert.equal(packet.signingEnabled,false);assert.equal(packet.depositIncluded,false);
 assert.equal(packet.gasBudgetMist,String(GAS_BUDGET));
 assert(now>=packet.preparedAt && now-packet.preparedAt<=MAX_AGE,'Refresh expired publication review');
 const expected=JSON.parse(await publicationTransaction().toJSON());
 assert.deepEqual(packet.transaction,expected,'Unsigned transaction differs from reviewed publication');
 const kind=await publicationTransaction().build({onlyTransactionKind:true});
 assert.equal(packet.transactionKindBase64,Buffer.from(kind).toString('base64'));
 assert.equal(packet.transactionKindSha256,hash(kind));
 verifyCandidate(packet.candidateObservation,now);
 const proof=verifyPublication(packet.simulation);
 assert.equal(packet.simulation.Transaction.transaction.gasData.budget,String(GAS_BUDGET));
 assert.equal(packet.estimatedNetGasMist,proof.gasMist);
 assert(BigInt(proof.gasMist)<GAS_BUDGET,'Estimate leaves no room in gas budget');
 // Reconstruct only the pinned blueprint; never return caller-supplied commands.
 return publicationTransaction();
}
export async function preparePacket(client=newClient(),now=Date.now) {
 const before=await readCandidate(client);const tx=publicationTransaction();
 const transaction=JSON.parse(await tx.toJSON());
 const simulation=await client.core.simulateTransaction({transaction:Transaction.from(JSON.stringify(transaction)),doGasSelection:true,checksEnabled:true,
  include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(45000)});
 const proof=verifyPublication(simulation);
 const after=await readCandidate(client);assert.deepEqual(before.nft,after.nft,'NFT changed during publication review');
 assert(after.checkpoint.sequenceNumber>=before.checkpoint.sequenceNumber);
 const kind=await tx.build({onlyTransactionKind:true});
 const packet={schema:'tree-generation-publication-review-v1',purpose:'publish-empty-package-only',preparedAt:now(),
  upgradePolicy:'retain-new-capabilities-in-dev-wallet-for-private-pilot',signingEnabled:false,depositIncluded:false,
  gasBudgetMist:String(GAS_BUDGET),estimatedNetGasMist:proof.gasMist,
  transaction,transactionKindBase64:Buffer.from(kind).toString('base64'),transactionKindSha256:hash(kind),
  candidateObservation:after,simulation,
  warning:'Unsigned transaction-kind blueprint only; not a signed or submitted transaction. Refresh and review in the selected wallet before signing. Simulation-created IDs are not deployed bindings.'};
 await verifyPacket(packet,{address:C.sender,chain:'sui:mainnet',now:now()});return packet;
}
