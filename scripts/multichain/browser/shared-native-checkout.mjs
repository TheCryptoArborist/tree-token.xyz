// Separate opt-in Sui checkout adapter. Existing legacy checkout is untouched.
import {validateOffer,validateSnapshot,buildContinueTransaction,normalizedAddress} from '../../../docs/multichain/generation-milestone/native-sui-payments/upstream/contract.mjs';
export function createSharedNativeCheckout({getSession,transport,Transaction,signAndExecute,storage,legacyStorage,locks}){
 if(![getSession,signAndExecute].every(f=>typeof f==='function')||!storage?.setItem||!storage?.getItem||!legacyStorage?.getItem||!locks?.request)throw Error('durable-checkout-adapters-required');
 const actor=()=>{const s=getSession();if(!s||!s.wallet||!s.nativeRunId)throw Error('session-required');return {...s,wallet:normalizedAddress(s.wallet)};};
 const key=s=>'tree-shared-native-checkout.v1:'+s.wallet;
 const digestValid=v=>typeof v==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(v);
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
 const legacy=s=>legacyStorage.getItem('treeforce89-pending-continue:'+s.wallet)!==null||storage.getItem('treeforce89-pending-continue:'+s.wallet)!==null;
 const load=s=>{const p=JSON.parse(storage.getItem(key(s))||'null');if(!p||!/^grove-[a-f0-9]{32}$/.test(p.nativeRunId||'')||!/^[a-f0-9]{48}$/.test(p.offerId||'')||(p.digest&&!digestValid(p.digest))||(p.paymentId&&!uuid(p.paymentId)))throw Error('receipt-review-required');return p;};
 const same=s=>{const n=actor();if(['wallet','nativeRunId','sessionToken','epoch'].some(k=>n[k]!==s[k]))throw Error('session-changed-review-required');};
 const save=(s,value)=>{const text=JSON.stringify(value);storage.setItem(key(s),text);if(storage.getItem(key(s))!==text)throw Error('durable-checkout-required');};
 const record=async(s,p)=>{same(s);const r=await transport.record({offerId:p.offerId,digest:p.digest});same(s);if(r.status!=='recorded'||r.offerId!==p.offerId||r.digest!==p.digest||r.restoreAuthorized!==false||!uuid(r.paymentId))throw Error('payment-review-required');save(s,{...p,paymentId:r.paymentId,status:'recorded'});return r;};
 return Object.freeze({
  pending(){try{const s=actor();if(legacy(s))return {kind:'legacy',canPay:false};if(storage.getItem(key(s))===null)return {kind:'none',canPay:true};const p=load(s);return {kind:'shared',canPay:false,hasDigest:!!p.digest,canRecover:!!p.paymentId,cancellationReported:p.status==='cancellation-reported'};}catch{return {kind:'review',canPay:false};}},
  async review(snapshot){const s=actor();validateSnapshot(snapshot,s.nativeRunId);const offer=await transport.offer({runId:s.nativeRunId,snapshot,lives:0});same(s);return validateOffer(offer,s.wallet,s.nativeRunId);},
  async pay(offer){const s=actor();return locks.request(key(s),{mode:'exclusive'},async()=>{
   same(s);if(storage.getItem(key(s))!==null||legacy(s))throw Error('recover-existing-payment');
   validateOffer(offer,s.wallet,s.nativeRunId);if(offer.expiresAt<=Date.now())throw Error('offer-expired');
   const pending={offerId:offer.offerId,nativeRunId:s.nativeRunId,status:'signing'};save(s,pending);
   // Even an uncertain/rejected signing result keeps the marker. No silent
   // discard or automatic re-signing; reconciliation is a separate user action.
   let result;try{result=await signAndExecute(buildContinueTransaction(Transaction,offer));}catch(error){if(error?.code===4001||error?.code==='USER_REJECTED_REQUEST')save(s,{...pending,status:'cancellation-reported'});throw error;}
   const digest=result?.Transaction?.digest;
   if(result?.$kind!=='Transaction'||!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(digest||''))throw Error('payment-review-required');
   save(s,{...pending,digest,status:'submitted'});return record(s,{...pending,digest});
  });},
  async reconcile({digest}={}){const s=actor();return locks.request(key(s),{mode:'exclusive'},async()=>{
   same(s);if(legacy(s))throw Error('legacy-payment-review-required');const p=load(s);
   if(digest!==undefined&&(!digestValid(digest)||(p.digest&&p.digest!==digest)))throw Error('receipt-review-required');
   const candidate=p.digest||digest;if(!candidate)throw Error('receipt-review-required');
   // A manually entered digest is saved only after server verification. A typo
   // never replaces a known digest or clears the original signing marker.
   return record(s,{...p,digest:candidate});
  });},
  async archiveCompleted(){const s=actor();return locks.request(key(s),{mode:'exclusive'},async()=>{
   same(s);if(legacy(s))throw Error('legacy-payment-review-required');const original=storage.getItem(key(s)),p=load(s);
   if(!uuid(p.paymentId)||!p.digest)throw Error('receipt-review-required');
   const r=await transport.complete({paymentId:p.paymentId});same(s);
   if(r?.status!=='completed'||r.archiveAllowed!==true||r.restoreAuthorized!==false||r.requiresPayment!==false||r.paymentId!==p.paymentId||r.offerId!==p.offerId||r.digest!==p.digest||r.nativeRunId!==p.nativeRunId)throw Error('completion-review-required');
   if(storage.getItem(key(s))!==original)throw Error('pending-payment-changed');
   const archiveKey=key(s)+':completed:'+p.paymentId,text=JSON.stringify({...p,status:'completed'});
   storage.setItem(archiveKey,text);if(storage.getItem(archiveKey)!==text)throw Error('durable-archive-required');
   storage.removeItem(key(s));if(storage.getItem(key(s))!==null)throw Error('pending-removal-failed');
   return {status:'archived',paymentId:p.paymentId,restoreAuthorized:false,requiresPayment:false};
  });},
  async recoverPending(){const s=actor();return locks.request(key(s),{mode:'exclusive'},async()=>{
   same(s);if(legacy(s))throw Error('legacy-payment-review-required');const p=load(s);if(!uuid(p.paymentId))throw Error('receipt-review-required');
   const r=await transport.recover({paymentId:p.paymentId});same(s);
   if(r?.paymentId!==p.paymentId||r.restoreAuthorized!==false||r.requiresPayment!==false||!['recovered','review-required'].includes(r.status))throw Error('recovery-review-required');
   return r; // Keep the journal; recovery alone is not consumption or completion.
  });},
 });
}
// Explicit browser wiring: shared journal across tabs, legacy journal per tab.
// Access failures throw; never silently substitute an empty/in-memory store.
export function createBrowserSharedNativeCheckout(options,browser=globalThis){
 return createSharedNativeCheckout({...options,storage:browser.localStorage,legacyStorage:browser.sessionStorage,locks:browser.navigator?.locks});
}
