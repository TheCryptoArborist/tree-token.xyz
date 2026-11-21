export const completedGames=Object.freeze([
 {id:'treeforce89',label:'Tree Force ’89',href:'https://tree-token.xyz/play/treeforce89/',creditRule:'complete-result'},
 {id:'canopy-breaker',label:'Canopy Breaker',href:'https://tree-token.xyz/play/canopy-breaker/',creditRule:'complete-result'},
 {id:'garden-bot',label:'Garden Bot',href:'https://nftree.net/battle/garden-bot',creditRule:'complete-result'},
 {id:'pvp',label:'PvP Battle',href:'https://nftree.net/battle/pvp',creditRule:'complete-result'},
]);
export function validateRuns(data,wallet,now=Date.now()){
 const dateKey=new Date(now).toISOString().slice(0,10);
 if(data?.wallet!==wallet||data.dateKey!==dateKey||!Array.isArray(data.runs)||data.runs.length>400)throw Error('Saved run progress could not be verified.');
 const seen=new Set();for(const run of data.runs){
  if(!completedGames.some(g=>g.id===run.gameId)||! /^[a-f0-9]{64}$/.test(run.id)||seen.has(run.id)||!Number.isFinite(Date.parse(run.completedAt))||run.completedAt.slice(0,10)!==dateKey||!(run.score===null||Number.isSafeInteger(run.score)&&run.score>=0)||!['completed','won','gameover'].includes(run.outcome))throw Error('Invalid saved run progress.');seen.add(run.id);
 }return data;
}
export function createCompletedRunTracking({root,getSession,fetchImpl=fetch,now=Date.now}){
 const view=root.ownerDocument.defaultView,button=root.querySelector('#completed-runs-refresh'),status=root.querySelector('#completed-runs-status');
 let identity=null,serial=0,busy=false,disposed=false,queued=false,lastRootBusy=false,data=null,controller=null,lastError=null;
 const listeners=[];
 function on(node,type,fn){node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));}
 const session=()=>{const s=getSession();return s&&Date.parse(s.expiresAt)>now()?s:null;};
 function emit(error=null){
  const s=session(),fresh=data&&data.dateKey===new Date(now()).toISOString().slice(0,10)&&data.wallet===s?.wallet;
  if(button)button.disabled=!s||busy;
  if(status)status.textContent=error||(!s?'Sign in to load your saved runs.':busy?'Checking saved runs…':data?data.runs.length?`${data.runs.length} saved run${data.runs.length===1?'':'s'} today${Object.values(data.sources||{}).includes('unavailable')?' · Some game results are temporarily unavailable.':''}`:'No completed runs saved today. Tree Force: finish, then save your mission result. Canopy Breaker saves completed runs automatically.':'Finish a game, then refresh saved runs.');
  root.dispatchEvent(new view.CustomEvent('arcade-completed-runs',{detail:{wallet:s?.wallet||null,dateKey:fresh?data.dateKey:null,runs:fresh?data.runs:[],stale:!fresh||Boolean(error),loading:busy,sessionActive:Boolean(s)}}));
 }
 function sessionChanged(){const s=session(),key=s?`${s.wallet}:${s.token}`:null;if(key===identity)return;identity=key;serial++;controller?.abort();busy=false;queued=false;data=null;lastError=null;emit();if(key)queueMicrotask(()=>{if(!disposed&&identity===key)void refresh();});}
 async function refresh(){sessionChanged();const s=session();if(!s||disposed)return;if(busy){queued=true;return;}const ticket=++serial;busy=true;lastError=null;emit();const activeController=new AbortController();controller=activeController;const timer=setTimeout(()=>activeController.abort(),12000);
  try{const response=await fetchImpl('/api/arcade-completed-runs',{method:'GET',cache:'no-store',credentials:'omit',headers:{Authorization:`Bearer ${s.token}`},signal:activeController.signal});const value=await response.json();if(disposed||ticket!==serial||session()?.token!==s.token)return;if(!response.ok)throw Error(value.error||'Saved runs are unavailable. Refresh to retry.');data=validateRuns(value,s.wallet,now());}
  catch(error){if(ticket===serial&&!disposed){data=null;lastError='Saved runs could not load. Refresh to retry.';}}
  finally{clearTimeout(timer);if(ticket===serial&&!disposed){busy=false;emit(lastError);if(queued){queued=false;void refresh();}}}
 }
 on(button,'click',()=>void refresh());
 on(root,'arcade-progress',event=>{sessionChanged();const next=Boolean(event.detail.busy),finished=lastRootBusy&&!next;lastRootBusy=next;if(finished&&session())void refresh();});
 on(view.document,'visibilitychange',()=>{if(!view.document.hidden)void refresh();});
 const timer=setInterval(()=>{sessionChanged();if(data&&data.dateKey!==new Date(now()).toISOString().slice(0,10)){data=null;emit();}},30000);
 emit();return {sessionChanged,refresh,destroy(){disposed=true;serial++;controller?.abort();clearInterval(timer);listeners.forEach(remove=>remove());}};
}
