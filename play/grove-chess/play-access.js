// Anonymous trials are per browser, not a financial or server-side entitlement.
export const TRIAL_KEY='grove-chess:trial:v1';
export function createPlayAccess({storage,holder=()=>false}={}){
 let writeFailed=false;
 function read(){try{const raw=storage.getItem(TRIAL_KEY);if(raw===null)return {used:0,active:null,finished:false};const s=JSON.parse(raw);if(!Number.isInteger(s.used)||s.used<0||s.used>2||!(s.active===null||typeof s.active==='string')||typeof s.finished!=='boolean')throw Error();return s;}catch{return {used:2,active:null,finished:true,unavailable:true};}}
 function save(s){try{storage.setItem(TRIAL_KEY,JSON.stringify(s));writeFailed=false;return true;}catch{writeFailed=true;return false;}}
 function current(id){const s=read();return s.active===id&&!s.finished;}
 return {remaining:()=>2-read().used,canPlay:id=>holder()||current(id)||read().used<2,
  start(id){if(holder())return true;const s=read();if(s.active===id&&!s.finished)return true;if(s.used>=2||!id)return false;return save({used:s.used+1,active:id,finished:false});},
  complete(id){const s=read();if(s.active===id&&!s.finished)save({...s,finished:true});},
  isFinished:id=>{const s=read();return s.active===id&&s.finished;},
  message(id){if(holder())return 'NFTree verified · Unlimited play';const s=read();if(s.unavailable||writeFailed)return 'Browser storage is unavailable. Enable it for two free games, or connect your NFTree wallet.';if(s.active===id&&!s.finished)return `Free game ${s.used} of 2 · Resume anytime in this browser`;return s.used<2?`${2-s.used} free ${s.used===1?'game':'games'} remaining · NFTree required after your trial`:'Your two free games are used · Connect your NFTree wallet to keep playing';}
 };
}
