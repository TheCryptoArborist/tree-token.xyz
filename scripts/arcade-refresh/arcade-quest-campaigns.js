// Saved campaigns use the existing message-only session; no simulation or wallet rewrite.
export function createQuestCampaigns({root,fetchImpl,getSession,syncGames,checkIn,now=()=>Date.now()}) {
 const byId=id=>root.querySelector(`#${id}`), notice=byId('campaign-service-status');
 if(!notice)return {sessionChanged(){},refresh(){},destroy(){}};
 const quizAvailability=root.ownerDocument.createElement('p');quizAvailability.id='campaign-quiz-availability';quizAvailability.className='campaign-notice';quizAvailability.setAttribute('role','status');byId('campaign-quiz-form').before(quizAvailability);
 for(const select of byId('campaign-quiz-form').querySelectorAll('select'))select.setAttribute('aria-describedby',quizAvailability.id);
 let identity=null,data=null,busy=false,epoch=0,disposed=false,authRejected=false;
 const listeners=[];const on=(node,event,handler)=>{node.addEventListener(event,handler);listeners.push(()=>node.removeEventListener(event,handler));};
 const session=()=>{const s=getSession();return s&&Date.parse(s.expiresAt)>now()&&!authRejected?s:null;};
 const actionButtons=['campaign-start','campaign-refresh','campaign-check','campaign-game','campaign-share-submit','campaign-claim','campaign-quiz-submit'];
 function render(){
  const signed=Boolean(session()),p=data,active=Boolean(p?.startedAt),count=p?Object.values(p.tasks).filter(Boolean).length:0;
  byId('campaign-meter').hidden=!p;
  byId('campaign-meter').setAttribute('aria-valuenow',String(count));byId('campaign-meter').querySelector('span').style.width=`${count*25}%`;
  byId('campaign-count').textContent=p?`${count} / 4 tasks completed`:'Sign in or refresh to view saved progress';
  for(const id of actionButtons)byId(id).disabled=busy||!signed||!p;
  byId('campaign-start').disabled=busy||!signed||!p||active;
  byId('campaign-start').textContent=active?'Campaign started ✓':'Start First Round';
  byId('campaign-refresh').disabled=busy||!signed;
  for(const [task,id]of [['checkIn','campaign-check-status'],['quiz','campaign-quiz-status'],['game','campaign-game-status'],['share','campaign-share-status']]){
   byId(id).textContent=p?(p.tasks[task]?'Completed ✓ · Saved':active?'Waiting for verified progress':'Start First Round to begin'):'Sign in to view';
  }
  for(const id of ['campaign-check','campaign-game','campaign-share-submit'])byId(id).disabled=busy||!signed||!active;
  if(p?.tasks.checkIn)byId('campaign-check').disabled=true;
  if(p?.tasks.game)byId('campaign-game').disabled=true;
  if(p?.tasks.share)byId('campaign-share-submit').disabled=true;
  byId('campaign-share-link').disabled=busy||!signed||!active||Boolean(p?.tasks.share);
  byId('campaign-claim').disabled=busy||!signed||!p?.canClaim||Boolean(p?.claimedAt);
  byId('campaign-claim').textContent=p?.claimedAt?'Badge collected ✓':p?.canClaim?'Claim First Round badge':'Complete all 4 tasks';
  byId('campaign-claim-status').textContent=p?.claimedAt?'First Round badge is saved with your wallet. No token payment or NFT mint was required.':'';
  byId('campaign-quiz-submit').disabled=busy||!signed||!p||Boolean(p?.quizCompleteThisWeek);
  // Answers can always be explored. Only a verified signed-in submission can save credit.
  for(const input of byId('campaign-quiz-form').querySelectorAll('select'))input.disabled=busy;
  quizAvailability.textContent=busy?'Loading campaign progress. Your answers will be available shortly.':!signed?'Choose your answers now. Sign in above to check them and save your learning stamp.':!p?'Choose your answers now. Refresh campaign progress above to enable checking and saving.':p.quizCompleteThisWeek?'This week’s learning stamp is already saved. You can still browse the questions.':'Choose all three answers, then select Check my answers to save your result.';
  if(p?.quizCompleteThisWeek)byId('campaign-quiz-feedback').textContent=`This week’s learning stamp is saved ✓ · ${p.learningStamps} earned in total`;
 }
 function sessionChanged(){
  const s=getSession(),key=s&&Date.parse(s.expiresAt)>now()?`${s.wallet}:${s.token}`:null;
  if(key===identity)return;
  identity=key;epoch++;busy=false;data=null;authRejected=false;
  byId('campaign-quiz-form').reset();byId('campaign-share-form').reset();byId('campaign-quiz-feedback').textContent='';
  notice.textContent=key?'Open Campaigns or refresh to load your saved progress.':'Sign in above to load your saved campaigns.';render();
 }
 function valid(p,wallet){return p&&p.wallet===wallet&&p.campaignId==='first-round-v1'&&typeof p.canClaim==='boolean'&&typeof p.quizCompleteThisWeek==='boolean'&&Number.isInteger(p.learningStamps)&&p.learningStamps>=0&&p.tasks&&['checkIn','quiz','game','share'].every(k=>typeof p.tasks[k]==='boolean')&&Object.keys(p.tasks).length===4&&(p.startedAt===null||Number.isFinite(Date.parse(p.startedAt)))&&(p.claimedAt===null||Number.isFinite(Date.parse(p.claimedAt)));}
 async function request(action='status',extra={}){
  sessionChanged();const s=session();if(!s||busy||disposed)return;
  const ticket=++epoch;busy=true;notice.textContent='Loading verified campaign progress…';render();
  try{
   const response=await fetchImpl('/api/arcade-campaign',{method:action==='status'?'GET':'POST',cache:'no-store',credentials:'omit',headers:{Authorization:`Bearer ${s.token}`,...(action==='status'?{}:{'Content-Type':'application/json'})},...(action==='status'?{}:{body:JSON.stringify({action,...extra})}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();
   if(disposed||ticket!==epoch||getSession()?.token!==s.token||getSession()?.wallet!==s.wallet)return;
   if(!response.ok){if(response.status===401)authRejected=true;throw Error(result.message||'Campaign progress is unavailable. Try refreshing.');}
   if(result.status!=='ok'||!valid(result.progress,s.wallet))throw Error('Saved campaign identity or progress could not be verified.');
   data=result.progress;notice.textContent='Your campaign progress is saved and up to date.';
   if(result.quizResult){const q=result.quizResult;if(!Number.isInteger(q.score)||q.score<0||q.score>3||q.passed!==(q.score===3))throw Error('Quiz result could not be verified.');byId('campaign-quiz-feedback').textContent=q.passed?'3 / 3 correct ✓ · Learning stamp saved.':`${q.score} / 3 correct. Read the guide and try again. No stamp awarded.`;}
  }catch(error){if(ticket===epoch&&!disposed){data=null;notice.textContent=error.message||'Campaigns are unavailable.';}}
  finally{if(ticket===epoch&&!disposed){busy=false;render();}}
 }
 on(byId('campaign-start'),'click',()=>void request('start'));
 on(byId('campaign-refresh'),'click',()=>void request());
 on(byId('campaign-claim'),'click',()=>void request('claim'));
 on(byId('campaign-quiz-form'),'submit',event=>{event.preventDefault();if(byId('campaign-quiz-form').reportValidity())void request('quiz',{answers:[1,2,3].map(n=>byId(`tree-answer-${n}`).value)});});
 on(byId('campaign-open-quiz'),'click',()=>{byId('campaign-quiz-details').open=true;byId('know-your-tree').scrollIntoView({behavior:'smooth',block:'start'});});
 for(const [id,operation]of [['campaign-check',checkIn],['campaign-game',syncGames]])on(byId(id),'click',async()=>{if(busy||!session())return;byId(id).disabled=true;try{await operation();await request();}catch{notice.textContent='Game or attendance sync is unavailable. Refresh to try again.';render();}});
 on(byId('campaign-share-form'),'submit',async event=>{
  event.preventDefault();sessionChanged();const s=session();if(!s||busy||!data?.startedAt||!byId('campaign-share-form').reportValidity())return;
  const ticket=++epoch;busy=true;render();
  try{const response=await fetchImpl('/api/arcade-social',{method:'POST',cache:'no-store',credentials:'omit',headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/json'},body:JSON.stringify({mission:'share-score',proof:byId('campaign-share-link').value}),signal:AbortSignal.timeout(12000)});const result=await response.json();
   if(ticket!==epoch||disposed||getSession()?.token!==s.token)return;
   if(response.status===401){authRejected=true;data=null;}
   if(!response.ok||result.wallet!==s.wallet||!Array.isArray(result.entries))throw Error(result.message||'The post submission could not be saved.');
   const entry=result.entries.find(e=>e.mission==='share-score');if(!entry||!['pending','completed','rejected'].includes(entry.status))throw Error('The saved post receipt could not be verified.');
   notice.textContent=entry.status==='pending'?'Post saved · Pending review. No campaign credit yet.':entry.status==='rejected'?'Post was not accepted. Submit a new original post next week.':'Post verification is saved. Refresh campaign progress.';
  }catch(error){if(ticket===epoch&&!disposed)notice.textContent=error.message;}
  finally{if(ticket===epoch&&!disposed){busy=false;render();}}
 });
 render();return {sessionChanged,refresh:()=>request(),destroy(){disposed=true;epoch++;listeners.forEach(remove=>remove());}};
}
