// Explicit EIP-6963 choice. Names are untrusted text; no icon, global provider or auto-connect.
export function mountBnbProviderPicker({root,onSelected,target=window}){
 const doc=root.ownerDocument,section=doc.createElement('section'),status=doc.createElement('p'),list=doc.createElement('div');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='No BNB wallet announced yet. Enable a compatible browser wallet, then reopen this review.';section.append(status,list);root.append(section);
 const entries=new Map();let disposed=false,busy=false,attempt=0,unsubscribe=()=>{};
 const active=()=>!disposed;
 const update=()=>{for(const b of list.querySelectorAll('button'))b.disabled=busy;};
 async function select(entry){
  if(disposed||busy)return;busy=true;const id=++attempt;unsubscribe();unsubscribe=()=>{};update();status.textContent='Approve the connection in your selected wallet.';
  let revision=0;const changed=()=>{revision++;};const events=['accountsChanged','chainChanged','disconnect'];
  const remove=()=>{for(const event of events)entry.provider.removeListener(event,changed);};
  try{
   for(const event of events)entry.provider.on(event,changed);unsubscribe=remove;onSelected(null);
   await entry.provider.request({method:'eth_requestAccounts'});const observed=revision;
   const accounts=await entry.provider.request({method:'eth_accounts'}),chain=await entry.provider.request({method:'eth_chainId'});
   if(!active()||id!==attempt)return;
   if(observed!==revision||chain!=='0x38'||!Array.isArray(accounts)||!/^0x[0-9a-fA-F]{40}$/.test(accounts[0]||'')||/^0x0{40}$/i.test(accounts[0]))throw Error('review-required');
   remove();const invalidate=()=>{if(!active()||id!==attempt)return;unsubscribe();unsubscribe=()=>{};onSelected(null);status.textContent='Wallet account or network changed. Select the wallet again to review.';};
   for(const event of events)entry.provider.on(event,invalidate);unsubscribe=()=>{for(const event of events)entry.provider.removeListener(event,invalidate);};
   onSelected(entry.provider);status.textContent=`Selected ${entry.name}: ${accounts[0]}. BNB Smart Chain. No payment was requested.`;
  }catch{unsubscribe();unsubscribe=()=>{};if(active()&&id===attempt){onSelected(null);status.textContent='Connection not ready. Select BNB Smart Chain in your wallet and try again. No payment was requested.';}}
  finally{remove();if(active()&&id===attempt){busy=false;update();}}
 }
 function announce(event){
  if(disposed)return;const d=event.detail,info=d?.info,p=d?.provider;
  if(typeof info?.uuid!=='string'||!/^[a-f0-9-]{36}$/i.test(info.uuid)||typeof info.name!=='string'||!info.name.trim()||info.name.length>100||typeof p?.request!=='function'||typeof p.on!=='function'||typeof p.removeListener!=='function'||entries.has(info.uuid)||entries.size>=20||[...entries.values()].some(e=>e.provider===p))return;
  if(entries.size===0)status.textContent='Choose a BNB wallet for review. Wallet names are supplied by extensions.';
  const entry={name:info.name,provider:p};entries.set(info.uuid,entry);const b=doc.createElement('button');b.type='button';b.textContent='Connect '+entry.name;b.disabled=busy;b.addEventListener('click',()=>{void select(entry);});list.append(b);
 }
 target.addEventListener('eip6963:announceProvider',announce);target.dispatchEvent(new Event('eip6963:requestProvider'));
 return {destroy(){if(disposed)return;disposed=true;attempt++;unsubscribe();target.removeEventListener('eip6963:announceProvider',announce);section.remove();}};
}
