import {createDAppKit,SuiGrpcClient} from '../../../setup/sui/ack/wallet-vendor.js';
import {C,preflight,readStoredState,recoverReceipt,requestAcknowledgement} from './core.js?v=original-ack-1';

const el=id=>document.getElementById(id);
const say=message=>{el('status').textContent=message;};
const MAX_QUOTE_AGE=120000;
const kit=createDAppKit({
  networks:['mainnet'],defaultNetwork:'mainnet',autoConnect:false,slushWalletConfig:null,
  createClient:network=>new SuiGrpcClient({network,baseUrl:'https://fullnode.mainnet.sui.io:443'})
});
let busy=false,connecting=false,epoch=0,quote=null,progress='ready';
const sui=value=>{
  const amount=BigInt(value),fraction=(amount%1000000000n).toString().padStart(9,'0').replace(/0+$/,'');
  return (amount/1000000000n).toString()+(fraction?'.'+fraction:'')+' SUI';
};
const identity=()=>({address:kit.stores.$connection.get().account?.address,network:kit.stores.$currentNetwork.get(),epoch});
const sameIdentity=(a,b)=>a.address===b.address&&a.network===b.network&&a.epoch===b.epoch;
const fresh=()=>quote?.stage==='ready'&&Date.now()>=quote.quotedAt&&Date.now()-quote.quotedAt<=MAX_QUOTE_AGE;

for(const [id,value] of Object.entries({expected:C.sender,nft:C.nft,package:C.package,vault:C.vault,adapter:C.adapter,pass:C.pass,request:C.request,guid:C.guid})){
  el(id).textContent=value;
}

function invalidateQuote(message){
  quote=null;
  el('reviewed').checked=false;
  for(const id of ['message-fee','gas-fee','total-fee'])el(id).textContent='Get a fresh quote below';
  if(message)el('quote-status').textContent=message;
}

function renderProgress(){
  el('pass-stage').textContent=progress==='retired'?'Retired · redemption complete':progress==='acknowledged'?'Acknowledgement sent · checking BNB delivery':progress==='submitted'?'Submission recorded · verify the receipt':'Awaiting your acknowledgement';
}

function setQuote(result){
  quote=result;
  el('reviewed').checked=false;
  if(result.stage==='ready'){
    el('message-fee').textContent=sui(result.feeMist);
    el('gas-fee').textContent=sui(result.gasMist);
    el('total-fee').textContent=sui(result.totalMist);
    el('quote-status').textContent='Checked '+new Date(result.quotedAt).toLocaleTimeString()+' · expires at '+new Date(result.quotedAt+MAX_QUOTE_AGE).toLocaleTimeString()+'.';
  }else{
    progress=result.stage==='retired'?'retired':'acknowledged';
    for(const id of ['message-fee','gas-fee','total-fee'])el(id).textContent='Acknowledgement already sent';
    el('quote-status').textContent=result.stage==='retired'?'The BNB pass is retired. This redemption is complete.':'The acknowledgement is already sent. Check its receipt below to verify completion.';
  }
  renderProgress();
  update();
}

function showReceipt(receipt){
  if(!el('receipt-input').value)el('receipt-input').value=receipt.digest;
  el('receipt').hidden=false;
  el('digest').textContent=receipt.digest;
  const verified=receipt.status==='chain_verified',retired=verified&&receipt.destinationStatus==='retired';
  el('receipt-status').textContent=verified?'Acknowledgement confirmed on Sui.':'Wallet reported a submission. Verify the receipt to confirm it on-chain.';
  el('pass-result').textContent=retired?'BNB delivery verified. Pass #1 is retired and the redemption is complete.':verified?'BNB pass retirement is still pending. Check this receipt again to refresh the result.':'Final BNB delivery has not yet been verified.';
  if(retired)progress='retired';
  else if(verified&&progress!=='retired')progress='acknowledged';
  else if(!verified&&progress==='ready')progress='submitted';
  renderProgress();
  el('explorer').href='https://suivision.xyz/txblock/'+encodeURIComponent(receipt.digest);
  el('copy').onclick=async()=>{
    try{await navigator.clipboard.writeText(receipt.digest);say('Digest copied. Send it back to the conversation.');}
    catch{say('Copy the transaction digest shown above.');}
  };
}

function update(){
  const account=identity(),connected=Boolean(account.address),correct=account.address?.toLowerCase()===C.sender&&account.network==='mainnet';
  el('wallet-status').textContent=connected?(correct?'Connected dev wallet: '+account.address:'Connected: '+account.address+'. Select the dev account ending 45c4 on Sui mainnet, then disconnect and reconnect here.'):'Connect the Sui dev wallet using Slush in Brave.';
  el('disconnect').hidden=!connected;
  el('disconnect').disabled=busy||connecting;
  el('connect-wallet').disabled=busy||connecting;
  el('connect-wallet').textContent=connecting?'Waiting for wallet…':connected?'Choose / reconnect wallet':'Connect wallet';
  el('reload-wallets').disabled=busy||connecting;
  el('check-receipt').disabled=el('check-receipt-top').disabled=busy||connecting;
  el('receipt-input').disabled=busy;
  let saved;
  try{
    saved=readStoredState(localStorage);
    el('storage-status').hidden=true;
    if(saved.receipt)showReceipt(saved.receipt);
  }catch{
    el('quote').disabled=el('configure').disabled=el('reviewed').disabled=true;
    el('storage-status').textContent='Browser storage could not be read. Check Slush activity before trying again.';
    el('storage-status').hidden=false;
    return;
  }
  const blocked=busy||connecting||!correct||saved.pending||Boolean(saved.receipt);
  el('quote').disabled=blocked;
  el('quote').textContent=progress==='acknowledged'||progress==='retired'?'Refresh completion status':'Simulate acknowledgement';
  el('reviewed').disabled=blocked||!fresh();
  el('configure').disabled=blocked||!fresh()||!el('reviewed').checked;
  el('configure').textContent=busy?'Checking / waiting for wallet…':progress==='retired'?'Redemption complete':saved.receipt?.status==='wallet_reported_success'?'Submission recorded':saved.receipt||progress==='acknowledged'?'Acknowledgement already sent':saved.pending?'Check wallet activity':'Open wallet to acknowledge release';
}

function wallets(){
  const available=kit.stores.$wallets.get();
  el('wallet-list').replaceChildren();
  el('discovery').textContent=available.length?'Detected '+available.length+' Sui wallet'+(available.length===1?'':'s')+'. Connect above or choose below.':'Wallet detection: no Sui extension detected yet.';
  el('wallet-help').hidden=available.length>0;
  for(const wallet of available){
    const button=document.createElement('button');
    button.type='button';button.textContent='Connect '+wallet.name;button.disabled=busy||connecting;
    button.onclick=()=>connect(wallet);
    el('wallet-list').append(button);
  }
}

async function connect(wallet){
  if(busy||connecting)return;
  connecting=true;wallets();update();say('Waiting for '+wallet.name+' connection approval…');
  try{await kit.connectWallet({wallet});say('Wallet connected. Check the selected dev account, then simulate the acknowledgement.');}
  catch(error){say('Connection failed: '+String(error?.message??error).slice(0,450));}
  finally{connecting=false;wallets();update();}
}

el('connect-wallet').onclick=async()=>{
  if(busy||connecting)return;
  const available=kit.stores.$wallets.get();
  if(available.length===1){await connect(available[0]);return;}
  wallets();
  say(available.length?'Select your wallet below.':'Slush has not been detected in this browser. Unlock Slush and check the extension help above.');
};
el('reload-wallets').onclick=()=>window.location.reload();
el('disconnect').onclick=async()=>{
  if(busy||connecting)return;
  try{await kit.disconnectWallet();say('Select the Sui dev account in Slush, then reconnect.');}
  catch(error){say(String(error?.message??error).slice(0,450));}
};
el('reviewed').onchange=update;

const unsubscribers=[
  kit.stores.$wallets.subscribe(wallets),
  kit.stores.$connection.subscribe(()=>{epoch++;invalidateQuote();update();}),
  kit.stores.$currentNetwork.subscribe(()=>{epoch++;invalidateQuote();update();})
];
window.addEventListener('storage',event=>{
  if(event.key===null||event.key===C.key||event.key===C.key+'-pending'){
    invalidateQuote('Activity changed in another tab. Check the receipt before continuing.');update();
  }
});

el('quote').onclick=async()=>{
  if(busy||connecting)return;
  const before=identity();busy=true;invalidateQuote();update();wallets();
  say('Checking the returned NFT, locked BNB pass and acknowledgement fee. No signature requested…');
  try{
    const result=await preflight(before.address);
    if(!sameIdentity(before,identity()))throw Error('Wallet changed during the checks. Reconnect and refresh.');
    setQuote(result);
    say(result.stage==='ready'?'Simulation passed. Review the message fee and gas estimate, then confirm the acknowledgement.':result.stage==='retired'?'BNB pass #1 is retired. The redemption is complete.':'The Sui acknowledgement is already sent. Check its transaction digest below; another send is blocked.');
  }catch(error){say(String(error?.message??error).slice(0,600));}
  finally{busy=false;update();wallets();}
};

const quoteTimer=window.setInterval(()=>{
  if(!busy&&quote?.stage==='ready'&&!fresh()){
    invalidateQuote('Quote expired. Get a fresh quote before signing.');update();
  }
},1000);

async function verifyStoredReceipt(digest){
  if(!navigator.locks?.request)throw Error('Use current Brave for receipt coordination.');
  return navigator.locks.request(C.key,{ifAvailable:true},async lock=>{
    if(!lock)throw Error('Another tab is checking this acknowledgement.');
    return recoverReceipt(digest,{storage:localStorage});
  });
}

function receiptMessage(receipt){
  return receipt.destinationStatus==='retired'?'Acknowledgement and BNB delivery verified. Pass #1 is retired; the redemption is complete.':'Acknowledgement confirmed on Sui. BNB pass retirement is still pending. Check the receipt again to refresh delivery.';
}

el('configure').onclick=async()=>{
  if(busy||connecting)return;
  busy=true;update();wallets();
  say('Refreshing the acknowledgement checks and fee before opening your wallet…');
  try{
    const receipt=await requestAcknowledgement({
      storage:localStorage,locks:navigator.locks,identity,
      reviewed:()=>el('reviewed').checked,reviewedQuote:()=>quote,onQuote:setQuote,onReceipt:showReceipt,
      sign:async input=>{say('Review the acknowledgement, message fee and gas in your wallet.');return kit.signAndExecuteTransaction(input);}
    });
    say('Submission recorded. Waiting for Sui confirmation before checking the receipt…');
    try{
      await kit.getClient().core.waitForTransaction({digest:receipt.digest});
      say('Checking the Sui acknowledgement and BNB pass retirement…');
      const verified=await verifyStoredReceipt(receipt.digest);showReceipt(verified);say(receiptMessage(verified));
    }catch(error){
      say('Submission recorded. Receipt verification has not completed: '+String(error?.message??error).slice(0,400)+' Use Check acknowledgement receipt below.');
    }
  }catch(error){
    let pending=true;try{pending=readStoredState(localStorage).pending;}catch{}
    say(String(error?.message??error).slice(0,600)+(pending?' Check Slush activity before another attempt.':''));
  }finally{busy=false;update();wallets();}
};

el('check-receipt').onclick=async()=>{
  if(busy||connecting)return;
  busy=true;update();wallets();say('Checking the acknowledgement on Sui and the BNB pass…');
  try{
    const receipt=await verifyStoredReceipt(el('receipt-input').value.trim());
    showReceipt(receipt);say(receiptMessage(receipt));
  }catch(error){say(String(error?.message??error).slice(0,600));}
  finally{busy=false;update();wallets();}
};
el('check-receipt-top').onclick=()=>{
  if(!el('receipt-input').value.trim()){
    el('receipt-section').scrollIntoView({behavior:'smooth',block:'start'});el('receipt-input').focus();
    say('Paste the acknowledgement transaction digest from Slush, then check the receipt.');return;
  }
  el('check-receipt').click();
};

window.addEventListener('pagehide',event=>{
  if(!event.persisted){for(const off of unsubscribers)off();window.clearInterval(quoteTimer);}
});
update();
try{
  const saved=readStoredState(localStorage);
  if(saved.pending||saved.receipt)say('An acknowledgement is pending or recorded. Use Check acknowledgement receipt below to verify it.');
}catch{}
