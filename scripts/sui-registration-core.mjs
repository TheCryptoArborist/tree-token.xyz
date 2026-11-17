import {Transaction} from '@mysten/sui/transactions';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
export const C=Object.freeze({
 sender:'0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',
 package:'0x2f3671d48dd000a27fd466fd347796149f5cd30cb16e1d22d2d89466ffc3d900',
 bridge:'0x4ae75e55799f0a4e34941503542990f1628f1b5881f0b3917bca4e255ce6b25b',
 admin:'0xf3c78dd3c49de3ddc4a783f1280a7f11e86cb202e1daa23df134adb0094fc292',
 endpoint:'0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91',
 endpointPackage:'0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac',
 registry:'0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec',
 oapp:'0x25a4c1a268dd726067558c8eddac5ef624b2507336ecec7d4ac1fd4553cbd789',
 nft:'0xc07d792d3700dea38f695d843f7eefa2e9c81efdf8aaf7da5fd151e4c58ef26c',
 graphql:'https://graphql.mainnet.sui.io/graphql', key:'nftree-sui-register-v1-2f3671d4',
});
const check=(v,m)=>{if(!v)throw Error(m);};
const content=o=>o?.asMoveObject?.contents;
export const STATE_QUERY=`query { checkpoint { sequenceNumber timestamp } ${[C.bridge,C.admin,C.endpoint].map((a,i)=>`o${i}:object(address:"${a}"){address version digest owner{__typename ... on Shared{initialSharedVersion} ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}}`).join(' ')} }`;
export async function readObjects(fetcher=fetch){
 const r=await fetcher(C.graphql,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:STATE_QUERY}),signal:AbortSignal.timeout(30000)});
 check(r.ok,'Sui state lookup failed. No wallet request was made.'); const x=await r.json();
 check(!x.errors&&x.data,'Sui state response could not be verified.');validateObjects(x.data);return x.data;
}
export function validateObjects(x){
 const b=x?.o0,a=x?.o1,e=x?.o2;
 check(b?.address===C.bridge&&content(b)?.type.repr===C.package+'::bridge::Bridge','Wrong pilot bridge.');
 check(b.owner?.__typename==='Shared'&&String(b.owner.initialSharedVersion)==='1','Wrong bridge ownership.');
 const j=content(b).json;
 check(j.cap?.cap_type?.['@variant']==='Package'&&j.cap.cap_type.pos0===C.package&&j.oapp===C.oapp&&j.nft?.id===C.nft&&!j.bound&&!j.released,'Pilot state changed; review before registration.');
 check(a?.address===C.admin&&content(a)?.type.repr===C.package+'::bridge::AdminCap'&&content(a).json.app===C.bridge&&a.owner?.address?.address===C.sender,'Dev wallet must own the matching admin capability.');
 check(e?.address===C.endpoint&&content(e)?.type.repr===C.endpointPackage+'::endpoint_v2::EndpointV2'&&e.owner?.__typename==='Shared'&&String(e.owner.initialSharedVersion)==='635685314'&&content(e).json.eid===30378&&content(e).json.oapp_registry.oapps.id===C.registry,'LayerZero endpoint identity changed.');
}
export function buildRegistration(address,x){
 check(address?.toLowerCase()===C.sender,'Connect the designated Sui dev wallet.');validateObjects(x);
 const t=new Transaction();t.setSender(C.sender);
 t.moveCall({target:C.package+'::bridge::register',arguments:[
  t.sharedObjectRef({objectId:C.bridge,initialSharedVersion:'1',mutable:false}),
  t.objectRef({objectId:C.admin,version:String(x.o1.version),digest:x.o1.digest}),
  t.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:true}),
  t.pure.vector('u8',[]),
 ]});return t;
}
export function verifySimulation(r){
 check(r?.$kind==='Transaction'&&r.Transaction?.status?.success===true,'Registration simulation failed. The application may already be registered; do not retry a previous submission.');
 const t=r.Transaction,ev=t.events?.filter(e=>e.eventType===C.endpointPackage+'::oapp_registry::OAppRegisteredEvent');
 check(ev?.length===1&&ev[0].json?.oapp===C.package&&ev[0].json.oapp_info==='','Unexpected LayerZero registration event.');
 const channel=ev[0].json.messaging_channel;
 check(/^0x[a-f0-9]{64}$/.test(channel),'Simulation did not return a messaging channel.');
 const changed=t.effects?.changedObjects;
 check(Array.isArray(changed)&&!changed.some(o=>[C.bridge,C.oapp,C.nft].includes(o.objectId)),'Registration must not change pilot custody or peer state.');
 check(changed.some(o=>o.objectId===channel&&o.idOperation==='Created'&&o.outputOwner?.$kind==='Shared'),'Missing new shared messaging channel.');
 check(changed.filter(o=>o.inputState==='Exists'&&o.objectId!==t.effects.gasObject?.objectId).every(o=>[C.admin,C.endpoint].includes(o.objectId)),'Unexpected existing object changed.');
 const g=t.effects.gasUsed,fee=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);
 check(fee>=0n&&fee<=100000000n,'Simulation fee exceeds the reviewed 0.1 SUI ceiling.');
 return {feeMist:String(fee),simulatedChannel:channel};
}
export async function preflight(address,{fetcher=fetch,simulate}={}){
 const objects=await readObjects(fetcher),transaction=buildRegistration(address,objects);
 const client=simulate?null:new SuiGraphQLClient({network:'mainnet',url:C.graphql});
 const result=await (simulate??(o=>client.core.simulateTransaction(o)))({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true},signal:AbortSignal.timeout(45000)});
 return {transaction,objects,result,...verifySimulation(result)};
}
export function readState(storage){return {pending:storage.getItem(C.key+'-pending')==='1',receipt:JSON.parse(storage.getItem(C.key)||'null')};}
export async function requestRegistration({storage,locks,identity,reviewed,prepare=preflight,sign,onReceipt=()=>{}}){
 check(locks?.request,'Use current Brave with Slush to coordinate this request safely.');
 return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling this registration.');const s=readState(storage);
  check(!s.pending&&!s.receipt,'A registration is already recorded or pending. Check wallet activity.');
  const account=identity();check(account.network==='mainnet'&&account.address?.toLowerCase()===C.sender,'Connect the designated dev wallet on Sui mainnet.');check(reviewed(),'Review the registration details first.');
  const ready=await prepare(account.address);
  const current=identity();check(current.address===account.address&&current.network===account.network&&current.epoch===account.epoch&&reviewed(),'Wallet or review changed during checks. Check the selected account and try again.');
  check(!readState(storage).pending&&!readState(storage).receipt,'Another registration is recorded.');
  storage.setItem(C.key+'-pending','1');
  let result;
  try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Registration failed on chain.');}
  check(result?.$kind==='Transaction'&&/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(result.Transaction?.digest),'Wallet returned no confirmed submission digest. Check wallet activity before continuing.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,action:'register_oapp',status:'wallet_reported_success',submittedAt:new Date().toISOString()};
  // Keep pending in place if receipt persistence fails. Never invite an ambiguous retry.
  storage.setItem(C.key,JSON.stringify(receipt));storage.removeItem(C.key+'-pending');onReceipt(receipt);return receipt;
 });
}
