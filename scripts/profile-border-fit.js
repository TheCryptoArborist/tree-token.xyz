// Keep the photo beneath the actual outer silhouette of each illustrated frame.
// This accommodates the wavy Christmas wire and the uneven autumn/leafy rims.
export function framePhotoOutline(image){
 const c=document.createElement('canvas');c.width=c.height=1024;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,1024,1024);
 const pixels=ctx.getImageData(0,0,1024,1024).data,path=new Path2D();
 for(let step=0;step<720;step++){
  const angle=step*Math.PI/360,dx=Math.cos(angle),dy=Math.sin(angle);let outer=0;
  for(let r=511;r>=320;r--){const x=Math.round(512+dx*r),y=Math.round(512+dy*r);if(x>=0&&x<1024&&y>=0&&y<1024&&pixels[(y*1024+x)*4+3]>=220){outer=r;break;}}
  if(!outer)throw Error('Frame outline is incomplete.');
  const radius=Math.min(496,outer-2),x=512+dx*radius,y=512+dy*radius;
  if(step)path.lineTo(x,y);else path.moveTo(x,y);
 }
 path.closePath();return path;
}
