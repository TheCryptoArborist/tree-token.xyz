import {step,PICKUPS,BIOMES} from './engine.js';
import {draw} from './art.js';
import {sound,wakeAudio,setSound} from './audio.js';
const $=id=>document.getElementById(id),api=window.breakerSession,canvas=$('game'),ctx=canvas.getContext('2d');
let run=null,queue=[],sending=null,paused=false,connected=!!api.account,clock=0,last=performance.now(),target=400,launch=false,fire=false,events=0,syncError='',muted=false,opening=null,quote=null,buying=false,gameRevision=0;
const keys=new Set(),motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
function replace(data){gameRevision++;run=data;queue=[];target=run.state.paddle;events=run.state.eventId;syncError='';paused=false;paint();}
async function open(){if(opening)return opening;const address=api.account?.address,stamp=gameRevision;opening=(async()=>{try{const data=await api.request('open');if(api.account?.address!==address||stamp!==gameRevision)return;replace(data);}catch(e){syncError=e.message;paint();}finally{opening=null;}})();return opening;}
async function flush(){
 if(sending)return sending;if(!queue.length||!run||!connected)return;
 const inputs=queue.splice(0,120),id=run.id,revision=run.revision,stamp=gameRevision;
 sending=(async()=>{try{const data=await api.request('frames',{id,revision,inputs});if(stamp!==gameRevision)return;if(data.resync){run=data;queue=[];events=run.state.eventId;toast('Saved run restored.');}else{run={...data,state:structuredClone(data.state)};for(const input of queue)step(run.state,input);}syncError='';}catch(e){if(stamp===gameRevision){queue.unshift(...inputs);syncError=e.message;paused=true;}}finally{sending=null;paint();}})();return sending;
}
async function checkpoint(){while(sending||queue.length){if(sending)await sending;else await flush();if(syncError)throw Error(syncError);}}
function overlay(kicker,title,text,label,note=''){const o=$('overlay');o.hidden=false;$('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('primary').textContent=label;$('primary').disabled=false;$('overlay-note').textContent=note;}
function paint(){
 const s=run?.state;if(s){$('level').textContent=String(s.level).padStart(2,'0')+' / 30';$('score').textContent=String(s.score).padStart(6,'0');$('lives').textContent=Array.from({length:3},(_,i)=>i<s.lives?'●':'○').join(' ');}
 if(!connected){overlay('NFTREE ACCESS REQUIRED','The canopy awaits.','Connect your Sui wallet and verify NFTree ownership.','Unlock with NFTree','Sign-in is a message. No TREE payment is needed to verify.');return;}
 if(syncError){overlay('FOREST CONNECTION','Your run is held.',syncError,'Reconnect & resume','Your recorded payment and saved run remain recoverable.');return;}
 if(!s){overlay('OPENING THE FOREST','Gathering the roots…','Loading your saved run.','Opening…');$('primary').disabled=true;return;}
 if(paused){overlay('TAKE A BREATH','The forest can wait.','Your seed is held. Resume when you’re ready.','Resume');return;}
 if(s.status==='gameover'){overlay('ALL LIVES LOST','The roots remember.',`Final score: ${s.score.toLocaleString()} · screen ${s.level} of 30. Start again at screen 1 with three lives.`,'Restart · 20,000 TREE','No payment occurs until you approve the transfer in your wallet.');return;}
 if(s.status==='won'){overlay('THE CANOPY STANDS','You broke the blight.',`All 30 screens restored. Final score: ${s.score.toLocaleString()}.`,'Play another run','Your NFTree grants access to the next completed-run challenge.');return;}
 if(s.status==='cleared'){overlay('GROVE RESTORED','The forest grows stronger.',`Next: screen ${s.level+1} · ${BIOMES[Math.floor(s.level/6)].name}.`,'Enter next grove','Your remaining lives carry forward.');return;}
 if(s.status==='ready'){overlay('SCREEN '+String(s.level).padStart(2,'0'),s.lives===3&&s.level===1?'Let the canopy rise.':'Keep the roots alive.','Move the living branch to aim. Launch your seed when ready.','Launch seed','Catch green power-ups. Beware amber forest hazards.');return;}
 $('overlay').hidden=true;
}
async function primary(){await wakeAudio();if(!connected){api.openAuth();return;}if(syncError){syncError='';await flush();if(syncError)return paint();if(!run)await open();paused=false;paint();return;}if(!run)return;if(paused){paused=false;paint();return;}if(run.state.status==='gameover'){try{await checkpoint();quote=await api.request('quote');showQuote();}catch(e){toast(e.message);}return;}if(run.state.status==='won'){try{await checkpoint();replace(await api.request('next'));}catch(e){toast(e.message);}return;}launch=true;canvas.focus();}
function showQuote(){const dl=$('invoice-details');dl.replaceChildren();for(const[k,v]of Object.entries({Network:'Sui Mainnet',Amount:'20,000 TREE',Recipient:quote.recipient,'Invoice ID':quote.id,'Signed digest':quote.expectedDigest||'Not signed yet'})){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=String(v);dl.append(dt,dd);}$('checkout-status').textContent=quote.status==='bound'?'A signed payment is recorded. Resume it without making a second payment.':'';$('pay').textContent=quote.status==='quoted'?'Approve 20,000 TREE in wallet':'Recover recorded payment';$('cancel-payment').hidden=quote.status!=='quoted';if(!$('checkout').open)$('checkout').showModal();}
$('pay').onclick=async()=>{if(!quote||buying)return;buying=true;$('pay').disabled=true;$('cancel-payment').disabled=true;try{if(quote.status==='quoted')await api.pay(quote);else if(quote.status==='bound')await api.resume(quote.id);else await api.recover(quote.id);replace(await api.request('open'));$('checkout').close();sound('power');toast('Restart verified. Three fresh lives.');quote=null;}catch(e){$('checkout-status').textContent=e.message+' Use payment history to recover a recorded transfer before trying again.';}finally{buying=false;$('pay').disabled=false;$('cancel-payment').disabled=false;}};
$('cancel-payment').onclick=async()=>{if(!quote||buying)return;try{await api.cancel(quote.id);quote=null;$('checkout').close();}catch(e){$('checkout-status').textContent=e.message;}};
$('history-toggle').onclick=async()=>{const box=$('history');box.hidden=!box.hidden;if(box.hidden)return;box.textContent='Loading recorded payments…';try{const rows=await api.history();box.replaceChildren();if(!rows.length){box.textContent='No restart payments yet.';return;}for(const row of rows){const p=document.createElement('p');p.textContent=`${row.status.toUpperCase()} · 20,000 TREE · ${row.id}`;box.append(p);if(['quoted','bound','paid'].includes(row.status)){const b=document.createElement('button');b.textContent=row.status==='quoted'?'Review invoice':row.status==='bound'?'Resume recorded payment':'Recover verified restart';b.onclick=()=>{quote=row;showQuote();};box.append(b);}if(row.status==='bound'){const b=document.createElement('button');b.textContent='Check finalized failure';b.onclick=async()=>{try{await api.reconcile(row.id);toast('Failed transfer released. A new invoice can now be created.');}catch(e){toast(e.message);}};box.append(b);}}}catch(e){box.textContent=e.message;}};
$('primary').onclick=primary;
$('launch').onpointerdown=e=>{e.currentTarget.setPointerCapture(e.pointerId);wakeAudio();fire=true;if(run&&['ready','cleared'].includes(run.state.status))launch=true;};
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('launch').addEventListener(name,()=>fire=false);
function togglePause(){if(!run||!connected||syncError)return;paused=!paused;if(paused)flush();paint();}
$('pause').onclick=togglePause;$('sound').onclick=async()=>{muted=!muted;setSound(!muted);$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));if(!muted)await wakeAudio();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.cabinet').requestFullscreen();}catch{toast('Use your browser fullscreen option.');}};
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();target=Math.max(0,Math.min(800,(e.clientX-r.left)/r.width*800));});
canvas.addEventListener('pointerdown',e=>{wakeAudio();canvas.setPointerCapture(e.pointerId);const r=canvas.getBoundingClientRect();target=Math.max(0,Math.min(800,(e.clientX-r.left)/r.width*800));fire=true;if(run?.state.status==='ready')launch=true;});
canvas.addEventListener('pointerup',()=>fire=false);canvas.addEventListener('pointercancel',()=>fire=false);
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','BUTTON','SUMMARY'].includes(e.target.tagName)||$('checkout').open)return;if(['ArrowLeft','ArrowRight',' ','a','d','A','D','p','P'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());wakeAudio();if(e.key===' '&&!e.repeat)launch=true;if(e.key.toLowerCase()==='p'&&!e.repeat)togglePause();}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();fire=false;if(run?.state.status==='playing'){paused=true;flush();paint();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){paused=true;keys.clear();fire=false;flush();paint();}});
api.subscribe(a=>{const next=!!a;if(!next){gameRevision++;queue=[];run=null;paused=true;connected=false;}else if(!connected){connected=true;open();}paint();});
let previousStart=false;
function frame(time){
 const dt=Math.min(.06,(time-last)/1000);last=time;
 const gamepad=navigator.getGamepads?.()?.find(g=>g?.connected);let axis=0,padFire=false;
 if(gamepad){axis=(gamepad.axes[0]||0)+(gamepad.buttons[14]?.pressed?-1:0)+(gamepad.buttons[15]?.pressed?1:0);if(Math.abs(axis)<.2)axis=0;padFire=!!(gamepad.buttons[0]?.pressed||gamepad.buttons[1]?.pressed);const start=!!gamepad.buttons[9]?.pressed;if(start&&!previousStart)togglePause();previousStart=start;if(padFire&&run?.state.status==='ready')launch=true;}
 if(run&&connected&&!paused&&!syncError&&!document.hidden&&!$('checkout').open&&(['ready','playing'].includes(run.state.status)||(run.state.status==='cleared'&&launch))){
  const direction=(keys.has('a')||keys.has('arrowleft')?-1:0)+(keys.has('d')||keys.has('arrowright')?1:0)+axis;
  target=Math.max(0,Math.min(800,target+direction*900*dt));clock+=dt;
  while(clock>=1/60&&queue.length<120){const input={x:target,launch:launch||keys.has(' '),fire:fire||keys.has(' ')||padFire};step(run.state,input);queue.push(input);launch=false;clock-=1/60;if(['gameover','cleared','won'].includes(run.state.status)){flush();clock=0;break;}}
  if(queue.length>=60)flush();if(queue.length>=120){paused=true;toast('Holding your run while the forest reconnects.');}
 }else clock=0;
 if(run){draw(ctx,run.state,{time:time/1000,motion});for(const e of run.state.events){if(e.id>events){sound(e.type);if(e.text&&['power','curse','boss','clear'].includes(e.type))toast(e.text);}}events=Math.max(events,run.state.eventId);}
 paint();requestAnimationFrame(frame);
}
const guide=$('pickups');for(const p of PICKUPS){const row=document.createElement('div'),b=document.createElement('b'),span=document.createElement('span');b.textContent=p.letter;b.className=p.good?'':'bad';span.textContent=p.name+(p.good?' · power-up':' · hazard');row.append(b,span);guide.append(row);}
await open();requestAnimationFrame(frame);
