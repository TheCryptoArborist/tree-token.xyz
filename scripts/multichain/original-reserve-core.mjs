import {Transaction} from '@mysten/sui/transactions';
import {bcs} from '@mysten/sui/bcs';
import {encodePacked,keccak256,concatHex} from 'viem';
import {C as P,newClient,verifyReceipts as verifyPriorReceipts,verifyDeposit,validateFundState} from './original-fund-core.mjs';
import {STATE_QUERY,readBnb} from './original-peer-core.mjs';
import {entries,canonical,json,optionsBase64} from './original-peer-state.mjs';
import beforeProof from '../../docs/multichain/original-trial/fund-verified.json' with {type:'json'};
import quoteTemplate from '../../docs/multichain/original-trial/reserve-quote-unsigned.json' with {type:'json'};
import sendTemplate from '../../docs/multichain/original-trial/reserve-send-unsigned.json' with {type:'json'};
export {newClient,STATE_QUERY};
const zero='0x'+'0'.repeat(64),guid=keccak256(encodePacked(['uint64','uint32','bytes32','uint32','bytes32'],[1n,30378,P.package,30102,P.peer]));
export const C=Object.freeze({...P,key:'nftree-original-reserve-v1-8e133122',guid,maxFeeMist:500000000n,maxGasMist:100000000n,executorPayee:'0xf99b445ae678d3f28fe7acb91e5d7ee8ab538d7e231a837b12c593fb624ad630',dvnPayee:'0x9004e1e4c6dcc42d1b73269db48d510192665677fcad2079a3c7d1e9e971d34e'});
export const payload=concatHex(['0x0201',C.vault,C.nft,zero,zero]),packet=concatHex([encodePacked(['uint8','uint64','uint32','bytes32','uint32','bytes32'],[1,1n,30378,C.package,30102,C.peer]),guid,payload]);
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m),digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/,base64=h=>btoa(String.fromCharCode(...Uint8Array.from(h.slice(2).match(/../g),v=>parseInt(v,16)))),bytes=x=>x instanceof Uint8Array?x:Uint8Array.from(Object.values(x));
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
export function validateState(s,stage=0){
 check(stage===0||stage===1,'Unknown announcement stage.');check(json(s.vault)?.announced===(stage===1),'Announcement already sent or not yet reflected. Check its receipt.');
 check(s.channelPath?.dynamicField?.value?.json?.outbound_nonce===String(stage),'Unexpected announcement nonce.');
 const copy=structuredClone(s);copy.vault.asMoveObject.contents.json.announced=false;copy.channelPath.dynamicField.value.json.outbound_nonce='0';validateFundState(copy,1);return s;
}
export async function readState(client,stage=0){const r=await client.query({query:STATE_QUERY,signal:AbortSignal.timeout(30000)});check(!r.errors&&r.data,'Cannot verify NFT backing and announcement state.');return validateState(r.data,stage);}
export async function verifySourceReceipts(client){await verifyPriorReceipts(client);const digest=beforeProof.digest,r=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(r.Transaction?.digest===digest,'Wrong original deposit receipt.');verifyDeposit(r);}
export function buildTransaction(kind,address,state,feeMist){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');validateState(state,0);check(kind==='quote'||kind==='send','Unknown announcement action.');const d=structuredClone(kind==='quote'?quoteTemplate:sendTemplate);
 if(kind==='send'){const fee=BigInt(feeMist);check(fee>0n&&fee<=C.maxFeeMist,'Message fee exceeds the reviewed 0.5-SUI ceiling.');d.inputs[4]={Pure:{bytes:bcs.u64().serialize(fee).toBase64()}};}
 return Transaction.from(JSON.stringify(d));
}
function common(result,transaction,kind){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Announcement '+kind+' did not succeed.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');for(const n of ['commands','inputs'])eq(norm(t.transaction[n]),norm(transaction.getData()[n]),'Exact announcement '+n+' differ.');
 const g=t.effects?.gasUsed;check(g,'Missing gas effects.');const gross=BigInt(g.computationCost)+BigInt(g.storageCost),gas=gross-BigInt(g.storageRebate);check(gross>0n&&gross<=C.maxGasMist&&gas>=0n&&BigInt(t.transaction.gasData.budget)>0n&&BigInt(t.transaction.gasData.budget)<=C.maxGasMist,'Gas exceeds the reviewed 0.1-SUI ceiling.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing object effects.');const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]),appIds=new Map([[C.vault,'2'],[C.oapp,'1'],[C.channel,C.channelVersion]]),writes=new Set();
 for(const x of changes){if(x.inputState==='Exists'){
  if(gasIds.has(x.objectId)){check(x.inputOwner?.AddressOwner===C.sender&&(!x.outputOwner||x.outputOwner.AddressOwner===C.sender),'Gas must belong to the dev wallet.');continue;}
  check(kind==='send','Quote must not mutate custody or security.');writes.add(x.objectId);check(x.outputState==='ObjectWrite'&&x.idOperation==='None','Unexpected announcement object operation.');
  if(appIds.has(x.objectId)){check(String(x.inputOwner?.Shared?.initialSharedVersion)===appIds.get(x.objectId),'Wrong shared object.');eq(norm(x.inputOwner),norm(x.outputOwner),'Shared ownership changed.');}
  else check(x.objectId===entries.channelPath.id&&x.inputOwner?.ObjectOwner===entries.channelPath.parent&&x.outputOwner?.ObjectOwner===entries.channelPath.parent,'Unexpected existing-object mutation.');
 }else if(x.outputState==='ObjectWrite'){
  check(kind==='send'&&x.idOperation==='Created'&&/^0x0*2::coin::Coin<0x0*2::sui::SUI>$/.test(t.objectTypes?.[x.objectId]??'')&&[C.sender,C.executorPayee,C.dvnPayee].includes(x.outputOwner?.AddressOwner),'Unexpected created object, currency or recipient.');
 }else check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected additional object effect.');}
 if(kind==='send')eq([...writes].sort(),[...appIds.keys(),entries.channelPath.id].sort(),'Expected exactly vault, OApp, channel and outbound-path writes.');
 return {t,gas};
}
export function verifyQuote(result,transaction){const {t,gas}=common(result,transaction,'quote');check(t.events?.length===0,'Quote must not send a packet.');const r=result.commandResults,value=i=>{const v=r?.at(i)?.returnValues?.[0]?.bcs;check(v,'Missing fee result.');return BigInt(bcs.u64().parse(bytes(v)));},fee=value(-2);check(fee>0n&&fee<=C.maxFeeMist&&value(-1)===0n,'Unsupported announcement messaging fee.');check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Quote has unexpected balance changes.');return {feeMist:String(fee)};}
export function verifySend(result,transaction,feeMist){
 const {t,gas}=common(result,transaction,'send'),fee=BigInt(feeMist);check(fee>0n&&fee<=C.maxFeeMist,'Unsupported message fee.');check(t.events?.length===3,'Exactly executor/DVN fee and packet events required.');const [ex,dv,ev]=t.events;
 check(ex.eventType===C.ulnPackage+'::send_uln::ExecutorFeePaidEvent'&&dv.eventType===C.ulnPackage+'::send_uln::DVNFeePaidEvent'&&ex.json.executor===C.executor,'Wrong fee events or executor.');eq(ex.json.guid,{bytes:base64(guid)},'Wrong executor GUID.');eq(dv.json.guid,ex.json.guid,'Wrong verifier GUID.');eq(dv.json.dvns,C.dvns,'Wrong required verifier set.');check(dv.json.fees?.length===3,'Exactly three required DVNs expected.');
 const amounts=[ex.json.fee,...dv.json.fees];check(ex.json.fee.recipient===C.executorPayee&&dv.json.fees.every(x=>x.recipient===C.dvnPayee),'Fee recipient changed.');check(amounts.every(x=>BigInt(x.fee)>=0n)&&amounts.reduce((n,x)=>n+BigInt(x.fee),0n)===fee,'Worker fees do not equal the quoted payment.');
 eq([ev.eventType,ev.json],[C.endpointPackage+'::messaging_channel::PacketSentEvent',{encoded_packet:base64(packet),options:optionsBase64,send_library:C.ulnPackage}],'Wrong packet, source identity, recipient, nonce, payload or delivery options.');
 const balances=new Map([[C.sender,-fee-gas]]);for(const x of amounts)balances.set(x.recipient,(balances.get(x.recipient)??0n)+BigInt(x.fee));check(t.balanceChanges?.length===balances.size,'Unexpected payment balances.');for(const x of t.balanceChanges){check(/^0x0*2::sui::SUI$/.test(x.coinType)&&balances.get(x.address)===BigInt(x.amount),'Unexpected payment recipient, currency or amount.');balances.delete(x.address);}check(!balances.size,'Missing payment balance.');
 return {feeMist:String(fee),gasMist:String(gas),totalMist:String(fee+gas),guid,vaultId:C.vault,nftId:C.nft};
}
const opts=()=>({doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,commandResults:true},signal:AbortSignal.timeout(45000)});
export async function preflight(address,{client=newClient(),bnb=readBnb,now=Date.now}={}){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');await verifySourceReceipts(client);const initial=await readState(client,0),bn=await bnb(initial);check(bn?.status==='verified'&&bn.stage===4,'BNB route and paused/unminted pass must be verified.');const state=await readState(client,0),quote=buildTransaction('quote',address,state),qr=await client.core.simulateTransaction({...opts(),transaction:Transaction.from(await quote.toJSON())}),{feeMist}=verifyQuote(qr,quote),transaction=buildTransaction('send',address,state,feeMist),sr=await client.core.simulateTransaction({...opts(),transaction:Transaction.from(await transaction.toJSON())});return {transaction,...verifySend(sr,transaction,feeMist),quotedAt:now()};
}
export function readStoredState(storage){const receipt=JSON.parse(storage.getItem(C.key)||'null');check(!receipt||digestPattern.test(receipt.digest),'Stored receipt is invalid. Check Slush activity.');return {pending:storage.getItem(C.key+'-pending')==='1',receipt};}
function save(storage,r){const v=JSON.stringify(r);storage.setItem(C.key,v);check(storage.getItem(C.key)===v,'Cannot save the announcement receipt. Copy it from Slush.');storage.removeItem(C.key+'-pending');}
export async function recoverReceipt(digest,{storage,client=newClient(),now=Date.now}={}){
 check(digestPattern.test(digest),'Enter the Sui announcement digest from Slush.');const old=readStoredState(storage).receipt;check(!old||old.digest===digest,'A different announcement is recorded.');await verifySourceReceipts(client);const r=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});check(r.Transaction?.digest===digest,'Wrong announcement receipt.');const input=r.Transaction.transaction?.inputs?.[4]?.Pure?.bytes;check(input,'Missing fee input.');const fee=BigInt(bcs.u64().parse(Uint8Array.from(atob(input),x=>x.charCodeAt(0)))),transaction=buildTransaction('send',C.sender,beforeProof.currentSuiState,fee),proof=verifySend(r,transaction,fee);await readState(client,1);const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,destinationStatus:'not_yet_verified',verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
}
export async function requestAnnouncement({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for announcement coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
 check(lock,'Another tab is handling the announcement.');const s=readStoredState(storage);check(!s.pending&&!s.receipt,'An announcement is pending or recorded. Check its receipt.');const a=identity(),q=reviewedQuote();check(a.address?.toLowerCase()===C.sender&&a.network==='mainnet','Select the Sui dev wallet ending 45c4 on mainnet.');check(reviewed()&&q&&now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulate and review a fresh quote first.');
 const ready=await prepare(a.address),b=identity();check(a.address===b.address&&a.network===b.network&&a.epoch===b.epoch&&reviewed(),'Wallet or review changed.');check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another announcement was recorded.');if(ready.feeMist!==q.feeMist||ready.gasMist!==q.gasMist){onQuote(ready);throw Error('Fee or gas changed. Review the refreshed quote.');}check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired.');storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');let r;
 try{r=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}if(r?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(r.FailedTransaction?.status?.error?.message??'Announcement failed on chain.');}check(r?.$kind==='Transaction'&&digestPattern.test(r.Transaction?.digest),'No valid digest returned. Check Slush activity before retrying.');const receipt={digest:r.Transaction.digest,network:'sui:mainnet',sender:C.sender,status:'wallet_reported_success',guid,submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
