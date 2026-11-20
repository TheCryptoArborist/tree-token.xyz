// One original NFTree #2720 release acknowledgement. All chain execution is through the user's wallet.
import {Transaction} from '@mysten/sui/transactions';
import {bcs} from '@mysten/sui/bcs';
import {toHex} from '@mysten/sui/utils';
import {encodePacked,encodeFunctionData,keccak256,concatHex,parseAbi} from 'viem';
import {C as P,newClient,verifySourceReceipts as verifyPriorReceipts} from './original-reserve-core.mjs';
import {STATE_QUERY,validateState as validatePeerState,baseline as peerBaseline,entries,canonical,json,optionsBase64} from './original-peer-state.mjs';
import {C as B,GUID as sourceGuid,PAYLOAD as sourcePayload,readSend,verifyReceipt as verifyBnbSend,createReadProvider} from './original-send-core.mjs';
import {walletRead} from '../../play/multichaintest/setup/bnb/core.js';
import fundBaseline from '../../docs/multichain/original-trial/fund-baseline.json' with {type:'json'};
import baseline from '../../docs/multichain/original-trial/ack-baseline.json' with {type:'json'};
import releaseReceipt from '../../docs/multichain/original-trial/ack-release-receipt.json' with {type:'json'};
import quoteTemplate from '../../docs/multichain/original-trial/ack-quote-unsigned.json' with {type:'json'};
import sendTemplate from '../../docs/multichain/original-trial/ack-send-unsigned.json' with {type:'json'};
export {newClient,STATE_QUERY,baseline};
const guid=keccak256(encodePacked(['uint64','uint32','bytes32','uint32','bytes32'],[2n,30378,P.package,30102,P.peer]));
export const C=Object.freeze({...P,key:'nftree-original-ack-v1-e9b1c962',guid,request:B.request,recipient:B.recipient,bnbSend:'0xa33612db18691d9805ebbc69ac24501d6e4476bd4edf2476b9b9b1710c50fe6f',release:'Ay5gtMkYp5mjYidC3TJn4YuJLKYcHLg3Yxm8qRhTy9mU',maxFeeMist:500000000n,maxGasMist:100000000n});
export const payload=concatHex(['0x0203',C.vault,C.nft,C.request,C.recipient]);
export const packet=concatHex([encodePacked(['uint8','uint64','uint32','bytes32','uint32','bytes32'],[1,2n,30378,C.package,30102,C.peer]),guid,payload]);
const check=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>check(canonical(a)===canonical(b),m),digestPattern=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const base64=h=>btoa(String.fromCharCode(...Uint8Array.from(h.slice(2).match(/../g),v=>parseInt(v,16)))),bytes=x=>x instanceof Uint8Array?x:Uint8Array.from(Object.values(x));
const norm=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='$kind'||k==='type'?undefined:['initialSharedVersion','version'].includes(k)?String(v):v));
const expectedVault=ack=>({...structuredClone(json(fundBaseline.vault)),nft:null,phase:2,announced:true,ack_sent:ack,request:{bytes:base64(C.request)},recipient:{bytes:base64(C.recipient)}});

// Keep the live authority, route, verifier and options checks. Normalize only the
// explicitly verified lifecycle changes before reusing the original route validator.
export function validateState(s,stage=undefined,{requireCustody=true}={}){
 const v=json(s.vault);check(typeof v?.ack_sent==='boolean','Missing original acknowledgement state.');
 const actual=v.ack_sent?1:0;check(stage===undefined||stage===actual,'Acknowledgement already sent or not yet reflected. Check its receipt.');
 check(s.vault?.address===C.vault,'Wrong original vault.');eq(s.vault.owner,fundBaseline.vault.owner,'Vault ownership changed.');eq(s.vault.asMoveObject?.contents?.type,fundBaseline.vault.asMoveObject.contents.type,'Wrong vault type.');
 eq(v,expectedVault(actual===1),'Only the exact released original request can be acknowledged.');
 const path=s.channelPath?.dynamicField?.value?.json,expectedPath=structuredClone(baseline.channelPath.dynamicField.value.json);
 expectedPath.outbound_nonce=actual?'2':'1';eq(path,expectedPath,'Wrong acknowledgement channel nonce or inbound release state.');
 if(requireCustody){
  check(s.nft?.address===C.nft&&s.nft.owner?.__typename==='AddressOwner'&&s.nft.owner.address?.address===C.recipient,'The released original NFT must be in the designated Sui wallet.');
  eq(s.nft.asMoveObject?.contents,fundBaseline.nft.asMoveObject.contents,'Released original NFT type or metadata changed.');
 }
 const copy=structuredClone(s);copy.vault.asMoveObject.contents.json=structuredClone(json(fundBaseline.vault));
 copy.nft=structuredClone(peerBaseline.nft);copy.channelPath.dynamicField.value.json.outbound_nonce='0';copy.channelPath.dynamicField.value.json.lazy_inbound_nonce='0';
 validatePeerState(copy,1);return s;
}
export async function readState(client,stage,{requireCustody=true}={}){
 const r=await client.query({query:STATE_QUERY,signal:AbortSignal.timeout(30000)});check(!r.errors&&r.data,'Cannot verify original release, authority and acknowledgement state.');return validateState(r.data,stage,{requireCustody});
}
export function verifyRelease(result){
 check(result?.$kind==='Transaction'&&result.Transaction?.digest===C.release&&result.Transaction.status?.success===true,'The exact Sui release receipt is not successful.');
 const t=result.Transaction;
 for(const n of ['sender','commands','inputs'])eq(norm(t.transaction?.[n]),norm(releaseReceipt.Transaction.transaction[n]),'Original executor release '+n+' differs.');
 eq(t.events?.map(e=>[e.eventType,e.json]),[
  [C.endpointPackage+'::messaging_channel::PacketDeliveredEvent',{src_eid:30102,sender:{bytes:base64(C.peer)},receiver:C.package,nonce:'1'}],
  [C.package+'::vault::Released',{vault:C.vault,request:{bytes:base64(C.request)},recipient:{bytes:base64(C.recipient)}}]
 ],'Wrong original source channel, release request or recipient.');
 const inputs=t.transaction.inputs;
 eq(Array.from(bcs.vector(bcs.u8()).parse(Uint8Array.from(atob(inputs[1].Pure.bytes),x=>x.charCodeAt(0)))),Array.from(Uint8Array.from(sourceGuid.slice(2).match(/../g),x=>parseInt(x,16))),'Wrong BNB redemption GUID.');
 eq('0x'+toHex(Uint8Array.from(bcs.vector(bcs.u8()).parse(Uint8Array.from(atob(inputs[8].Pure.bytes),x=>x.charCodeAt(0))))),sourcePayload,'Wrong original redemption payload.');
 const changed=t.effects?.changedObjects;check(Array.isArray(changed),'Missing original release effects.');
 const nft=changed.filter(x=>x.objectId===C.nft),vault=changed.filter(x=>x.objectId===C.vault);
 check(nft.length===1&&nft[0].inputState==='DoesNotExist'&&nft[0].outputState==='ObjectWrite'&&nft[0].idOperation==='None'&&nft[0].outputOwner?.AddressOwner===C.recipient&&t.objectTypes?.[C.nft]===C.nftType,'Original NFT must be unwrapped to the exact recipient.');
 check(String(nft[0].outputVersion)===String(baseline.nft.version)&&nft[0].outputDigest===baseline.nft.digest,'NFT release output differs from the independently verified original object.');
 check(vault.length===1&&vault[0].inputState==='Exists'&&vault[0].outputState==='ObjectWrite'&&vault[0].idOperation==='None'&&String(vault[0].inputOwner?.Shared?.initialSharedVersion)==='2'&&String(vault[0].outputOwner?.Shared?.initialSharedVersion)==='2','Original vault release effect differs.');
 return {status:'verified',digest:C.release,nftId:C.nft,recipient:C.recipient,request:C.request,sourceGuid};
}
export async function verifySourceReceipts(client){
 await verifyPriorReceipts(client);
 const result=await client.core.getTransaction({digest:C.release,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});
 return verifyRelease(result);
}
export async function readBnb({fetcher=fetch,provider}={}){
 // Public reads only: this Sui step never connects or sends through a BNB wallet.
 const account={request:async({method})=>{if(method==='eth_accounts')return [B.from];if(method==='eth_chainId')return '0x38';throw Error('Acknowledgement supports BNB reads only.');}};
 provider??=createReadProvider(account,{fetcher,endpoints:['https://bsc-rpc.publicnode.com','https://bsc-dataseed.bnbchain.org','https://bsc-dataseed-public.bnbchain.org']});
 const state=await readSend(provider,{source:async()=>{throw Error('Original BNB redemption has not been sent.');}});
 check(state.action==='complete'&&state.sent==='1','The original BNB redemption must already be sent.');
 const receipt=await verifyBnbSend(provider,C.bnbSend,{read:async()=>state});check(receipt.status==='verified'&&receipt.guid===sourceGuid,'Original BNB send receipt is not verified.');
 const data=encodeFunctionData({abi:parseAbi(['function delivered(bytes32) view returns (bytes32)']),functionName:'delivered',args:[guid]});
 const delivered=await walletRead(provider,{method:'eth_call',params:[{to:C.adapter,data},state.block]});
 const retired=state.passState==='4';check(delivered.toLowerCase()===(retired?keccak256(payload):'0x'+'0'.repeat(64)),'BNB retirement and exact acknowledgement payload hash disagree.');
 return {status:'verified',...state,receipt,acknowledgementHash:delivered,destinationStatus:retired?'retired':'pending'};
}
export function buildTransaction(kind,address,state,feeMist){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');validateState(state,0);check(kind==='quote'||kind==='send','Unknown acknowledgement action.');
 const d=structuredClone(kind==='quote'?quoteTemplate:sendTemplate);
 if(kind==='send'){const fee=BigInt(feeMist);check(fee>0n&&fee<=C.maxFeeMist,'Message fee exceeds the reviewed 0.5-SUI ceiling.');d.inputs[4]={Pure:{bytes:bcs.u64().serialize(fee).toBase64()}};}
 return Transaction.from(JSON.stringify(d));
}
// Exact original Vault<T>/NFT/CallCap BCS; the NFT option must remain empty.
const Nft=bcs.struct('NFT',{id:bcs.Address,number:bcs.u64(),name:bcs.string(),description:bcs.string(),image_url:bcs.string(),rarity:bcs.string()});
const Cap=bcs.struct('CallCap',{id:bcs.Address,cap_type:bcs.enum('CapType',{Individual:null,Package:bcs.Address})});
const Vault=bcs.struct('Vault',{id:bcs.Address,version:bcs.u64(),registry:bcs.Address,cap:Cap,oapp:bcs.Address,nft:bcs.option(Nft),backing:bcs.vector(bcs.u8()),route:bcs.vector(bcs.u8()),peer:bcs.vector(bcs.u8()),bound:bcs.bool(),paused:bcs.bool(),phase:bcs.u8(),announced:bcs.bool(),ack_sent:bcs.bool(),request:bcs.vector(bcs.u8()),recipient:bcs.vector(bcs.u8())});
function expectedVaultBcs(ack){const v=expectedVault(ack);v.cap.cap_type={Package:v.cap.cap_type.pos0};for(const n of ['backing','route','peer','request','recipient'])v[n]=Array.from(atob(v[n].bytes),x=>x.charCodeAt(0));return Vault.serialize(v).toBytes();}
function common(result,transaction,kind){
 check(result?.$kind==='Transaction'&&result.Transaction?.status?.success===true,'Acknowledgement '+kind+' did not succeed.');const t=result.Transaction;
 check(t.transaction?.sender===C.sender&&t.transaction.gasData?.owner===C.sender,'Wrong sender or gas owner.');for(const n of ['commands','inputs'])eq(norm(t.transaction[n]),norm(transaction.getData()[n]),'Exact acknowledgement '+n+' differ.');
 const g=t.effects?.gasUsed;check(g,'Missing gas effects.');const gross=BigInt(g.computationCost)+BigInt(g.storageCost),gas=gross-BigInt(g.storageRebate);check(gross>0n&&gross<=C.maxGasMist&&gas>=0n&&BigInt(t.transaction.gasData.budget)>0n&&BigInt(t.transaction.gasData.budget)<=C.maxGasMist,'Gas exceeds the reviewed 0.1-SUI ceiling.');
 const changes=t.effects?.changedObjects;check(Array.isArray(changes),'Missing object effects.');const gasIds=new Set([t.effects.gasObject?.objectId,...(t.transaction.gasData.payment??[]).map(x=>x.objectId)]),appIds=new Map([[C.vault,'2'],[C.oapp,'1'],[C.channel,C.channelVersion]]),writes=new Set();
 for(const x of changes){if(x.inputState==='Exists'){
  if(gasIds.has(x.objectId)){check(x.inputOwner?.AddressOwner===C.sender&&(!x.outputOwner||x.outputOwner.AddressOwner===C.sender),'Gas must belong to the dev wallet.');continue;}
  check(kind==='send','Quote must not mutate custody or security.');writes.add(x.objectId);check(x.outputState==='ObjectWrite'&&x.idOperation==='None','Unexpected acknowledgement object operation.');
  if(appIds.has(x.objectId)){check(String(x.inputOwner?.Shared?.initialSharedVersion)===appIds.get(x.objectId),'Wrong shared object.');eq(norm(x.inputOwner),norm(x.outputOwner),'Shared ownership changed.');}
  else check(x.objectId===entries.channelPath.id&&x.inputOwner?.ObjectOwner===entries.channelPath.parent&&x.outputOwner?.ObjectOwner===entries.channelPath.parent,'Unexpected existing-object mutation.');
 }else if(x.outputState==='ObjectWrite'){
  check(kind==='send'&&x.idOperation==='Created'&&/^0x0*2::coin::Coin<0x0*2::sui::SUI>$/.test(t.objectTypes?.[x.objectId]??'')&&[C.sender,C.executorPayee,C.dvnPayee].includes(x.outputOwner?.AddressOwner),'Unexpected created object, currency or recipient.');
 }else check(x.inputState==='DoesNotExist'&&x.outputOwner===null&&((x.outputState==='AccumulatorWriteV1'&&x.idOperation==='None')||(x.outputState==='DoesNotExist'&&x.idOperation==='Created')),'Unexpected additional object effect.');}
 if(kind==='send')eq([...writes].sort(),[...appIds.keys(),entries.channelPath.id].sort(),'Expected exactly vault, OApp, channel and outbound-path writes.');
 return {t,gas,gross};
}
export function verifyQuote(result,transaction){const {t,gas}=common(result,transaction,'quote');check(t.events?.length===0,'Quote must not send a packet.');const r=result.commandResults,value=i=>{const v=r?.at(i)?.returnValues?.[0]?.bcs;check(v,'Missing fee result.');return BigInt(bcs.u64().parse(bytes(v)));},fee=value(-2);check(fee>0n&&fee<=C.maxFeeMist&&value(-1)===0n,'Unsupported acknowledgement messaging fee.');check(t.balanceChanges?.length===1&&t.balanceChanges[0].address===C.sender&&/^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType)&&BigInt(t.balanceChanges[0].amount)===-gas,'Quote has unexpected balance changes.');return {feeMist:String(fee)};}
export function verifySend(result,transaction,feeMist){
 const {t,gas,gross}=common(result,transaction,'send'),fee=BigInt(feeMist);check(fee>0n&&fee<=C.maxFeeMist,'Unsupported message fee.');check(t.events?.length===3,'Exactly executor/DVN fee and packet events required.');const [ex,dv,ev]=t.events;
 check(ex.eventType===C.ulnPackage+'::send_uln::ExecutorFeePaidEvent'&&dv.eventType===C.ulnPackage+'::send_uln::DVNFeePaidEvent'&&ex.json.executor===C.executor,'Wrong fee events or executor.');eq(ex.json.guid,{bytes:base64(guid)},'Wrong executor GUID.');eq(dv.json.guid,ex.json.guid,'Wrong verifier GUID.');eq(dv.json.dvns,C.dvns,'Wrong required verifier set.');check(dv.json.fees?.length===3,'Exactly three required DVNs expected.');
 const amounts=[ex.json.fee,...dv.json.fees];check(ex.json.fee.recipient===C.executorPayee&&dv.json.fees.every(x=>x.recipient===C.dvnPayee),'Fee recipient changed.');check(amounts.every(x=>BigInt(x.fee)>=0n)&&amounts.reduce((n,x)=>n+BigInt(x.fee),0n)===fee,'Worker fees do not equal the quoted payment.');
 eq([ev.eventType,ev.json],[C.endpointPackage+'::messaging_channel::PacketSentEvent',{encoded_packet:base64(packet),options:optionsBase64,send_library:C.ulnPackage}],'Wrong packet, source identity, recipient, nonce, payload or delivery options.');
 const balances=new Map([[C.sender,-fee-gas]]);for(const x of amounts)balances.set(x.recipient,(balances.get(x.recipient)??0n)+BigInt(x.fee));check(t.balanceChanges?.length===balances.size,'Unexpected payment balances.');for(const x of t.balanceChanges){check(/^0x0*2::sui::SUI$/.test(x.coinType)&&balances.get(x.address)===BigInt(x.amount),'Unexpected payment recipient, currency or amount.');balances.delete(x.address);}check(!balances.size,'Missing payment balance.');
 if(result.commandResults){
  const refs=result.commandResults[1]?.mutatedReferences;
  check(refs?.length===2,'Expected only vault and OApp mutable references.');
  eq(Array.from(bytes(refs[0].bcs)),Array.from(expectedVaultBcs(true)),'Acknowledgement must only mark the released original vault ack_sent.');
  check('0x'+toHex(bytes(refs[1].bcs).slice(0,32))===C.oapp,'Wrong OApp mutation reference.');
 }
 return {feeMist:String(fee),gasMist:String(gas),grossGasMist:String(gross),totalMist:String(fee+gas),guid,vaultId:C.vault,nftId:C.nft,request:C.request,recipient:C.recipient};
}

const opts=()=>({doGasSelection:true,checksEnabled:true,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true,commandResults:true},signal:AbortSignal.timeout(45000)});
const stageOf=(state,bnb)=>{
 check(bnb?.status==='verified'&&['pending','retired'].includes(bnb.destinationStatus),'Original BNB route and redemption must be verified.');
 const sent=json(state.vault).ack_sent;check(sent||bnb.destinationStatus!=='retired','BNB retired before the original Sui acknowledgement.');
 return sent?(bnb.destinationStatus==='retired'?'retired':'acknowledged'):'ready';
};
export async function preflight(address,{client=newClient(),bnb=readBnb,now=Date.now}={}){
 check(address?.toLowerCase()===C.sender,'Select the Sui dev wallet ending 45c4.');const started=now();
 const [,state,bn]=await Promise.all([verifySourceReceipts(client),readState(client,undefined,{requireCustody:false}),bnb()]);
 const stage=stageOf(state,bn);if(stage!=='ready')return {stage,guid,destinationStatus:bn.destinationStatus,quotedAt:now(),releaseDigest:C.release};
 validateState(state,0);const quote=buildTransaction('quote',address,state),qr=await client.core.simulateTransaction({...opts(),transaction:Transaction.from(await quote.toJSON())}),{feeMist}=verifyQuote(qr,quote);
 const transaction=buildTransaction('send',address,state,feeMist),sr=await client.core.simulateTransaction({...opts(),transaction:Transaction.from(await transaction.toJSON())});
 check(Array.isArray(sr.commandResults)&&sr.commandResults.length===transaction.getData().commands.length,'Missing acknowledgement simulation mutation proof.');const proof=verifySend(sr,transaction,feeMist);
 await readState(client,0);check(now()>=started&&now()-started<=C.maxAge,'Fresh acknowledgement checks expired. Refresh them.');
 return {stage:'ready',transaction,...proof,destinationStatus:'pending',releaseDigest:C.release,quotedAt:started};
}
export function readStoredState(storage){
 const receipt=JSON.parse(storage.getItem(C.key)||'null'),pending=storage.getItem(C.key+'-pending');
 check(pending===null||pending==='1','Stored acknowledgement request needs review.');
 check(!receipt||(digestPattern.test(receipt.digest)&&receipt.guid===guid&&receipt.sender===C.sender&&receipt.network==='sui:mainnet'&&['wallet_reported_success','chain_verified'].includes(receipt.status)),'Stored acknowledgement receipt is invalid. Check Slush activity.');
 return {pending:pending==='1',receipt};
}
function save(storage,receipt){const value=JSON.stringify(receipt);storage.setItem(C.key,value);check(storage.getItem(C.key)===value,'Cannot save the acknowledgement receipt. Copy its digest from Slush.');storage.removeItem(C.key+'-pending');}
export async function recoverReceipt(digest,{storage,locks,client=newClient(),bnb=readBnb,now=Date.now,isCurrent=()=>true}={}){
 check(digestPattern.test(digest),'Enter the Sui acknowledgement digest from Slush.');
 const recover=async()=>{
  const before=readStoredState(storage);check(!before.receipt||before.receipt.digest===digest,'A different acknowledgement is recorded.');
  await verifySourceReceipts(client);
  const r=await client.core.getTransaction({digest,include:{effects:true,events:true,transaction:true,balanceChanges:true,objectTypes:true},signal:AbortSignal.timeout(30000)});
  check(r.Transaction?.digest===digest,'Wrong acknowledgement receipt.');const input=r.Transaction.transaction?.inputs?.[4]?.Pure?.bytes;check(input,'Missing acknowledgement fee input.');
  const fee=BigInt(bcs.u64().parse(Uint8Array.from(atob(input),x=>x.charCodeAt(0)))),transaction=buildTransaction('send',C.sender,baseline,fee),proof=verifySend(r,transaction,fee);
  const [state,bn]=await Promise.all([readState(client,1,{requireCustody:false}),bnb()]);const stage=stageOf(state,bn);
  check(stage==='acknowledged'||stage==='retired','Acknowledgement is not yet reflected.');check(isCurrent(),'Wallet changed during receipt verification.');eq(readStoredState(storage),before,'Stored acknowledgement changed during receipt verification.');
  const receipt={digest,network:'sui:mainnet',sender:C.sender,status:'chain_verified',...proof,stage,destinationStatus:bn.destinationStatus,verifiedAt:new Date(now()).toISOString()};save(storage,receipt);return receipt;
 };
 if(!locks)return recover();check(locks?.request,'Use current Brave for receipt coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{check(lock,'Another tab is checking this acknowledgement.');return recover();});
}
export async function requestAcknowledgement({storage,locks,identity,reviewed,reviewedQuote,prepare=preflight,sign,onQuote=()=>{},onReceipt=()=>{},now=Date.now}){
 check(locks?.request,'Use current Brave with Slush for acknowledgement coordination.');return locks.request(C.key,{ifAvailable:true},async lock=>{
  check(lock,'Another tab is handling this acknowledgement.');const stored=readStoredState(storage);check(!stored.pending&&!stored.receipt,'An acknowledgement is pending or recorded. Check its receipt.');
  const before=identity(),q=reviewedQuote();check(before.address?.toLowerCase()===C.sender&&before.network==='mainnet','Select the Sui dev wallet ending 45c4 on mainnet.');
  check(reviewed()&&q?.stage==='ready'&&now()>=q.quotedAt&&now()-q.quotedAt<=C.maxAge,'Simulate and review a fresh acknowledgement quote first.');
  const ready=await prepare(before.address),after=identity();check(before.address===after.address&&before.network===after.network&&before.epoch===after.epoch&&reviewed(),'Wallet or review changed.');
  check(!readStoredState(storage).pending&&!readStoredState(storage).receipt,'Another acknowledgement was recorded.');
  if(['stage','feeMist','gasMist','grossGasMist'].some(k=>ready[k]!==q[k])||now()-q.quotedAt>C.maxAge){onQuote(ready);throw Error('Acknowledgement progress, fee or gas changed. Review the refreshed quote.');}
  check(ready.stage==='ready'&&ready.guid===guid&&ready.transaction,'Acknowledgement has already been sent.');check(now()>=ready.quotedAt&&now()-ready.quotedAt<=C.maxAge,'Fresh checks expired.');
  const fee=BigInt(ready.feeMist),gross=BigInt(ready.grossGasMist),gas=BigInt(ready.gasMist);
  check(fee>0n&&fee<=C.maxFeeMist&&gross>0n&&gross<=C.maxGasMist&&gas>=0n&&gas<=gross&&BigInt(ready.totalMist)===fee+gas,'Acknowledgement fee or gas exceeds the reviewed ceilings.');
  storage.setItem(C.key+'-pending','1');check(readStoredState(storage).pending,'Cannot persist pending state.');let result;
  try{result=await sign({transaction:ready.transaction});}catch(e){if(e?.code===4001)storage.removeItem(C.key+'-pending');throw e;}
  if(result?.$kind==='FailedTransaction'){storage.removeItem(C.key+'-pending');throw Error(result.FailedTransaction?.status?.error?.message??'Acknowledgement failed on chain.');}
  check(result?.$kind==='Transaction'&&digestPattern.test(result.Transaction?.digest),'No valid digest returned. Check Slush activity before retrying.');
  const receipt={digest:result.Transaction.digest,network:'sui:mainnet',sender:C.sender,status:'wallet_reported_success',guid,feeMist:ready.feeMist,submittedAt:new Date(now()).toISOString()};save(storage,receipt);onReceipt(receipt);return receipt;
 });
}
