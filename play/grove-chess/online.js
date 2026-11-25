import {holderAccess,onHolderChange} from './holder-session.js';
import {TRIAL_KEY} from './play-access.js';
const $=s=>document.querySelector(s),KEY='grove-chess:online-room:v1';
export function createOnline({onRoom}){
 let room=null,active=false,timer,busy=false,studio;
 const note=text=>{$('#online-note').textContent=text;};
 function used(){try{const s=JSON.parse(localStorage.getItem(TRIAL_KEY)||'{"used":0}');return Number.isInteger(s.used)&&s.used>=0&&s.used<=2?s.used:2;}catch{return 2;}}
 function auth(){if(!holderAccess.isHolder())return {};for(const store of [localStorage,sessionStorage]){try{const s=JSON.parse(store.getItem('tree-arcade:daily-growth:session:v1'));if(s?.wallet===holderAccess.state.wallet&&/^[a-f0-9]{64}$/.test(s.token)&&new Date(s.expiresAt).getTime()>Date.now())return {Authorization:'Bearer '+s.token};}catch{}}return {};}
 function paint(){
  $('#online-join').hidden=!room||room.seat!==null||room.status!=='waiting';
  $('#online-copy').hidden=!room||room.status!=='waiting';
  $('#online-cancel').hidden=!room||!room.seat||room.status!=='waiting';
  $('#online-resign').hidden=!room||!room.seat||room.status!=='playing';
  for(const id of ['#online-find','#online-private']){$(id).disabled=busy;$(id).hidden=Boolean(room&&room.seat&&['waiting','playing'].includes(room.status));}
  $('#online-signin').hidden=!holderAccess.isHolder();
 }
 function accept(next){
  room=next;
  if(room.seat){localStorage.setItem(KEY,room.id);if(!room.holderSeat&&['playing','finished'].includes(room.status)){localStorage.setItem(TRIAL_KEY,JSON.stringify({used:Math.max(used(),room.used),active:room.id,finished:room.status==='finished'}));}}
  const expired=room.status==='waiting'&&Date.parse(room.expiresAt)<=Date.now();
  note(expired?'This invitation has expired. Start a new match.':room.status==='waiting'?(room.seat?'Waiting for an opponent. Share your invitation or keep this tab open.':'An open seat awaits. Join to play as Pine.'):room.status==='playing'?(room.seat?'You play '+(room.seat==='w'?'Birch (White).':'Pine (Black).'):'Both seats are taken. You can watch this match.'):room.result||'This invitation was cancelled.');
  if(expired)room={...room,status:'expired'};
  if(active)onRoom(room);paint();
 }
 async function request(action,body){
  const r=await fetch('/api/grove-chess?action='+action+(action==='read'?'&room='+encodeURIComponent(body.room):''),{method:action==='read'?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...auth()},...(action==='read'?{}:{body:JSON.stringify({...body,used:used()})}),signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(!r.ok)throw Error(d.message||'Online play is unavailable.');accept(d.room);return room;
 }
 async function run(action,body){if(busy)return;busy=true;paint();try{return await request(action,body);}catch(e){note(e.message);if(room&&action==='move')try{await request('read',{room:room.id});note(e.message);}catch{}return null;}finally{busy=false;paint();}}
 async function poll(){clearTimeout(timer);if(!active)return;if(room&&!busy)try{await request('read',{room:room.id});}catch{note('Connection interrupted. Reconnecting — your match is saved.');}timer=setTimeout(poll,4000);}
 onHolderChange(paint);
 async function start(announce){if(holderAccess.isHolder()&&!auth().Authorization){note('Sign in below to use unlimited NFTree play. This is a free wallet message.');return;}const next=await run('create',{announce});if(next){history.replaceState(null,'','?room='+next.id);}}
 $('#online-find').onclick=()=>start(true);$('#online-private').onclick=()=>start(false);
 $('#online-join').onclick=()=>{if(holderAccess.isHolder()&&!auth().Authorization){note('Sign in below to use your NFTree access.');return;}void run('join',{room:room.id});};
 $('#online-cancel').onclick=()=>run('cancel',{room:room.id,revision:room.revision});
 $('#online-resign').onclick=()=>$('#online-resign-dialog').showModal();
 $('#online-resign-no').onclick=()=>$('#online-resign-dialog').close();
 $('#online-resign-yes').onclick=()=>{$('#online-resign-dialog').close();void run('resign',{room:room.id,revision:room.revision});};
 $('#online-copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/play/grove-chess/?room='+room.id);note('Match link copied.');}catch{note('Share this link: '+location.origin+'/play/grove-chess/?room='+room.id);}};
 $('#online-signin').onclick=async()=>{try{note('Approve the free Arcade sign-in message in your wallet.');if(!studio){const {createStudioAccess}=await import('/scripts/profile-studio-access-v4.js');studio=createStudioAccess();}await studio.signIn();note('Signed in. You can create or join your match.');}catch(e){note(e.message);}};
 return {get room(){return room;},get busy(){return busy;},async activate(){active=true;$('#online-panel').hidden=false;let id=new URLSearchParams(location.search).get('room');if(!id)try{id=localStorage.getItem(KEY);}catch{}if(id)await run('read',{room:id});else{note('Invite someone to a live match. “Find an opponent” posts the cabinet artwork and a join link in the Arcade Telegram topic.');paint();}void poll();},deactivate(){active=false;clearTimeout(timer);$('#online-panel').hidden=true;},move(move){if(!room)return;return run('move',{room:room.id,revision:room.revision,...move});}};
}
