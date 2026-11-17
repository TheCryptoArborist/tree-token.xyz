import {Transaction} from '@mysten/sui/transactions';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {C as R,STATE_QUERY} from './reserve-core.mjs';
import {content,canonical} from './peer-bind-state.mjs';
import {Uln} from './config-encoding.mjs';
import {createReadProvider,BNB_READ_ENDPOINTS} from '../../play/multichaintest/setup/bnb/configure/core.js';
import {hashHex} from '../../play/multichaintest/setup/bnb/core.js';
import {validateBnbConfiguration} from './peer-bind-core.mjs';
import bnb from '../../play/multichaintest/setup/bnb/configure/configuration.json' with {type:'json'};
import proofReads from './three-verifier-bnb-reads.json' with {type:'json'};
import baseline from './three-verifier-baseline.json' with {type:'json'};
export {STATE_QUERY};
export const C=Object.freeze({...R,key:'nftree-sui-three-verifier-v1-2f3671d4',dvns:Object.freeze(R.dvns.filter(x=>x!=='0x5ddd0e7338d03f52e98831b52ca28e09a145a0495eea80fe46c4a4b88a69278a'))});
export const READ_ENDPOINTS=Object.freeze(['https://bsc-rpc.publicnode.com',...BNB_READ_ENDPOINTS]);
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m);
const normalized=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function ulnValue(confirmations){return {use_default_confirmations:false,use_default_required_dvns:false,use_default_optional_dvns:false,uln_config:{confirmations:String(confirmations),required_dvns:[...C.dvns],optional_dvns:[],optional_dvn_threshold:0}};}
export function validateState(s,stage=0){
 check(stage===0||stage===1,'Unknown Sui recovery stage.');
 for(const name of ['bridge','oapp','channel','endpoint','uln','bridgeAdmin','admin','registration']){const a=s[name],b=baseline[name];check(a?.address===b.address,'Wrong '+name+' object.');eq(a.owner,b.owner,name+' ownership changed.');eq(a.asMoveObject?.contents?.type,b.asMoveObject.contents.type,name+' type changed.');}
 for(const name of ['bridge','oapp','channel','bridgeAdmin','admin','registration'])eq(content(s[name]),content(baseline[name]),'Pilot '+name+' changed. Check wallet activity before continuing.');
 check(content(s.endpoint).eid===30378,'Wrong Sui network.');
 for(const name of ['appLibraries','appExecutor','peer','path'])eq(s[name]?.dynamicField?.value?.json,baseline[name].dynamicField.value.json,'Pilot '+name+' changed. Do not send another message.');
 for(const [name,confirmations]of [['appSend',5],['appReceive',20]])eq(s[name]?.dynamicField?.value?.json,stage===0?baseline[name].dynamicField.value.json:ulnValue(confirmations),'Sui '+name+' differs from the reviewed recovery stage.');
}
export async function readState(fetcher=fetch,stage=0){const r=await fetcher(C.graphql,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:STATE_QUERY}),signal:AbortSignal.timeout(30000)});check(r.ok,'Sui state lookup failed.');const x=await r.json();check(!x.errors&&x.data,'Sui state could not be verified.');validateState(x.data,stage);return x.data;}
export function validateBnbPendingReserve(s){validateBnbConfiguration(s);check(s.proofs?.length===proofReads.length,'Missing BNB reserve proof checks.');for(const [i,q]of proofReads.entries())check(s.proofs[i]?.toLowerCase()===q.expected.toLowerCase(),'BNB reserve proof or delivery state changed. Verify the existing message before recovery.');}
export async function readBnbPendingReserve(fetcher=fetch){
 const reader=createReadProvider({request(){throw Error('This Sui step does not request an EVM wallet.');}},{fetcher,endpoints:READ_ENDPOINTS});
 const block=await reader.request({method:'eth_blockNumber'}),codes={};
 for(const [address,expected]of Object.entries(bnb.code)){const actual=await hashHex(await reader.request({method:'eth_getCode',params:[address,'latest']}));check(actual===expected,'BNB pilot or protocol code changed.');codes[address]=actual;}
 const values=[];for(const q of bnb.reads)values.push(await reader.request({method:'eth_call',params:[{to:q.to,data:q.data},'latest']}));validateBnbConfiguration({codes,values});
 const proofs=[];for(const q of proofReads){const value=await reader.request({method:'eth_call',params:[{to:q.to,data:q.data},'latest']});check(value?.toLowerCase()===q.expected.toLowerCase(),'BNB reserve proof or delivery state changed. Verify the existing message before recovery.');proofs.push(value);}
 const result={block,codes,values,proofs};validateBnbPendingReserve(result);return result;
}
export function buildSecurityChange(address,state){
 check(address?.toLowerCase()===C.sender,'Connect the designated Sui dev wallet.');validateState(state);const t=new Transaction();t.setSender(C.sender);
 const o=t.sharedObjectRef({objectId:C.oapp,initialSharedVersion:'1',mutable:false}),a=t.objectRef({objectId:C.admin,version:String(state.admin.version),digest:state.admin.digest}),e=t.sharedObjectRef({objectId:C.endpoint,initialSharedVersion:'635685314',mutable:false}),u=t.sharedObjectRef({objectId:C.uln,initialSharedVersion:'635685319',mutable:true});
 for(const [type,confirmations]of [[2,5],[3,20]]){const call=t.moveCall({target:C.oappPackage+'::endpoint_calls::set_config',arguments:[o,a,e,t.pure.address(C.ulnPackage),t.pure.u32(30102),t.pure.u32(type),t.pure.vector('u8',Array.from(Uln.serialize(ulnValue(confirmations)).toBytes()))]});t.moveCall({target:C.ulnPackage+'::uln_302::set_config',arguments:[u,call]});}
 return t;
}
export function verifySimulation(result,state){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Three-verifier configuration simulation failed. No signature requested.');const t=result.Transaction,expected=buildSecurityChange(C.sender,state).getData();check(t.transaction?.sender===C.sender,'Wrong simulation sender.');
 for(const name of ['commands','inputs'])eq(normalized(t.transaction?.[name]),normalized(expected[name]),'Unexpected security-change '+name+'.');
 const events=[['send_uln','sender','dst_eid',5],['receive_uln','receiver','src_eid',20]].map(([part,who,eid,count])=>[C.ulnPackage+'::'+part+'::UlnConfigSetEvent',{[who]:C.package,[eid]:30102,config:ulnValue(count)}]);eq(t.events?.map(e=>[e.eventType,e.json]),events,'Only the approved three-verifier send and receive settings may change.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing security-change effects.');
 const entries=new Map([['0xd2e53b93c8816d16bb6e7aab8fd21582b5e63419cd480441bedb23116c450ac4','0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60'],['0x8e9e56a04fb6fb65545aea4712adf7dedd750046298fbf975b4ee66957419a34','0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09']]);
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData?.payment??[]).map(x=>x.objectId)]),allowed=new Set([C.admin,C.uln,...entries.keys()]);
 for(const x of changes.filter(x=>x.inputState==='Exists')){if(gasIds.has(x.objectId)){check(x.inputOwner?.AddressOwner===C.sender,'Gas must belong to the dev wallet.');continue;}check(allowed.has(x.objectId),'Unexpected existing object mutation.');if(x.objectId===C.admin)check(x.outputOwner?.AddressOwner===C.sender,'Admin capability ownership changed.');else if(x.objectId===C.uln)check(String(x.outputOwner?.Shared?.initialSharedVersion)==='635685319','ULN shared ownership changed.');else check(x.inputOwner?.ObjectOwner===entries.get(x.objectId)&&x.outputOwner?.ObjectOwner===entries.get(x.objectId),'Configuration entry ownership changed.');}
 for(const id of allowed)check(changes.some(x=>x.objectId===id&&x.outputState==='ObjectWrite'),'Missing reviewed configuration write.');
 check(!changes.some(x=>[C.bridge,C.bridgeAdmin,C.nft,C.oapp,C.channel,C.endpoint].includes(x.objectId)),'Recovery must retain custody, peers, nonce and bridge authority.');
 check(changes.filter(x=>x.idOperation==='Created'&&x.outputOwner).every(x=>x.outputOwner.AddressOwner===C.sender&&gasIds.has(x.objectId)),'Unexpected persistent object created.');
 const g=t.effects.gasUsed,gross=BigInt(g.computationCost)+BigInt(g.storageCost),rebate=BigInt(g.storageRebate),net=gross-rebate;check(gross>0n&&gross<=100000000n&&rebate<=100000000n,'Sui gas or rebate exceeds the reviewed 0.1-SUI pilot ceiling.');
 check(t.balanceChanges?.length===1&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&t.balanceChanges[0].address===C.sender&&BigInt(t.balanceChanges[0].amount)===-net,'Unexpected token or recipient balance change.');return {grossMist:String(gross),rebateMist:String(rebate),netMist:String(net)};
}
export async function preflight(address,{fetcher=fetch,readBnb=readBnbPendingReserve,simulate}={}){
 const bnbState=await readBnb(fetcher),state=await readState(fetcher),transaction=buildSecurityChange(address,state),client=simulate?null:new SuiGraphQLClient({network:'mainnet',url:C.graphql});
 const result=await (simulate??(o=>client.core.simulateTransaction(o)))({transaction:Transaction.from(await transaction.toJSON()),doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true},signal:AbortSignal.timeout(45000)});return {transaction,state,bnbState,result,...verifySimulation(result,state)};
}
export function readStoredState(storage){return {pending:storage.getItem(C.key+'-pending')==='1',receipt:JSON.parse(storage.getItem(C.key)||'null')};}
export async function requestSecurityChange({storage,locks,identity,reviewed,prepare=preflight,sign,onReceipt=()=>{}}){
 check(locks?.request,'Use current Brave with Slush for safe cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling this security change.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'A security change is recorded or pending. Check wallet activity.');const account=identity();check(account.network==='mainnet'&&account.address?.toLowerCase()===C.sender,'Connect the designated dev wallet on Sui mainnet.');check(reviewed(),'Review the approved four-to-three verifier change first.');
 const ready=await prepare(account.address),current=identity();check(current.address===account.address&&current.network===account.network&&current.epoch===account.epoch&&reviewed(),'Wallet or review changed.');check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another configuration request is recorded.');storage.setItem(C.key+'-pending','1');check(storage.getItem(C.key+'-pending')==='1','Cannot persist pending recovery state.');let result;
 try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
 if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Security change failed on chain.');}check(result?.$kind==='Transaction'&&/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(result.Transaction?.digest),'No valid submission digest returned. Check wallet activity before continuing.');
 const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,action:'set_three_required_verifiers_both_directions',verifiers:C.dvns,status:'wallet_reported_success',submittedAt:new Date().toISOString()};const text=JSON.stringify(receipt);storage.setItem(C.key,text);check(storage.getItem(C.key)===text,'Cannot persist recovery receipt.');storage.removeItem(C.key+'-pending');onReceipt(receipt);return receipt;
 });
}
