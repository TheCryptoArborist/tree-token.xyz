import {useEffect,useRef} from 'react';
import {TREE_RECIPIENT} from '../paid/contract.mjs';

type Props={offer:any;pending:any;grant:any;error:string;stage:string;busy:boolean;manualDigest:string;
 onManualDigest:(value:string)=>void;onClose:()=>void;onPay:()=>void;onCheck:()=>void;
 onManualCheck:()=>void;onResume:()=>void;onRetryCheckout:()=>void;onUnsubmitted:()=>void};

export default function ContinuationDialog(p:Props){
 const {offer,pending,grant,error,stage,busy}=p;
 const primary=useRef<HTMLButtonElement>(null);
 const ready=!!grant;
 useEffect(()=>{if(!busy)primary.current?.focus();},[busy,ready,!!offer]);
 return <div className="continuation-backdrop" onKeyDown={event=>{
  event.stopPropagation();if(event.key==='Escape'&&!busy){event.preventDefault();p.onClose();}
  if(event.key==='Tab'){
   const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],summary'))
    .filter(node=>node.getClientRects().length>0);
   if(nodes.length){const index=nodes.indexOf(document.activeElement as HTMLElement);event.preventDefault();
    nodes[(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();}
  }
 }}>
  <section role="dialog" aria-modal="true" aria-labelledby="continue-title" className="continuation-review">
   <p className="continuation-eyebrow">{ready?'PAYMENT CONFIRMED':'CONTINUE YOUR FLIGHT'}</p>
   <h2 id="continue-title">{ready?'Ready to fly again?':'Keep the canopy alive'}</h2>
   <p>{ready?'Your three lives are ready. Pick up at the same wave with your score intact.':'Restore 3 lives and replay your current wave, keeping your score.'}</p>
   {ready?<p className="continuation-lives" aria-label="3 lives restored">♥ ♥ ♥</p>:<>
    <p className="continuation-price">20,000 TREE</p>
    <p className="continuation-note">Sui mainnet · SUI gas is separate</p>
   </>}
   {offer&&!pending&&!ready&&<details className="continuation-details"><summary>Payment details</summary>
    <p className="continuation-note">Recipient</p><code>{TREE_RECIPIENT}</code></details>}
   {busy?<>
    <p role="status" aria-live="polite">{stage||'Checking your payment…'}</p>
    <button type="button" className="continuation-primary" disabled>Waiting for confirmation…</button>
   </>:ready?<button ref={primary} type="button" className="continuation-primary" onClick={p.onResume}>Resume gameplay · 3 lives</button>:
    pending?<>
     <p className="continuation-note">{pending.digest?'Your payment is saved. Check it to unlock your three lives.':'Already approved in your wallet? We can find your payment automatically.'}</p>
     <button ref={primary} type="button" className="continuation-primary" onClick={p.onCheck}>Check payment & continue</button>
     {!pending.digest&&<button type="button" className="continuation-secondary" onClick={p.onUnsubmitted}>I haven’t paid — return to checkout</button>}
    </>:offer?<button ref={primary} type="button" className="continuation-primary" onClick={p.onPay}>Pay 20,000 TREE & restore lives</button>:
     error?<button ref={primary} type="button" className="continuation-primary" onClick={p.onRetryCheckout}>Retry checkout</button>:
      <p role="status">Preparing your continue button…</p>}
   {error&&<p role="alert">{error}</p>}
   {!busy&&!ready&&pending&&!pending.digest&&<details className="continuation-details">
    <summary>Advanced payment recovery</summary>
    <p className="continuation-note">Only if automatic lookup cannot find your payment.</p>
    <label>Transaction ID<input aria-label="Transaction ID" value={p.manualDigest} onChange={e=>p.onManualDigest(e.target.value.trim())}/></label>
    <button type="button" disabled={!p.manualDigest} onClick={p.onManualCheck}>Check this payment</button>
   </details>}
   {!busy&&pending?.digest&&<a className="continuation-receipt" href={'https://suiscan.xyz/mainnet/tx/'+pending.digest} target="_blank" rel="noreferrer">View payment receipt</a>}
   <button type="button" className="continuation-secondary" disabled={busy} onClick={p.onClose}>Back to Game Over</button>
  </section>
 </div>;
}
