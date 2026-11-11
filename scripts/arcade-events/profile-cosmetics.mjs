export const PROFILE_SIZE=512;
export const CROWN_OVERLAYS={contender:'/assets/profile-studio/canopy-crown-89/contender.png',champion:'/assets/profile-studio/canopy-crown-89/champion.png'};
const crownPhotoMasks=new WeakMap();
function crownPhotoMask(canvas,overlay){
 let mask=crownPhotoMasks.get(overlay);if(mask)return mask;
 // Flood-fill transparent pixels connected to the exterior. Unlike a circle,
 // this follows each frame's leaves, lettering and belt without exposing photo
 // beyond the illustrated rim. Cache the mask; slider redraws only composite it.
 mask=typeof canvas.cloneNode==='function'?canvas.cloneNode(false):new canvas.constructor(1024,1024);
 mask.width=mask.height=1024;const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.drawImage(overlay,0,0,1024,1024);
 const pixels=ctx.getImageData(0,0,1024,1024),data=pixels.data,exterior=new Uint8Array(1024*1024),queue=new Uint32Array(exterior.length);let head=0,tail=0;
 const visit=i=>{if(!exterior[i]&&data[i*4+3]<128){exterior[i]=1;queue[tail++]=i;}};
 for(let n=0;n<1024;n++){visit(n);visit(1023*1024+n);visit(n*1024);visit(n*1024+1023);}
 while(head<tail){const i=queue[head++],x=i%1024,y=(i-x)/1024;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((dx||dy)&&x+dx>=0&&x+dx<1024&&y+dy>=0&&y+dy<1024)visit(i+dy*1024+dx);}}
 const enclosed=!exterior[512*1024+512];
 for(let i=0;i<exterior.length;i++){data[i*4]=data[i*4+1]=data[i*4+2]=255;data[i*4+3]=enclosed&&!exterior[i]?255:0;}
 ctx.putImageData(pixels,0,0);crownPhotoMasks.set(overlay,mask);return mask;
}
export function drawCrownProfile(canvas,{overlay,photo=null,zoom=1,offsetX=0,offsetY=0,overlayOnly=false}={}){
 canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.clearRect(0,0,1024,1024);
 if(!overlayOnly&&overlay){c.save();c.scale(2,2);avatar(c,photo,zoom,offsetX,offsetY);c.restore();c.save();c.globalCompositeOperation='destination-in';c.drawImage(crownPhotoMask(canvas,overlay),0,0);c.restore();}
 if(overlay)c.drawImage(overlay,0,0,1024,1024);
}
export const EMBLEM={x:400,y:400,r:44};
function disk(c,x,y,r,fill,stroke,width=1){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function leaf(c,x,y,angle,color){c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(-10,0);c.quadraticCurveTo(0,-9,10,0);c.quadraticCurveTo(0,9,-10,0);c.fillStyle=color;c.fill();c.restore();}
function avatar(c,photo,zoom=1,offsetX=0,offsetY=0){c.save();c.beginPath();c.arc(256,256,248,0,Math.PI*2);c.clip();if(photo){const w=photo.naturalWidth||photo.width,h=photo.naturalHeight||photo.height,scale=Math.max(512/w,512/h)*zoom;c.drawImage(photo,256-w*scale/2+offsetX/100*(w*scale-512)/2,256-h*scale/2+offsetY/100*(h*scale-512)/2,w*scale,h*scale);}else{const g=c.createLinearGradient(0,0,512,512);g.addColorStop(0,'#6b8f8a');g.addColorStop(1,'#263950');c.fillStyle=g;c.fillRect(0,0,512,512);disk(c,256,190,65,'#c9d8d0');c.fillStyle='#c9d8d0';c.beginPath();c.ellipse(256,403,134,126,0,0,Math.PI*2);c.fill();}c.restore();}
function ring(c,champion){disk(c,256,256,240,null,champion?'#e8c367':'#234837',18);disk(c,256,256,249,null,champion?'#fff0b1':'#aacd6b',3);disk(c,256,256,230,null,champion?'#745031':'#a6cf80',3);for(let i=0;i<44;i++){const a=i*Math.PI/22;leaf(c,256+240*Math.cos(a),256+240*Math.sin(a),a+Math.PI/2,champion?(i%2?'#fff0ac':'#a87c32'):(i%3?'#7aaf55':'#b9d26d'));}c.strokeStyle='#7e42bd';c.lineWidth=8;for(const a of [0.5,Math.PI+0.5]){c.beginPath();c.arc(256,256,239,a,a+0.48);c.stroke();}}
function emblem(c,art,champion){const {x,y,r}=EMBLEM;disk(c,x,y,r,champion?'#e4c36c':'#a2ca69','#0a241b',5);disk(c,x,y,r-6,'#402065');c.save();c.beginPath();c.arc(x,y,r-10,0,Math.PI*2);c.clip();if(art){const s=art.naturalWidth/512;c.drawImage(art,214*s,15*s,108*s,108*s,x-r+10,y-r+10,(r-10)*2,(r-10)*2);}else{leaf(c,x,y,Math.PI/4,'#b4dc7f');leaf(c,x-8,y+6,-Math.PI/4,'#79a842');}c.restore();if(champion){c.fillStyle='#f4d782';c.beginPath();c.moveTo(x-16,y-20);c.lineTo(x-20,y-37);c.lineTo(x-6,y-29);c.lineTo(x,y-40);c.lineTo(x+6,y-29);c.lineTo(x+20,y-37);c.lineTo(x+16,y-20);c.closePath();c.fill();}}
// Photo-first compositions: no poster text, title ribbon or artwork outside the social crop.
export function drawProfileCosmetic(canvas,{kind='frame',photo=null,art=null,zoom=1,offsetX=0,offsetY=0}={}){canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');c.clearRect(0,0,512,512);avatar(c,photo,zoom,offsetX,offsetY);if(kind!=='badge')ring(c,kind==='champion');else disk(c,256,256,247,null,'#91ad91',3);if(kind!=='frame')emblem(c,art,kind==='champion');}
export function drawProfileSizes(source,container){for(const size of [48,80,128]){const item=document.createElement('div'),canvas=document.createElement('canvas'),label=document.createElement('span');canvas.width=size;canvas.height=size;canvas.style.width=size+'px';canvas.style.height=size+'px';canvas.getContext('2d').drawImage(source,0,0,size,size);label.textContent=size+'px';item.append(canvas,label);container.append(item);}}
