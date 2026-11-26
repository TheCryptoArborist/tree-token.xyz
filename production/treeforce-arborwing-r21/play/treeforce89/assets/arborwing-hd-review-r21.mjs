// Local WebGL artwork experiment. Game dimensions, sprite origin and physics stay untouched.
export function installSeedlingTexture(scene){
 if(!(['localhost','127.0.0.1'].includes(location.hostname)||location.pathname.startsWith('/play/treeforce89/review/arborwing/'))||!['after','all'].includes((new URLSearchParams(location.search).get('art')||'all')))return;
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
 if((new URLSearchParams(location.search).get('art')||'all')==='all')installGrowthTextures(scene,texture);

}

function installGrowthTextures(scene,texture){
 const art=scene.textures.get('growth-hd-review').getSourceImage();
 const sources=[{x:146,y:11,width:304,height:577},{x:670,y:11,width:399,height:580},{x:54,y:617,width:488,height:602},{x:601,y:617,width:552,height:624}];
 const envelopes=[{x:45,y:71,width:41,height:55},{x:35,y:57,width:56,height:68},{x:33,y:49,width:63,height:79},{x:21,y:25,width:84,height:110}];
 const layouts=[];
 sources.forEach((source,i)=>{
  const box=envelopes[i],scale=Math.min(box.width/source.width,box.height/source.height);
  const width=source.width*scale,height=source.height*scale,x=box.x+(box.width-width)/2,y=box.y+(box.height-height);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(art,source.x,source.y,source.width,source.height,x*4,y*4,width*4,height*4);
  const hd=scene.textures.addCanvas('growth-review-atlas-'+i,canvas);hd.setFilter(0);
  const sourceIndex=texture.source.length;texture.source.push(hd.source[0]);texture.remove(i+1);
  const f=texture.add(i+1,sourceIndex,0,0,512,640);
  Object.assign(f,{cutWidth:128,cutHeight:160,width:128,height:160,halfWidth:64,halfHeight:80,centerX:64,centerY:80});
  Object.assign(f.data.sourceSize,{w:128,h:160});Object.assign(f.data.spriteSourceSize,{x:0,y:0,w:128,h:160,r:128,b:160});
  layouts.push({source,box,x,y,width,height});
 });
 scene.registry.set('growthArtLayouts',layouts);
}
