const API='/api/arcade-monthly',SESSION='tree-arcade:daily-growth:session:v1',PENDING='tree-arcade:recovery:pending:v1';
export function createMonthlyPanel({root,fetchImpl=fetch,loadBridge=()=>import('/assets/arcade/arcade-growth-wallet.js'),loadPayment=()=>import('/assets/arcade/arcade-recovery-wallet.js')}={}){
 if(!root)return;const doc=root.ownerDocument,view=doc.defaultView,panel=doc.getElementById('arcade-monthly-panel');if(!panel)return;
 const el=id=>panel.querySelector('#monthly-'+id);let busy=false,latest=null,identity=null,pending=null,controller=null,lastSession=null,disposed=false,checking=false,successUntil=0;
 const session=()=>{try{const s=JSON.parse(view.sessionStorage.getItem(SESSION)||'null');return s&&/^[a-f0-9]{64}$/.test(s.token)&&/^0x[a-f0-9]{64}$/.test(s.wallet)&&Date.parse(s.expiresAt)>Date.now()?s:null;}catch{return null;}};
 function notice(text){el('status').textContent=text;}
 function savePending(p){pending=p;try{if(p)view.sessionStorage.setItem(PENDING,JSON.stringify(p));else view.sessionStorage.removeItem(PENDING);}catch{}}
 try{pending=JSON.parse(view.sessionStorage.getItem(PENDING)||'null');}catch{}
 async function current(){const s=session();if(!s)return null;const bridge=await loadBridge();const w=bridge.getWalletState();return w.connected&&w.address===s.wallet?{...s,walletId:w.walletId||s.walletId}:null;}
 async function request(action,data,s=identity){if(!s)throw Error('Sign in to the Arcade first.');const r=await fetchImpl(API+'?action='+action,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+s.token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:controller?.signal});const p=await r.json();if(!r.ok||p.status!=='ok')throw Error(p.message||'Progress is unavailable.');return p;}
 function render(){
 const p=latest,authenticated=Boolean(identity);panel.dataset.state=authenticated?'signed-in':'signed-out';
 el('streak').textContent=p?`${p.attendance.streak} ${p.attendance.streak===1?'day':'days'}`:'—';
 el('count').textContent=p?`${p.monthlyReward.verifiedQuestDays} / 20`:'— / 20';
 el('qualification').textContent=p?(p.monthlyReward.qualified?'QUALIFIED ✓':`${Math.max(0,20-p.monthlyReward.verifiedQuestDays)} quest days to qualify`):'Sign in to see your progress';
 const meter=el('meter');meter.setAttribute('aria-valuenow',String(p?Math.min(20,p.monthlyReward.verifiedQuestDays):0));meter.querySelector('span').style.width=p?`${Math.min(100,p.monthlyReward.verifiedQuestDays*5)}%`:'0%';
 el('today').textContent=p?(p.monthlyReward.todayQualified?'Today’s verified quest day is saved ✓':'Complete and refresh a verified quest today to add one qualifying day.'):'Complete verified quests on 20 different UTC days this month.';
 const dates=p?.attendance.missedDates||[],previous=el('date').value;el('date').replaceChildren();for(const date of dates){const option=doc.createElement('option');option.value=date;option.textContent=new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));el('date').append(option);}if(dates.includes(previous))el('date').value=previous;
 const hasPending=Boolean(pending&&pending.wallet===identity?.wallet);el('recovery-controls').hidden=!authenticated;el('none').hidden=!authenticated||dates.length>0;
 el('date').disabled=busy||!dates.length||hasPending;el('pay').disabled=busy||!dates.length||hasPending;el('refresh').disabled=busy||!authenticated;
 el('retry').hidden=!hasPending;el('retry').disabled=busy;el('digest-form').hidden=!hasPending;el('digest').value=hasPending?pending.digest||'':'';
 el('pay').textContent=busy?'Working…':'Recover day · 20,000 TREE';
 }
 function accept(p,s){if(!p?.progress||p.progress.wallet!==s.wallet||p.progress.monthlyReward?.requiredQuestDays!==20||!Array.isArray(p.progress.attendance?.missedDates)||!Number.isInteger(p.progress.monthlyReward.verifiedQuestDays)||p.progress.monthlyReward.verifiedQuestDays<0||p.progress.monthlyReward.verifiedQuestDays>31)throw Error('Monthly progress could not be verified.');latest=p.progress;}
 async function refresh(){if(busy||checking||disposed)return;checking=true;const s=await current();if(!s){identity=null;latest=null;render();checking=false;return;}identity=s;controller=new AbortController();try{const p=await request('status',undefined,s);if(disposed||(await current())?.wallet!==s.wallet)return;accept(p,s);if(Date.now()>successUntil)notice(pending?.wallet===s.wallet?'A recovery checkout needs verification. Check its payment before sending anything else.':'Check-ins protect attendance. Only verified completed-game quest days qualify for the monthly reward.');}catch(e){latest=null;notice(e.message);}finally{checking=false;render();}}
 async function verify(){const s=await current();if(!s||pending?.wallet!==s.wallet)throw Error('Reconnect the wallet used for this recovery.');identity=s;const digest=el('digest').value.trim()||pending.digest;if(!digest)throw Error('Paste the payment digest from wallet history, then verify. Do not pay again while the result is uncertain.');savePending({...pending,digest});const p=await request('verify',{intentId:pending.intentId,digest});if((await current())?.wallet!==s.wallet)throw Error('Wallet changed. Refresh to see saved progress.');accept(p,s);savePending(null);successUntil=Date.now()+8000;notice('Missed check-in restored ✓ Attendance only; no quest credit was added.');root.dispatchEvent(new view.CustomEvent('arcade-attendance-recovered'));}
 async function perform(task){if(busy)return;busy=true;render();try{await task();}catch(e){notice(e.message);}finally{busy=false;render();}}
 el('pay').addEventListener('click',()=>void perform(async()=>{
  const s=await current();if(!s)throw Error('Sign in to the Arcade before paying.');identity=s;if(pending?.wallet===s.wallet)throw Error('Verify your existing checkout before making another payment.');
  const dateKey=el('date').value;if(!dateKey||!latest?.attendance.missedDates.includes(dateKey))throw Error('Select a missed date from this month.');
  notice('Preparing your 20,000 TREE checkout…');const {intent}=await request('intent',{dateKey});if((await current())?.wallet!==s.wallet)throw Error('Wallet changed. No payment was requested.');
  savePending({intentId:intent.id,wallet:s.wallet,dateKey,digest:null});render();notice(`Approve 20,000 TREE plus SUI gas in your wallet to recover ${dateKey}.`);
  try{const {payForRecovery}=await loadPayment();const digest=await payForRecovery(intent,s);savePending({...pending,digest});el('digest').value=digest;notice('Payment submitted. Verifying the confirmed transaction…');await verify();}
  catch(e){throw Error(`${e.message} If you approved payment, keep or paste its digest and use Verify payment. Do not pay again while checking.`);}
 }));
 el('retry').addEventListener('click',()=>void perform(verify));el('digest-form').addEventListener('submit',e=>{e.preventDefault();void perform(verify);});
 el('cancel').addEventListener('click',()=>{if(busy)return;if(view.confirm('Only clear this checkout if your wallet shows the payment was rejected or never sent. A submitted payment should be verified, not paid again. Clear this checkout?')){savePending(null);notice('Checkout cleared. Existing payments are not refunded.');render();}});
 el('refresh').addEventListener('click',()=>void refresh());
 const observer=new view.MutationObserver(()=>{const s=session(),key=s?.token||'';if(root.dataset.growthState==='syncing'||root.dataset.growthState==='loading')return;if(key!==lastSession||root.dataset.growthState==='authenticated'){lastSession=key;void refresh();}});observer.observe(root,{attributes:true,attributeFilter:['data-growth-state']});
 const onReturn=()=>void refresh();view.addEventListener('focus',onReturn);view.addEventListener('pageshow',onReturn);render();void refresh();
 return {refresh,destroy(){disposed=true;controller?.abort();observer.disconnect();view.removeEventListener('focus',onReturn);view.removeEventListener('pageshow',onReturn);}};
}
if(typeof document!=='undefined')createMonthlyPanel({root:document.getElementById('arcade-daily-growth')});
