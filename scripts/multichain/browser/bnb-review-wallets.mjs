// Inject the already-selected Sui wallet/account and EIP-1193 provider.
// No discovery, connection, network switch, transaction signing or sending.
export function createBnbReviewWallets({getSui,subscribeSui,provider}){
 if(typeof getSui!=='function'||typeof subscribeSui!=='function'||typeof provider?.request!=='function'||typeof provider.on!=='function'||typeof provider.removeListener!=='function')throw Error('wallet-adapters-required');
 let revision=0,disposed=false;const changed=()=>{revision++;};
 const unsubscribe=subscribeSui(changed);if(typeof unsubscribe!=='function')throw Error('wallet-subscription-required');
 const events=['accountsChanged','chainChanged','disconnect'];for(const event of events)provider.on(event,changed);
 const check=ok=>{if(!ok)throw Error('wallet-changed-review-required');};
 function sui(){check(!disposed);const s=getSui();check(s?.network==='sui:mainnet'&&s.wallet?.accounts?.some(a=>a===s.account)&&s.account?.chains?.includes('sui:mainnet')&&s.account?.features?.includes('sui:signPersonalMessage'));return s;}
 async function snapshot(){const epoch=revision,s=sui();const accounts=await provider.request({method:'eth_accounts'}),chain=await provider.request({method:'eth_chainId'});check(!disposed&&revision===epoch&&sui().account===s.account&&sui().wallet===s.wallet&&chain==='0x38'&&Array.isArray(accounts)&&/^0x[0-9a-fA-F]{40}$/.test(accounts[0]||''));return {suiWallet:s.account.address,payer:accounts[0].toLowerCase(),chainId:56,network:'sui:mainnet',epoch:String(epoch)};}
 async function unchanged(before){const after=await snapshot();check(JSON.stringify(before)===JSON.stringify(after));}
 return Object.freeze({snapshot,epoch:()=>String(revision),
  async signSuiMessage({address,message}){
   const before=await snapshot();check(before.suiWallet===address&&message instanceof Uint8Array);const s=sui(),feature=s.wallet.features?.['sui:signPersonalMessage'];check(typeof feature?.signPersonalMessage==='function');
   const result=await feature.signPersonalMessage({account:s.account,message});await unchanged(before);check(sui().wallet===s.wallet&&sui().account===s.account&&typeof result?.signature==='string');return result.signature;
  },
  async signBnbMessage({address,message,chainId}){
   const before=await snapshot();check(before.payer===address&&chainId===56&&typeof message==='string');
   const data='0x'+Array.from(new TextEncoder().encode(message),b=>b.toString(16).padStart(2,'0')).join('');
   const signature=await provider.request({method:'personal_sign',params:[data,address]});await unchanged(before);check(typeof signature==='string'&&/^0x[0-9a-fA-F]{130}$/.test(signature));return signature;
  },
  destroy(){if(disposed)return;disposed=true;changed();unsubscribe();for(const event of events)provider.removeListener(event,changed);},
 });
}
