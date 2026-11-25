import {HOLIDAY_START,holidayAvailable,holidayCountdown,holidayMessage} from './treeforce-season-r18.mjs';
const box=document.getElementById('treeforce-holiday-cabinet');
if(box){
 const message=box.querySelector('[data-holiday-message]'),timer=box.querySelector('[role=timer]'),date=box.querySelector('[data-holiday-date]');
 let interval;
 const update=()=>{const now=Date.now(),text=holidayMessage(now);box.hidden=!text;if(!text)return;
  if(message.textContent!==text)message.textContent=text;
  const remaining=holidayCountdown(now);if(timer.textContent!==remaining)timer.textContent=remaining;
  const label=holidayAvailable(now)?'Ends January 1 at 06:00 UTC':'Arrives November 27 at 06:00 UTC';if(date.textContent!==label)date.textContent=label;
 };
 const stop=()=>{clearInterval(interval);interval=undefined;};
 const sync=()=>{stop();update();if(!document.hidden)interval=setInterval(update,1000);};
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',sync);sync();
}
