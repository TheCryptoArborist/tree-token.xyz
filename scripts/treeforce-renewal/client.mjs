export async function renewSession(session,{fresh,fetchImpl=fetch,signal}={}){
 const response=await fetchImpl('/play/treeforce89/session-refresh',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.sessionToken},body:JSON.stringify({runId:session.runId,...fresh?{freshToken:fresh.sessionToken}:{}}),cache:'no-store',signal});
 let result;try{result=await response.json();}catch{throw Error('Session service unavailable');}
 if(!response.ok)throw Object.assign(Error('Session access needs to be renewed.'),{code:result.code,status:response.status});
 if(result.wallet!==session.wallet||result.runId!==session.runId||!/^[a-f0-9]{64}$/.test(result.sessionToken)||!Number.isSafeInteger(result.expiresAt)||result.expiresAt<=Date.now()||result.expiresAt>Date.now()+2*60*60_000+60000||fresh&&result.sessionToken===session.sessionToken)throw Error('Session renewal could not be validated');
 return result;
}
// These closures are inserted into the existing gateway; no game snapshot is rebuilt.
export function expiryEffect(){
 if(!r)return;
 const expire=()=>{if(a.current!==r)return;window.dispatchEvent(new Event('treeforce-session-suspend'));setRenewalState('expired');p('Verification expired. Your run is paused on this page. Verify to resume with the same score, wave and remaining lives.');};
 const timer=window.setTimeout(expire,Math.max(0,r.expiresAt-Date.now()));
 return()=>window.clearTimeout(timer);
}
export function refreshEffect(){
 if(!r)return;
 let cancelled=false,busy=false;const controller=new AbortController();
 const activity=()=>{lastActivity.current=Date.now();};
 const refresh=async()=>{
  const held=a.current,account=t.stores.$connection.get().account;
  if(cancelled||busy||!held||!account||rh(account.address)!==held.wallet||document.visibilityState!=='visible'||Date.now()-lastActivity.current>90000||held.expiresAt>Date.now()+15*60000||held.expiresAt<=Date.now())return;
  busy=true;try{const next=await renewSession(held,{signal:controller.signal});if(!cancelled&&a.current===held&&rh(t.stores.$connection.get().account?.address)===held.wallet){a.current=next;i(next);setRenewalState('');p('');}}
  catch(error){if(!cancelled&&a.current===held&&[401,403,409].includes(error.status)){window.dispatchEvent(new Event('treeforce-session-suspend'));setRenewalState('expired');p('Your run is paused. Verify access to resume.');}}
  finally{busy=false;}
 };
 window.addEventListener('pointerdown',activity);window.addEventListener('pointermove',activity,{passive:true});window.addEventListener('keydown',activity);
 const timer=window.setInterval(refresh,30000);void refresh();
 return()=>{cancelled=true;controller.abort();window.clearInterval(timer);window.removeEventListener('pointerdown',activity);window.removeEventListener('pointermove',activity);window.removeEventListener('keydown',activity);};
}
export function heldAccountEffect(){
 s.current++;o.current?.abort();l(false);
 const previous=a.current;
 if(previous&&!e?.address){window.dispatchEvent(new Event('treeforce-session-suspend'));return;}
 if(previous&&previous.wallet===rh(e?.address))return;
 a.current=null;i(null);setRenewalState('');p('');
 if(previous)void sh(previous).catch(()=>{});
 return()=>{s.current++;o.current?.abort();};
}
export function foregroundEffect(){
 const check=()=>{const held=a.current;if(!held)return;window.dispatchEvent(new Event('treeforce-session-suspend'));if(held.expiresAt<=Date.now()){setRenewalState('expired');p('Verification expired. Your run is paused. Verify to resume.');}};
 const visible=()=>{if(document.visibilityState==='visible')check();};
 window.addEventListener('pagehide',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',visible);
 return()=>{window.removeEventListener('pagehide',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',visible);};
}
