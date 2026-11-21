// At most one wallet submission attempt per invoice. Recovery only checks the recorded digest.
export function createCheckoutFlow({sign,bind,execute,redeem,submitStored,onChange=()=>{}}){
 let busy=false,uncertain=null,phase='idle',lastError=null;
 const update=value=>{phase=value;try{onChange();}catch{/* Rendering must never interrupt a payment. */}};
 const fail=error=>{const labels={signing:'Wallet approval',binding:'Recording signed payment',submitting:'Submitting recorded payment',verifying:'Checking payment receipt'};lastError=new Error(`${labels[phase]||'Checkout'}: ${error.message||'Request interrupted'}.`);return lastError;};
 return Object.freeze({
  get pending(){return uncertain;},
  get phase(){return phase;},
  get lastError(){return lastError;},
  async pay(invoice){
   if(busy||uncertain)throw lastError||Error('Review the recorded purchase below before starting another payment');busy=true;lastError=null;update('signing');
   try{
    const signed=await sign(invoice); // rejection here has not submitted a transaction
    uncertain=invoice.id;
    update('binding');
    const bound=await bind(invoice.id,signed);
    if(bound.status==='paid'){update('verifying');const item=await redeem(invoice.id);uncertain=null;return item;}
    if(bound.status!=='bound'||!bound.expectedDigest)throw Error('Payment was not bound');
    update('submitting');await execute(signed,bound.expectedDigest,invoice.id,invoice.wallet);
    update('verifying');
    const item=await redeem(invoice.id);uncertain=null;return item;
   }catch(error){throw fail(error);}finally{busy=false;update('idle');}
  },
  async resume(id){if(busy)throw Error('Checkout is busy');busy=true;uncertain=id;lastError=null;update('submitting');try{await submitStored(id);update('verifying');const item=await redeem(id);uncertain=null;return item;}catch(error){throw fail(error);}finally{busy=false;update('idle');}},
  async recover(id){if(busy)throw Error('Checkout is busy');busy=true;uncertain=id;lastError=null;update('verifying');try{const item=await redeem(id);uncertain=null;return item;}catch(error){throw fail(error);}finally{busy=false;update('idle');}},
  // Called only after a trusted history read confirms no signed/bound/paid invoice exists.
  observeHistory(rows){if(!busy&&uncertain&&rows.some(row=>row.id===uncertain&&['cancelled','expired'].includes(row.status)))uncertain=null;},
  clearUnsigned(id){if(!busy&&uncertain===id)uncertain=null;}
 });
}
