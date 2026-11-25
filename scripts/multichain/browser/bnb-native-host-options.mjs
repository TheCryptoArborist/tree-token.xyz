// Adapt the pinned game's dApp Kit stores and native session ref. No global provider.
export function createNativeBnbReviewOptions({kit,provider,getNativeSession,getSessionEpoch,origin}){
 const connection=kit?.stores?.$connection,network=kit?.stores?.$currentNetwork;
 if(typeof connection?.get!=='function'||typeof connection.subscribe!=='function'||typeof network?.get!=='function'||typeof network.subscribe!=='function'||typeof kit?.signPersonalMessage!=='function'||typeof getNativeSession!=='function'||typeof getSessionEpoch!=='function')throw Error('native-host-adapters-required');
 let selectedWallet,selectedAccount,view;
 const getSui=()=>{
  const c=connection.get();if(c?.status!=='connected'||!c.account||!c.wallet||network.get()!=='mainnet')throw Error('native-wallet-required');
  if(c.wallet!==selectedWallet||c.account!==selectedAccount){
   selectedWallet=c.wallet;selectedAccount=c.account;
   // dApp Kit owns wallet/account resolution; this facade forwards only personal messages.
   const capturedWallet=c.wallet,capturedAccount=c.account;
   const account={address:c.account.address,chains:['sui:mainnet'],features:['sui:signPersonalMessage']};
   const wallet={accounts:[account],features:{'sui:signPersonalMessage':{async signPersonalMessage({message}){
    const before=connection.get();if(before.wallet!==capturedWallet||before.account!==capturedAccount||before.status!=='connected'||network.get()!=='mainnet')throw Error('native-wallet-changed');
    return kit.signPersonalMessage({message,account:capturedAccount});
   }}}};view={wallet,account,network:'sui:mainnet'};
  }return view;
 };
 const getSession=()=>{
  const s=getNativeSession();if(!s)return null;
  return {sessionToken:s.sessionToken,nativeRunId:s.runId,epoch:String(getSessionEpoch()),expiresAt:s.expiresAt};
 };
 const subscribeSui=listener=>{
  const offConnection=connection.subscribe(listener);
  let offNetwork;try{offNetwork=network.subscribe(listener);}catch(error){offConnection();throw error;}
  return()=>{offConnection();offNetwork();};
 };
 return Object.freeze({origin,provider,getSession,getSui,subscribeSui});
}
