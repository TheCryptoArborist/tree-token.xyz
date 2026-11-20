// Wallet-only sign-in UX. No game, commerce or permissions are granted by this page.
const by=id=>document.getElementById(id);
const connect=by('connect'),sign=by('sign'),logout=by('logout'),
  statusButton=by('status-button'),access=by('access');
let wallet=null, epoch=0,busy=false,authenticated=false;
const APP='https://tree-token.xyz';
function output(text){by('status').textContent=text;}
function redraw(){
  sign.disabled=!wallet||busy;access.disabled=!authenticated||busy;
  connect.disabled=busy;statusButton.disabled=busy;logout.disabled=busy;
  by('wallet').textContent=wallet?'Selected BNB wallet: '+wallet:'No BNB wallet selected.';
}
function changed(){epoch++;wallet=null;authenticated=false;by('result').textContent='Wallet changed. Reconnect to continue.';redraw();}
if(window.ethereum?.on){
  window.ethereum.on('accountsChanged',changed);
  window.ethereum.on('chainChanged',changed);
}
const provider=()=>window.ethereum&&typeof window.ethereum.request==='function'?window.ethereum:null;
async function chain56(){
  const p=provider();if(!p)throw Error('No EVM wallet detected. Open this page in a BNB-compatible wallet browser.');
  const chain=await p.request({method:'eth_chainId'});
  if(Number.parseInt(chain,16)!==56)throw Error('Select BNB Smart Chain in your wallet, then reconnect. No automatic network switching.');
  return p;
}
async function post(action,fields={}){
  const response=await fetch('/api/arcade-bnb-test',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...fields}),cache:'no-store'});
  const data=await response.json().catch(()=>({error:'invalid-response'}));
  if(!response.ok)throw Error(data.error||data.reason||'service-unavailable');
  return data;
}
const hex=text=>'0x'+[...new TextEncoder().encode(text)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function task(fn){if(busy)return;busy=true;redraw();try{await fn();}catch(e){output('Could not continue: '+(e?.message||'request failed')+'. No game access was granted.');}finally{busy=false;redraw();}}
connect.addEventListener('click',()=>task(async()=>{
  const p=await chain56(),accounts=await p.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!/^0x[a-f0-9]{40}$/i.test(accounts[0]||''))throw Error('No BNB address returned.');
  wallet=accounts[0];authenticated=false;epoch++;
  output('Connected. Review the sign-in message before approving.');
}));
sign.addEventListener('click',()=>task(async()=>{
  const current=wallet, marker=epoch,p=await chain56();
  const accounts=await p.request({method:'eth_accounts'});
  if(!accounts.some(a=>a.toLowerCase()===current.toLowerCase()))throw Error('Wallet account changed.');
  output('Requesting one-time login message…');
  const challenge=await post('challenge',{wallet:current});
  if(epoch!==marker||!wallet||wallet.toLowerCase()!==current.toLowerCase())throw Error('Wallet changed.');
  if(challenge.chainId!==56||challenge.gameplayAuthorized!==false||
      challenge.wallet.toLowerCase()!==current.toLowerCase()||
      !challenge.message.includes('Chain ID: 56'))throw Error('Invalid server login challenge.');
  output('Review the personal-message signature prompt in your wallet.');
  const signature=await p.request({method:'personal_sign',params:[hex(challenge.message),current]});
  if(epoch!==marker||!wallet||wallet.toLowerCase()!==current.toLowerCase())throw Error('Wallet changed during signing.');
  const signed=await post('sign-in',{wallet:current,nonce:challenge.nonce,signature});
  if(signed.authenticated!==true||signed.gameplayAuthorized!==false)throw Error('Unexpected server response.');
  authenticated=true;output('BNB sign-in verified. Gameplay remains disabled.');
}));
statusButton.addEventListener('click',()=>task(async()=>{
  const r=await post('status');
  authenticated=r.authenticated===true;
  output(authenticated?'Test session active for '+r.wallet+'. Gameplay remains disabled.':'No BNB test session.');
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