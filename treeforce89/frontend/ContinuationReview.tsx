"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {useCurrentAccount,useDAppKit} from '@mysten/dapp-kit-react';
import {Transaction} from '@mysten/sui/transactions';
import {createPaidContinueClient} from '../paid/client.mjs';
import {TREE_RECIPIENT} from '../paid/contract.mjs';
import type {RunState} from './game/arcade';

export default function ContinuationReview({session,run,onClose,onContinue}:{
 session:{wallet:string;sessionToken:string;runId:string;expiresAt:number};run?:RunState;
 onClose:()=>void;onContinue:(grant:any)=>boolean;
}) {
 const kit=useDAppKit(),account=useCurrentAccount();
 const [offer,setOffer]=useState<any>(null),[error,setError]=useState(''),[stage,setStage]=useState('');
 const [busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[manualDigest,setManualDigest]=useState('');
 const closeButton=useRef<HTMLButtonElement>(null),mounted=useRef(true);
 const client=useMemo(()=>createPaidContinueClient({session,Transaction,
  getCurrentWallet:()=>kit.stores.$connection.get().account?.address,
  signAndExecute:transaction=>kit.signAndExecuteTransaction({transaction,account,network:'mainnet'}),
  waitForTransaction:digest=>kit.stores.$currentClient.get().core.waitForTransaction({digest}),
  onStage:value=>{if(mounted.current)setStage(value);}}),[session,kit,account]);
 const pending=client.pending();
 useEffect(()=>{mounted.current=true;closeButton.current?.focus();return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let active=true;setError('');setOffer(null);
  if(pending||!run)return;
  client.review(run).then(value=>{if(active)setOffer(value);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[client,run,attempt]);
 const perform=async(action:()=>Promise<any>)=>{
  if(busy)return;setBusy(true);setError('');
  try{const grant=await action();if(mounted.current&&onContinue(grant))client.acknowledge();}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Retry verification; do not pay again.');}
  finally{if(mounted.current){setBusy(false);setStage('');}}
 };
 return <div className="continuation-backdrop" onKeyDown={event=>{
  event.stopPropagation();if(event.key==='Escape'&&!busy){event.preventDefault();onClose();}
  if(event.key==='Tab'){const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]'));
   if(nodes.length){const index=nodes.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();nodes[(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();}}
 }}>
  <section role="dialog" aria-modal="true" aria-labelledby="continue-title" className="continuation-review">
   <h2 id="continue-title">{pending?'Recover your continuation':'Keep the canopy alive'}</h2>
   <p>Restore 3 lives and replay your current wave, keeping your score.</p>
   <p className="continuation-price">20,000 TREE</p>
   <p className="continuation-note">Sui mainnet · SUI gas is separate</p>
   {offer&&<><p className="continuation-note">Payment recipient</p><code>{TREE_RECIPIENT}</code></>}
   {!offer&&!pending&&!error&&<p role="status">Confirming checkout details…</p>}
   {pending&&<>
    <p>{pending.digest?'A payment has already been submitted. Verify it to resume; do not pay again.':'If you submitted a payment, enter its transaction digest from your wallet.'}</p>
    {pending.digest?<a href={'https://suiscan.xyz/mainnet/tx/'+pending.digest} target="_blank" rel="noreferrer">View payment transaction</a>:
     <label>Transaction digest<input aria-label="Transaction digest" value={manualDigest} onChange={e=>setManualDigest(e.target.value.trim())} disabled={busy}/></label>}
   </>}
   {stage&&<p role="status" aria-live="polite">{stage}</p>}
   {error&&<p role="alert">{error}</p>}
   {pending?<button type="button" disabled={busy||(!pending.digest&&!manualDigest)} onClick={()=>perform(()=>client.retry(manualDigest||undefined))}>{busy?'Checking payment…':'Verify existing payment'}</button>:
    offer?<button type="button" disabled={busy} onClick={()=>perform(()=>client.pay(offer))}>{busy?'Waiting for confirmation…':'Pay 20,000 TREE & continue'}</button>:
     error&&<button type="button" onClick={()=>setAttempt(x=>x+1)}>Retry checkout</button>}
   {pending&&!pending.digest&&!busy&&<button type="button" onClick={()=>{client.discardUnsubmitted();onClose();}}>I did not submit a payment</button>}
   <button type="button" ref={closeButton} disabled={busy} onClick={onClose}>{pending?'Back to game':'Back to Game Over'}</button>
  </section>
 </div>;
}
