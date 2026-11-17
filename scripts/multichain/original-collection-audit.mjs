// Offline readiness checks only. No wallet, signing or transaction submission API.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const ORIGINAL='0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705';
export const NFT_TYPE=ORIGINAL+'::collection::NFT';
export const REVIEWED_PACKAGE='0x79459345a7abde29c4763c97c65f8f48b9e9878dc077ea7ab57c0ad7d585c736';
export const DEV='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
export const POOLS=['0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a','0xedd6b2d96968197bc121ad7bed064a43b5ad7d84cbb8b7c00d8fd78bea3e2e4d','0xed43f2ffb52ef542ea2cfccd0358431923460fec8ef659febda111614e20457a','0xfa7b71037b2a8a6bbe36b6cfbccca629f698c767aeb9dad603a0c655adf4de2a'];
const id=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v);
export function auditOriginalCollection(manifest,readiness){
 assert.equal(readiness.typeOrigin,ORIGINAL,'Wrong original collection');
 assert.equal(readiness.resolvedPackage,REVIEWED_PACKAGE,'Package changed: review before using');
 assert.equal(readiness.packageVersion,5,'Package version changed');
 assert.deepEqual([...readiness.nftAbilities].sort(),['KEY','STORE'],'NFT must support external custody');
 assert.equal(readiness.modulePaginationComplete,true,'Partial module inspection');
 assert.equal(readiness.config.asMoveObject.contents.type.repr,ORIGINAL+'::collection::MintConfig');
 assert.equal(readiness.config.asMoveObject.contents.json.admin,DEV,'Admin changed');
 assert.equal(manifest.reachedEnd,true,'Incomplete holder scan');
 assert.equal(manifest.type,NFT_TYPE,'Wrong NFT type');
 assert(manifest.records.length>0&&manifest.records.length<=5000,'Observed original inventory exceeds the 5,000 design ceiling');
 assert.equal(readiness.allPoolScanComplete,true,'Incomplete pool scan');
 const ids=new Set(),numbers=new Set(),counts={pool:0,addressOwned:0,objectOwned:0};
 for(const r of manifest.records){
  assert(id(r.id)&&!ids.has(r.id),'Duplicate, overlapping or invalid NFT ID');ids.add(r.id);
  assert(Number.isSafeInteger(r.number)&&r.number>=1&&r.number<=5000&&!numbers.has(r.number),'Invalid or duplicate original serial');numbers.add(r.number);
  assert(['pool','addressOwned','objectOwned'].includes(r.kind),'Unsupported custody class');
  if(r.kind==='pool')assert(POOLS.includes(r.owner),'Unreviewed sales pool');else assert(id(r.owner),'Unresolved owner');
  counts[r.kind]++;
 }
 const c=readiness.candidate;assert(ids.has(c.address),'Candidate is not an original inventory NFT');
 const record=manifest.records.find(r=>r.id===c.address);assert.equal(record.kind,'addressOwned');assert.equal(record.owner,DEV,'Candidate must be directly dev-owned');
 assert.equal(c.owner.address.address,DEV);assert.equal(c.asMoveObject.contents.type.repr,NFT_TYPE);
 // Inventory fingerprint only: not a Merkle root or deposit authorization.
 const allowlistSha256=createHash('sha256').update([...ids].sort().join('\n')+'\n').digest('hex');
 const unaccountedSerials=Array.from({length:5000},(_,i)=>i+1).filter(n=>!numbers.has(n));
 return {status:'single_candidate_verified_full_collection_review_pending',objects:ids.size,serials:numbers.size,...counts,unaccountedSerials,full5000Reconciled:unaccountedSerials.length===0,allowlistSha256,candidate:c.address,singleCandidateVerified:true,productionVaultDeployed:false,publicSaleEnabled:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const base=new URL('../../docs/multichain/original-collection/',import.meta.url);
 const read=n=>JSON.parse(readFileSync(new URL(n,base)));
 console.log(JSON.stringify(auditOriginalCollection(read('inventory.json'),read('onchain-readiness.json')),null,2));
}
