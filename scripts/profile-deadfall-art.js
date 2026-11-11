// Approved Deadfall Run composition from the original published game poster.
export async function deadfallArtwork(url,loadImage){
 const source=await loadImage(url),c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#09251b';ctx.fillRect(0,0,512,512);
 ctx.save();ctx.filter='brightness(2.1) contrast(1.08) saturate(1.15)';ctx.drawImage(source,460,240,470,470,0,0,512,512);ctx.restore();
 const shade=ctx.createLinearGradient(0,350,0,512);shade.addColorStop(0,'rgba(5,20,14,0)');shade.addColorStop(.35,'rgba(5,20,14,.88)');shade.addColorStop(1,'rgba(5,20,14,.98)');ctx.fillStyle=shade;ctx.fillRect(0,350,512,162);
 ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff0b4';ctx.strokeStyle='#06140e';ctx.lineWidth=5;ctx.lineJoin='round';ctx.font='900 58px system-ui, sans-serif';
 for(const [i,text]of ['DEADFALL','RUN'].entries()){ctx.strokeText(text,256,425+i*62,370);ctx.fillText(text,256,425+i*62,370);}
 return loadImage(c.toDataURL('image/png'));
}
