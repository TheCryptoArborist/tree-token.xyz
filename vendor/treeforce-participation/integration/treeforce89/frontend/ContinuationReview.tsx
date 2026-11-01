"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {useCurrentAccount,useDAppKit} from '@mysten/dapp-kit-react';
import {Transaction} from '@mysten/sui/transactions';
import {createPaidContinueClient} from '../paid/client.mjs';
import ContinuationDialog from './ContinuationDialog';
import {findRecentContinueReceipts} from '../paid/receipt-discovery.mjs';
import type {RunState} from './game/arcade';

export default function ContinuationReview({session,run,onClose,onContinue}:{
 session:{wallet:string;sessionToken:string;runId:string;expiresAt:number};run?:RunState;
 onClose:()=>void;onContinue:(grant:any)=>boolean;
}) {
 const kit=useDAppKit(),account=useCurrentAccount();
 const [offer,setOffer]=useState<any>(null),[error,setError]=useState(''),[stage,setStage]=useState('');
 const [grant,setGrant]=useState<any>(null);
 const [busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[manualDigest,setManualDigest]=useState('');
 const mounted=useRef(true);
 const client=useMemo(()=>createPaidContinueClient({session,Transaction,
  getCurrentWallet:()=>kit.stores.$connection.get().account?.address,
  signAndExecute:transaction=>kit.signAndExecuteTransaction({transaction,account,network:'mainnet'}),
  waitForTransaction:digest=>kit.stores.$currentClient.get().core.waitForTransaction({digest}),
  findReceipts:async input=>{const {SuiGraphQLClient}=await import('@mysten/sui/graphql');
   return findRecentContinueReceipts({...input,client:kit.stores.$currentClient.get(),
    archivalClient:new SuiGraphQLClient({network:'mainnet',url:'https://graphql.mainnet.sui.io/graphql'})});},
  onStage:value=>{if(mounted.current)setStage(value);}}),[session,kit,account]);
 const pending=client.pending();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let active=true;setError('');setOffer(null);
  if(pending||!run)return;
  client.review(run).then(value=>{if(active)setOffer(value);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[client,run,attempt]);
 const perform=async(action:()=>Promise<any>)=>{
  if(busy)return;setBusy(true);setError('');
  try{const grant=await action();if(mounted.current)setGrant(grant);}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Retry verification; do not pay again.');}
  finally{if(mounted.current){setBusy(false);setStage('');}}
 };
 const resume=()=>{
  if(!grant||busy)return;
  try{if(!onContinue(grant))throw Error('Reconnect the wallet used for this game, then check the payment again.');client.acknowledge();}
  catch(e){setError(e instanceof Error?e.message:'Gameplay could not resume. Your payment is saved.');}
 };
 return <ContinuationDialog offer={offer} pending={pending} grant={grant} error={error} stage={stage} busy={busy}
  manualDigest={manualDigest} onManualDigest={setManualDigest} onClose={onClose}
  onPay={()=>perform(()=>client.pay(offer))} onCheck={()=>perform(()=>client.retry())}
  onManualCheck={()=>perform(()=>client.retry(manualDigest))} onResume={resume}
  onRetryCheckout={()=>setAttempt(x=>x+1)}
  onUnsubmitted={()=>{client.discardUnsubmitted();setAttempt(x=>x+1);setError('');}} />;
}
