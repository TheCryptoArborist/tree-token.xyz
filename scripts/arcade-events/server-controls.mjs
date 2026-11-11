const KEY='tree-arcade:daily-growth:session:v1',API='/api/arcade-events';
export function installEventServerControls({readDraft,applyDraft,view=window,fetchImpl=fetch}){
 const $=id=>view.document.getElementById(id),buttons=['holder-check','server-load','server-save'];let version=0,identity='',busy=false;
 const session=()=>{for(const store of ['localStorage','sessionStorage'])try{const s=JSON.parse(view[store].getItem(KEY)||'null');if(s&&/^[a-f0-9]{64}$/.test(s.token)&&/^0x[0-9a-f]{64}$/.test(s.wallet)&&Date.parse(s.expiresAt)>Date.now())return s;}catch{}return null;};
 async function call(action,body){const s=session();if(!s)throw Error('Sign in to Tree Arcade with your Sui wallet, then return here.');
  const r=await fetchImpl(API+'?action='+action,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+s.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'}),data=await r.json();
  if(session()?.token!==s.token||session()?.wallet!==s.wallet)throw Error('The connected wallet changed. Check again with the intended wallet.');
  if(!r.ok||data.status!=='ok')throw Error(data.message||'The event service is temporarily unavailable.');
  if(action.startsWith('admin-')&&(data.terms?.version!==2||data.terms?.currency!=='USDC'||(data.event&&data.event.terms_version!==2)))throw Error('The saved event uses different currency rules. Reload the workshop before continuing.');
  return {data,wallet:s.wallet};
 }
 function bind(id,work,statusId){$(id).addEventListener('click',async()=>{if(busy)return;busy=true;buttons.forEach(id=>$(id).disabled=true);$(statusId).textContent='Checking…';try{await work();}catch(e){$(statusId).textContent=e.message;}finally{busy=false;buttons.forEach(id=>$(id).disabled=false);}});}
 bind('holder-check',async()=>{const {data}=await call('eligibility');$('holder-status').textContent=`NFTree ownership verified (${data.nftreeCount}). Entry remains closed. Ownership will be checked again before payment and each ranked run.`;},'holder-status');
 bind('server-load',async()=>{const draft=readDraft(),{data,wallet}=await call('admin-load&id='+encodeURIComponent(draft.id));if(!data.event){version=0;identity=wallet+':'+draft.id;$('server-status').textContent='No server draft yet. Save this draft to create one.';return;}
  const e=data.event,local=stamp=>{if(!stamp)return '';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:e.time_zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;};
  applyDraft({id:e.event_id,title:e.title,gameId:e.game_id,timeZone:e.time_zone,startLocal:local(e.starts_at),endLocal:local(e.ends_at)});version=e.version;identity=wallet+':'+e.event_id;$('server-status').textContent=`Loaded server draft · Version ${version}. Entry remains closed.`;
 },'server-status');
 bind('server-save',async()=>{const draft=readDraft(),s=session();if(!s)throw Error('Sign in to the Arcade first.');const expectedVersion=identity===s.wallet+':'+draft.id?version:0;
  const {id,title,gameId,timeZone,startLocal,endLocal}=draft,{data,wallet}=await call('admin-save',{termsVersion:2,draft:{id,title,gameId,timeZone,startLocal,endLocal},expectedVersion});version=data.event.version;identity=wallet+':'+draft.id;$('server-status').textContent=`Saved on the server · Version ${version}. Entry remains closed.`;
 },'server-status');
}
