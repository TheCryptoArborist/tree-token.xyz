import {preflight,requestDeployment,verifyReceipt,loadState,saveState} from './core.js?v=bind-1';

const CONFIG_SHA256='4dfbb245f1e90bb7d3d91e789fe8082dd8e1f6aec1473e00ac747c00e62d7409';
const el=id=>document.getElementById(id);
const tell=text=>{el('status').textContent=text;};
const providers=new Map();
let cfg=null,provider=null,epoch=0,busy=false,quote=null,blocked=false;
const key=()=> 'nftree-bnb-binding-'+cfg.dataSha256;
const fee=wei=>(Number(BigInt(wei))/1e18).toFixed(8)+' BNB';
function recorded(){try{return cfg?loadState(localStorage,key()):null;}catch{blocked=true;tell('Binding storage needs review. Check wallet activity before continuing.');return null;}}
function render(){
  const state=recorded();
  el('deploy').disabled=!provider||!cfg||busy||blocked||!!state||!quote||!el('consent').checked;
  el('refresh').disabled=!provider||!cfg||busy||blocked||!!state;
  el('receipt-check').disabled=!provider||busy||!state?.hash;
  el('receipt').hidden=!state;
  el('hash').textContent=state?.hash??'A wallet request may be pending. Check wallet activity before another binding.';
  el('copy-hash').hidden=!state?.hash;
  if(state?.status==='verified')el('receipt-note').textContent='Binding receipt and the live adapter/pass relationship are verified. Send this hash back to configure LayerZero.';
  else if(state?.hash)el('receipt-note').textContent='Transaction submitted. Check its receipt, then send this hash back to the conversation.';
  for(const button of el('wallet-list').children)button.disabled=busy;
}
async function check(){
  if(!provider||!cfg||busy)return;
  const chosen=provider,version=epoch;busy=true;quote=null;render();tell('Checking BNB, binding bytecode and gas…');
  try{
    const result=await preflight(chosen,cfg);
    if(provider!==chosen||epoch!==version)throw Error('Wallet changed during the checks. Refresh them again.');
    quote=result;el('fee').textContent=fee(result.estimatedFeeWei)+' estimated';
    el('wallet-status').textContent='Designated BNB wallet connected: '+cfg.from;
    tell('Checks passed. Review the details and confirm before opening your wallet. Your wallet displays the final fee.');
  }catch(error){const message=String(error?.message??error).slice(0,600);el('wallet-status').textContent='Wallet connected. Binding checks failed: '+message;tell(message);}
  finally{busy=false;render();}
}
function addProvider(wallet,name){
  if(!wallet?.request||providers.has(wallet))return;
  providers.set(wallet,name);
  el('wallet-help').textContent='Choose the wallet holding your designated BNB account.';
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Connect '+String(name).slice(0,70);
  button.onclick=async()=>{
    if(busy)return;busy=true;quote=null;epoch++;render();
    try{
      await wallet.request({method:'eth_requestAccounts'});provider=wallet;epoch++;
      const changed=()=>{if(provider===wallet){epoch++;quote=null;el('wallet-status').textContent='Wallet changed. Select the designated BNB account and refresh checks.';render();}};
      wallet.on?.('accountsChanged',changed);wallet.on?.('chainChanged',changed);wallet.on?.('disconnect',changed);
      el('wallet-status').textContent='Wallet connected. Checking the selected account and network…';
    }catch(error){tell(String(error?.message??error).slice(0,600));}
    finally{busy=false;render();}
    if(provider===wallet&&!recorded())await check();
  };
  el('wallet-list').append(button);render();
}
window.addEventListener('eip6963:announceProvider',event=>addProvider(event.detail?.provider,event.detail?.info?.name??'EVM wallet'));
window.dispatchEvent(new Event('eip6963:requestProvider'));
if(window.ethereum)addProvider(window.ethereum,'browser EVM wallet');
window.addEventListener('ethereum#initialized',()=>addProvider(window.ethereum,'browser EVM wallet'));
window.addEventListener('storage',event=>{if(cfg&&(event.key===null||event.key===key())){quote=null;render();tell('Binding state changed in another tab. Review its receipt before continuing.');}});
el('consent').onchange=render;
el('refresh').onclick=check;
el('deploy').onclick=async()=>{
  if(busy||!provider||!cfg)return;
  const chosen=provider,version=epoch;busy=true;render();tell('Refreshing checks before opening your wallet…');
  try{
    const result=await requestDeployment({provider:chosen,cfg,storage:localStorage,locks:navigator.locks,key:key(),consent:el('consent').checked,isCurrent:()=>provider===chosen&&epoch===version&&el('consent').checked});
    if(result)tell('Transaction submitted. Check the receipt below and send the transaction hash back.');
  }catch(error){tell(String(error?.message??error).slice(0,600)+(recorded()?' Check wallet activity before another request.':''));}
  finally{busy=false;quote=null;render();}
};
el('receipt-check').onclick=async()=>{
  const state=recorded();if(!state?.hash||!provider||busy)return;
  busy=true;render();
  try{
    const result=await verifyReceipt(provider,cfg,state.hash);
    if(result.status==='verified'){saveState(localStorage,key(),result);tell('Binding verified. Send this hash back to configure the LayerZero route.');}
    else tell('The transaction has no receipt yet. Check again after it confirms.');
  }catch(error){tell(String(error?.message??error).slice(0,600));}
  finally{busy=false;render();}
};
el('copy-hash').onclick=async()=>{const state=recorded();if(state?.hash)try{await navigator.clipboard.writeText(state.hash);tell('Transaction hash copied.');}catch{tell('Select and copy the transaction hash shown below.');}};
try{
  const response=await fetch('./binding.json',{cache:'no-store'});if(!response.ok)throw Error('Binding settings could not be loaded.');
  const bytes=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==CONFIG_SHA256)throw Error('Binding settings differ from the reviewed draft.');
  cfg=JSON.parse(new TextDecoder().decode(bytes));
  el('expected').textContent=cfg.from;el('predicted').textContent=cfg.adapter;
  if(recorded())tell('A binding request is recorded in this browser. Use its receipt; do not submit it again.');
  else tell('Connect your BNB wallet to run the binding checks.');
}catch(error){blocked=true;tell(String(error?.message??error).slice(0,600));}
render();
