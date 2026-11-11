// Compose badges from unchanged, published game artwork; no substitute icons.
export async function gameBadgeArtwork(choice,loadImage){
 const source=await loadImage(choice.url),c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#09251b';ctx.fillRect(0,0,512,512);
 if(choice.gameBadge==='root-rage'){
  // Preserve the original boss battle proportions and keep the kick, robot and saw visible.
  ctx.drawImage(source,130,200,1400,700,0,60,512,256);
 } 
 else if(choice.gameBadge==='deadfall-run'){
  ctx.save();ctx.filter='brightness(2.1) contrast(1.08) saturate(1.15)';
  ctx.drawImage(source,460,240,470,470,0,0,512,512);ctx.restore();
 }
 else ctx.drawImage(source,0,0,source.naturalWidth,source.naturalWidth,0,0,512,512);
 const isTruck=choice.gameBadge==='deadfall-run',shadeTop=isTruck?350:290;
 const shade=ctx.createLinearGradient(0,shadeTop,0,512);shade.addColorStop(0,'rgba(5,20,14,0)');shade.addColorStop(.35,'rgba(5,20,14,.88)');shade.addColorStop(1,'rgba(5,20,14,.98)');ctx.fillStyle=shade;ctx.fillRect(0,shadeTop,512,512-shadeTop);
 ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff0b4';ctx.strokeStyle='#06140e';ctx.lineWidth=5;ctx.lineJoin='round';
 const lines=choice.gameBadge==='root-rage'?['ROOT','RAGE']:choice.gameBadge==='deadfall-run'?['DEADFALL','RUN']:['CANOPY','BREAKER'];
 ctx.font=isTruck?'900 58px system-ui, sans-serif':'900 68px system-ui, sans-serif';
 for(let i=0;i<lines.length;i++){ctx.strokeText(lines[i],256,(isTruck?425+i*62:397+i*72),370);ctx.fillText(lines[i],256,(isTruck?425+i*62:397+i*72),370);}
 return loadImage(c.toDataURL('image/png'));
}
