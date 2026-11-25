import {createBnbCheckoutReview} from './bnb-checkout-review.mjs';
// Prepare an undeployed review controller from authenticated context and selected wallets.
export async function createConnectedBnbReview({transport,getSession,wallets,clock=Date.now}){
 const session=structuredClone(getSession()),identity=JSON.stringify(session),selected=await wallets.snapshot();
 const unchanged=()=>{if(JSON.stringify(getSession())!==identity||wallets.epoch()!==selected.epoch||session.expiresAt<=clock())throw Error('session-changed-review-required');};
 unchanged();const context=await transport['bnb-context']({});unchanged();const after=await wallets.snapshot();unchanged();
 if(JSON.stringify(after)!==JSON.stringify(selected)||context?.restoreAuthorized!==false||context.paymentEnabled!==false||context.network!=='sui:mainnet'||context.suiWallet!==selected.suiWallet||context.nativeRunId!==session.nativeRunId||context.expiresAt!==session.expiresAt)throw Error('context-review-required');
 const getContext=()=>{unchanged();return {sessionToken:session.sessionToken,suiWallet:context.suiWallet,payer:selected.payer,accountId:context.accountId,runId:context.runId,sequence:context.sequence,chainId:56,network:'sui:mainnet',epoch:JSON.stringify([session.epoch,selected.epoch]),expiresAt:context.expiresAt};};
 return createBnbCheckoutReview({transport,getContext,signSuiMessage:input=>wallets.signSuiMessage(input),signBnbMessage:input=>wallets.signBnbMessage(input),clock});
}
