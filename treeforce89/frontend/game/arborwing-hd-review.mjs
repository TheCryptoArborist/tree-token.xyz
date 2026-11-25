// Local WebGL artwork experiment. Game dimensions, sprite origin and physics stay untouched.
export function installSeedlingTexture(scene){
 if(!['127.0.0.1','localhost'].includes(location.hostname)||new URLSearchParams(location.search).get('art')!=='after')return;
 if(scene.game.renderer.type!==2)return; // Canvas fallback retains the original art.
 const texture=scene.textures.get('playerSheet');
 const art=scene.textures.get('seedling-hd-review').getSourceImage();
 const factor=4,canvas=document.createElement('canvas');canvas.width=128*factor;canvas.height=160*factor;
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 // Fit inside the original occupied envelope without stretching the adult anatomy.
 const source={x:165,y:59,width:693,height:1392};
 const scale=Math.min(36/source.width,59/source.height);
 const width=source.width*scale,height=source.height*scale;
 const x=45+(36-width)/2,y=75+(59-height);
 ctx.drawImage(art,source.x,source.y,source.width,source.height,x*factor,y*factor,width*factor,height*factor);
 scene.registry.set('seedlingArtLayout',{source,width,height,x,y});
 const hd=scene.textures.addCanvas('seedling-review-atlas',canvas);hd.setFilter(0);
 // A separate source lets stage zero use linear sampling without touching stages 1–4.
 const sourceIndex=texture.source.length;texture.source.push(hd.source[0]);texture.remove(0);
 const f=texture.add(0,sourceIndex,0,0,128*factor,160*factor);
 // WebGL UVs span the high-resolution source; render and physics keep the logical frame.
 f.cutWidth=128;f.cutHeight=160;f.width=128;f.height=160;f.halfWidth=64;f.halfHeight=80;f.centerX=64;f.centerY=80;
 f.data.sourceSize.w=128;f.data.sourceSize.h=160;
 Object.assign(f.data.spriteSourceSize,{x:0,y:0,w:128,h:160,r:128,b:160});
 scene.registry.set('seedlingHDReview',true);
}
