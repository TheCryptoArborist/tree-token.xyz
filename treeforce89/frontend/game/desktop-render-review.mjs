import {createQualityMonitor} from "./render-quality.mjs";
// Local-only 2x backbuffer experiment for the bundled Phaser WebGL renderer.
// Logical renderer size, ScaleManager, cameras, world bounds and inputs remain 480x720.
export function installDesktopRenderReview(game){
 const mode=new URLSearchParams(location.search).get('render');
 if(!['localhost','127.0.0.1'].includes(location.hostname)||!['hd','auto'].includes(mode))return;
 const start=()=>{
 const r=game.renderer;
 if(r?.type!==2)return;
 const monitor=createQualityMonitor();
 const media=matchMedia('(min-width:1000px)');let density=media.matches?2:1;const canvas=game.canvas;
 const original={resize:r.resize,resetViewport:r.resetViewport,setScissor:r.setScissor,resetScissor:r.resetScissor};
 const screen=()=>!r.currentFramebuffer;
 function viewport(){if(r.contextLost||!screen())return;const gl=r.gl;gl.viewport(0,0,canvas.width,canvas.height);r.drawingBufferHeight=gl.drawingBufferHeight;}
 function scissor(x,y,w,h){if(r.contextLost)return;r.gl.scissor(Math.round(x*density),canvas.height-Math.round((y+h)*density),Math.round(w*density),Math.round(h*density));}
 function apply(){if(r.contextLost)return;const w=Math.round(r.width*density),h=Math.round(r.height*density);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;viewport();if(screen())scissor(...(r.currentScissor||r.defaultScissor||[0,0,r.width,r.height]));game.registry.set('desktopRenderReview',{density,mode,fallback:monitor.fallback,logicalWidth:r.width,logicalHeight:r.height});}
 r.resize=function(...args){const result=original.resize.apply(this,args);apply();return result;};
 r.resetViewport=function(...args){const result=original.resetViewport.apply(this,args);viewport();return result;};
 r.setScissor=function(x,y,w,h,...rest){if(!screen())return original.setScissor.call(this,x,y,w,h,...rest);this.flush();scissor(x,y,w,h);};
 r.resetScissor=function(...args){if(!screen())return original.resetScissor.apply(this,args);this.gl.enable(this.gl.SCISSOR_TEST);if(this.currentScissor)scissor(...this.currentScissor);};
 const frame=()=>{const scene=game.scene.getScene('game');if(mode==='auto'&&density===2&&monitor.sample(performance.now(),!document.hidden&&!r.contextLost&&!!scene?.sys.isActive()&&!scene.paused)){density=1;apply();}viewport();if(screen())scissor(...r.defaultScissor);};
 const restored=()=>requestAnimationFrame(apply);
 const resized=()=>{density=media.matches&&!monitor.fallback?2:1;monitor.sample(performance.now(),false);apply();};media.addEventListener('change',resized);
 r.on('prerender',frame);canvas.addEventListener('webglcontextrestored',restored);
 apply();
 game.events.once('destroy',()=>{media.removeEventListener('change',resized);r.off('prerender',frame);canvas.removeEventListener('webglcontextrestored',restored);Object.assign(r,original);});
 };
 if(game.isBooted)start();else game.events.once('ready',start);
}
