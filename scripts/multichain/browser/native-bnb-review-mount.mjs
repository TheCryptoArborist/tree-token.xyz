import {createNativeContinueTransport} from './native-continue-transport.mjs';
import {createBnbReviewWallets} from './bnb-review-wallets.mjs';
import {createConnectedBnbReview} from './bnb-connected-review.mjs';
import {mountBnbCheckoutReview} from './bnb-checkout-review.mjs';
// Explicit source-only mount for a host-owned checkout container. No auto-mount.
export function mountNativeBnbReview({root,getSession,getSui,subscribeSui,provider,fetch,origin,clock=Date.now}){
 const container=root.ownerDocument.createElement('div'),status=root.ownerDocument.createElement('p');
 status.setAttribute('role','status');status.textContent='Checking your session and selected wallets…';container.append(status);root.append(container);
 let disposed=false,wallets,controls,review;
 const destroy=()=>{if(disposed)return;disposed=true;controls?.destroy();review?.destroy();wallets?.destroy();container.remove();};
 const ready=(async()=>{
  try{
   const transport=createNativeContinueTransport({getSession,fetch,origin,clock});
   wallets=createBnbReviewWallets({getSui,subscribeSui,provider});
   review=await createConnectedBnbReview({transport,getSession,wallets,clock});
   if(disposed){review.destroy();return false;}
   status.remove();controls=mountBnbCheckoutReview({root:container,review});return true;
  }catch{
   review?.destroy();wallets?.destroy();
   if(!disposed)status.textContent='Review unavailable. Check your Sui session and selected Sui and BNB wallets. No payment was requested.';
   return false;
  }
 })();
 return Object.freeze({ready,destroy});
}
