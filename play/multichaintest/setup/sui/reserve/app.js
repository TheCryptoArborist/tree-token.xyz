import {createDAppKit,SuiGrpcClient} from './wallet-vendor.js';
import {C,preflight,requestReserve,readStoredState} from './core.js?v=reserve-1';
const el=id=>document.getElementById(id),say=s=>el('status').textContent=s;
const kit=createDAppKit({networks:['mainnet'],defaultNetwork:'mainnet',autoConnect:false,slushWalletConfig:null,createClient:network=>new SuiGrpcClient({network,baseUrl:'https://fullnode.mainnet.sui.io:443'})});
let busy=false,connecting=false,epoch=0,quote=null;
const sui=n=>(BigInt(n)/1000000000n)+"."+(BigInt(n)%1000000000n).toString().padStart(9,"0");
function setQuote(q){quote=q;el("reviewed").checked=false;el("message-fee").textContent=sui(q.feeMist)+" SUI";el("gas-fee").textContent=sui(q.gasMist)+" SUI";el("total-fee").textContent=sui(q.totalMist)+" SUI";el("quote-status").textContent="Checked "+new Date(q.quotedAt).toLocaleTimeString()+" · expires in two minutes. Refresh if needed.";update();}
const identity=()=>({address:kit.stores.$connection.get().account?.address,network:kit.stores.$currentNetwork.get(),epoch});
async function connect(wallet){if(busy||connecting)return;connecting=true;wallets();update();say('Waiting for '+wallet.name+' connection approval…');try{await kit.connectWallet({wallet});say('Wallet connected. Check the selected dev account, then review the transaction.');}catch(e){say('Connection failed: '+String(e?.message??e).slice(0,450));}finally{connecting=false;wallets();update();}}
el('connect-wallet').onclick=async()=>{if(busy||connecting)return;const ws=kit.stores.$wallets.get();if(ws.length===1){await connect(ws[0]);return;}el('wallet-help').hidden=ws.length>0;wallets();say(ws.length?'Select your wallet below.':'Slush has not been detected in this browser. Use the extension help below, or Open in Slush on mobile.');};
el('reload-wallets').onclick=()=>window.location.reload();
el('expected').textContent=C.sender;
function showReceipt(r){el('receipt').hidden=false;el('digest').textContent=r.digest;el('explorer').href='https://suivision.xyz/txblock/'+encodeURIComponent(r.digest);el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(r.digest);say('Digest copied. Send it back to the conversation.');}catch{say('Copy the digest shown above.');}};}
function update(){
 const a=kit.stores.$connection.get().account?.address;
 el('wallet-status').textContent=a?'Connected: '+a:'Connect the Sui dev wallet using Slush in Brave.';el('disconnect').hidden=!a;el('connect-wallet').disabled=busy||connecting;el('connect-wallet').textContent=connecting?'Waiting for wallet…':a?'Choose / reconnect wallet':'Connect wallet';
 let s;try{s=readStoredState(localStorage);if(s.receipt)showReceipt(s.receipt);}catch{el('configure').disabled=true;say('Storage is unavailable. Enable browser storage and check wallet activity.');return;}
 el('quote').disabled=busy||connecting||a?.toLowerCase()!==C.sender||kit.stores.$currentNetwork.get()!=='mainnet'||s.pending||!!s.receipt;
 el('configure').disabled=!quote||Date.now()-quote.quotedAt>120000||busy||connecting||a?.toLowerCase()!==C.sender||kit.stores.$currentNetwork.get()!=='mainnet'||!el('reviewed').checked||s.pending||!!s.receipt;
 el('configure').textContent=busy?'Checking / waiting for wallet…':s.receipt?'Reserve already submitted':s.pending?'Check wallet activity':'Open wallet to announce reserve';
 if(!busy&&(s.pending||s.receipt))say(s.receipt?'A reserve receipt is recorded. Send its digest back; do not send again.':'A wallet request may already be submitted. Check wallet activity and send back its digest before continuing.');
}
function wallets(){const ws=kit.stores.$wallets.get();el('wallet-list').replaceChildren();el('discovery').textContent=ws.length?'Detected '+ws.length+' Sui wallet'+(ws.length===1?'':'s')+'. Connect above or choose below.':'Wallet detection: no Sui extension detected yet. Connect wallet above shows the available connection options.';if(ws.length)el('wallet-help').hidden=true;for(const wallet of ws){const b=document.createElement('button');b.type='button';b.textContent='Connect '+wallet.name;b.disabled=busy||connecting;b.onclick=()=>connect(wallet);el('wallet-list').append(b);}}
kit.stores.$wallets.subscribe(wallets);kit.stores.$connection.subscribe(()=>{epoch++;quote=null;el('reviewed').checked=false;update();});kit.stores.$currentNetwork.subscribe(()=>{epoch++;quote=null;el('reviewed').checked=false;update();});
el('disconnect').onclick=async()=>{if(busy)return;try{await kit.disconnectWallet();say('Select the Sui dev account in Slush, then reconnect.');}catch(e){say(String(e?.message??e));}};
el('reviewed').onchange=update;
window.addEventListener('storage',e=>{if(e.key===null||e.key===C.key||e.key===C.key+'-pending')update();});
el('quote').onclick=async()=>{if(busy||connecting)return;const before=identity();busy=true;quote=null;el('reviewed').checked=false;update();wallets();say('Checking both chains and simulating the quote and send. No signature requested…');try{const q=await preflight(before.address);const after=identity();if(before.address!==after.address||before.network!==after.network||before.epoch!==after.epoch)throw Error('Wallet changed during quote. Reconnect and refresh.');setQuote(q);say('Simulation passed. Review the message fee, gas estimate and Canary correction above.');}catch(e){say(String(e?.message??e).slice(0,600));}finally{busy=false;update();wallets();}};
window.setInterval(()=>{if(quote&&Date.now()-quote.quotedAt>120000){quote=null;el('reviewed').checked=false;el('quote-status').textContent='Quote expired. Get a fresh quote before signing.';update();}},1000);
el('configure').onclick=async()=>{if(busy)return;busy=true;update();wallets();say('Rechecking both chains and refreshing the message fee. No signature requested yet…');try{
 const r=await requestReserve({storage:localStorage,locks:navigator.locks,identity,reviewed:()=>el('reviewed').checked,reviewedQuote:()=>quote,onQuote:setQuote,sign:async input=>{say('Simulation passed. Review the Canary identity correction, reserve announcement, SUI message fee and gas in Slush.');return kit.signAndExecuteTransaction(input);},onReceipt:showReceipt});
 say('Wallet reported success. Send this digest back so the applied settings can be verified.');
 try{await kit.getClient().core.waitForTransaction({digest:r.digest});say('Transaction indexed. Send the digest back to verify the reserve packet and BNB delivery.');}catch{say('Submission recorded; receipt lookup has not completed. Send the digest back. Do not send again.');}
}catch(e){let s;try{s=readStoredState(localStorage);}catch{s={pending:true};}say(String(e?.message??e).slice(0,600)+(s.pending?' Check wallet activity before another attempt.':''));}finally{busy=false;update();wallets();}};
update();
