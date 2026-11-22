// Offline verification of immutable publication evidence plus checkpointed state reads.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import fs from 'node:fs';
import {C,verifyBuild,verifyPublication,verifyCandidate} from './readiness.mjs';
import build from '../../../docs/multichain/generation-milestone/publication-bytecode.json' with {type:'json'};
export const DIGEST='DVoQj1tPzfASPesS1bdEsEBQnQ7AhzNS4kxeuEiQVq6S';
export const PACKAGE='0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifyPublished({transaction,objects,package:packageResult,candidate}){
 verifyBuild();const proof=verifyPublication(transaction);assert.equal(transaction.Transaction.digest,DIGEST);assert.equal(proof.packageId,PACKAGE);
 assert.equal(transaction.Transaction.transaction.gasData.budget,'100000000');
 assert(!packageResult.errors&&!objects.errors);const pkg=packageResult.data.object;
 assert.equal(pkg.address,PACKAGE);assert.equal(pkg.version,1);assert.equal(pkg.previousTransaction.digest,DIGEST);
 assert.equal(pkg.asMovePackage.modules.pageInfo.hasNextPage,false);
 const modules=pkg.asMovePackage.modules.nodes;assert.deepEqual(modules.map(m=>m.name).sort(),['codec','vault']);
 // These offsets identify the zero self-address in the exact hash-pinned build.
 // Only that 32-byte substitution is allowed; every other byte must remain exact.
 const offsets={codec:220,vault:2567};const moduleEvidence=[];
 for(const m of modules){const actual=Buffer.from(m.bytes,'base64');const source=build.modules.map(x=>Buffer.from(x,'base64')).filter(x=>x.length===actual.length);assert.equal(source.length,1);const expected=Buffer.from(source[0]),offset=offsets[m.name];assert(expected.subarray(offset,offset+32).equals(Buffer.alloc(32)));Buffer.from(PACKAGE.slice(2),'hex').copy(expected,offset);assert(actual.equals(expected),'Published module differs: '+m.name);moduleEvidence.push({name:m.name,bytes:actual.length,sha256:hash(actual),selfAddressOffset:offset});}
 const data=objects.data;assert.equal(data.chainIdentifier,C.chain);
 const rows=Object.values(data).filter(x=>x&&typeof x==='object'&&x.address);assert.equal(rows.length,5);
 for(const item of proof.objects.filter(x=>x.type!=='package')){const row=rows.find(x=>x.address===item.id);assert(row);assert.equal(row.version,1);assert.equal(row.asMoveObject.contents.type.repr,item.type);if(item.type.endsWith('Cap')){assert.equal(row.owner.__typename,'AddressOwner');assert.equal(row.owner.address.address,C.sender);}else assert.equal(row.owner.__typename,'Shared');}
 const json=id=>rows.find(x=>x.address===id).asMoveObject.contents.json;
 const registry=json(proof.registryId),oapp=json(proof.oappId);
 assert.equal(registry.version,'1');assert.equal(registry.slot,null);assert.equal(registry.oapp,proof.oappId);assert.equal(registry.backing,C.nft);assert.equal(Buffer.from(registry.nft_type,'base64').toString(),C.nftType.slice(2));assert.equal(registry.cap.cap_type['@variant'],'Package');assert.equal(registry.cap.cap_type.pos0,PACKAGE);
 const admin=proof.objects.find(x=>x.type===PACKAGE+'::vault::AdminCap');assert.equal(json(admin.id).registry,proof.registryId);
 const appAdmin=proof.objects.find(x=>x.type===C.oappPackage+'::oapp::AdminCap');assert.equal(oapp.admin_cap,appAdmin.id);assert.equal(oapp.oapp_cap.cap_type.pos0,PACKAGE);assert.equal(oapp.peer.peers.size,'0');assert.equal(oapp.enforced_options.options.size,'0');assert.equal(oapp.sending_call,null);
 const upgrade=proof.objects.find(x=>x.type.endsWith('::package::UpgradeCap'));assert.equal(json(upgrade.id).package,PACKAGE);assert.equal(json(upgrade.id).version,'1');assert.equal(json(upgrade.id).policy,0);
 // Historical checkpoint verification: this does not claim saved evidence stays fresh.
 verifyCandidate(candidate,Date.parse(candidate.checkpoint.timestamp));
 return {digest:DIGEST,...proof,modules:moduleEvidence,stateCheckpoint:data.checkpoint,nftCheckpoint:candidate.checkpoint,candidate:candidate.nft,capabilitiesOwnedBy:C.sender,upgradePolicy:'compatible retained in dev wallet',emptyRegistry:true,slotCreated:false,peersConfigured:false,nftDeposited:false};
}
export function readEvidence(){const root=new URL('../../../docs/multichain/generation-milestone/published/',import.meta.url);return Object.fromEntries(['transaction','objects','package','candidate'].map(k=>[k,JSON.parse(fs.readFileSync(new URL(k+'.json',root)))]));}
if(process.argv[1]?.endsWith('/verify-published.mjs'))console.log(JSON.stringify(verifyPublished(readEvidence()),null,2));
