// Compose badges from unchanged, published game artwork; no substitute icons.
export async function gameBadgeArtwork(choice,loadImage){
 const source=await loadImage(choice.url),c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#09251b';ctx.fillRect(0,0,512,512);
 if(choice.gameBadge==='root-rage')ctx.drawImage(source,170,20,680,680,0,0,512,512);
 else ctx.drawImage(source,0,0,source.naturalWidth,source.naturalWidth,0,0,512,512);
 const shade=ctx.createLinearGradient(0,290,0,512);shade.addColorStop(0,'rgba(5,20,14,0)');shade.addColorStop(.35,'rgba(5,20,14,.88)');shade.addColorStop(1,'rgba(5,20,14,.98)');ctx.fillStyle=shade;ctx.fillRect(0,290,512,222);
 ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff0b4';ctx.strokeStyle='#06140e';ctx.lineWidth=5;ctx.lineJoin='round';
 const lines=choice.gameBadge==='root-rage'?['ROOT','RAGE']:['CANOPY','BREAKER'];
 ctx.font='900 68px system-ui, sans-serif';
 for(let i=0;i<lines.length;i++){ctx.strokeText(lines[i],256,397+i*72,370);ctx.fillText(lines[i],256,397+i*72,370);}
 return loadImage(c.toDataURL('image/png'));
}
