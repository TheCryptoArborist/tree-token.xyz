import {holderAccess,onHolderChange} from './holder-session.js';
import {TRIAL_KEY} from './play-access.js';
const $=s=>document.querySelector(s),KEY='grove-chess:online-room:v1';
export function mergeOnlineTrial(previous,room){
 const used=Math.max(previous.used,room.used);
 // Reading an old result must not revoke a newer unfinished local trial.
 if(room.used>previous.used||previous.active===room.id||!previous.active)return {used,active:room.id,finished:room.status==='finished'};
 return {...previous,used};
}
export function createOnline({onRoom}){
 let room=null,active=false,timer,busy=false,studio,generation=0,sharingRoom=null;
 const note=text=>{$('#online-note').textContent=text;};
 function used(){try{const s=JSON.parse(localStorage.getItem(TRIAL_KEY)||'{"used":0}');return Number.isInteger(s.used)&&s.used>=0&&s.used<=2?s.used:2;}catch{return 2;}}
 function auth(){if(!holderAccess.isHolder())return {};for(const store of [localStorage,sessionStorage]){try{const s=JSON.parse(store.getItem('tree-arcade:daily-growth:session:v1'));if(s?.wallet===holderAccess.state.wallet&&/^[a-f0-9]{64}$/.test(s.token)&&new Date(s.expiresAt).getTime()>Date.now())return {Authorization:'Bearer '+s.token};}catch{}}return {};}
 function paint(){
  $('#online-join').hidden=!room||room.seat!==null||room.status!=='waiting';
  paintSharing();
  $('#online-cancel').hidden=!room||!room.seat||room.status!=='waiting';
  $('#online-resign').hidden=!room||!room.seat||room.status!=='playing';
  for(const id of ['#online-find','#online-private']){$(id).disabled=busy;$(id).hidden=Boolean(room&&room.seat&&['waiting','playing'].includes(room.status));}
  $('#online-signin').hidden=!holderAccess.isHolder();
 }
 function invitation(){
  if(!room||!room.seat||room.status!=='waiting'||Date.parse(room.expiresAt)<=Date.now())return null;
  return {title:'Grove Chess · TREE Arcade',text:'Challenge me to Grove Chess 🌳♟️ Your first two games are free—no wallet needed. Take the open seat before this invitation expires!',url:'https://tree-token.xyz/play/grove-chess/?room='+encodeURIComponent(room.id)};
 }
 function paintSharing(){
  const invite=invitation();$('#online-sharing').hidden=!invite;
  if(!invite){$('#online-invite-link').value='';for(const id of ['#online-sms','#online-x','#online-facebook'])$(id).href='';sharingRoom=null;return;}
  if(sharingRoom!==room.id){$('#online-share-status').textContent='Choose an app, send a text, or copy your link.';sharingRoom=room.id;}
  $('#online-share').hidden=typeof globalThis.navigator?.share!=='function';
  $('#online-invite-link').value=invite.url;
  const message=encodeURIComponent(invite.text+' '+invite.url);
  $('#online-sms').href=(/iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent||'')?'sms:&body=':'sms:?body=')+message;
  $('#online-x').href='https://twitter.com/intent/tweet?text='+encodeURIComponent(invite.text)+'&url='+encodeURIComponent(invite.url);
  $('#online-facebook').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(invite.url);
 }
 function shareReady(){const invite=invitation();if(!invite){paintSharing();note('This invitation is no longer open. Create a new match to invite a friend.');}return invite;}
 $('#online-share').onclick=async()=>{
  const invite=shareReady();if(!invite)return;
  try{await navigator.share(invite);$('#online-share-status').textContent='Invitation shared. Keep this game open while your friend joins.';}
  catch(error){$('#online-share-status').textContent=error.name==='AbortError'?'Sharing cancelled. Your invitation is still ready.':'Sharing is unavailable here. Copy the invitation link or use one of the options below.';}
 };
 for(const id of ['#online-sms','#online-x','#online-facebook'])$(id).onclick=event=>{if(!shareReady())event.preventDefault();};
 function accept(next){
  room=next;
  if(room.seat){localStorage.setItem(KEY,room.id);if(!room.holderSeat&&['playing','finished'].includes(room.status)){let previous;try{previous=JSON.parse(localStorage.getItem(TRIAL_KEY))||{used:0,active:null,finished:false};}catch{previous={used:2,active:null,finished:true};}localStorage.setItem(TRIAL_KEY,JSON.stringify(mergeOnlineTrial({...previous,used:used()},room)));}}
  const expired=room.status==='waiting'&&Date.parse(room.expiresAt)<=Date.now();
  note(expired?'This invitation has expired. Start a new match.':room.status==='waiting'?(room.seat?'Waiting for an opponent. Share your invitation or keep this tab open.':'An open seat awaits. Join to play as Pine.'):room.status==='playing'?(room.seat?'You play '+(room.seat==='w'?'Birch (White).':'Pine (Black).'):'Both seats are taken. You can watch this match.'):room.result||'This invitation was cancelled.');
  if(expired)room={...room,status:'expired'};
  if(active)onRoom(room);paint();
 }
 async function request(action,body){
  const ticket=generation;
  const r=await fetch('/api/grove-chess?action='+action+(action==='read'?'&room='+encodeURIComponent(body.room):''),{method:action==='read'?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...auth()},...(action==='read'?{}:{body:JSON.stringify({...body,used:used()})}),signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(ticket!==generation)return null;if(!r.ok)throw Error(d.message||'Online play is unavailable.');if(room?.id===d.room.id&&room.revision>d.room.revision)return room;accept(d.room);return room;
 }
 async function run(action,body){if(busy)return;if(action!=='read')generation++;busy=true;paint();try{return await request(action,body);}catch(e){note(e.message);if(room&&action==='move')try{await request('read',{room:room.id});note(e.message);}catch{}return null;}finally{busy=false;paint();if(active){clearTimeout(timer);timer=setTimeout(poll,4000);}}}
 async function poll(){clearTimeout(timer);if(!active)return;const ticket=generation;if(room&&!busy)try{await request('read',{room:room.id});}catch{if(ticket===generation)note('Connection interrupted. Reconnecting — your match is saved.');}if(active&&ticket===generation)timer=setTimeout(poll,4000);}
 onHolderChange(paint);
 async function start(announce){if(holderAccess.isHolder()&&!auth().Authorization){note('Sign in below to use unlimited NFTree play. This is a free wallet message.');return;}const next=await run('create',{announce});if(next){history.replaceState(null,'','?room='+next.id);}}
 $('#online-find').onclick=()=>start(true);$('#online-private').onclick=()=>start(false);
 $('#online-join').onclick=()=>{if(holderAccess.isHolder()&&!auth().Authorization){note('Sign in below to use your NFTree access.');return;}void run('join',{room:room.id});};
 $('#online-cancel').onclick=()=>run('cancel',{room:room.id,revision:room.revision});
 $('#online-resign').onclick=()=>$('#online-resign-dialog').showModal();
 $('#online-resign-no').onclick=()=>$('#online-resign-dialog').close();
 $('#online-resign-yes').onclick=()=>{$('#online-resign-dialog').close();void run('resign',{room:room.id,revision:room.revision});};
 $('#online-copy').onclick=async()=>{const invite=shareReady();if(!invite)return;try{await navigator.clipboard.writeText(invite.url);$('#online-share-status').textContent='Invitation link copied. Paste it into a text, chat, or social post.';}catch{$('#online-invite-link').focus({preventScroll:true});$('#online-invite-link').select();$('#online-share-status').textContent='Copy the selected invitation link, then paste it into your message.';}};
 $('#online-signin').onclick=async()=>{try{note('Approve the free Arcade sign-in message in your wallet.');if(!studio){const {createStudioAccess}=await import('/scripts/profile-studio-access-v4.js');studio=createStudioAccess();}await studio.signIn();note('Signed in. You can create or join your match.');}catch(e){note(e.message);}};
 return {auth,get room(){return room;},get busy(){return busy;},async activate(){generation++;active=true;$('#online-panel').hidden=false;let id=new URLSearchParams(location.search).get('room');if(!id)try{id=localStorage.getItem(KEY);}catch{}if(id)await run('read',{room:id});else{note('Invite a friend privately by text, chat, or social media. Find an opponent announces your match in the Arcade Telegram topic.');paint();}void poll();},deactivate(){generation++;active=false;clearTimeout(timer);$('#online-panel').hidden=true;},move(move){if(!room)return;return run('move',{room:room.id,revision:room.revision,...move});}};
}
