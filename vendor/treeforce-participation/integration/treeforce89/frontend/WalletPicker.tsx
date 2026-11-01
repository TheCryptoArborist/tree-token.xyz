'use client';
import {useEffect,useRef,useState} from 'react';
import {useDAppKit,useWallets} from '@mysten/dapp-kit-react';
import {missingWalletOptions} from '../paid/wallet-options.mjs';

export default function WalletPicker(){
 const kit=useDAppKit(),wallets=useWallets();
 const [open,setOpen]=useState(false),[connecting,setConnecting]=useState(''),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),busy=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{const modal=dialog.current;if(!modal)return;
  if(open&&!modal.open)modal.showModal();else if(!open&&modal.open)modal.close();
 },[open]);
 const connect=async(wallet:(typeof wallets)[number])=>{
  if(busy.current)return;busy.current=true;setConnecting(wallet.name);setError('');
  try{await kit.connectWallet({wallet});if(mounted.current)setOpen(false);}
  catch(e){if(mounted.current)setError(/cancel|reject|denied/i.test(e instanceof Error?e.message:'')
   ?'Wallet connection was cancelled. Choose a wallet to try again.':`Could not connect to ${wallet.name}. Please retry in your wallet.`);}
  finally{busy.current=false;if(mounted.current)setConnecting('');}
 };
 return <>
  <button type="button" className="home-connect" onClick={()=>{setError('');setOpen(true);}}>Connect Sui wallet</button>
  <p className="home-wallet-hint">Slush · Suiet · Nightly · Backpack + more</p>
  <dialog ref={dialog} className="home-wallet-picker" aria-labelledby="home-wallet-title" aria-describedby="home-wallet-description"
   onClose={()=>setOpen(false)} onCancel={event=>{if(busy.current)event.preventDefault();else setOpen(false);}}>
   <div className="home-wallet-heading"><div><span>SUI MAINNET</span><h2 id="home-wallet-title">Choose your wallet</h2></div>
    <button type="button" className="wallet-picker-close" aria-label="Close wallet picker" disabled={!!connecting} onClick={()=>setOpen(false)}>×</button></div>
   <p id="home-wallet-description">Connect a wallet holding an NFTree to unlock the game.</p>
   {wallets.length>0&&<><h3>Available in this browser</h3><div className="home-wallet-options">
    {wallets.map(wallet=><button type="button" className="home-wallet-row" key={wallet.id} disabled={!!connecting} onClick={()=>connect(wallet)}>
     <img src={wallet.icon} alt=""/><span className="home-wallet-name">{wallet.name}</span><span className="home-wallet-action">{connecting===wallet.name?'Connecting…':'Connect →'}</span>
    </button>)}
   </div></>}
   {missingWalletOptions(wallets).length>0&&<><h3>{wallets.length?'Get another Sui wallet':'Get a Sui wallet'}</h3>
    <div className="home-wallet-options">{missingWalletOptions(wallets).map(option=><a key={option.name} className="home-wallet-row" href={option.href} target="_blank" rel="noopener noreferrer">
     <span className="wallet-letter" style={{color:option.color}} aria-hidden="true">{option.name.slice(0,1)}</span>
     <span className="home-wallet-name">{option.name}</span><span className="home-wallet-action">Get wallet ↗</span>
    </a>)}</div></>}
   {connecting&&<p role="status">Approve the connection in {connecting}.</p>}
   {error&&<p role="alert">{error}</p>}
   <p className="home-wallet-footnote">Installed Sui wallets appear automatically. After installing or enabling one, refresh this page.</p>
  </dialog>
 </>;
}
