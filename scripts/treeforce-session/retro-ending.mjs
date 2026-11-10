// Phaser-native pixel decoration: no new fonts, image downloads or UI overlays.
export function drawRetroEnding(scene,cleared){
 const gold=0xf2c94c,accent=cleared?0x65dc79:0xff6b62,ink=0x100d20;
 const g=scene.add.graphics();
 g.fillStyle(ink,.96).fillRect(36,38,408,614);
 g.lineStyle(3,gold,1).strokeRect(40,42,400,606);
 g.lineStyle(1,accent,.8).strokeRect(47,49,386,592);
 for(const x of [40,424])for(const y of [42,632]){
  g.fillStyle(gold,1).fillRect(x,y,16,16);
  g.fillStyle(ink,1).fillRect(x+4,y+4,8,8);
 }
 // Checkerboard rails and pixel wings frame the hero without obscuring it.
 for(let i=0;i<22;i++){
  g.fillStyle(i%2?accent:gold,.8).fillRect(64+i*16,64,12,4);
  g.fillStyle(i%2?gold:accent,.8).fillRect(64+i*16,624,12,4);
 }
 for(const x of [92,372])for(let step=0;step<3;step++){
  g.fillStyle(gold,.85).fillRect(x+(x<240?step*8:-step*8),110+step*8,8,8);
 }
 // Raised button plates sit behind the original labels and hit targets.
 for(const [y,w,h,color] of [[507,330,44,gold],[590,266,34,0x65dc79],[631,266,30,0x9a68ff]]){
  g.fillStyle(0x02040b,1).fillRect(240-w/2+4,y-h/2+5,w,h);
  g.fillStyle(0x211b32,1).fillRect(240-w/2,y-h/2,w,h);
  g.lineStyle(2,color,1).strokeRect(240-w/2,y-h/2,w,h);
 }
}

export function drawContinueInvitation(scene){
 const text=(y,label,size,color)=>scene.add.text(240,y,label,{fontFamily:'monospace',fontSize:size+'px',fontStyle:'bold',color}).setOrigin(.5);
 text(431,'CONTINUE?',24,'#f2c94c').setShadow(3,3,0x4a205e,0);
 text(453,'THE CANOPY STILL NEEDS YOU!',10,'#fff7df');
 const heart=['0110110','1111111','1111111','0111110','0011100','0001000'];
 const g=scene.add.graphics();
 for(const cx of [214,240,266])for(let row=0;row<heart.length;row++)for(let col=0;col<7;col++)if(heart[row][col]==='1')g.fillStyle(0xff6b62,1).fillRect(cx-7+col*2,466+row*2,2,2);
 text(558,'KEEP YOUR SCORE + CURRENT WAVE',9,'#b9c9b6');
}
