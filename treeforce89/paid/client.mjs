import {validateOffer,validateSnapshot,normalizedAddress,buildContinueTransaction} from './contract.mjs';
const digestPattern=/^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const key=wallet=>'treeforce89-pending-continue:'+normalizedAddress(wallet);
const browserStorage=()=>{try{return typeof window==='undefined'?undefined:window.sessionStorage;}catch{return undefined;}};
export function loadPendingContinuation(wallet,storage=browserStorage()) {
 try{const p=JSON.parse(storage?.getItem(key(wallet))||'null');
  return p&&p.wallet===normalizedAddress(wallet)&&/^[a-f0-9]{48}$/.test(p.offerId)&&
   (!p.digest||digestPattern.test(p.digest))?p:null;
 }catch{return null;}
}
export function createPaidContinueClient({session,Transaction,signAndExecute,waitForTransaction,
 getCurrentWallet,findReceipts,fetchImpl=fetch,storage=browserStorage(),onStage=()=>{}}) {
 let busy=false;
 const current=()=>{if(getCurrentWallet()!==session.wallet)throw Error('Reconnect the wallet used for this game.');};
 const save=value=>{if(!storage)throw Error('Browser session storage is required for payment recovery.');
  storage.setItem(key(session.wallet),JSON.stringify({wallet:session.wallet,...value}));};
 const post=async(path,body)=>{
  current();const response=await fetchImpl('/play/treeforce89/api/'+path,{method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.sessionToken},
   body:JSON.stringify(body),cache:'no-store'});
  let value;try{value=await response.json();}catch{throw Error('Server response unavailable. Retry verification; do not pay again.');}
  current();if(!response.ok)throw Object.assign(Error(value.error||'Checkout unavailable.'),{code:value.code});return value;
 };
 const verify=async pending=>{
  if(!pending?.digest||!digestPattern.test(pending.digest))throw Error('Enter the transaction digest from your wallet.');
  onStage('Verifying the confirmed TREE payment…');
  const grant=await post('tree-continue',{offerId:pending.offerId,digest:pending.digest});
  if(grant.authorized!==true||grant.offerId!==pending.offerId||grant.digest!==pending.digest||grant.lives!==3||
   !Number.isSafeInteger(grant.continuationNumber)||grant.continuationNumber<1||
   grant.session?.sessionToken!==session.sessionToken||grant.session?.wallet!==session.wallet||
   grant.session?.runId!==grant.runId||grant.wave!==grant.snapshot?.wave||
   !Number.isSafeInteger(grant.session?.expiresAt)||grant.session.expiresAt<=Date.now())throw Error('Continuation authorization is invalid.');
  validateSnapshot(grant.snapshot,grant.runId);return grant;
 };
 return {
  pending:()=>loadPendingContinuation(session.wallet,storage),
  async review(snapshot){current();validateSnapshot(snapshot,session.runId);
   return validateOffer(await post('tree-continue-offer',{runId:session.runId,snapshot,lives:0}),session.wallet,session.runId);},
  async pay(offer){
   if(busy)throw Error('A continuation request is already in progress.');
   if(loadPendingContinuation(session.wallet,storage))throw Error('Recover the previous checkout before paying again.');
   validateOffer(offer,session.wallet,session.runId);current();
   if(offer.expiresAt<=Date.now())throw Error('Checkout expired. No payment was requested.');
   busy=true;
   try{
    const startedAt=Date.now();
    save({offerId:offer.offerId,startedAt});onStage('Approve 20,000 TREE in your wallet. SUI gas is separate.');
    let result;
    try{result=await signAndExecute(buildContinueTransaction(Transaction,offer));}
    catch(e){if(e?.code===4001||e?.code==='USER_REJECTED_REQUEST'||/user (?:rejected|denied)|cancelled|canceled/i.test(e?.message||'')){
      storage.removeItem(key(session.wallet));throw Error('Payment cancelled. No continuation was granted.');}throw e;}
    if(result?.$kind==='FailedTransaction'){
     storage.removeItem(key(session.wallet));throw Error('The transaction failed. No TREE continuation payment was confirmed.');}
    const digest=result?.Transaction?.digest;
    if(result?.$kind!=='Transaction'||!digestPattern.test(digest||''))throw Error('Check your wallet for a submitted transaction before retrying.');
    const pending={offerId:offer.offerId,startedAt,digest};save(pending);current();
    onStage('Payment submitted. Waiting for confirmation…');
    if(waitForTransaction)await waitForTransaction(digest);
    return await verify(pending);
   }finally{busy=false;}
  },
  async retry(digest){
   if(busy)throw Error('A continuation request is already in progress.');busy=true;
   try{const pending=loadPendingContinuation(session.wallet,storage);
    if(!pending)throw Error('No pending checkout is saved for this wallet.');
    if(digest){if(!digestPattern.test(digest))throw Error('Enter a valid Sui transaction digest.');save({...pending,digest});pending.digest=digest;}
    if(!pending.digest&&findReceipts){
     current();onStage('Finding your TREE payment…');
     const candidates=await findReceipts({wallet:session.wallet,startedAt:pending.startedAt});current();
     for(const candidate of [...new Set(candidates)].filter(d=>digestPattern.test(d)).slice(0,5)){
      try{const grant=await verify({...pending,digest:candidate});save({...pending,digest:candidate});return grant;}
      catch(e){if(!['PAYMENT_MISMATCH','PAYMENT_USED'].includes(e?.code))throw e;}
     }
     throw Error('No confirmed payment found yet. If you approved the payment, wait a moment and check again.');
    }
    return await verify(pending);
   }finally{busy=false;}
  },
  acknowledge(){current();storage?.removeItem(key(session.wallet));},
  discardUnsubmitted(){const p=loadPendingContinuation(session.wallet,storage);
   if(p?.digest)throw Error('Verify the existing payment instead of discarding it.');storage?.removeItem(key(session.wallet));},
 };
}
