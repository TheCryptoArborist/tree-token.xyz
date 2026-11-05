// Controller preferences are local input settings, never access or payment proof.
const clamp=v=>Math.max(-1,Math.min(1,Number.isFinite(v)?v:0));
const button=(pad,index)=>!!pad.buttons?.[index]?.pressed||Number(pad.buttons?.[index]?.value||0)>.5;
const axis=(pad,index)=>clamp(pad.axes?.[index]);
const bindButton=index=>({kind:'button',index});
const bindAxis=(index,direction,neutral=0)=>({kind:'axis',index,direction,neutral});
const actions=['left','right','a','b','start'];
const valid=b=>b&&Number.isInteger(b.index)&&b.index>=0&&b.index<64&&(b.kind==='button'||b.kind==='axis'&&[-1,1].includes(b.direction)&&Number.isFinite(b.neutral)&&Math.abs(b.neutral)<=1);
export const validProfile=p=>!!(p&&actions.every(k=>valid(p[k]))&&['a','b','start'].every(k=>p[k].kind==='button')&&new Set(['a','b','start'].map(k=>p[k].index)).size===3);
function active(pad,b){return b.kind==='button'?button(pad,b.index):(axis(pad,b.index)-b.neutral)*b.direction>.5;}
export function defaultProfile(pad){
 const standard=pad?.mapping==='standard',count=pad?.buttons?.length||0;
 // Unmapped USB adapters differ; the setup wizard learns their actual layout.
 return {name:standard?'Standard controller':count<=4?'USB NES · four buttons':'USB NES',
  left:standard?bindButton(14):bindAxis(0,-1),right:standard?bindButton(15):bindAxis(0,1),
  a:bindButton(0),b:bindButton(1),start:bindButton(standard?9:count<=4?3:count<=8?7:9),analog:standard};
}
export function readController(pad,profile=defaultProfile(pad)){
 if(!pad?.connected)return {axis:0,fire:false,start:false};
 let move=Number(active(pad,profile.right))-Number(active(pad,profile.left));
 if(profile.analog&&move===0){const x=axis(pad,0);if(Math.abs(x)>.2)move=x;}
 return {axis:clamp(move),fire:active(pad,profile.a)||active(pad,profile.b),start:active(pad,profile.start)};
}
export function createControllerTracker({read=()=>navigator.getGamepads?.()||[],storage=null}={}){
 let profiles=Object.create(null);try{const saved=JSON.parse(storage?.getItem('canopy-breaker-controls-v1')||'{}');if(saved&&typeof saved==='object')for(const[id,p]of Object.entries(saved))if(validProfile(p))profiles[id]=p;}catch{/* Storage is optional. */}
 let key=null,armed=false,lastStart=false,lastFire=false,pad=null;
 const reset=()=>{armed=false;lastStart=false;lastFire=false;};
 return {
  get pad(){return pad;},
  profile(id){return Object.hasOwn(profiles,id)?profiles[id]:null;},
  setProfile(id,p){if(!validProfile(p))throw Error('Invalid controller mapping');profiles[id]={...p,name:'Your NES mapping'};reset();try{storage?.setItem('canopy-breaker-controls-v1',JSON.stringify(profiles));}catch{/* Continue with the session mapping. */}},
  clearProfile(id){delete profiles[id];reset();try{storage?.setItem('canopy-breaker-controls-v1',JSON.stringify(profiles));}catch{}},
  poll(){
   let pads;try{pads=Array.from(read()||[]).filter(p=>p?.connected);}catch{const disconnected=key!==null;pad=null;key=null;reset();return {axis:0,fire:false,startPressed:false,firePressed:false,disconnected,error:true};}
   const previous=pads.find(p=>`${p.index}:${p.id}`===key),pressed=pads.find(p=>p.buttons?.some(b=>b.pressed));
   const previousBusy=previous&&(previous.buttons?.some(b=>b.pressed)||previous.axes?.some(a=>Math.abs(a)>.2));
   const found=(previousBusy?previous:pressed||previous)||pads[0]||null;
   const nextKey=found?`${found.index}:${found.id}`:null,changed=nextKey!==key,disconnected=key!==null&&changed;
   if(changed){key=nextKey;reset();}pad=found;
   if(!pad)return {axis:0,fire:false,startPressed:false,firePressed:false,changed,disconnected};
   const profile=Object.hasOwn(profiles,pad.id)?profiles[pad.id]:defaultProfile(pad),input=readController(pad,profile);
   const info={changed,disconnected,name:pad.id,profile:profile.name};
   // A held button after reconnect/remapping must not resume or launch a run.
   if(!armed){if(!input.fire&&!input.start&&!input.axis)armed=true;return {...info,axis:0,fire:false,startPressed:false,firePressed:false};}
   const startPressed=input.start&&!lastStart,firePressed=input.fire&&!lastFire;lastStart=input.start;lastFire=input.fire;
   return {...info,...input,startPressed,firePressed};
  }
 };
}
export function createControllerCalibration(pad){
 const id=pad.id,index=pad.index,neutral=Array.from(pad.axes||[],clamp),bindings={};let next=0,released=false,error='';
 const state=()=>({action:actions[next]??null,complete:next===actions.length,release:!released,error,profile:next===actions.length?{...bindings,name:'Your NES mapping'}:null});
 return {poll(current){
  if(!current||!current.connected||current.id!==id||current.index!==index)return {...state(),disconnected:true};
  if(next===actions.length)return state();
  const buttons=Array.from(current.buttons||[]),isNeutral=!buttons.some((_,i)=>button(current,i))&&neutral.every((v,i)=>Math.abs(axis(current,i)-v)<.2);
  if(!released){if(isNeutral){released=true;error='';}return state();}
  let captured=null;const pressed=buttons.findIndex((_,i)=>button(current,i));
  if(pressed>=0)captured=bindButton(pressed);
  else if(next<2){let best=.65;for(let i=0;i<neutral.length;i++){const d=axis(current,i)-neutral[i];if(Math.abs(d)>best){best=Math.abs(d);captured=bindAxis(i,Math.sign(d),neutral[i]);}}}
  if(!captured)return state();
  const duplicate=Object.values(bindings).some(b=>JSON.stringify(b)===JSON.stringify(captured));
  released=false;if(duplicate){error='Use a different control for this step.';return state();}
  bindings[actions[next]]=captured;next++;return state();
 }};
}
