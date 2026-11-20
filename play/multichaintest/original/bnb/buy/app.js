import {C,STEPS,preflight,requestPurchase,recoverReceipt,loadState,createReadProvider} from './core.js?v=original-purchase-1';
const el=id=>document.getElementById(id),tell=t=>el('status').textContent=t,providers=new Map();
let provider=null,wallet=null,quote=null,busy=false,blocked=false,epoch=0,cleanup=()=>{};
const fee=n=>(Number(BigInt(n))/1e18).toFixed(8)+' BNB';
function stored(){try{return loadState(localStorage)}catch{blocked=true;tell('Stored purchase state needs review. Check wallet activity before another request.');return {receipts:[]}}}
function render(){
 const s=stored(),a=quote?.action,complete=a==='complete';
 el('approve').disabled=busy||blocked||!provider||!!s.pending||!quote||complete||Date.now()-quote.quotedAt>C.maxAge||!el('consent').checked;
 el('refresh').disabled=busy||blocked||!provider;el('receipt-check').disabled=busy||blocked||!provider;el('disconnect').hidden=!provider;el('disconnect').disabled=busy;el('connect-wallet').disabled=busy;
 for(const b of el('wallet-list').children)b.disabled=busy;
 el('step').textContent=!a?'Connect and simulate the next step':complete?'Purchase complete — ownership verified':({reset:'Preparation',approve:'1 of 2',buy:'2 of 2'}[a]+' · '+STEPS[a].label);
 el('approve').textContent=a&&!complete?'Open wallet · '+STEPS[a].label:'Open wallet for the next step';
 el('review-copy').textContent=a==='reset'?'I reviewed resetting this pass contract’s USDT allowance to zero. This spends BNB gas and transfers no USDT.':a==='approve'?'I reviewed approving exactly 25 USDT to the displayed original-backed pass contract. Approval spends BNB gas but does not transfer USDT.':'I reviewed buying one original-backed pass for exactly 25 USDT, paid to the displayed treasury. BNB gas is also required.';
 el('receipt').hidden=!s.pending&&!s.receipts.length;el('hash').textContent=[...s.receipts.map(x=>x.action+' · '+x.hash),...(s.pending?[s.pending.hash??'A wallet request is recorded. Check wallet activity for its hash.']:[])].join('\n');
 if(s.pending?.hash&&!el('receipt-input').value)el('receipt-input').value=s.pending.hash;
 el('pending-note').hidden=!s.pending;
}
function setQuote(q){quote=q;el('consent').checked=false;el('fee').textContent=q.action==='complete'?'No further purchase transaction':fee(q.estimatedFeeWei)+' estimated for this step';el('token-balance').textContent=(Number(BigInt(q.tokenBalance))/1e18).toFixed(6)+' USDT';el('quote-status').textContent=q.action==='complete'?'Pass #1 ownership, contract access and zero remaining allowance are verified.':'Checked '+new Date(q.quotedAt).toLocaleTimeString()+' · expires in two minutes.';render()}
async function check(){
 if(!provider||busy)return;const p=provider,e=epoch;busy=true;quote=null;el('consent').checked=false;render();tell('Checking original NFT custody, the delivered reserve, purchase enablement, exact contracts, wallet and gas. No signature requested…');
 try{const q=await preflight(p);if(p!==provider||e!==epoch)throw Error('Wallet changed. Refresh checks.');setQuote(q);el('wallet-status').textContent='Designated BNB wallet verified: '+C.from;tell(q.action==='complete'?'Purchase verified. Pass #1 belongs to your BNB wallet and no USDT allowance remains. Live Arcade integration is a separate step. Send the purchase hash back here.':stored().pending?'A wallet request is recorded. Verify its receipt below before continuing.':'Simulation passed. Review the displayed step and checkbox before opening your wallet.')}catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;render()}
}
async function connect(w){
 if(busy)return;busy=true;quote=null;epoch++;el('consent').checked=false;render();tell('Waiting for wallet connection approval…');
 try{await w.request({method:'eth_requestAccounts'});cleanup();wallet=w;provider=createReadProvider(w,{endpoints:['https://bsc-rpc.publicnode.com','https://bsc-dataseed.bnbchain.org','https://bsc-dataseed-public.bnbchain.org']});epoch++;
 const changed=()=>{if(wallet===w){epoch++;quote=null;el('consent').checked=false;el('wallet-status').textContent='Wallet changed. Select BNB mainnet and account ending 83ae, then simulate again.';render()}};
 for(const e of ['accountsChanged','chainChanged','disconnect'])w.on?.(e,changed);cleanup=()=>{for(const e of ['accountsChanged','chainChanged','disconnect'])w.removeListener?.(e,changed)};
 el('wallet-status').textContent='Wallet connected. Checking the selected account and network…';
 }catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;render()}
 if(wallet===w)await check();
}
function add(w,name){if(!w?.request||providers.has(w))return;providers.set(w,name);const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='Connect '+String(name).slice(0,70);b.onclick=()=>connect(w);el('wallet-list').append(b);el('wallet-help').textContent='Select the extension holding your BNB wallet ending 83ae.';render()}
function discover(){for(const w of window.ethereum?.providers??[])add(w,w.isBraveWallet?'Brave Wallet':w.isMetaMask?'MetaMask':'EVM wallet');add(window.ethereum,'browser EVM wallet');window.dispatchEvent(new Event('eip6963:requestProvider'));if(!providers.size)el('wallet-help').textContent='No EVM extension detected yet. Unlock your BNB wallet, enable it for this site and click Connect wallet again.'}
window.addEventListener('eip6963:announceProvider',e=>add(e.detail?.provider,e.detail?.info?.name??'EVM wallet'));window.addEventListener('ethereum#initialized',discover);
el('connect-wallet').onclick=async()=>{discover();if(providers.size===1)await connect([...providers.keys()][0]);else tell(providers.size?'Choose your BNB wallet below.':'No EVM extension detected. Unlock it and check site access.')};
el('disconnect').onclick=()=>{if(busy)return;cleanup();provider=null;wallet=null;epoch++;quote=null;el('consent').checked=false;el('wallet-status').textContent='Page disconnected. Reconnect the designated BNB account.';render()};
el('refresh').onclick=check;el('consent').onchange=render;
el('approve').onclick=async()=>{
 if(busy||!provider||!quote)return;const p=provider,e=epoch;busy=true;render();tell('Repeating custody, contract, payment, wallet and gas checks before opening your wallet…');
 try{await requestPurchase({provider:p,storage:localStorage,locks:navigator.locks,reviewed:()=>el('consent').checked,reviewedQuote:()=>quote,isCurrent:()=>p===provider&&e===epoch,onQuote:setQuote});tell('Submitted. Check the receipt below before continuing.')}catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;quote=null;el('consent').checked=false;render()}
};
el('receipt-check').onclick=async()=>{
 if(busy||!provider)return;const p=provider,e=epoch;busy=true;render();tell('Verifying exact transaction, USDT events, pass state and original NFT custody…');let verified=false;
 try{const r=await recoverReceipt({provider:p,hash:el('receipt-input').value.trim(),storage:localStorage,locks:navigator.locks,isCurrent:()=>p===provider&&e===epoch});verified=r.status==='verified';tell(verified?'Receipt verified. Refreshing the next step…':'The transaction has not confirmed yet. Check again shortly.');if(verified)el('receipt-input').value=''}catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;quote=null;el('consent').checked=false;render()}
 if(verified)await check();
};
window.addEventListener('storage',e=>{if(e.key===null||e.key===C.key){quote=null;el('consent').checked=false;render();tell('Purchase state changed in another tab. Check its receipt and refresh.')}});
window.setInterval(()=>{if(quote&&quote.action!=='complete'&&Date.now()-quote.quotedAt>C.maxAge){quote=null;el('consent').checked=false;el('quote-status').textContent='Simulation expired. Refresh before signing.';render()}},1000);
window.addEventListener('pagehide',()=>cleanup(),{once:true});
for(const [key,value]of Object.entries({expected:C.from,pass:C.pass,currency:C.currency,treasury:C.treasury,nft:C.nft,route:C.route}))el(key).textContent=value;
discover();render();
