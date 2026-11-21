// Wallet-only sign-in UX. No game, commerce or permissions are granted by this page.
const by=id=>document.getElementById(id);
const connect=by('connect'),sign=by('sign'),logout=by('logout'),
  statusButton=by('status-button'),access=by('access');
let wallet=null,epoch=0,busy=false,authenticated=false,observedProvider=null;
const SCOPE='eip155:56:treeforce89-test:v1';
const address=value=>typeof value==='string'&&/^0x[a-f0-9]{40}$/i.test(value);
const same=(a,b)=>address(a)&&address(b)&&a.toLowerCase()===b.toLowerCase();
function output(text){by('status').textContent=text;}
function redraw(){
  sign.disabled=!wallet||busy;access.disabled=!authenticated||busy;
  connect.disabled=busy;statusButton.disabled=busy;logout.disabled=busy;
  by('wallet').textContent=wallet?'Selected BNB wallet: '+wallet:'No BNB wallet selected.';
}
function changed(){
  epoch++;wallet=null;authenticated=false;
  by('result').textContent='Wallet or network changed. Reconnect to continue.';
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
  const response=await fetch('/api/arcade-bnb-test',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...fields}),cache:'no-store'});
  const data=await response.json().catch(()=>({error:'invalid-response'}));
  if(!response.ok){
    if(response.status===401)authenticated=false;
    const error=Error(data.error||data.reason||'service-unavailable');error.status=response.status;throw error;
  }
  return data;
}
const hex=text=>'0x'+[...new TextEncoder().encode(text)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function task(fn){if(busy)return;busy=true;redraw();try{await fn();}catch(e){output('Could not continue: '+(e?.message||'request failed')+'. No game access was granted.');}finally{busy=false;redraw();}}
connect.addEventListener('click',()=>task(async()=>{
  const p=await chain56(),accounts=await p.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!address(accounts[0]))throw Error('No BNB address returned.');
  if(await chain56()!==p)throw Error('Wallet provider changed. Reconnect.');
  const selected=await p.request({method:'eth_accounts'});
  if(!Array.isArray(selected)||!same(selected[0],accounts[0]))throw Error('Wallet account changed. Reconnect.');
  wallet=accounts[0];authenticated=false;epoch++;
  output('Connected. Review the sign-in message before approving.');
}));
sign.addEventListener('click',()=>task(async()=>{
  const current=wallet, marker=epoch,p=await chain56();
  authenticated=false;
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
  authenticated=true;output('BNB sign-in verified. Gameplay remains disabled.');
}));
statusButton.addEventListener('click',()=>task(async()=>{
  const marker=epoch;authenticated=false;
  let r;
  try{r=await post('status');}catch(error){
    if(error.status===401){output('No BNB test session. Connect and sign in to begin.');return;}
    throw error;
  }
  if(epoch!==marker)throw Error('Wallet changed while checking the session. Check sign-in status again.');
  if(r.authenticated!==true||r.gameplayAuthorized!==false||r.chainId!==56||r.scope!==SCOPE||!address(r.wallet))throw Error('Unexpected server response.');
  if(wallet&&!same(wallet,r.wallet)){
    output('A test session exists for '+r.wallet+'. Sign in with the selected wallet to replace it. Gameplay remains disabled.');return;
  }
  authenticated=true;
  output('Test session active for '+r.wallet+'. Gameplay remains disabled.');
}));
logout.addEventListener('click',()=>task(async()=>{
  await post('logout');authenticated=false;
  output('This BNB test session was signed out. Live Arcade sign-ins are untouched.');
}));
access.addEventListener('click',()=>task(async()=>{
  try{const result=await post('entitlement');by('result').textContent=result.gameplayAuthorized===false?'Not authorized to play.':'Access remains disabled.';}
  catch(e){by('result').textContent='No gameplay access: '+e.message+'.';}
}));
redraw();
