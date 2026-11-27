// Reviewed reference-proportion atlas; logical frames and physics unchanged.
export function installSeedlingTexture(scene){if(scene.game.renderer.type===2&&location.pathname.startsWith('/play/treeforce89/review/arborwing/'))installProportionTextures(scene,scene.textures.get('playerSheet'));}
function installProportionTextures(scene,texture){
 const art=scene.textures.get('proportions-hd-review').getSourceImage();
 const sources=[{x:31,y:38,width:363,height:580},{x:412,y:36,width:364,height:595},{x:793,y:36,width:379,height:608},{x:1193,y:36,width:436,height:608},{x:1649,y:36,width:512,height:671}];
 const boxes=[{x:45,y:75,width:36,height:59},{x:45,y:71,width:41,height:55},{x:35,y:57,width:56,height:68},{x:33,y:49,width:63,height:79},{x:21,y:25,width:84,height:110}];
 const layouts=sources.map((source,i)=>{
  const box=boxes[i],scale=Math.min(box.width/source.width,box.height/source.height),width=source.width*scale,height=source.height*scale;
  const x=box.x+(box.width-width)/2,y=box.y+box.height-height;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(art,source.x,source.y,source.width,source.height,x*4,y*4,width*4,height*4);
  const hd=scene.textures.addCanvas('proportions-review-atlas-'+i,canvas);hd.setFilter(0);const sourceIndex=texture.source.length;texture.source.push(hd.source[0]);texture.remove(i);const f=texture.add(i,sourceIndex,0,0,512,640);
  Object.assign(f,{cutWidth:128,cutHeight:160,width:128,height:160,halfWidth:64,halfHeight:80,centerX:64,centerY:80});Object.assign(f.data.sourceSize,{w:128,h:160});Object.assign(f.data.spriteSourceSize,{x:0,y:0,w:128,h:160,r:128,b:160});
  return{source,box,x,y,width,height,mountFront:(535-source.y)/source.height};
 });
 scene.registry.set('seedlingArtLayout',layouts[0]);scene.registry.set('growthArtLayouts',layouts.slice(1));scene.registry.set('seedlingHDReview',true);scene.registry.set('heroProportionsReview',true);
}
