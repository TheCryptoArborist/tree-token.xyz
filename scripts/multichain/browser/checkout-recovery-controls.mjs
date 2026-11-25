// Undeployed recovery-only controls. No signing, payment or restoration handler.
export function mountCheckoutRecoveryControls({root,checkout,onRecovered=()=>{}}){
 const doc=root.ownerDocument,section=doc.createElement('section'),status=doc.createElement('p'),label=doc.createElement('label'),input=doc.createElement('input'),verify=doc.createElement('button'),recover=doc.createElement('button'),complete=doc.createElement('button');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 label.textContent='Transaction digest from your wallet (if needed)';input.type='text';input.autocomplete='off';label.append(input);
 verify.type=recover.type=complete.type='button';complete.textContent='Check completion';verify.textContent='Verify existing payment';recover.textContent='Recover paid run';
 section.append(status,label,verify,recover,complete);root.append(section);let busy=false,disposed=false;
 function refresh(message){if(disposed)return;const p=checkout.pending();
  status.textContent=message||(p.cancellationReported?'The wallet reported cancellation. Keep this checkout for review; do not pay again.':null)||({none:'No pending payment on this browser.',legacy:'An older checkout is pending. Recover it through the existing checkout before paying again.',shared:'A checkout is pending. Verify the existing payment; do not pay again.',review:'Payment history needs review. Do not pay again.'}[p.kind]);
  input.disabled=busy||p.kind!=='shared'||p.hasDigest;verify.disabled=busy||p.kind!=='shared';recover.disabled=complete.disabled=busy||p.kind!=='shared'||!p.canRecover;
 }
 async function run(action){if(busy||disposed)return;busy=true;refresh();try{
  const result=await action();if(disposed)return;
  if(result.status==='recovered'){await onRecovered(result);refresh('Paid run recovered. No new payment was requested. Restoration still requires its separate review.');}
  else if(result.status==='archived')refresh('Completed payment archived. No new payment or restoration was requested.');
  else if(result.status==='recorded')refresh('Payment verified. You can now recover the paid run.');
  else refresh('This payment needs review. Do not pay again.');
 }catch{refresh('Verification could not finish. Your pending payment is retained. Do not pay again.');}
 finally{busy=false;if(!disposed)refresh(status.textContent);}}
 verify.addEventListener('click',()=>run(()=>checkout.reconcile(input.value.trim()?{digest:input.value.trim()}:{})));
 recover.addEventListener('click',()=>run(()=>checkout.recoverPending()));complete.addEventListener('click',()=>run(()=>checkout.archiveCompleted()));refresh();
 return {refresh,destroy(){disposed=true;section.remove();}};
}
