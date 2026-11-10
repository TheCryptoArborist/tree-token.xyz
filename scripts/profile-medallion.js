// Render existing partner/ecosystem art into a circular badge without changing its source image.
export function drawMedallion(ctx,image,x,y,size){
 const cx=x+size/2,cy=y+size/2,r=size/2;
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r-2,0,Math.PI*2);ctx.clip();
 ctx.fillStyle='#102b20';ctx.fillRect(x,y,size,size);
 const inner=size-14,scale=Math.max(inner/image.width,inner/image.height),w=image.width*scale,h=image.height*scale;
 ctx.drawImage(image,cx-w/2,cy-h/2,w,h);
 const gold=ctx.createLinearGradient(x,y,x+size,y+size);gold.addColorStop(0,'#fff1bc');gold.addColorStop(.35,'#d6a342');gold.addColorStop(.65,'#ffdf7c');gold.addColorStop(1,'#9f661d');
 ctx.strokeStyle=gold;ctx.lineWidth=9;ctx.beginPath();ctx.arc(cx,cy,r-7,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle='#183d29';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,r-13,0,Math.PI*2);ctx.stroke();ctx.restore();
}
