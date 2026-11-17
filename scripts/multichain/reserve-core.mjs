import {Transaction} from '@mysten/sui/transactions';
import {bcs} from '@mysten/sui/bcs';
import {SuiGraphQLClient} from '@mysten/sui/graphql';
import {C as B,STATE_QUERY as BIND_QUERY,content,canonical,base64} from './peer-bind-state.mjs';
import {readBnbConfiguration} from './peer-bind-core.mjs';
import templates from './reserve-templates.json' with {type:'json'};
import baseline from './reserve-baseline.json' with {type:'json'};
export {readBnbConfiguration};
export const C=Object.freeze({...B,key:'nftree-sui-reserve-v1-2f3671d4',dvns:templates.dvns,guid:templates.guid});
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m);
const fromHex=h=>Uint8Array.from(h.replace(/^0x/,'').match(/../g),x=>parseInt(x,16));
const toBase64=h=>btoa(String.fromCharCode(...fromHex(h)));
const peerQuery=`peer:address(address:"${content(baseline.oapp).peer.peers.id}"){dynamicField(name:{type:"u32",bcs:"lnUAAA=="}){value{... on MoveValue{json}}}}`;
const pathQuery=`path:address(address:"${content(baseline.channel).channels.id}"){dynamicField(name:{type:"${C.endpointPackage}::messaging_channel::ChannelKey",bcs:"${toBase64('9675000020'+C.peer.slice(2))}"}){value{... on MoveValue{json}}}}`;
export const STATE_QUERY=BIND_QUERY.slice(0,-1)+peerQuery+' '+pathQuery+'}';
export function validateState(s){
 for(const name of ['bridge','oapp','channel','endpoint','uln','bridgeAdmin','admin','registration']){
  const a=s[name],b=baseline[name];check(a?.address===b.address,'Wrong '+name+' object.');eq(a.owner,b.owner,name+' ownership changed.');eq(a.asMoveObject?.contents?.type,b.asMoveObject.contents.type,name+' type changed.');
 }
 for(const name of ['bridge','oapp','channel','bridgeAdmin','admin','registration'])eq(content(s[name]),content(baseline[name]),'Pilot '+name+' state changed. Check wallet activity before continuing.');
 check(content(s.endpoint).eid===30378,'Wrong Sui network.');
 for(const name of ['appLibraries','appSend','appReceive','appExecutor','peer','path'])eq(s[name]?.dynamicField?.value?.json,baseline[name].dynamicField.value.json,'Pilot '+name+' changed. Verify its receipt before continuing.');
}
export async function readState(fetcher=fetch){const r=await fetcher(C.graphql,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:STATE_QUERY}),signal:AbortSignal.timeout(30000)});check(r.ok,'Sui state lookup failed.');const x=await r.json();check(!x.errors&&x.data,'Sui state could not be verified.');validateState(x.data);return x.data;}
export function buildTransaction(kind,address,state,feeMist){
 check(address?.toLowerCase()===C.sender,'Connect the designated Sui dev wallet.');validateState(state);check(['quote','send'].includes(kind),'Unknown reserve action.');
 const data=structuredClone(templates[kind]);
 for(const input of data.inputs){const ref=input.Object?.ImmOrOwnedObject;if(ref?.objectId===C.admin){ref.version=String(state.admin.version);ref.digest=state.admin.digest;}}
 if(kind==='send'){const fee=BigInt(feeMist);check(fee>0n&&fee<=2000000000n,'Message fee exceeds the reviewed 2-SUI pilot ceiling.');data.inputs[templates.feeInput]={Pure:{bytes:bcs.u64().serialize(fee).toBase64()}};}
 return Transaction.from(JSON.stringify(data));
}
const normalized=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
function verifyCommon(result,transaction,kind){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Reserve '+kind+' simulation failed. No signature requested.');const t=result.Transaction,data=transaction.getData();check(t.transaction?.sender===C.sender,'Wrong simulation sender.');
 for(const name of ['commands','inputs'])eq(normalized(t.transaction[name]),normalized(data[name]),'Unexpected reserve '+name+'.');
 const g=t.effects?.gasUsed;check(g,'Missing gas estimate.');const gas=BigInt(g.computationCost)+BigInt(g.storageCost)-BigInt(g.storageRebate);check(gas>=0n&&gas<=100000000n,'Sui gas exceeds the 0.1-SUI pilot ceiling.');
 const events=t.events??[];check(events.length===(kind==='quote'?2:5),'Unexpected reserve events.');
 for(const [i,part,who,eid,count] of [[0,'send_uln','sender','dst_eid','5'],[1,'receive_uln','receiver','src_eid','20']]){
  eq([events[i].eventType,events[i].json],[C.ulnPackage+'::'+part+'::UlnConfigSetEvent',{[who]:C.package,[eid]:30102,config:{use_default_confirmations:false,use_default_required_dvns:false,use_default_optional_dvns:false,uln_config:{confirmations:count,required_dvns:C.dvns,optional_dvns:[],optional_dvn_threshold:0}}}],'Verifier correction differs from review.');
 }
 const changes=t.effects.changedObjects;check(Array.isArray(changes),'Missing object effects.');
 const configParents=['0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60','0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09'];
 const pathParent=content(baseline.channel).channels.id;
 const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData?.payment??[]).map(x=>x.objectId)]);
 for(const x of changes.filter(x=>x.inputState==='Exists')){
  if(gasIds.has(x.objectId)){check(x.inputOwner?.AddressOwner===C.sender,'Gas must belong to the dev wallet.');continue;}
  if(x.objectId===C.admin){check(x.outputOwner?.AddressOwner===C.sender,'Admin capability ownership changed.');continue;}
  if([C.uln,...(kind==='send'?[C.oapp,C.channel]:[])].includes(x.objectId)){eq(normalized(x.outputOwner),normalized(x.inputOwner),'Shared ownership changed.');continue;}
  check([...configParents,...(kind==='send'?[pathParent]:[])].includes(x.inputOwner?.ObjectOwner)&&x.outputOwner?.ObjectOwner===x.inputOwner.ObjectOwner,'Unexpected existing object mutation.');
 }
 check(!changes.some(x=>[C.bridge,C.bridgeAdmin,C.nft,C.endpoint].includes(x.objectId)),'Reserve must retain NFT custody and bridge authority.');
 return {t,gas};
}
export function verifyQuote(result,transaction){const {gas}=verifyCommon(result,transaction,'quote');const value=i=>{const v=result.commandResults?.[i]?.returnValues?.[0]?.bcs;check(v,'Missing fee quote.');return BigInt(bcs.u64().parse(v instanceof Uint8Array?v:Uint8Array.from(Object.values(v))));};const fee=value(templates.nativeIndex),zro=value(templates.zroIndex);check(zro===0n&&fee>0n&&fee<=2000000000n,'Unsupported or excessive messaging fee.');return {feeMist:String(fee),quoteGasMist:String(gas)};}
export function verifySend(result,transaction,feeMist){
 const {t,gas}=verifyCommon(result,transaction,'send'),events=t.events,fee=BigInt(feeMist),guid={bytes:base64(C.guid)};
 const ex=events[2],dv=events[3],packet=events[4];check(ex.eventType===C.ulnPackage+'::send_uln::ExecutorFeePaidEvent'&&dv.eventType===C.ulnPackage+'::send_uln::DVNFeePaidEvent','Unexpected fee events.');
 eq(ex.json.guid,guid,'Wrong executor message.');check(ex.json.executor===C.executor,'Wrong executor.');eq(dv.json.guid,guid,'Wrong verifier message.');eq(dv.json.dvns,C.dvns,'Required verifiers changed.');check(dv.json.fees?.length===4,'Missing verifier fee.');
 const amounts=[ex.json.fee,...dv.json.fees];check(amounts.every(x=>BigInt(x.fee)>=0n)&&amounts.reduce((n,x)=>n+BigInt(x.fee),0n)===fee,'Paid fees differ from quote.');
 eq([packet.eventType,packet.json],[C.endpointPackage+'::messaging_channel::PacketSentEvent',{encoded_packet:toBase64(templates.packetHex),options:toBase64(templates.optionsHex),send_library:C.ulnPackage}],'Reserve packet or delivery options changed.');
 const balances=new Map([[C.sender,-fee-gas]]);for(const a of amounts)balances.set(a.recipient,(balances.get(a.recipient)??0n)+BigInt(a.fee));
 check(t.balanceChanges?.length===balances.size,'Unexpected asset payment.');for(const x of t.balanceChanges){check(/^0x0*2::sui::SUI$/.test(x.coinType)&&balances.get(x.address)===BigInt(x.amount),'Unexpected token or recipient balance change.');balances.delete(x.address);}check(!balances.size,'Missing payment balance proof.');
 return {feeMist:String(fee),gasMist:String(gas),totalMist:String(fee+gas)};
}
export async function preflight(address,{fetcher=fetch,simulate,readBnb=readBnbConfiguration,now=Date.now}={}){
 const bnbState=await readBnb(fetcher),state=await readState(fetcher),client=simulate?null:new SuiGraphQLClient({network:'mainnet',url:C.graphql}),run=simulate??(o=>client.core.simulateTransaction(o));
 const quote=buildTransaction('quote',address,state),options={doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,commandResults:true},signal:AbortSignal.timeout(45000)};
 const quoteResult=await run({...options,transaction:Transaction.from(await quote.toJSON())}),{feeMist}=verifyQuote(quoteResult,quote),transaction=buildTransaction('send',address,state,feeMist);
 const sendResult=await run({...options,transaction:Transaction.from(await transaction.toJSON())});return {transaction,state,bnbState,quoteResult,sendResult,...verifySend(sendResult,transaction,feeMist),quotedAt:now()};
}
export function readStoredState(storage){return {pending:storage.getItem(C.key+'-pending')==='1',receipt:JSON.parse(storage.getItem(C.key)||'null')};}
export async function requestReserve({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onReceipt=()=>{},onQuote=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for safe cross-tab coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling this reserve.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'A reserve is already recorded or pending. Check wallet activity.');
  const account=identity(),quote=reviewedQuote();check(account.network==='mainnet'&&account.address?.toLowerCase()===C.sender,'Connect the designated dev wallet on Sui mainnet.');check(reviewed()&&quote,'Get a quote and review the transaction first.');
  check(now()-quote.quotedAt<=120000&&now()>=quote.quotedAt,'Quote expired. Refresh and review it again.');
  const ready=await prepare(account.address),current=identity();check(current.address===account.address&&current.network===account.network&&current.epoch===account.epoch&&reviewed(),'Wallet or review changed.');
  if(ready.feeMist!==quote.feeMist||now()-quote.quotedAt>120000){onQuote(ready);throw Error('The quote changed or expired. Review the refreshed quote before signing.');}
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another reserve is recorded.');storage.setItem(C.key+'-pending','1');check(storage.getItem(C.key+'-pending')==='1','Cannot persist pending reserve state.');let result;
  try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Reserve failed on chain.');}
  check(result?.$kind==='Transaction'&&/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(result.Transaction?.digest),'No valid submission digest returned. Check wallet activity before continuing.');
  const receipt={network:'sui:mainnet',sender:C.sender,digest:result.Transaction.digest,action:'correct_canary_and_announce_reserve',guid:C.guid,feeMist:ready.feeMist,status:'wallet_reported_success',submittedAt:new Date(now()).toISOString()};const text=JSON.stringify(receipt);storage.setItem(C.key,text);check(storage.getItem(C.key)===text,'Cannot persist reserve receipt.');storage.removeItem(C.key+'-pending');onReceipt(receipt);return receipt;
 });
}
