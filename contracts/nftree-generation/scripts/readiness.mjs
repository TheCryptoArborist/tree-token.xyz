// Simulation-only tooling. No keypair, wallet, signing or execution API.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Transaction} from '@mysten/sui/transactions';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {bcs} from '@mysten/sui/bcs';
import build from '../../../docs/multichain/generation-milestone/publication-bytecode.json' with {type:'json'};
import validation from '../../../docs/multichain/generation-milestone/validation.json' with {type:'json'};
export const C=Object.freeze({
 sender:'0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',
 nft:'0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba',
 nftType:'0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT',
 oappPackage:'0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24',
 graphql:'https://graphql.mainnet.sui.io/graphql',
 chain:'4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S', maxGasMist:200000000n,
});
const check=(condition,message)=>assert(condition,message);
const equal=(a,b,message)=>assert.deepEqual(a,b,message);
export function verifyBuild() {
 const bytes=readFileSync(new URL('../../../docs/multichain/generation-milestone/publication-bytecode.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),validation.moveReleaseBuildSha256);
 assert.equal(build.modules.length,2);
}
export function publication() {
 verifyBuild(); const tx=new Transaction(); tx.setSender(C.sender);
 const [cap]=tx.publish({modules:build.modules,dependencies:build.dependencies});
 tx.transferObjects([cap],tx.pure.address(C.sender)); return tx;
}
export function readOnlyFetch(fetcher=globalThis.fetch) {
 return async (url,options)=>{
  assert.equal(String(url),C.graphql,'Unexpected endpoint');
  assert.equal(options?.method,'POST');
  const body=JSON.parse(options.body);
  assert.equal(typeof body.query,'string');
  assert(!/\b(mutation|executeTransaction)\b/.test(body.query),'Submission is forbidden');
  assert(/^\s*(query\b|\{)/.test(body.query),'Only GraphQL queries allowed');
  return fetcher(url,options);
 };
}
export function newClient() {return new SuiGraphQLClient({network:'mainnet',url:C.graphql,fetch:readOnlyFetch()});}
export function verifyCandidate(data,now=Date.now()) {
 assert.equal(data.chainIdentifier,C.chain);
 const n=data.nft;
 assert.equal(n?.address,C.nft); assert.equal(n.owner?.__typename,'AddressOwner');
 assert.equal(n.owner.address.address,C.sender); assert.equal(n.asMoveObject?.contents?.type?.repr,C.nftType);
 assert.equal(n.asMoveObject.contents.json.number,'2720');
 assert(n.version && n.digest);
 const age=now-Date.parse(data.checkpoint.timestamp);
 assert(Number.isFinite(age)&&age>=-30000&&age<=120000,'Stale checkpoint');
}
export async function readCandidate(client) {
 const r=await client.query({query:`query { chainIdentifier checkpoint { sequenceNumber timestamp }
 nft:object(address:"${C.nft}"){address version digest owner{__typename ... on AddressOwner{address{address}}}
 asMoveObject{contents{type{repr} json}}}}`,signal:AbortSignal.timeout(20000)});
 assert(!r.errors);verifyCandidate(r.data);return r.data;
}
export function verifyPublication(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Publication did not succeed. No NFT deposit is permitted.');
 const t=result.Transaction;check(t.transaction?.sender===C.sender,'Wrong publication sender.');
 const commands=t.transaction.commands;check(commands?.length===2&&commands[0].Publish&&commands[1].TransferObjects,'Unexpected publication command.');
 equal(commands[0].Publish.modules,build.modules,'Wrong published modules.');equal(commands[0].Publish.dependencies,build.dependencies,'Wrong dependencies.');
 equal(commands[1].TransferObjects.objects.map(x=>x.NestedResult),[[0,0]],'Upgrade authority transfer changed.');
 const inputs=t.transaction.inputs;check(inputs?.length===1,'Unexpected publication inputs.');
 const target=inputs[commands[1].TransferObjects.address.Input]?.Pure?.bytes;
 check(target===btoa(String.fromCharCode(...Uint8Array.from(C.sender.slice(2).match(/../g),x=>parseInt(x,16)))),'Upgrade authority recipient changed.');
 check(t.transaction.gasData?.owner===C.sender,'Gas must be paid by the dev wallet.');
 const gasIds=new Set([t.effects?.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]);
 const changes=t.effects?.changedObjects;check(Array.isArray(changes)&&!changes.some(x=>x.objectId===C.nft),'Original NFT was unexpectedly touched.');
 const created=[];for(const x of changes){if(x.inputState==='Exists'){check(gasIds.has(x.objectId)&&x.inputOwner?.AddressOwner===C.sender,'Unexpected existing object mutation.');}else if(['ObjectWrite','PackageWrite'].includes(x.outputState)){created.push(x);}else {const transient=x.inputState==='DoesNotExist'&&x.outputState==='DoesNotExist'&&x.idOperation==='Created';const addressGas=x.inputState==='DoesNotExist'&&x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None'&&x.outputOwner===null;check(transient||addressGas,'Unexpected object effect.');}}
 check(created.length===6,'Unexpected number of created objects.');
 const typed=created.map(x=>({id:x.objectId,type:t.objectTypes?.[x.objectId],owner:x.outputOwner}));
 const packages=typed.filter(x=>x.type==='package');check(packages.length===1,'Missing new package.');const packageId=packages[0].id;
 const expected=[packageId+'::vault::Registry',packageId+'::vault::AdminCap',C.oappPackage+'::oapp::OApp',C.oappPackage+'::oapp::AdminCap','0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap'];
 for(const type of expected){const found=typed.filter(x=>x.type===type);check(found.length===1,'Created object type differs: '+type);if(type.endsWith('Cap'))check(found[0].owner?.AddressOwner===C.sender,'A capability left the dev wallet.');else check(found[0].owner?.Shared||found[0].owner?.$kind==='Shared','Expected a shared empty registry/OApp.');}
 check((t.events??[]).length===0,'Unexpected publication events.');const g=t.effects.gasUsed;check(g,'Missing gas summary.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>0n&&gas<=C.maxGasMist,'Estimated gas exceeds the reviewed 0.2-SUI limit.');
 check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Unexpected asset payment.');
 return {gasMist:String(gas),packageId,registryId:typed.find(x=>x.type===expected[0]).id,oappId:typed.find(x=>x.type===expected[2]).id,objects:typed};
}

export function nativeTypeProbe() {
 const tx=new Transaction();tx.setSender(C.sender);
 tx.moveCall({target:'0x1::type_name::with_original_ids',typeArguments:[C.nftType]});
 return tx;
}
export function verifyNativeType(result) {
 assert.equal(result.$kind,'Transaction');assert.equal(result.Transaction.status.success,true);
 const tx=result.Transaction.transaction;
 assert.equal(tx.sender,C.sender); assert.equal(tx.commands.length,1); assert.equal(tx.inputs.length,0);
 const command=tx.commands[0].MoveCall;
 assert(/^0x0*1$/.test(command?.package));assert.equal(command.module,'type_name');
 assert.equal(command.function,'with_original_ids');assert.deepEqual(command.typeArguments,[C.nftType]);
 assert.deepEqual(command.arguments,[]);
 const values=result.commandResults?.[0]?.returnValues;
 assert.equal(values?.length,1);
 const name=bcs.string().parse(Uint8Array.from(values[0].bcs));
 assert.equal(name,C.nftType.slice(2));
 assert(!result.Transaction.effects.changedObjects.some(x=>x.objectId===C.nft));
 return name;
}
export async function simulateReadiness(client=newClient()) {
 const before=await readCandidate(client);
 const include={effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,commandResults:true};
 const sim=async tx=>client.core.simulateTransaction({transaction:Transaction.from(await tx.toJSON()),doGasSelection:true,checksEnabled:true,include,signal:AbortSignal.timeout(45000)});
 const publishResult=await sim(publication());const proof=verifyPublication(publishResult);
 const nativeResult=await sim(nativeTypeProbe());const nativeRuntimeTypeName=verifyNativeType(nativeResult);
 const after=await readCandidate(client);assert.deepEqual(before.nft,after.nft,'Candidate changed during simulation');
 assert(after.checkpoint.sequenceNumber>=before.checkpoint.sequenceNumber);
 return {publishResult,nativeResult,summary:{observedAt:new Date().toISOString(),sourceCommit:'2a29a4c799d7866160fe159afc9c07a301c751ab',
  status:'unsigned_simulations_verified',...proof,nativeRuntimeTypeName,
  candidate:after.nft,startCheckpoint:before.checkpoint,endCheckpoint:after.checkpoint,
  published:false,funded:false,signingEnabled:false,governanceApproved:false,depositReady:false,
  warning:'All created IDs are ephemeral simulation output, not deployed addresses. No deposit is prepared.'}};
}
