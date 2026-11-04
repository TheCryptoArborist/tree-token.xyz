"use client";
import {useEffect,useState} from "react";
import {getWallets,StandardConnect} from "@mysten/wallet-standard";

/**
 * Passive-only wallet diagnostic. It does not call connect(), sign,
 * transact, inspect accounts, or query NFT ownership.
 * Useful for separating wallet detection from Slush origin authorization.
 */
export default function PassiveWalletDiagnostics() {
  const [wallets,setWallets]=useState<{name:string;mainnet:boolean;connect:boolean}[]>([]);
  useEffect(()=>{
    const update=()=>{
      setWallets(getWallets().get().map(wallet=>({
        name:wallet.name,
        mainnet:Boolean(wallet.chains?.includes("sui:mainnet")),
        connect:Boolean(wallet.features?.[StandardConnect]),
      })));
    };
    update();
    const timer=window.setInterval(update,2000);
    return()=>window.clearInterval(timer);
  },[]);
  return <div className="nftree-gateway" aria-label="Passive wallet diagnostics">
    <h2>Wallet Safety Diagnostics</h2>
    <p>This is a passive inspection of wallet availability. It does not request a wallet connection, read your NFTrees, sign a message, or send a payment.</p>
    <div className="nftree-diagnostic" role="status">
      <strong>Detection-only test</strong>
      <span>Origin: {window.location.origin}</span>
      <span>Wallets detected: {wallets.length}</span>
      {wallets.map((wallet,i)=><span key={i}>{wallet.name}: {wallet.mainnet?"Sui mainnet advertised":"No Sui mainnet advertised"} · {wallet.connect?"Connect feature available":"No connect feature"}</span>)}
      <small>No wallet address, password, key, or signature is requested or stored. Do not bypass a wallet's malicious-site warning.</small>
    </div>
    <p>To compare behavior, observe whether Slush displays any warning while this page is open, without clicking a wallet authorization button.</p>
  </div>;
}
