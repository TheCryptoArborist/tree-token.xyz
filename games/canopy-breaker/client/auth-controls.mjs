export function authPresentation({address,principal,busy=false,loading=false},opening=false){
 const label=principal||loading?'Opening game…':busy?'Verifying NFTree…':opening?(address?'Opening sign-in…':'Opening wallet…'):address?'Verify NFTree':'Connect Wallet';
 return {label,disabled:!!(principal||busy||loading||opening)};
}

// Keep the cabinet CTA on the same wallet/sign-in flow as the access panel.
export function createAuthControls({document,getState,verify,onError=()=>{},onChange=()=>{}}){
 let opening=false;
 const presentation=()=>authPresentation(getState(),opening);
 function render(){
  const state=getState(),action=presentation(),primary=document.getElementById('primary'),button=document.getElementById('verify');
  if(!state.loaded){primary.textContent=action.label;primary.disabled=action.disabled;}
  button.textContent=state.principal?'NFTree verified':state.busy?'Verifying NFTree…':'Verify NFTree';
  button.disabled=!!(!state.address||state.principal||state.busy||state.loading);
  onChange();
 }
 async function open(){
  const state=getState();
  if(presentation().disabled)return false;
  const startAddress=state.address,action=startAddress?'verify':'connect';
  let failure=null;
  opening=true;render();
  try{
   const panel=document.querySelector('.access');
   if(!panel)throw Error('The NFTree access panel is unavailable. Reload the game to try again.');
   if(document.fullscreenElement&&!document.fullscreenElement.contains(panel)){
    if(!document.exitFullscreen)throw Error('Exit fullscreen to connect and verify your NFTree wallet.');
    await document.exitFullscreen();
    if(document.fullscreenElement&&!document.fullscreenElement.contains(panel))throw Error('Exit fullscreen to connect and verify your NFTree wallet.');
   }
   panel.scrollIntoView({behavior:'smooth',block:'center'});
   if(getState().busy||getState().loading||getState().principal)return false;
   if(action==='verify'){
    if(!getState().address||getState().address!==startAddress)return false;
    document.getElementById('verify').focus({preventScroll:true});
    await verify();
    return true;
   }
   const connect=document.querySelector('mysten-dapp-kit-connect-button');
   await connect?.updateComplete;
   if(getState().address||getState().busy||getState().principal)return false;
   // dapp-kit-core 1.6.41's documented trigger part is a native button
   // inside internal-button. Click it so its existing modal owns connection.
   const trigger=connect?.shadowRoot?.querySelector('internal-button');
   await trigger?.updateComplete;
   const button=trigger?.shadowRoot?.querySelector('button[part~="trigger"]');
   if(!button||button.disabled)throw Error('Use Connect Wallet in the NFTree access panel, then verify your NFTree.');
   button.focus({preventScroll:true});button.click();
   return true;
  }catch(error){failure=error?.message||'Could not open wallet sign-in. Please try again.';return false;}
  finally{opening=false;render();if(failure)onError(failure);}
 }
 return Object.freeze({open,render,get label(){return presentation().label;},get busy(){return presentation().disabled;}});
}
