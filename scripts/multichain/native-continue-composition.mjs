// Source-only composition. No environment reads, route registration or activation.
import {createRestoreHttpHandler} from './continue-restore-http.mjs';
import {createNativeContinueGateway} from './native-continue-gateway.mjs';
const outputFields={
 complete:['source','checkoutId','txHash','receiptId','payer','status','paymentId','runId','nativeRunId','sequence','offerId','digest','archiveAllowed'],
 record:['status','paymentId','offerId','digest','runId','sequence'],
 recover:['status','paymentId','runId','nativeRunId','sequence'],
 offer:['enabled','recipientConfirmed','offerId','wallet','runId','network','coinType','recipient','price','decimals','amountBaseUnits','lives','expiresAt'],
};
export function createNativeContinueComposition({legacyHandler,readMode,authorization,recordPayment,recoverPayment,nativeOffer,completePayment=async()=>{throw Error('completion-disabled');},readCutover=async()=>null,clock=()=>Date.now()}){
 const services={complete:completePayment,prepare:authorization?.prepare?.bind(authorization),activate:authorization?.activate?.bind(authorization),record:recordPayment,recover:recoverPayment,offer:nativeOffer};
 if(!Object.values(services).every(fn=>typeof fn==='function'))throw Error('complete-native-services-required');
 const actions={...services};
 for(const action of ['complete','record','recover','offer'])actions[action]=async input=>{
  const result=await services[action](input);
  if(!result||typeof result!=='object')throw Error('service-result-required');
  // Offer/record/recover never release a checkpoint or expose service credentials.
  return {...Object.fromEntries(outputFields[action].filter(k=>Object.hasOwn(result,k)).map(k=>[k,result[k]])),restoreAuthorized:false,requiresPayment:false};
 };
 const sharedHandlers=Object.fromEntries(Object.keys(actions).map(action=>[action,createRestoreHttpHandler({action,authorization:actions})]));
 const guardedMode=async()=>{
  const mode=await (readMode??(async()=> 'legacy'))();
  if(mode!=='shared')return mode;
  const proof=await readCutover(),now=clock();
  if(proof?.legacyWritersDrained!==true||proof?.paymentsPaused!==true||
   !/^[a-f0-9]{64}$/.test(proof?.runtimeDigest||'')||!/^[a-f0-9]{64}$/.test(proof?.databaseIdentity||'')||
   !Number.isSafeInteger(proof?.checkedAt)||!Number.isSafeInteger(proof?.expiresAt)||
   proof.checkedAt>now||now-proof.checkedAt>5000||proof.expiresAt<=now||proof.expiresAt-proof.checkedAt>60000)return 'blocked';
  return 'shared';
 };
 return createNativeContinueGateway({legacyHandler,readMode:guardedMode,sharedHandlers});
}
