import {C,STEPS,GUID,preflight,requestSend,recoverReceipt,loadState,createReadProvider} from './core.js?v=original-send-1';
const el=id=>document.getElementById(id),tell=t=>el('status').textContent=t,providers=new Map();
let provider=null,wallet=null,quote=null,busy=false,blocked=false,epoch=0,cleanup=()=>{};
const fee=n=>(Number(BigInt(n))/1e18).toFixed(8)+' BNB';
function stored(){try{return loadState(localStorage)}catch{blocked=true;tell('Stored redemption state needs review. Check wallet activity before another request.');return {receipts:[]}}}
function render(){
 const s=stored(),a=quote?.action,complete=a==='complete',fund=a==='fund';
 el('approve').disabled=busy||blocked||!provider||!!s.pending||!quote||complete||fund||Date.now()-quote.quotedAt>C.maxAge||!el('consent').checked;
 el('refresh').disabled=busy||blocked||!provider;el('receipt-check').disabled=busy||blocked||!provider;el('disconnect').hidden=!provider;el('disconnect').disabled=busy;el('connect-wallet').disabled=busy;
 for(const b of el('wallet-list').children)b.disabled=busy;
 el('step').textContent=!a?'Connect and simulate the send':fund?'Add BNB before sending':complete?'Request sent — verify destination separately':'Send the fixed redemption to Sui';
 el('approve').textContent='Open wallet to send redemption';
 el('review-copy').textContent='I reviewed sending the fixed request for original NFTree #2720 to the Sui dev wallet ending 45c4. I approve the displayed native BNB message fee plus separate network gas. Sui release and the return acknowledgement must be verified afterward.';
 el('receipt').hidden=!s.pending&&!s.receipts.length;el('hash').textContent=[...s.receipts.map(x=>x.action+' · '+x.hash),...(s.pending?[s.pending.hash??'A wallet request is recorded. Check wallet activity for its hash.']:[])].join('\n');
 if(s.pending?.hash&&!el('receipt-input').value)el('receipt-input').value=s.pending.hash;
 el('pending-note').hidden=!s.pending;
}
function setQuote(q){quote=q;el('consent').checked=false;el('fee').textContent=q.action==='complete'?'No further send transaction':fee(q.estimatedFeeWei)+' estimated network gas';el('funding').textContent=q.balanceWei?'BNB balance: '+fee(q.balanceWei)+' · required message fee plus buffered gas: '+fee(q.requiredBalanceWei)+(q.action==='fund'?' · shortfall: '+fee(q.shortfallWei):''):'Outgoing send state verified. Destination verification is separate.';el('message-fee').textContent=q.feeWei?fee(q.feeWei)+' native BNB paid by this approval':'Message already sent';el('quote-status').textContent=q.action==='complete'?'The one-shot redemption request has been sent. This page will not request another transaction.':'Checked '+new Date(q.quotedAt).toLocaleTimeString()+' · expires in two minutes.';render()}
async function check(){
 if(!provider||busy)return;const p=provider,e=epoch;busy=true;quote=null;el('consent').checked=false;render();tell('Checking original custody, actual lock receipt, route security, fixed request, exact message fee, packet GUID and send gas. No signature requested…');
 try{const q=await preflight(p);if(p!==provider||e!==epoch)throw Error('Wallet changed. Refresh checks.');setQuote(q);el('wallet-status').textContent='Designated BNB wallet verified: '+C.from;tell(q.action==='fund'?'Custody, lock, route, quote and send-simulation checks passed. Add native BNB on BNB Smart Chain to wallet ending 83ae before sending. The amount needed is displayed above. No transaction has been requested.':q.action==='complete'?'Outgoing redemption send verified. Send its transaction hash back to this chat so we can verify Sui delivery. This page has not verified NFT release or the return acknowledgement.':stored().pending?'A wallet request is recorded. Verify its receipt below before continuing.':'Simulation passed. Review the displayed step and checkbox before opening your wallet.')}catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;render()}
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
 if(busy||!provider||!quote)return;const p=provider,e=epoch;busy=true;render();tell('Repeating custody, lock, contract, recipient, quote, wallet and gas checks before opening your wallet…');
 try{await requestSend({provider:p,storage:localStorage,locks:navigator.locks,reviewed:()=>el('consent').checked,reviewedQuote:()=>quote,isCurrent:()=>p===provider&&e===epoch,onQuote:setQuote});tell('Submitted. Check the receipt below before continuing.')}catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;quote=null;el('consent').checked=false;render()}
};
el('receipt-check').onclick=async()=>{
 if(busy||!provider)return;const p=provider,e=epoch;busy=true;render();tell('Verifying the exact send transaction, LayerZero packet, GUID, fee and current BNB send state…');let verified=false;
 try{const r=await recoverReceipt({provider:p,hash:el('receipt-input').value.trim(),storage:localStorage,locks:navigator.locks,isCurrent:()=>p===provider&&e===epoch});verified=r.status==='verified';tell(verified?'Receipt verified. Refreshing the next step…':'The transaction has not confirmed yet. Check again shortly.');if(verified)el('receipt-input').value=''}catch(error){tell(String(error?.message??error).slice(0,650))}finally{busy=false;quote=null;el('consent').checked=false;render()}
 if(verified)await check();
};
window.addEventListener('storage',e=>{if(e.key===null||e.key===C.key){quote=null;el('consent').checked=false;render();tell('Redemption state changed in another tab. Check its receipt and refresh.')}});
window.setInterval(()=>{if(quote&&quote.action!=='complete'&&Date.now()-quote.quotedAt>C.maxAge){quote=null;el('consent').checked=false;el('quote-status').textContent='Simulation expired. Refresh before signing.';render()}},1000);
window.addEventListener('pagehide',()=>cleanup(),{once:true});
for(const [key,value]of Object.entries({expected:C.from,adapter:C.adapter,guid:GUID,pass:C.pass,recipient:C.recipient,request:C.request,nft:C.nft,route:C.route}))el(key).textContent=value;
discover();render();
