const API='/api/arcade-monthly',SESSION='tree-arcade:daily-growth:session:v1',PENDING='tree-arcade:recovery:pending:v1';
export function createMonthlyPanel({root,fetchImpl=fetch,now=Date.now,loadBridge=()=>import('/assets/arcade/arcade-growth-wallet.js'),loadPayment=()=>import('/assets/arcade/arcade-recovery-wallet.js')}={}){
 if(!root)return;const doc=root.ownerDocument,view=doc.defaultView,panel=doc.getElementById('arcade-monthly-panel');if(!panel)return;
 const el=id=>panel.querySelector('#monthly-'+id);let busy=false,latest=null,identity=null,pending=null,controller=null,lastSession=null,disposed=false,checking=false,successUntil=0,expiryTimer=null,displayedIntentId=null,identitySerial=0,latestClock=null,presentationError=null;
 const responseClocks=new WeakMap();
 const deadlineNote=doc.createElement('p');deadlineNote.id='monthly-recovery-deadline';panel.querySelector('.monthly-recovery summary').after(deadlineNote);
 const utcTime=value=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(value))+' UTC';
 const session=()=>{for(const name of ['localStorage','sessionStorage']){try{const s=JSON.parse(view[name].getItem(SESSION)||'null');if(s&&/^[a-f0-9]{64}$/.test(s.token)&&/^0x[a-f0-9]{64}$/.test(s.wallet)&&Date.parse(s.expiresAt)>Date.now())return s;}catch{}}return null;};
 const sameSession=(a,b)=>Boolean(a&&b&&a.wallet===b.wallet&&a.token===b.token);
 function syncIdentity({inactive=false}={}){
  const s=session(),key=s?`${s.wallet}:${s.token}`:'';
  if(key===lastSession&&!(inactive&&(identity||latest||checking)))return false;
  lastSession=key;identitySerial++;controller?.abort();controller=null;checking=false;identity=null;latest=null;latestClock=null;presentationError=null;successUntil=0;
  notice(s&&!inactive?'Loading this wallet’s attendance and quest progress…':'Sign in above to see attendance and verified quest-day progress.');
  return true;
 }
 function notice(text){el('status').textContent=text;}
 const errorText=error=>typeof error?.message==='string'?error.message:'Monthly progress is unavailable.';
 function savePending(p){pending=p;try{if(p){view.sessionStorage.setItem(PENDING,JSON.stringify(p));if(!view.sessionStorage.getItem(PENDING))throw Error('storage');}else view.sessionStorage.removeItem(PENDING);}catch{if(p)throw Error('Your browser could not save this checkout. No new payment was requested. Allow session storage before trying again.');}}
 try{pending=JSON.parse(view.sessionStorage.getItem(PENDING)||'null');}catch{}
 async function current(){const s=session();if(!s)return null;const bridge=await loadBridge();if(!sameSession(s,session()))return null;const w=bridge.getWalletState();return w.connected&&w.address===s.wallet?{...s,walletId:w.walletId||s.walletId}:null;}
 function responseClock(response){
  const date=response.headers?.get?.('date'),serverTime=typeof date==='string'?Date.parse(date):NaN;
  const observedAt=Date.now(),monotonicAt=view.performance?.now?.();
  return Number.isFinite(serverTime)&&Number.isFinite(observedAt)&&Number.isFinite(monotonicAt)
   ?{serverTime,observedAt,monotonicAt}:null;
 }
 async function request(action,data,s=identity,signal){if(!s)throw Error('Sign in to the Arcade first.');const r=await fetchImpl(API+'?action='+action,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+s.token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal});const clock=responseClock(r),p=await r.json();if(!r.ok||p.status!=='ok')throw Error(p.message||'Progress is unavailable.');if(clock)responseClocks.set(p,clock);return p;}
 function render(){
 if(disposed)return;
 const authenticated=sameSession(identity,session()),p=authenticated&&latest?.wallet===identity.wallet?latest:null;panel.dataset.state=authenticated?'signed-in':'signed-out';
 el('streak').textContent=p?`${p.attendance.streak} ${p.attendance.streak===1?'day':'days'}`:'—';
 el('count').textContent=p?`${p.monthlyReward.verifiedQuestDays} / 20`:'— / 20';
 el('qualification').textContent=p?(p.monthlyReward.qualified?'20-DAY GOAL COMPLETE ✓':`${Math.max(0,20-p.monthlyReward.verifiedQuestDays)} quest days to the 20-day goal`):'Sign in to see your progress';
 const meter=el('meter');meter.setAttribute('aria-valuenow',String(p?Math.min(20,p.monthlyReward.verifiedQuestDays):0));meter.querySelector('span').style.width=p?`${Math.min(100,p.monthlyReward.verifiedQuestDays*5)}%`:'0%';
 el('today').textContent=p?(p.monthlyReward.todayQualified?'Today’s verified quest day is saved ✓':'Complete and refresh a verified quest today to add one verified quest day.'):'Complete verified quests on 20 different UTC days this month.';
 const dates=p?.attendance.missedDates||[],previous=el('date').value;el('date').replaceChildren();for(const date of dates){const option=doc.createElement('option');option.value=date;option.textContent=new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));el('date').append(option);}if(dates.includes(previous))el('date').value=previous;
 const hasPending=Boolean(authenticated&&pending&&pending.wallet===identity?.wallet);el('recovery-controls').hidden=!authenticated;el('none').hidden=!authenticated||dates.length>0;
 if(expiryTimer!==null){view.clearTimeout(expiryTimer);expiryTimer=null;}
 const expiresAt=hasPending?Date.parse(pending.expiresAt):NaN;
 const expired=Number.isFinite(expiresAt)&&expiresAt<=now();
 deadlineNote.textContent=expired?'This checkout has expired for new payments. If you paid on time, use Verify payment. Keep your digest and do not pay again.':hasPending&&Number.isFinite(expiresAt)?`Checkout expires ${utcTime(expiresAt)}. Allow time for confirmation before the UTC month closes. Do not approve after the deadline; late payments cannot restore attendance. Payments made on time can still be verified later.`:'Recovery payments must confirm before 00:00 UTC on the first day of the next month. Payments made on time can still be verified after the month closes.';
 if(hasPending&&Number.isFinite(Date.parse(pending.seasonEndsAt))&&!expired)deadlineNote.textContent+=` Month closes ${utcTime(pending.seasonEndsAt)}.`;
 if(hasPending&&Number.isFinite(expiresAt)&&!expired)expiryTimer=view.setTimeout(()=>{expiryTimer=null;if(!disposed)render();},Math.min(expiresAt-now()+1,2147483647));
 el('date').disabled=busy||!dates.length||Boolean(pending);el('pay').disabled=busy||!dates.length||Boolean(pending);el('refresh').disabled=busy||!authenticated;
 el('retry').hidden=!hasPending;el('retry').disabled=busy;el('digest-form').hidden=!hasPending;
 if(!hasPending){el('digest').value='';displayedIntentId=null;}else if(displayedIntentId!==pending.intentId){el('digest').value=pending.digest||'';displayedIntentId=pending.intentId;}
 el('pay').textContent=busy?'Working…':'Recover day · 20,000 TREE';
 root.dispatchEvent(new view.CustomEvent('arcade-attendance-state',{detail:{
  wallet:authenticated?identity.wallet:null,sessionActive:authenticated,progress:p,
  loading:busy||checking,fresh:Boolean(p&&!busy&&!checking&&!presentationError),
  error:presentationError,clock:p?latestClock:null,
 }}));
 }
 function accept(p,s){if(!p?.progress||p.progress.wallet!==s.wallet||p.progress.monthlyReward?.requiredQuestDays!==20||!Array.isArray(p.progress.attendance?.missedDates)||!Number.isInteger(p.progress.monthlyReward.verifiedQuestDays)||p.progress.monthlyReward.verifiedQuestDays<0||p.progress.monthlyReward.verifiedQuestDays>31)throw Error('Monthly progress could not be verified.');latest=p.progress;const clock=responseClocks.get(p);latestClock=clock&&new Date(clock.serverTime).toISOString().slice(0,10)===latest.dateKey?clock:null;presentationError=null;}
 async function refresh(){
  if(disposed)return;syncIdentity();if(busy||checking){render();return;}checking=true;presentationError=null;render();const ticket=identitySerial;
  try{
   const s=await current();if(disposed||ticket!==identitySerial)return;
   if(!s){identity=null;latest=null;latestClock=null;return;}if(!sameSession(identity,s)){latest=null;latestClock=null;}identity=s;render();
   const activeController=new AbortController();controller=activeController;
   const p=await request('status',undefined,s,activeController.signal);
   if(disposed||ticket!==identitySerial||!sameSession(s,await current()))return;
   accept(p,s);if(Date.now()>successUntil)notice(pending?pending.wallet===s.wallet?'A recovery checkout needs verification. Check its payment before sending anything else.':'A recovery checkout is saved for another wallet. Switch back to that wallet to verify or clear it before starting another recovery.':'Check-ins protect attendance. Verified completed-game quest days are tracked separately.');
  }catch(e){if(ticket===identitySerial&&!disposed){latest=null;latestClock=null;presentationError=errorText(e);notice(presentationError);}}
  finally{if(ticket===identitySerial&&!disposed){checking=false;render();}}
 }
 function recoveryReceipt(payload,checkout,digest){
  const receipt=payload.receipt;
  if(!receipt||receipt.dateKey!==checkout.dateKey||receipt.digest!==digest||receipt.price!=='20000')return null;
  const date=Date.parse(receipt.dateKey+'T00:00:00.000Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(receipt.dateKey)||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==receipt.dateKey)return null;
  return {dateKey:receipt.dateKey,digest:receipt.digest,price:receipt.price};
 }
 async function verify(submittedDigest){const s=await current();if(!s||pending?.wallet!==s.wallet)throw Error('Reconnect the wallet used for this recovery.');identity=s;const checkout={...pending},ticket=identitySerial,digest=submittedDigest||el('digest').value.trim()||checkout.digest;if(!digest)throw Error('Paste the payment digest from wallet history, then verify. Do not pay again while the result is uncertain.');savePending({...checkout,digest});const p=await request('verify',{intentId:checkout.intentId,digest},s),active=await current();if(disposed||ticket!==identitySerial||!sameSession(s,active))throw Error('Wallet changed. Refresh to see saved progress.');accept(p,s);savePending(null);successUntil=Date.now()+8000;notice('Missed check-in restored ✓ Attendance only; no quest credit was added.');const link=doc.createElement('a');link.href='#daily';link.dataset.arcadeRoute='daily';link.textContent='View your grove';el('status').append(' ',link);root.dispatchEvent(new view.CustomEvent('arcade-attendance-recovered',{detail:{wallet:s.wallet,progress:latest,receipt:recoveryReceipt(p,checkout,digest),clock:latestClock}}));}
 async function perform(task){syncIdentity();if(busy||disposed)return;busy=true;presentationError=null;render();const ticket=identitySerial;try{await task();}catch(e){if(ticket===identitySerial&&!disposed){presentationError=errorText(e);notice(presentationError);}}finally{busy=false;if(!disposed){const changed=syncIdentity();render();if(changed||ticket!==identitySerial)void refresh();}}}
 el('pay').addEventListener('click',()=>void perform(async()=>{
  const s=await current();if(!s)throw Error('Sign in to the Arcade before paying.');identity=s;if(pending)throw Error(pending.wallet===s.wallet?'Verify your existing checkout before making another payment.':'Switch back to the wallet with the saved recovery checkout to verify or clear it before starting another recovery.');
  const dateKey=el('date').value;if(!dateKey||!latest?.attendance.missedDates.includes(dateKey))throw Error('Select a missed date from this month.');
  notice('Preparing your 20,000 TREE checkout…');const {intent}=await request('intent',{dateKey},s);if(!sameSession(s,await current()))throw Error('Wallet changed. No payment was requested.');
  savePending({intentId:intent.id,wallet:s.wallet,dateKey,digest:null,expiresAt:intent.expiresAt,seasonEndsAt:intent.seasonEndsAt});render();notice(`Approve 20,000 TREE plus SUI gas in your wallet to recover ${dateKey}. Confirm before the checkout deadline shown above.`);
  try{const {payForRecovery}=await loadPayment();if(!sameSession(s,await current()))throw Error('Wallet changed. No payment was requested.');if(!Number.isFinite(Date.parse(intent.expiresAt))||Date.parse(intent.expiresAt)<=now())throw Error('This checkout has expired. No new wallet payment was requested.');const digest=await payForRecovery(intent,s);savePending({...pending,digest});el('digest').value=digest;notice('Payment submitted. Verifying the confirmed transaction…');await verify();}
  catch(e){throw Error(`${e.message} If you approved payment, keep or paste its digest and use Verify payment. Do not pay again while checking.`);}
 }));
 el('retry').addEventListener('click',()=>{const digest=el('digest').value.trim();void perform(()=>verify(digest));});el('digest-form').addEventListener('submit',e=>{e.preventDefault();const digest=el('digest').value.trim();void perform(()=>verify(digest));});
 el('cancel').addEventListener('click',()=>{if(busy)return;if(view.confirm('Only clear this checkout if your wallet shows the payment was rejected or never sent. A submitted payment should be verified, not paid again. Clear this checkout?')){savePending(null);presentationError=null;notice('Checkout cleared. Existing payments are not refunded.');render();}});
 el('refresh').addEventListener('click',()=>void refresh());
 const observer=new view.MutationObserver(()=>{const changed=syncIdentity();if(changed)render();if(root.dataset.growthState==='syncing'||root.dataset.growthState==='loading')return;if(changed||root.dataset.growthState==='authenticated')void refresh();});observer.observe(root,{attributes:true,attributeFilter:['data-growth-state']});
 const onProgress=event=>{const inactive=event.detail?.sessionActive===false,changed=syncIdentity({inactive});if(changed)render();if(!inactive&&(changed||!identity))void refresh();};root.addEventListener('arcade-progress',onProgress);
 const onStorage=event=>{if(event.key!==SESSION)return;if(syncIdentity())render();void refresh();};view.addEventListener('storage',onStorage);
 const onAttendanceRefresh=()=>void refresh();root.addEventListener('arcade-attendance-refresh',onAttendanceRefresh);
 const onOpenRecovery=event=>{
  if(disposed)return;
  if(syncIdentity())render();
  doc.getElementById('growth-month-tab')?.click();
  const recovery=panel.querySelector('.monthly-recovery');recovery.open=true;
  const authenticated=sameSession(identity,session()),selector=el('date');
  if(authenticated&&!pending){
   const dates=[...selector.options].map(option=>option.value),requested=event.detail?.dateKey;
   const selected=dates.includes(requested)?requested:dates.sort().at(-1);
   if(selected)selector.value=selected;
  }
  const target=authenticated&&pending?.wallet===identity.wallet?el('retry'):selector;
  if(!target.disabled&&!target.hidden)target.focus();else recovery.querySelector('summary')?.focus();
 };root.addEventListener('arcade-open-attendance-recovery',onOpenRecovery);
 const onReturn=()=>void refresh();view.addEventListener('focus',onReturn);view.addEventListener('pageshow',onReturn);render();void refresh();
 return {refresh,destroy(){disposed=true;identitySerial++;if(expiryTimer!==null)view.clearTimeout(expiryTimer);controller?.abort();observer.disconnect();deadlineNote.remove();root.removeEventListener('arcade-progress',onProgress);root.removeEventListener('arcade-attendance-refresh',onAttendanceRefresh);root.removeEventListener('arcade-open-attendance-recovery',onOpenRecovery);view.removeEventListener('storage',onStorage);view.removeEventListener('focus',onReturn);view.removeEventListener('pageshow',onReturn);}};
}
if(typeof document!=='undefined')createMonthlyPanel({root:document.getElementById('arcade-daily-growth')});
