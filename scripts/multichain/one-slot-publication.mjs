import {Transaction} from '@mysten/sui/transactions';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import build from '../../docs/multichain/one-slot-vault/publication-bytecode.json' with {type:'json'};
export const DEV='0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
export const NFT='0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba';
export const NFT_TYPE='0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
export const moduleHashes=build.modules.map(m=>createHash('sha256').update(Buffer.from(m,'base64')).digest('hex'));
export function publication(address=DEV){assert.equal(address,DEV,'Use the designated dev wallet');const tx=new Transaction();tx.setSender(address);const [cap]=tx.publish({modules:build.modules,dependencies:build.dependencies});tx.transferObjects([cap],tx.pure.address(address));return tx;}
export function verifyPublication(result){
 assert.equal(result.$kind,'Transaction');const t=result.Transaction;assert.equal(t.status.success,true);assert.equal(t.transaction.sender,DEV);
 const commands=t.transaction.commands;assert.equal(commands.length,2);const p=commands[0].Publish;assert(p);assert.deepEqual(p.modules,build.modules);assert.deepEqual(p.dependencies,build.dependencies);assert.deepEqual(commands[1].TransferObjects.objects.map(x=>x.NestedResult),[[0,0]]);
 const destination=t.transaction.inputs[commands[1].TransferObjects.address.Input];assert.equal(destination.Pure.bytes,Buffer.from(DEV.slice(2),'hex').toString('base64'));
 const gasIds=new Set([t.effects.gasObject?.objectId,...t.transaction.gasData.payment.map(x=>x.objectId)]);const created=[];
 for(const c of t.effects.changedObjects){if(c.inputState==='Exists'){assert(gasIds.has(c.objectId),'Unexpected existing object changed');assert.equal(c.inputOwner.AddressOwner,DEV);}else if(['ObjectWrite','PackageWrite'].includes(c.outputState))created.push(c);}
 assert(!t.effects.changedObjects.some(c=>c.objectId===NFT),'Original NFT must not be an input or effect');
 const typed=created.map(c=>({id:c.objectId,type:t.objectTypes[c.objectId],owner:c.outputOwner}));assert.equal(created.length,6);
 const packages=typed.filter(c=>c.type==='package');assert.equal(packages.length,1);const pkg=packages[0].id;
 for(const suffix of ['::vault::Registry','::vault::AdminCap'])assert.equal(typed.find(c=>c.type?.endsWith(suffix))?.type,pkg+suffix);
 for(const suffix of ['::oapp::OApp','::oapp::AdminCap'])assert.equal(typed.find(c=>c.type?.endsWith(suffix))?.type,'0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24'+suffix);
 for(const suffix of ['::vault::Registry','::vault::AdminCap','::oapp::OApp','::oapp::AdminCap','::package::UpgradeCap']){
  const found=typed.filter(c=>c.type?.endsWith(suffix));assert.equal(found.length,1,'Missing or duplicate '+suffix);if(suffix.endsWith('Cap'))assert.equal(found[0].owner.AddressOwner,DEV);else assert(found[0].owner.$kind==='Shared'||found[0].owner.Shared,'Object must be shared');
 }
 assert.equal(t.events.length,0);const g=t.effects.gasUsed,gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);assert(gas>0n&&gas<=200000000n,'Review a larger publication estimate');assert.equal(t.balanceChanges.length,1);assert.equal(t.balanceChanges[0].address,DEV);assert(/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType));assert.equal(BigInt(t.balanceChanges[0].amount),-gas);
 return {status:'unsigned_publication_simulation_verified',netGasMist:String(gas),moduleHashes,dependencies:build.dependencies,createdObjects:typed,originalNftTouched:false,published:false,funded:false,signingEnabled:false};
}
