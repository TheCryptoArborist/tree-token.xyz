if(location.origin!=='https://tree-token.xyz'){
 document.querySelectorAll('button').forEach(button=>button.disabled=true);
 document.getElementById('status').textContent='Open this review on tree-token.xyz/play/generation-review/. Wallet actions are disabled on other sites.';
}else{
// Isolated generation review. Authentication protocol copied unchanged from the published BNB page.
const by=id=>document.getElementById(id);
const connect=by('connect'),sign=by('sign'),logout=by('logout'),
  statusButton=by('status-button'),access=by('access');
let wallet=null,sessionWallet=null,epoch=0,busy=false,authenticated=false,observedProvider=null;
const SCOPE='eip155:56:treeforce89-test:v1';
const address=value=>typeof value==='string'&&/^0x[a-f0-9]{40}$/i.test(value);
const same=(a,b)=>address(a)&&address(b)&&a.toLowerCase()===b.toLowerCase();
function output(text){by('status').textContent=text;}
function clearBacking(text='No generation review yet.'){by('result').textContent=text;}
function redraw(){
  sign.disabled=!wallet||busy;access.disabled=!authenticated||busy;
  connect.disabled=busy;statusButton.disabled=busy;logout.disabled=busy;
  by('wallet').textContent=wallet?'Selected BNB wallet: '+wallet:'No BNB wallet selected.';
}
function changed(){
  epoch++;wallet=null;sessionWallet=null;authenticated=false;
  clearBacking('Wallet or network changed. Reconnect to review generation 1 again.');
  output('Wallet or network changed. Reconnect, or check the saved test session.');redraw();
}
function provider(){
  const p=window.ethereum&&typeof window.ethereum.request==='function'?window.ethereum:null;
  if(p!==observedProvider){
    const previous=observedProvider;
    for(const event of ['accountsChanged','chainChanged'])previous?.removeListener?.(event,changed);
    observedProvider=p;
    for(const event of ['accountsChanged','chainChanged'])p?.on?.(event,changed);
    if(previous||wallet)changed();
  }
  return p;
}
provider();
function unchanged(current,marker,p){
  if(provider()!==p||epoch!==marker||!same(wallet,current))throw Error('Wallet changed. Check sign-in status before trying again');
}
async function chain56(){
  const p=provider();if(!p)throw Error('No EVM wallet detected. Open this page in a BNB-compatible wallet browser.');
  const chain=await p.request({method:'eth_chainId'});
  if(typeof chain!=='string'||!/^0x[0-9a-f]+$/i.test(chain)||BigInt(chain)!==56n)throw Error('Select BNB Smart Chain in your wallet, then reconnect. No automatic network switching.');
  return p;
}
async function post(action,fields={}){
  const requestEpoch=epoch;
  const response=await fetch('/api/arcade-bnb-test',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...fields}),cache:'no-store'});
  const data=await response.json().catch(()=>({error:'invalid-response'}));
  if(!response.ok){
    const error=Error(data.error||data.reason||'service-unavailable');
    error.status=response.status;error.data=data;error.requestEpoch=requestEpoch;
    if(response.status===401&&requestEpoch===epoch){
      authenticated=false;sessionWallet=null;epoch++;error.sessionInvalidated=true;
      clearBacking('Sign in again before reviewing generation 1.');
    }
    throw error;
  }
  return data;
}
const hex=text=>'0x'+[...new TextEncoder().encode(text)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function task(fn){if(busy)return;busy=true;redraw();try{await fn();}catch(e){output('Could not continue: '+(e?.message||'request failed')+'. No game access was granted.');}finally{busy=false;redraw();}}
connect.addEventListener('click',()=>task(async()=>{
  clearBacking();
  const p=await chain56(),accounts=await p.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!address(accounts[0]))throw Error('No BNB address returned.');
  if(await chain56()!==p)throw Error('Wallet provider changed. Reconnect.');
  const selected=await p.request({method:'eth_accounts'});
  if(!Array.isArray(selected)||!same(selected[0],accounts[0]))throw Error('Wallet account changed. Reconnect.');
  wallet=accounts[0];sessionWallet=null;authenticated=false;epoch++;
  output('Connected. Review the sign-in message before approving.');
}));
sign.addEventListener('click',()=>task(async()=>{
  clearBacking();
  const current=wallet, marker=epoch,p=await chain56();
  authenticated=false;sessionWallet=null;
  const accounts=await p.request({method:'eth_accounts'});
  if(!Array.isArray(accounts)||!same(accounts[0],current))throw Error('Wallet account changed.');
  unchanged(current,marker,p);
  output('Requesting one-time login message…');
  const challenge=await post('challenge',{wallet:current});
  unchanged(current,marker,p);
  if(challenge.chainId!==56||challenge.gameplayAuthorized!==false||
      challenge.scope!==SCOPE||!same(challenge.wallet,current)||
      typeof challenge.message!=='string'||!challenge.message.includes('Chain ID: 56'))throw Error('Invalid server login challenge.');
  output('Review the personal-message signature prompt in your wallet.');
  const signature=await p.request({method:'personal_sign',params:[hex(challenge.message),current]});
  unchanged(current,marker,p);
  const signed=await post('sign-in',{wallet:current,nonce:challenge.nonce,signature});
  unchanged(current,marker,p);
  if(signed.authenticated!==true||signed.gameplayAuthorized!==false||signed.chainId!==56||
      signed.scope!==SCOPE||!same(signed.wallet,current))throw Error('Unexpected server response.');
  authenticated=true;sessionWallet=signed.wallet;output('BNB sign-in verified. Gameplay remains disabled.');
}));
statusButton.addEventListener('click',()=>task(async()=>{
  const marker=epoch;authenticated=false;sessionWallet=null;
  clearBacking();
  let r;
  try{r=await post('status');}catch(error){
    if(error.status===401){
      if(error.sessionInvalidated&&error.requestEpoch===marker)output('No BNB test session. Connect and sign in to begin.');
      return;
    }
    throw error;
  }
  if(epoch!==marker)throw Error('Wallet changed while checking the session. Check sign-in status again.');
  if(r.authenticated!==true||r.gameplayAuthorized!==false||r.chainId!==56||r.scope!==SCOPE||!address(r.wallet))throw Error('Unexpected server response.');
  if(wallet&&!same(wallet,r.wallet)){
    output('A test session exists for '+r.wallet+'. Sign in with the selected wallet to replace it. Gameplay remains disabled.');return;
  }
  authenticated=true;sessionWallet=r.wallet;
  output('Test session active for '+r.wallet+'. Gameplay remains disabled.');
}));
logout.addEventListener('click',()=>task(async()=>{
  const marker=++epoch;authenticated=false;sessionWallet=null;
  clearBacking('Sign in or check your session before reviewing generation 1 again.');
  await post('logout');
  if(epoch!==marker)return;
  output('This BNB test session was signed out. Live Arcade sign-ins are untouched.');
}));
access.addEventListener('click',()=>task(async()=>{
  provider();
  if(!authenticated){clearBacking('Sign in before requesting a review.');return;}
  const marker=epoch,current=sessionWallet;
  clearBacking('Reviewing your session and generation 1…');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
  try{
    const response=await fetch('/api/arcade-bnb-test/run-review',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'issue'}),signal:controller.signal});
    const data=await response.json();
    provider();
    if(epoch!==marker||!authenticated||!same(sessionWallet,current))return;
    if(response.status===401&&data?.error==='invalid-session'&&data.gameplayAuthorized===false){
      authenticated=false;sessionWallet=null;epoch++;
      clearBacking('Your sign-in is no longer valid. Connect and sign in again.');output('Sign in again before requesting a review.');return;
    }
    if(response.status===403&&data?.error==='review-denied'&&data.gameplayAuthorized===false){
      clearBacking('Review denied. No access was granted. Check sign-in status if your session may have expired. Gameplay remains disabled.');return;
    }
    if(response.status===429&&data?.gameplayAuthorized===false){clearBacking('Too many checks. Wait a minute, then try again. No access was granted.');return;}
    // Even an unexpected successful ticket is neither retained nor consumed.
    clearBacking('Unable to confirm the review result. Try again later. Gameplay remains disabled.');
  }catch{
    if(epoch===marker&&authenticated&&same(sessionWallet,current))clearBacking('The review could not finish. Try again later. Gameplay remains disabled.');
  }finally{clearTimeout(timer);}
}));
redraw();

}
