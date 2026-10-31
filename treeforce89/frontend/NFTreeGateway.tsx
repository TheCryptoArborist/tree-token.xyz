"use client";
import {useEffect,useRef,useState} from 'react';
import {useCurrentAccount,useDAppKit,useWalletConnection} from '@mysten/dapp-kit-react';
import {ConnectButton} from '@mysten/dapp-kit-react/ui';
import {authenticateGateway,revokeGatewaySession,isGatewaySessionCurrent,restartGatewayRun} from './game/gateway-client.mjs';
import CanopyGame from './CanopyGame';
import ContinuationReview from './ContinuationReview';
import {loadPendingContinuation} from '../paid/client.mjs';
import {prepareAuthorizedContinue} from './game/authorized-continue-resume.mjs';
import type {RunState} from './game/arcade';

type Session={wallet:string;sessionToken:string;runId:string;expiresAt:number};

export default function NFTreeGateway() {
  const account=useCurrentAccount();
  const kit=useDAppKit();
  const connection=useWalletConnection();
  const [session,setSession]=useState<Session|null>(null);
  const sessionRef=useRef<Session|null>(null);
  const requestRef=useRef<AbortController|null>(null);
  const epoch=useRef(0);
  const [pending,setPending]=useState(false);
  const [stage,setStage]=useState('');
  const [error,setError]=useState('');
  const [initialScene,setInitialScene]=useState<'game'|'title'>('title');
  const restarting=useRef(false);
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  const [checkoutRun,setCheckoutRun]=useState<RunState|undefined>();
  const [resume,setResume]=useState<{digest:string;run:RunState}|undefined>();
  const lastGrant=useRef('');
  useEffect(()=>{setCheckoutRun(undefined);setCheckoutOpen(!!session&&!!loadPendingContinuation(session.wallet));},[session?.runId]);

  useEffect(()=>{
    // Account changes or disconnect immediately unmount the game. In-flight
    // signing responses cannot restore access for a previously selected wallet.
    epoch.current++;
    requestRef.current?.abort();
    const previous=sessionRef.current;
    sessionRef.current=null;setSession(null);setPending(false);setError('');
    if(previous)void revokeGatewaySession(previous).catch(()=>{});
    return()=>{epoch.current++;requestRef.current?.abort();};
  },[account?.address]);

  useEffect(()=>{
    if(!session)return;
    const timer=window.setTimeout(()=>{
      sessionRef.current=null;setSession(null);
      setError('Your game session expired. Verify your NFTree again to play.');
      void revokeGatewaySession(session).catch(()=>{});
    },Math.max(0,session.expiresAt-Date.now()));
    return()=>window.clearTimeout(timer);
  },[session]);

  useEffect(()=>{
    const leave=()=>{
      if(sessionRef.current)void revokeGatewaySession(sessionRef.current,{keepalive:true}).catch(()=>{});
    };
    window.addEventListener('pagehide',leave);
    return()=>{window.removeEventListener('pagehide',leave);leave();};
  },[]);

  const verify=async()=>{
    if(!account || pending)return;
    const version=++epoch.current;
    const controller=new AbortController();requestRef.current=controller;
    setPending(true);setError('');
    try {
      const verified=await authenticateGateway({wallet:account.address,origin:window.location.origin,
        signal:controller.signal,onStage:setStage,
        signMessage:message=>kit.signPersonalMessage({message,account,network:'mainnet'})});
      if(version!==epoch.current || kit.stores.$connection.get().account?.address!==account.address){
        void revokeGatewaySession(verified).catch(()=>{});return;
      }
      setResume(undefined);lastGrant.current='';setInitialScene('title');sessionRef.current=verified;setSession(verified);
    } catch(e) {
      if(version===epoch.current){setSession(null);setError(e instanceof Error?e.message:'Wallet sign-in failed. Please retry.');}
    } finally {
      if(version===epoch.current)setPending(false);
    }
  };
  const disconnect=async()=>{
    epoch.current++;requestRef.current?.abort();
    const previous=sessionRef.current;sessionRef.current=null;setSession(null);setPending(false);setError('');
    try {if(previous)await revokeGatewaySession(previous);}
    catch {setError('Game closed. Server sign-out could not be confirmed; the session will expire automatically.');}
    finally {await kit.disconnectWallet().catch(()=>{});}
  };
  const restart=async(destination:'game'|'title')=>{
    if(checkoutOpen)throw Error('Close checkout before starting a new run.');
    const previous=sessionRef.current;
    if(!previous || !account || restarting.current)throw Error('A new run is already pending.');
    restarting.current=true;
    const version=++epoch.current;
    const controller=new AbortController();requestRef.current=controller;
    try {
      const next=await restartGatewayRun(previous,{signal:controller.signal});
      if(version!==epoch.current || sessionRef.current!==previous ||
        kit.stores.$connection.get().account?.address!==account.address){
        void revokeGatewaySession(next).catch(()=>{});return;
      }
      setResume(undefined);setInitialScene(destination);sessionRef.current=next;setSession(next);
    } catch(e) {
      if(version===epoch.current && ['SESSION_REQUIRED','RUN_CHANGED','NFTREE_REQUIRED'].includes((e as {code?:string})?.code||'')){
        sessionRef.current=null;setSession(null);
        setError(e instanceof Error?e.message:'Verify your NFTree again.');
        void revokeGatewaySession(previous).catch(()=>{});
      }
      throw e;
    } finally {restarting.current=false;}
  };
  const continuePaid=(grant:any)=>{
    const previous=sessionRef.current;
    if(!previous||!account||kit.stores.$connection.get().account?.address!==previous.wallet||
      grant.session?.wallet!==previous.wallet||grant.session?.sessionToken!==previous.sessionToken||
      lastGrant.current===grant.digest)return false;
    const run=prepareAuthorizedContinue(grant.snapshot,grant,{maxWaves:10}) as RunState;
    lastGrant.current=grant.digest;setResume({digest:grant.digest,run});setInitialScene('game');
    sessionRef.current=grant.session;setSession(grant.session);setCheckoutOpen(false);return true;
  };
  if(session && isGatewaySessionCurrent(session,account?.address)) {
    return <div className="nftree-game-shell">
      <div className="nftree-wallet-bar"><span>NFTree verified · {session.wallet.slice(0,6)}…{session.wallet.slice(-4)}</span><button type="button" onClick={disconnect}>Disconnect</button></div>
      <CanopyGame key={session.runId+':'+(resume?.digest||'start')} serverRunId={session.runId} initialScene={initialScene} resumeRun={resume?.run} onNewRunRequested={restart} onContinueRequested={run=>{setCheckoutRun(run);setCheckoutOpen(true);}} />
      {checkoutOpen&&<ContinuationReview session={session} run={checkoutRun} onContinue={continuePaid} onClose={()=>setCheckoutOpen(false)} />}
    </div>;
  }
  return <div className="nftree-gateway" aria-label="NFTree Gateway">
    <h2>NFTree Gateway</h2>
    <p>Your NFTree is your arcade pass. Connect your Sui wallet, then verify access to play TREE FORCE ’89.</p>
    {!account ? <ConnectButton /> : <>
      <p className="nftree-connected">Wallet connected · {account.address.slice(0,6)}…{account.address.slice(-4)}</p>
      <button type="button" disabled={pending} onClick={verify}>{pending?stage:'Verify NFTree & Play'}</button>
      <button className="nftree-secondary" type="button" onClick={disconnect}>Disconnect</button>
    </>}
    {!account && connection.status==='connecting' && <p role="status">Waiting for your wallet…</p>}
    {pending && <p role="status" aria-live="polite">{stage}</p>}
    <p className="nftree-signin-note">Sign-in uses a message signature. It does not transfer tokens or charge a fee.</p>
    <p className="nftree-signin-note">Use a wallet holding an NFTree directly. Kiosk and custody holdings are not supported in this preview.</p>
    <a href="https://nftree.net/" target="_blank" rel="noreferrer">Explore NFTrees</a>
    <small>If your wallet shows a security warning, stop. Do not bypass it.</small>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
