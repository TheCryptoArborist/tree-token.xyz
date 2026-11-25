// Undeployed host assembly. The caller supplies verified native services, never
// browser configuration. No SDK client, secret lookup or route registration.
import {createNativeBnbCheckout} from './native-bnb-checkout.mjs';
import {createNativePaymentCompletion} from './native-payment-completion.mjs';
import {createNativeSuiSessionAdapter} from './native-sui-session.mjs';
import {createNativeSuiPaymentRecorder} from './native-sui-payment.mjs';
import {createNativePaidRunRecovery} from './native-paid-run-recovery.mjs';
import {createNativeSharedOffer} from './native-shared-offer.mjs';
import {createSharedContinueDelivery} from './shared-continue-delivery.mjs';
import {createRestoreAuthorization} from './continue-restore-authorization.mjs';
import {createNativeContinueComposition} from './native-continue-composition.mjs';
export function createNativeContinueHost({pool,legacyHandler,nativePaidService,verifyRuntime,checkOwnership,readTransaction,readBnbPayment,readReviewedCheckpoint,readReleasePolicy,readMode,readCutover=async()=>null,runtimeDigest,databaseIdentity}){
 if(!/^[a-f0-9]{64}$/.test(runtimeDigest||'')||!/^[a-f0-9]{64}$/.test(databaseIdentity||'')||typeof nativePaidService?.offer!=='function'||typeof verifyRuntime!=='function')throw Error('verified-native-host-required');
 const verified=async db=>{
  const proof=await verifyRuntime(db);
  if(proof?.databaseIdentity!==databaseIdentity||proof?.runtimeDigest!==runtimeDigest||proof?.verified!==true)throw Error('native-host-identity-mismatch');
  return proof;
 };
 const sessionAdapter=createNativeSuiSessionAdapter({verifyRuntime:verified,checkOwnership,readReviewedCheckpoint});
 const delivery=createSharedContinueDelivery({pool,lockSessionAndFlight:sessionAdapter.lockSessionAndFlight,consumeRun:sessionAdapter.consumeRun});
 const authorization=createRestoreAuthorization({delivery,readReleasePolicy});
 return createNativeContinueComposition({legacyHandler,readMode,authorization,
  bnbCheckout:readBnbPayment?createNativeBnbCheckout({pool,verifyRuntime:verified,checkOwnership,readReviewedCheckpoint,readPayment:readBnbPayment}):undefined,
  recordBnbPayment:({sessionHash,runId,checkoutId,txHash})=>delivery.importPayment({sessionHash,runId,source:'bnb-usdt',sourceId:checkoutId,txHash}),
  completePayment:createNativePaymentCompletion({pool,verifyRuntime:verified}),
  recordPayment:createNativeSuiPaymentRecorder({pool,verifyRuntime:verified,readTransaction}),
  recoverPayment:createNativePaidRunRecovery({pool,verifyRuntime:verified,checkOwnership}),
  nativeOffer:createNativeSharedOffer({pool,sessionAdapter,nativeOffer:input=>nativePaidService.offer(input)}),
  readCutover:async()=>{
   const proof=await readCutover();
   if(proof?.runtimeDigest!==runtimeDigest||proof?.databaseIdentity!==databaseIdentity)return null;
   return proof;
  },
 });
}
