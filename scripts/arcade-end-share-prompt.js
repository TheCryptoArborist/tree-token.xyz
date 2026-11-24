import {receiptIdForRun,resultShareUrl} from './arcade-share-handoff.js';
import {drawShareCard,shareGames} from './arcade-result-share-builder.js';
export function mountEndSharePrompt(host,{gameId,runId,wallet,ready=false,score=null,stage=null}){
 host.replaceChildren();const game=shareGames.find(g=>g.id===gameId);if(!game||!runId)return()=>{};
 let active=true;const doc=host.ownerDocument,box=doc.createElement('section'),heading=doc.createElement('strong'),canvas=doc.createElement('canvas'),note=doc.createElement('p'),link=doc.createElement('a');
 box.style.cssText='margin:14px 0;padding:14px;border:2px solid #c9f45c;border-radius:10px;background:#071b19;color:#fff9e9;text-align:center;';
 heading.textContent='Your run is worth showing off 🌳';heading.style.cssText='display:block;font:800 18px system-ui;';
 canvas.width=1200;canvas.height=675;canvas.style.cssText='display:block;width:100%;max-width:420px;height:auto;margin:12px auto;border:1px solid #698b69;';canvas.setAttribute('aria-label',game.name+' share card preview');
 note.style.cssText='font:14px/1.5 system-ui;margin:10px 0;color:#cfdfd6;';note.setAttribute('role','status');
 link.textContent='Share your run →';link.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border:2px solid #e9ffc0;border-radius:8px;background:#c9f45c;color:#071b19;font:800 17px system-ui;text-decoration:none;';link.hidden=true;link.style.display='none';
 box.append(heading,canvas,note,link);host.append(box);
 const render=image=>drawShareCard(canvas.getContext('2d'),{game,run:{score:Number.isSafeInteger(score)?score:null,stage},image,result:true});render(null);
 const image=new Image();image.onload=()=>{if(active)render(image);};image.src=new URL(game.art,'https://tree-token.xyz').href;
 note.textContent=ready?'Preparing your saved-run share link…':'Save your mission result below to unlock sharing.';
 if(ready)receiptIdForRun(gameId,runId,wallet).then(id=>{if(!active)return;link.href=resultShareUrl(gameId,id);link.hidden=false;link.style.display='inline-flex';note.textContent='Open TREE Arcade to load and verify this result.';}).catch(()=>{if(active)note.textContent='Your share link could not load. Your saved result is safe; try again.';});
 return()=>{active=false;image.onload=null;host.replaceChildren();};
}
export function EndSharePrompt({React,gameId,runId,wallet,ready,score=null,stage=null}){
 const ref=React.useRef(null);React.useEffect(()=>{if(ref.current)return mountEndSharePrompt(ref.current,{gameId,runId,wallet,ready,score,stage});},[gameId,runId,wallet,ready,score,stage]);return React.createElement('div',{ref});
}
