import {W,H,BIOMES,PICKUPS,paddleWidth} from './engine.js';
import {drawPickup} from './pickup-art.js';
const TAU=Math.PI*2;
function round(c,x,y,w,h,r=8){c.beginPath();c.roundRect(x,y,w,h,r);}
function leaf(c,x,y,scale,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.beginPath();c.moveTo(0,-12);c.bezierCurveTo(20,-10,16,10,0,15);c.bezierCurveTo(-16,8,-12,-4,0,-12);c.fillStyle=color;c.fill();c.strokeStyle='#cbf6b857';c.lineWidth=1;c.beginPath();c.moveTo(0,12);c.lineTo(1,-6);c.stroke();c.restore();}
function forest(c,biome,t){
 const b=BIOMES[biome],sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#102e36');sky.addColorStop(.4,b.dark);sky.addColorStop(1,'#061a18');c.fillStyle=sky;c.fillRect(0,0,W,H);
 c.save();c.globalAlpha=.15;const light=c.createRadialGradient(430,280,10,400,360,590);light.addColorStop(0,b.color);light.addColorStop(1,'transparent');c.fillStyle=light;c.fillRect(0,0,W,H);c.restore();
 for(let layer=0;layer<3;layer++){
  c.fillStyle=['#112b32','#0b2528','#09201f'][layer];
  for(let i=0;i<11;i++){
   const x=((i*131+layer*67)%920)-70,width=22+layer*13,top=35+(i*63%150),base=840;
   c.beginPath();c.moveTo(x-width,base);c.bezierCurveTo(x+8,590,x-width/3,310,x,top);c.lineTo(x+12,top-30);c.bezierCurveTo(x+width,350,x+12,650,x+width*2,base);c.fill();
   c.strokeStyle=c.fillStyle;c.lineWidth=8+layer*5;for(let j=0;j<3;j++){const y=180+j*120+(i%3)*30;c.beginPath();c.moveTo(x+width/2,y+50);c.quadraticCurveTo(x+65*(j%2?1:-1),y-20,x+120*(j%2?1:-1),y-50);c.stroke();}
  }
 }
 c.fillStyle='#0b2921';for(let i=0;i<15;i++){c.beginPath();c.ellipse(i*67-40,35+(i%3)*18,85,50,.2,0,TAU);c.fill();}
 c.strokeStyle='#46614b';c.lineWidth=15;c.beginPath();c.moveTo(16,78);c.lineTo(16,865);c.moveTo(784,78);c.lineTo(784,865);c.stroke();
 c.strokeStyle='#1f372b';c.lineWidth=8;c.beginPath();c.moveTo(16,78);c.lineTo(16,865);c.moveTo(784,78);c.lineTo(784,865);c.stroke();
 for(let i=0;i<17;i++){leaf(c,i%2?782:18,100+i*43,.7,b.color,i%2?-1:1);}
 const soil=c.createLinearGradient(0,835,0,H);soil.addColorStop(0,'#244a32');soil.addColorStop(.15,'#173021');soil.addColorStop(1,'#09130f');c.fillStyle=soil;c.beginPath();c.moveTo(0,H);c.lineTo(0,864);for(let x=0;x<=W;x+=20)c.lineTo(x,862+Math.sin(x*.03)*5);c.lineTo(W,H);c.fill();
 c.strokeStyle='#346143';c.lineWidth=3;for(let i=0;i<32;i++){let x=i*27;c.beginPath();c.moveTo(x,900);c.quadraticCurveTo(x+44,872,x+2,862);c.stroke();}
 for(let i=0;i<24;i++){const x=(i*197)%W,y=475+(i*83)%330;const a=.3+Math.sin(t*.7+i*1.8)*.25;c.globalAlpha=a;c.fillStyle=b.color;c.beginPath();c.arc(x+Math.sin(t*.2+i)*8,y+Math.cos(t*.4+i)*9,1.5,0,TAU);c.fill();}c.globalAlpha=1;
}
function brick(c,b,color){
 const grad=c.createLinearGradient(b.x,b.y,b.x,b.y+b.h);grad.addColorStop(0,b.kind===0?'#56674a':b.kind===1?'#475547':'#665c44');grad.addColorStop(1,b.kind===0?'#2b3d2b':b.kind===1?'#26382f':'#3c3226');round(c,b.x,b.y,b.w,b.h,5);c.fillStyle='#0005';c.fill();c.save();c.translate(0,-2);round(c,b.x,b.y,b.w,b.h,5);c.fillStyle=grad;c.fill();c.strokeStyle=b.maxHp>1?color+'b0':'#9ebd6965';c.lineWidth=b.maxHp>1?1.5:1;c.stroke();
 c.strokeStyle='#c4d4b82c';c.beginPath();c.moveTo(b.x+7,b.y+5);c.lineTo(b.x+b.w-8,b.y+5);c.stroke();
 c.strokeStyle='#101d1888';c.beginPath();c.moveTo(b.x+18,b.y+2);c.lineTo(b.x+22,b.y+12);c.lineTo(b.x+16,b.y+24);c.stroke();
 if(b.hp<b.maxHp){c.strokeStyle='#c6e7a0a0';c.beginPath();c.moveTo(b.x+40,b.y);c.lineTo(b.x+32,b.y+14);c.lineTo(b.x+45,b.y+27);c.stroke();}
 leaf(c,b.x+48,b.y+12,.4,color,-.8);if(b.hp>1){c.fillStyle=color;for(let i=0;i<b.hp;i++)c.fillRect(b.x+7+i*6,b.y+19,3,3);}c.restore();
}
function paddle(c,s){
 const w=paddleWidth(s),x=s.paddle,y=828;c.save();c.translate(x,y);
 c.shadowColor='#7ef3a0';c.shadowBlur=14;round(c,-w/2,-6,w,9,5);c.fillStyle='#86f2a9';c.fill();c.shadowBlur=0;
 const bark=c.createLinearGradient(0,0,0,21);bark.addColorStop(0,'#7f6944');bark.addColorStop(.5,'#3d3829');bark.addColorStop(1,'#1e281f');round(c,-w/2,-3,w,22,8);c.fillStyle=bark;c.fill();c.strokeStyle='#b5af69';c.stroke();
 c.strokeStyle='#242b1e';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(-w/2+i*33,6);c.quadraticCurveTo(i*20-w/2+25,16,i*29-w/2+45,10);c.stroke();}
 leaf(c,-w/2+10,-6,.8,'#9befa0',-.8);leaf(c,w/2-10,-6,.8,'#69bf83',.8);
 c.fillStyle='#173d2c';c.strokeStyle='#a9de89';c.beginPath();c.moveTo(0,-9);c.lineTo(12,5);c.lineTo(0,20);c.lineTo(-12,5);c.closePath();c.fill();c.stroke();
 if(s.effects.laser){c.fillStyle='#72e0b0';for(const x of [-w/2+14,w/2-14]){c.beginPath();c.moveTo(x-5,-2);c.lineTo(x,-23);c.lineTo(x+5,-2);c.fill();}}
 c.restore();
}
export function draw(c,s,{time=0,motion=true}={}){
 c.clearRect(0,0,W,H);const biome=Math.floor((s.level-1)/6),color=BIOMES[biome].color;forest(c,biome,motion?time:0);
 c.fillStyle='#bfe2c7';c.font='600 14px "DM Sans",sans-serif';c.textAlign='center';c.letterSpacing='3px';c.fillText(BIOMES[biome].name.toUpperCase(),400,59);c.letterSpacing='0px';c.fillStyle='#6f9a86';c.font='11px "DM Sans",sans-serif';c.fillText(s.level%6===0?'BLIGHT SPORES · WATCH YOUR ROOTS':'RESTORE THE FOREST',400,81);
 for(const b of s.bricks)brick(c,b,color);
 if(s.boss){const b=s.boss;c.save();c.translate(b.x,b.y);c.fillStyle='#36233d';c.strokeStyle='#bd79bc';c.lineWidth=3;c.beginPath();c.moveTo(-60,35);c.lineTo(-75,-25);c.lineTo(-40,-11);c.lineTo(-25,-60);c.lineTo(0,-27);c.lineTo(35,-65);c.lineTo(42,-12);c.lineTo(78,-28);c.lineTo(62,36);c.closePath();c.fill();c.stroke();c.shadowColor='#edaa43';c.shadowBlur=20;c.fillStyle='#ffcd70';c.fillRect(-32,-3,18,8);c.fillRect(14,-3,18,8);c.shadowBlur=0;c.strokeStyle='#17111e';c.lineWidth=6;c.beginPath();c.moveTo(-24,20);c.lineTo(0,28);c.lineTo(25,17);c.stroke();c.restore();round(c,250,109,300,8,4);c.fillStyle='#392432';c.fill();round(c,250,109,300*b.hp/b.maxHp,8,4);c.fillStyle='#dc84ce';c.fill();}
 for(const p of s.pickups)drawPickup(c,p.type,p.x,p.y,{time,motion});
 for(const h of s.hazards){c.fillStyle='#773a65';c.strokeStyle='#db86bd';c.lineWidth=2;c.beginPath();for(let i=0;i<10;i++){let a=i/10*TAU,r=i%2?7:14;c.lineTo(h.x+Math.cos(a)*r,h.y+Math.sin(a)*r);}c.closePath();c.fill();c.stroke();}
 for(const b of s.balls){c.save();c.shadowColor=s.effects.hot?'#ffb851':b.primary?color:'#8fc8ff';c.shadowBlur=22;c.fillStyle=s.effects.hot?'#ffd26e':b.primary?'#edffb8':'#b1e2ff';c.beginPath();c.arc(b.x,b.y,b.primary?8:6,0,TAU);c.fill();c.shadowBlur=0;c.strokeStyle='#406843';c.lineWidth=1.5;c.beginPath();c.moveTo(b.x-3,b.y+5);c.quadraticCurveTo(b.x-5,b.y-3,b.x+3,b.y-6);c.stroke();c.restore();}
 for(const shot of s.shots){c.fillStyle='#a6ffd2';c.beginPath();c.moveTo(shot.x,shot.y-18);c.lineTo(shot.x-3,shot.y+4);c.lineTo(shot.x+3,shot.y+4);c.fill();}
 for(const e of s.events){const age=s.tick-e.tick;if(age<24&&['break','hit','paddle'].includes(e.type)&&motion){c.globalAlpha=1-age/24;for(let i=0;i<6;i++){const a=i*TAU/6,d=age*1.5;c.fillStyle=i%2?color:'#dbc893';c.fillRect(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,4,4);}c.globalAlpha=1;}}
 paddle(c,s);
 const effects=Object.keys(s.effects);if(effects.length){c.font='11px sans-serif';c.textAlign='center';c.fillStyle=color;c.fillText(effects.map(id=>PICKUPS.find(p=>p.id===id)?.name+' '+Math.ceil(s.effects[id]/60)+'s').join('   ·   '),400,775);}
 c.textAlign='center';c.font='10px "DM Sans",sans-serif';c.fillStyle='#6b9579';c.fillText('THE ROOTS HOLD. THE CANOPY RISES.',400,886);
}
