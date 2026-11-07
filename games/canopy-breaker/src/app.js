import {step,PICKUPS,BIOMES} from './engine.js';
import {SAVE_EVERY_FRAMES,MAX_BATCH_FRAMES,MAX_PENDING_FRAMES} from './replay-limits.js';
import {draw} from './art.js';
import {sound,wakeAudio,setSound} from './audio.js';
import {createControllerTracker,createControllerCalibration} from './controller.js';
import {pickupIcon,loadPickupArt} from './pickup-art.js';
import {loadBlockArt} from './block-art.js';
import {loadBackgroundArt} from './background-art.js';
const $=id=>document.getElementById(id),api=window.breakerSession,canvas=$('game'),ctx=canvas.getContext('2d');
let run=null,queue=[],sending=null,inFlightInputs=0,paused=false,connected=!!api.account,clock=0,last=performance.now(),target=400,launch=false,fire=false,events=0,syncError='',muted=false,opening=null,quote=null,buying=false,gameActionBusy=false,newGameRequest=null,gameRevision=0;
let pauseReason='manual',pauseView=null,pauseSaving=false,resumeAt=0,resumeTask=false,pauseEpoch=0;
const keys=new Set(),motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let controlStorage=null;try{controlStorage=localStorage;}catch{}
const controller=createControllerTracker({storage:controlStorage}),controlDialog=$('controller-dialog');let calibration=null;
const canPause=()=>run&&['ready','playing','cleared'].includes(run.state.status);
function toast(text,{pickup=null}={}){const box=$('toast');box.replaceChildren();box.classList.toggle('pickup-toast',!!pickup);if(pickup){const copy=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span');title.textContent=(pickup.good?'':'Hazard · ')+pickup.name;detail.textContent=pickup.description;copy.append(title,detail);box.append(pickupIcon(pickup.id,{size:48}),copy);}else box.textContent=text;box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),pickup?3500:2500);}
function clearControls(){keys.clear();launch=false;fire=false;clock=0;}
function resetPause(){pauseEpoch++;paused=false;pauseView=null;pauseSaving=false;resumeAt=0;resumeTask=false;clock=0;}
function replace(data){gameRevision++;if(data.id!==run?.id)newGameRequest=null;resetPause();run=data;queue=[];target=run.state.paddle;events=run.state.eventId;syncError='';paint();}
async function open(){
 const address=api.account?.address,stamp=gameRevision;
 if(opening?.address===address&&opening.stamp===stamp)return opening.promise;
 const pending={address,stamp};opening=pending;
 pending.promise=(async()=>{try{const data=await api.request('open');if(api.account?.address!==address||stamp!==gameRevision)return;replace(data);}catch(e){if(api.account?.address===address&&stamp===gameRevision){syncError=e.message;paint();}}finally{if(opening===pending)opening=null;}})();return pending.promise;
}
async function flush(){
 if(sending)return sending;if(!queue.length||!run||!connected)return;
 const inputs=queue.splice(0,MAX_BATCH_FRAMES),id=run.id,revision=run.revision,stamp=gameRevision;inFlightInputs=inputs.length;
 sending=(async()=>{try{const data=await api.request('frames',{id,revision,inputs});if(stamp!==gameRevision)return;if(data.resync){run=data;queue=[];events=run.state.eventId;toast('Saved run restored.');}else{run={...data,state:structuredClone(data.state)};for(const input of queue)step(run.state,input);}syncError='';if(['gameover','won'].includes(data.state.status)){resetPause();window.dispatchEvent(new Event('breaker-score-saved'));}}catch(e){if(stamp===gameRevision){queue.unshift(...inputs);syncError=e.message;pauseEpoch++;resumeAt=0;resumeTask=false;paused=true;pauseView=structuredClone(run.state);clearControls();}}finally{sending=null;inFlightInputs=0;paint();}})();return sending;
}
async function checkpoint(){while(sending||queue.length){if(sending)await sending;else await flush();if(syncError)throw Error(syncError);}}
// Keep rendering a stable pause snapshot while authoritative checkpoints settle.
// Only submitted fixed-step inputs move the server run; countdown adds no inputs.
function pauseGame(reason='manual'){
 if(!canPause()||!connected)return;
 const epoch=++pauseEpoch,stamp=gameRevision,address=api.account?.address;
 paused=true;pauseReason=reason;pauseView=structuredClone(run.state);pauseSaving=true;resumeAt=0;resumeTask=false;clearControls();paint();
 void (async()=>{try{await checkpoint();}catch{}finally{if(epoch===pauseEpoch&&stamp===gameRevision){pauseSaving=false;paint();}}})();
}
async function requestResume(){
 if(!paused||pauseSaving||resumeTask||resumeAt||syncError||!connected||document.hidden||$('checkout').open||controlDialog.open)return;
 const epoch=pauseEpoch,stamp=gameRevision,address=api.account?.address;resumeTask=true;clearControls();paint();
 try{
  await checkpoint();
  if(epoch!==pauseEpoch||stamp!==gameRevision||api.account?.address!==address||!paused||document.hidden||$('checkout').open||controlDialog.open)return;
  if(!canPause()){resetPause();return;}
  pauseView=structuredClone(run.state);resumeAt=performance.now()+3000;last=performance.now();canvas.focus();
 }catch{}finally{if(epoch===pauseEpoch&&stamp===gameRevision){resumeTask=false;paint();}}
}
const pauseCopy={manual:'You paused the game.',focus:'The game window lost focus.',hidden:'The game tab was hidden.',controller:'Your active controller changed or disconnected.',setup:'Controller setup opened.',checkout:'Payment history opened a checkout.',leaderboard:'The leaderboard opened.',saving:'Saving fell behind, so the game paused to protect your run.',navigation:'Your run is saving before leaving the game.'};
function overlay(kicker,title,text,label,note=''){const o=$('overlay');o.hidden=false;o.classList.remove('gameover-choices','pause-state','resume-countdown');$('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('primary').textContent=label;$('primary').disabled=gameActionBusy||buying;$('secondary').hidden=true;$('secondary').disabled=gameActionBusy||buying;$('overlay-note').textContent=note;}
function paint(){
 const s=run?.state;if(s){$('level').textContent=String(s.level).padStart(2,'0')+' / 30';$('score').textContent=String(s.score).padStart(6,'0');$('lives').textContent=Array.from({length:3},(_,i)=>i<s.lives?'●':'○').join(' ');}
 if(!connected){overlay('NFTREE ACCESS REQUIRED','The canopy awaits.','Connect your Sui wallet and verify NFTree ownership.',api.authLabel||'Connect Wallet','Sign-in is a message. No TREE payment is needed to verify.');$('primary').disabled=!!api.authBusy;return;}
 if(syncError){overlay('FOREST CONNECTION','Your run is held.',syncError,'Reconnect','Your recorded payment and saved run remain recoverable.');return;}
 if(!s){overlay('OPENING THE FOREST','Gathering the roots…','Loading your saved run.','Opening…');$('primary').disabled=true;return;}
 if(paused){
  const saving=pauseSaving||resumeTask,seconds=Math.max(1,Math.ceil((resumeAt-performance.now())/1000));
  overlay(resumeAt?'GET READY':pauseReason==='saving'?'SAVING YOUR RUN':'GAME PAUSED',resumeAt?`Resuming in ${seconds}…`:'The forest can wait.',resumeAt?'Aim your branch. The seed stays frozen until the countdown ends.':pauseCopy[pauseReason]||pauseCopy.manual,resumeAt?`Resume in ${seconds}`:saving?'Saving paused position…':'Resume','Your seed is held. Resume includes a three-second countdown.');
  $('overlay').classList.add('pause-state');if(resumeAt)$('overlay').classList.add('resume-countdown');$('primary').disabled=!!(saving||resumeAt);return;
 }

 if(s.status==='gameover'){overlay('ALL LIVES LOST','The roots remember.',`Score: ${s.score.toLocaleString()} · screen ${s.level} of 30. Continue with your score, or start again from zero.`,'Continue · 20,000 TREE','New game resets score; leaderboard best stays saved. Both choices start at screen 1 with three lives.');$('overlay').classList.add('gameover-choices');$('secondary').textContent='Start New Game · Free';$('secondary').hidden=false;return;}
 if(s.status==='won'){overlay('THE CANOPY STANDS','You broke the blight.',`All 30 screens restored. Final score: ${s.score.toLocaleString()}.`,'Play another run','Your NFTree grants access to the next completed-run challenge.');return;}
 if(s.status==='cleared'){overlay('GROVE RESTORED','The forest grows stronger.',`Next: screen ${s.level+1} · ${BIOMES[Math.floor(s.level/6)].name}.`,'Enter next grove','Your remaining lives carry forward.');return;}
 if(s.status==='ready'){overlay('SCREEN '+String(s.level).padStart(2,'0'),s.lives===3&&s.level===1?'Let the canopy rise.':'Keep the roots alive.','Move the living branch to aim. Launch your seed when ready.','Launch seed','Catch green power-ups. Beware amber forest hazards.');return;}
 $('overlay').hidden=true;
}
async function primary(){if(gameActionBusy||buying)return;await wakeAudio();if(gameActionBusy||buying)return;if(!connected){await api.openAuth();return;}if(syncError){const address=api.account?.address,stamp=gameRevision;syncError='';try{await checkpoint();if(api.account?.address!==address||stamp!==gameRevision)return;if(!run)await open();else if(canPause())pauseGame('saving');}catch{}paint();return;}if(!run)return;if(paused){await requestResume();return;}if(run.state.status==='gameover'){const address=api.account?.address,stamp=gameRevision;gameActionBusy=true;paint();try{await checkpoint();if(api.account?.address!==address||stamp!==gameRevision)return;const nextQuote=await api.request('quote');if(api.account?.address!==address||stamp!==gameRevision)return;quote=nextQuote;showQuote();}catch(e){if(api.account?.address===address&&stamp===gameRevision)toast(e.message);}finally{gameActionBusy=false;paint();}return;}if(run.state.status==='won'){try{await checkpoint();replace(await api.request('next'));}catch(e){toast(e.message);}return;}launch=true;canvas.focus();}
async function startNewGame(){
 if(gameActionBusy||buying||!connected||!run||run.state.status!=='gameover')return;
 const address=api.account?.address,stamp=gameRevision,id=newGameRequest?.address===address&&newGameRequest.id===run.id?newGameRequest.id:run.id;
 newGameRequest={id,address};gameActionBusy=true;paint();
 try{
  await checkpoint();if(api.account?.address!==address||stamp!==gameRevision)return;
  const data=await api.request('newGame',{id});
  if(api.account?.address!==address||stamp!==gameRevision)return;
  replace(data);quote=null;if($('checkout').open)$('checkout').close();api.history().catch(()=>{});
  toast('New game ready. Score reset. Your leaderboard best is saved.');
 }catch(e){if(api.account?.address===address&&stamp===gameRevision)toast(e.message);}
 finally{gameActionBusy=false;paint();}
}
function showQuote(){pauseGame('checkout');const dl=$('invoice-details');dl.replaceChildren();for(const[k,v]of Object.entries({Network:'Sui Mainnet',Amount:'20,000 TREE',Recipient:quote.recipient,'Invoice ID':quote.id,'Signed digest':quote.expectedDigest||'Not signed yet'})){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=String(v);dl.append(dt,dd);}$('checkout-status').textContent=quote.status==='bound'?'A signed payment is recorded. Resume it without making a second payment.':'';$('pay').textContent=quote.status==='quoted'?'Approve 20,000 TREE in wallet':'Recover recorded payment';$('cancel-payment').hidden=quote.status!=='quoted';if(!$('checkout').open)$('checkout').showModal();}
$('pay').onclick=async()=>{if(!quote||buying)return;buying=true;$('pay').disabled=true;$('cancel-payment').disabled=true;try{if(quote.status==='quoted')await api.pay(quote);else if(quote.status==='bound')await api.resume(quote.id);else await api.recover(quote.id);replace(await api.request('open'));$('checkout').close();sound('power');toast('Continue verified. Score kept. Three fresh lives.');quote=null;}catch(e){$('checkout-status').textContent=e.message+' Use payment history to recover a recorded transfer before trying again.';}finally{buying=false;$('pay').disabled=false;$('cancel-payment').disabled=false;}};
$('cancel-payment').onclick=async()=>{if(!quote||buying)return;try{await api.cancel(quote.id);quote=null;$('checkout').close();}catch(e){$('checkout-status').textContent=e.message;}};
$('history-toggle').onclick=async()=>{const box=$('history');box.hidden=!box.hidden;if(box.hidden)return;box.textContent='Loading recorded payments…';try{const rows=await api.history();box.replaceChildren();if(!rows.length){box.textContent='No continue payments yet.';return;}for(const row of rows){const p=document.createElement('p');p.textContent=`${row.status.toUpperCase()} · 20,000 TREE · ${row.id}`;box.append(p);if(['quoted','bound','paid'].includes(row.status)){const b=document.createElement('button');b.textContent=row.status==='quoted'?'Review invoice':row.status==='bound'?'Resume recorded payment':'Recover verified continue';b.onclick=()=>{quote=row;showQuote();};box.append(b);}if(row.status==='bound'){const b=document.createElement('button');b.textContent='Check finalized failure';b.onclick=async()=>{try{await api.reconcile(row.id);toast('Failed transfer released. A new invoice can now be created.');}catch(e){toast(e.message);}};box.append(b);}}}catch(e){box.textContent=e.message;}};
$('primary').onclick=primary;
$('secondary').onclick=startNewGame;
$('launch').onpointerdown=e=>{e.currentTarget.setPointerCapture(e.pointerId);wakeAudio();if(!paused){fire=true;if(run&&['ready','cleared'].includes(run.state.status))launch=true;}};
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('launch').addEventListener(name,()=>fire=false);
function togglePause(){if(!canPause()||!connected||syncError)return;if(paused&&!resumeAt)void requestResume();else pauseGame('manual');}
window.addEventListener('breaker-view-leaderboard',()=>{pauseGame('leaderboard');});
for(const link of document.querySelectorAll('.game-navigation a,.top a')){
 if(!['https://tree-token.xyz/','https://tree-token.xyz/play/'].includes(link.href)||link.target==='_blank')continue;
 link.addEventListener('click',async event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!run||!connected)return;
  event.preventDefault();pauseGame('navigation');
  try{await checkpoint();window.location.assign(link.href);}catch{toast('Your run could not save yet. Reconnect before leaving the game.');}
 });
}
$('pause').onclick=togglePause;$('sound').onclick=async()=>{muted=!muted;setSound(!muted);$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));if(!muted)await wakeAudio();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.cabinet').requestFullscreen();}catch{toast('Use your browser fullscreen option.');}};
document.querySelector('.field').addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();target=Math.max(0,Math.min(800,(e.clientX-r.left)/r.width*800));});
canvas.addEventListener('pointerdown',e=>{wakeAudio();canvas.setPointerCapture(e.pointerId);const r=canvas.getBoundingClientRect();target=Math.max(0,Math.min(800,(e.clientX-r.left)/r.width*800));if(!paused){fire=true;if(run?.state.status==='ready')launch=true;}});
canvas.addEventListener('pointerup',()=>fire=false);canvas.addEventListener('pointercancel',()=>fire=false);
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','BUTTON','SUMMARY'].includes(e.target.tagName)||$('checkout').open)return;if(['ArrowLeft','ArrowRight',' ','a','d','A','D','p','P'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());wakeAudio();if(e.key===' '&&!e.repeat&&!paused)launch=true;if(e.key.toLowerCase()==='p'&&!e.repeat)togglePause();}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearControls();if(run?.state.status==='playing'||resumeAt)pauseGame('focus');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearControls();pauseGame('hidden');}});
api.subscribe(a=>{const next=!!a;if(!next){gameRevision++;resetPause();clearControls();queue=[];run=null;connected=false;}else if(!connected){connected=true;open();}paint();});
window.addEventListener('breaker-auth-change',()=>paint());
function textIfChanged(id,text){if($(id).textContent!==text)$(id).textContent=text;}
$('controller-setup').onclick=()=>{calibration=null;pauseGame('setup');$('controller-prompt').textContent='Release all controller buttons and the D-pad, then choose Begin setup.';if(!controlDialog.open)controlDialog.showModal();};
$('controller-begin').onclick=()=>{if(!controller.pad)return;wakeAudio();calibration=createControllerCalibration(controller.pad);};
$('controller-reset').onclick=()=>{if(!controller.pad)return;controller.clearProfile(controller.pad.id);calibration=null;$('controller-prompt').textContent='Default controls restored. You can set the buttons again or close this window.';};
controlDialog.addEventListener('close',()=>{calibration=null;});
function pollController(){
 const input=controller.poll(),pad=controller.pad;
 textIfChanged('controller-status',input.error?'Controller access is unavailable here. Keyboard and mouse still work.':pad?`${input.profile} connected · ${pad.id}`:'Connect your USB NES controller and press any button.');
 $('controller-begin').disabled=!pad||!!calibration;$('controller-reset').disabled=!pad;
 if(input.disconnected&&canPause()){pauseGame('controller');toast('Controller changed or disconnected. Your game is paused.');}
 if(controlDialog.open&&calibration){
  const state=calibration.poll(pad),names={left:'D-pad LEFT',right:'D-pad RIGHT',a:'A',b:'B',start:'START'};
  if(state.disconnected){calibration=null;$('controller-prompt').textContent='Controller disconnected. Reconnect it and begin setup again.';}
  else if(state.complete){controller.setProfile(pad.id,state.profile);calibration=null;$('controller-prompt').textContent='NES controls saved. Close this window, then press Start to resume. Select is not used for gameplay.';toast('NES controller controls saved.');}
  else textIfChanged('controller-prompt',state.error||state.release?`${state.error?state.error+' ':''}Release all controls, then ${state.action==='left'||state.action==='right'?'hold':'press'} ${names[state.action]}.`:`${state.action==='left'||state.action==='right'?'Hold':'Press'} ${names[state.action]}.`);
 }
 return input;
}
function frame(time){
 const dt=Math.min(.06,(time-last)/1000);last=time;
 if(resumeAt&&($('checkout').open||controlDialog.open))pauseGame(controlDialog.open?'setup':'checkout');
 const input=pollController(),canUsePad=connected&&!syncError&&!document.hidden&&!$('checkout').open&&!controlDialog.open;
 const axis=canUsePad?input.axis:0,padFire=canUsePad&&input.fire;
 if(canUsePad){if(input.startPressed){wakeAudio();togglePause();}if(input.firePressed&&!paused&&run&&['ready','cleared'].includes(run.state.status)){wakeAudio();launch=true;}}
 const direction=(keys.has('a')||keys.has('arrowleft')?-1:0)+(keys.has('d')||keys.has('arrowright')?1:0)+axis;
 if(paused&&resumeAt)target=Math.max(0,Math.min(800,target+direction*900*dt));
 let justResumed=false;
 if(resumeAt&&time>=resumeAt&&connected&&!syncError&&!document.hidden&&!$('checkout').open&&!controlDialog.open){resetPause();last=time;justResumed=true;}
 if(run&&connected&&!paused&&!justResumed&&!syncError&&!document.hidden&&!$('checkout').open&&!controlDialog.open&&(['ready','playing'].includes(run.state.status)||(run.state.status==='cleared'&&launch))){
  target=Math.max(0,Math.min(800,target+direction*900*dt));clock+=dt;
  while(clock>=1/60&&queue.length+inFlightInputs<MAX_PENDING_FRAMES){const input={x:target,launch:launch||keys.has(' '),fire:fire||keys.has(' ')||padFire};step(run.state,input);queue.push(input);launch=false;clock-=1/60;if(['gameover','cleared','won'].includes(run.state.status)){flush();clock=0;break;}}
  if(queue.length>=SAVE_EVERY_FRAMES)flush();if(queue.length+inFlightInputs>=MAX_PENDING_FRAMES)pauseGame('saving');
 }else clock=0;
 if(run){draw(ctx,paused&&pauseView?pauseView:run.state,{time:time/1000,motion});if(paused&&resumeAt){ctx.save();ctx.strokeStyle='#ffe05e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(target-14,865);ctx.lineTo(target,852);ctx.lineTo(target+14,865);ctx.stroke();ctx.restore();}for(const e of run.state.events){if(e.id>events){sound(e.type);if(e.text&&['power','curse','boss','clear'].includes(e.type))toast(e.text,{pickup:['power','curse'].includes(e.type)?PICKUPS.find(p=>p.name===e.text):null});}}events=Math.max(events,run.state.eventId);}
 paint();requestAnimationFrame(frame);
}
const guide=$('pickups');for(const p of PICKUPS){const row=document.createElement('div'),copy=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('span');name.textContent=p.name+(p.good?'':' · hazard');detail.textContent=p.description;copy.append(name,detail);row.append(pickupIcon(p.id,{size:52}),copy);guide.append(row);}
await Promise.all([loadPickupArt(),loadBlockArt(),loadBackgroundArt()]);
await open();requestAnimationFrame(frame);
