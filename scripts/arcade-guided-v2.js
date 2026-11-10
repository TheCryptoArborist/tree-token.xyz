import {mountShareBuilder,shareGames,savedGameStatus} from './arcade-share-builder.js';
const root=document.getElementById('arcade-daily-growth');
if(root){
 const $=id=>document.getElementById(id);let progress=null,sessionActive=false,launched=false,expiresAt=null,stale=false;
 mountShareBuilder($('guided-campaign-share'));mountShareBuilder($('guided-share-score'));mountShareBuilder($('guided-friend-challenge'),{challenge:true});
 const route=id=>$(id)?.click();$('guided-view-month').addEventListener('click',()=>route('growth-month-tab'));
 $('guided-check').addEventListener('click',()=>{route('growth-today-tab');$('growth-check-in-task').scrollIntoView({block:'center',behavior:'smooth'});});
 $('guided-open-share').addEventListener('click',()=>$('guided-campaign-share').scrollIntoView({block:'start',behavior:'smooth'}));
 function gameChoice(){const game=shareGames.find(g=>g.id===$('guided-game').value);$('guided-play').href=game.url;$('guided-play').textContent='Play '+game.name+' ↗';$('guided-campaign-share').dispatchEvent(new CustomEvent('arcade-share-game',{detail:{gameId:game.id}}));launched=false;render();}
 $('guided-game').addEventListener('change',gameChoice);$('guided-play').addEventListener('click',()=>{launched=true;render();});
 $('guided-game-refresh').addEventListener('click',()=>{$('growth-refresh').click();if(!$('campaign-game').disabled)$('campaign-game').click();});
 $('guided-start-bonus').addEventListener('click',()=>$('campaign-start').click());
 function render(){
  $('guided-today').textContent=progress?(progress.today.checkedIn?'Checked in today ✓':'Ready for today’s free check-in'):'Sign in to see saved attendance';
  $('guided-attendance').textContent=progress?`${progress.checkedInDays} check-ins this month${stale?' · Last saved':''}`:'Your check-ins will appear here';
  const next=progress?.milestones.find(m=>!m.earned&&m.target>progress.checkedInDays);$('guided-next-badge').textContent=progress?next?`${next.target-progress.checkedInDays} more check-ins to the ${next.target}-day badge`:progress.milestones.length&&progress.milestones.every(m=>m.earned)?'Your monthly attendance badges are complete ✓':'Keep growing your monthly collection':'Four attendance badges · 3, 7, 14, 21 days';
  $('guided-check-state').textContent=progress?progress.today.checkedIn?'Completed ✓ · Today’s attendance is saved':'Not started · Save today’s free check-in':sessionActive?'Loading your saved attendance…':'Sign in to load your saved attendance';
  $('arcade-checkin-shortcut').textContent=progress?.today.checkedIn?'Checked in today ✓':'Open free daily check-in →';
  $('guided-check').textContent=progress?.today.checkedIn?'View today’s check-in ✓':'Open daily check-in →';
  const selected=shareGames.find(g=>g.id===$('guided-game').value);$('guided-game-state').textContent=savedGameStatus(progress,selected,launched);
  $('guided-game-refresh').disabled=!sessionActive;$('guided-game-refresh').title=sessionActive?'Refresh recorded gameplay':'Sign in to load saved gameplay';
  const start=$('campaign-start');$('guided-start-bonus').disabled=start.disabled;$('guided-start-bonus').textContent=start.textContent.includes('started')?'Badge tracking started ✓':'Start First Round badge tracking';
  if(expiresAt&&sessionActive){const minutes=Math.max(0,Math.ceil((Date.parse(expiresAt)-Date.now())/60000));$('guided-session-note').textContent=minutes<=5?`Your Arcade sign-in expires in ${minutes} minute${minutes===1?'':'s'}. Saved check-ins stay saved; switching tabs does not require a new check-in.`:'Signed in across all Arcade tabs. Check-in is saved once per UTC day.';}else $('guided-session-note').textContent='One Arcade sign-in works across every tab. If it expires after an hour, your saved check-ins and badges are kept.';
 }
 root.addEventListener('arcade-progress',e=>{progress=e.detail.progress;sessionActive=e.detail.sessionActive;expiresAt=e.detail.expiresAt;stale=e.detail.stale;render();});
 new MutationObserver(render).observe($('campaign-game-status'),{childList:true,characterData:true,subtree:true});
 new MutationObserver(render).observe($('campaign-start'),{attributes:true,childList:true});render();
}
