"use client";
import {useEffect,useState} from "react";
import {getWallets,StandardConnect,StandardDisconnect} from "@mysten/wallet-standard";

/**
 * Isolated Slush wallet authorization diagnostic.
 * Never requests an NFT query, signing capability, or transaction.
 * Does not record or display wallet addresses.
 */
export default function ConnectionOnlyDiagnostics() {
  const [wallet,setWallet]=useState<ReturnType<typeof getWallets>["get"] extends (...args:any[])=>infer R ? R[number] | null : never>(null);
  const [stage,setStage]=useState("idle");
  const [error,setError]=useState("");
  const [pending,setPending]=useState(false);
  useEffect(()=>{
    const update=()=>setWallet(getWallets().get().find(w=>w.name.toLowerCase().includes("slush")&&Boolean(w.features?.[StandardConnect]))??null);
    update();
    const timer=window.setInterval(update,2000);
    return()=>window.clearInterval(timer);
  },[]);
  const connect=async()=>{
    if(!wallet||pending)return;
    setPending(true);setError("");setStage("authorization-requested");
    try{
      const result=await wallet.features[StandardConnect].connect();
      const mainnet=Array.from(result.accounts||[]).some(account=>account.chains?.includes("sui:mainnet"));
      setStage(mainnet?"authorization-complete-mainnet-account":"authorization-complete-no-mainnet-account");
    }catch(e){
      setStage("authorization-rejected");
      setError(e instanceof Error?e.name:"Connection error");
    }finally{setPending(false)}
  };
  const disconnect=async()=>{
    if(!wallet)return;
    try{if(wallet.features?.[StandardDisconnect])await wallet.features[StandardDisconnect].disconnect();setStage("disconnected")}
    catch{setStage("disconnect-error")}
  };
  return <div className="nftree-gateway" aria-label="Slush authorization diagnostic">
    <h2>Slush Connection Test</h2>
    <p>This isolates the standard wallet authorization request. It does not read NFTrees, sign messages, or transfer TREE.</p>
    <div className="nftree-diagnostic" role="status">
      <strong>Authorization-only test</strong>
      <span>Slush detected: {wallet?"yes":"no"}</span>
      <span>Last stage: {stage}</span>
      {error&&<span>Connection error category: {error}</span>}
      <small>No wallet addresses, passwords, private keys, or signatures are logged by this page. Do not override a malicious-site warning.</small>
    </div>
    <button type="button" disabled={!wallet||pending} onClick={connect}>{pending?"Awaiting Slush response…":"Request Slush Connection"}</button>
    {stage.startsWith("authorization-complete")&&<button type="button" onClick={disconnect}>Disconnect</button>}
    <p>Stop immediately if Slush displays a malicious-site warning. The diagnostic status will remain at authorization-requested if Slush does not resolve the connection.</p>
  </div>;
}
