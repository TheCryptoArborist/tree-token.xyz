// Separate opt-in Sui checkout adapter. Existing legacy checkout is untouched.
import {validateOffer,validateSnapshot,buildContinueTransaction,normalizedAddress} from '../../../docs/multichain/generation-milestone/native-sui-payments/upstream/contract.mjs';
export function createSharedNativeCheckout({getSession,transport,Transaction,signAndExecute,storage,locks}){
 if(![getSession,signAndExecute].every(f=>typeof f==='function')||!storage?.setItem||!locks?.request)throw Error('durable-checkout-adapters-required');
 const actor=()=>{const s=getSession();if(!s||!s.wallet||!s.nativeRunId)throw Error('session-required');return {...s,wallet:normalizedAddress(s.wallet)};};
 const key=s=>'tree-shared-native-checkout.v1:'+s.wallet;
 const same=s=>{const n=actor();if(['wallet','nativeRunId','sessionToken','epoch'].some(k=>n[k]!==s[k]))throw Error('session-changed-review-required');};
 const save=(s,value)=>{const text=JSON.stringify(value);storage.setItem(key(s),text);if(storage.getItem(key(s))!==text)throw Error('durable-checkout-required');};
 const record=async(s,p)=>{same(s);const r=await transport.record({offerId:p.offerId,digest:p.digest});same(s);if(r.status!=='recorded'||r.offerId!==p.offerId||r.digest!==p.digest||r.restoreAuthorized!==false)throw Error('payment-review-required');save(s,{...p,paymentId:r.paymentId,status:'recorded'});return r;};
 return Object.freeze({
  async review(snapshot){const s=actor();validateSnapshot(snapshot,s.nativeRunId);const offer=await transport.offer({runId:s.nativeRunId,snapshot,lives:0});same(s);return validateOffer(offer,s.wallet,s.nativeRunId);},
  async pay(offer){const s=actor();return locks.request(key(s),{mode:'exclusive'},async()=>{
   same(s);if(storage.getItem(key(s))||storage.getItem('treeforce89-pending-continue:'+s.wallet))throw Error('recover-existing-payment');
   validateOffer(offer,s.wallet,s.nativeRunId);if(offer.expiresAt<=Date.now())throw Error('offer-expired');
   const pending={offerId:offer.offerId,nativeRunId:s.nativeRunId,status:'signing'};save(s,pending);
   // Even an uncertain/rejected signing result keeps the marker. No silent
   // discard or automatic re-signing; reconciliation is a separate user action.
   const result=await signAndExecute(buildContinueTransaction(Transaction,offer));
   const digest=result?.Transaction?.digest;
   if(result?.$kind!=='Transaction'||!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(digest||''))throw Error('payment-review-required');
   save(s,{...pending,digest,status:'submitted'});return record(s,{...pending,digest});
  });},
  async reconcile(){const s=actor();return locks.request(key(s),{mode:'exclusive'},async()=>{same(s);const p=JSON.parse(storage.getItem(key(s))||'null');if(!p?.digest)throw Error('receipt-review-required');return record(s,p);});},
 });
}
