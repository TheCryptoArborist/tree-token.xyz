// Deterministic gameplay rules. These values grant score/arcade upgrades only.
export const WEAPONS=Object.freeze([
 {name:'SAP POD',short:'SAP POD',projectile:'sap',shots:1,fireMs:285,speed:440,damage:1,pierce:0,activeCap:2,coresToNext:1},
 {name:'RESIN REPEATER',short:'REPEATER',projectile:'swiftSap',shots:1,fireMs:205,speed:560,damage:1,pierce:0,activeCap:3,coresToNext:2},
 {name:'TWIN PODS',short:'TWIN PODS',projectile:'sap',shots:2,fireMs:270,speed:520,damage:1,pierce:0,activeCap:4,coresToNext:2},
 {name:'THORN LANCE',short:'THORN LANCE',projectile:'thorn',shots:2,fireMs:290,speed:560,damage:1,pierce:2,activeCap:6,coresToNext:2},
 {name:'CANOPY CANNON',short:'CANOPY CANNON',projectile:'canopyBolt',shots:3,fireMs:360,speed:530,damage:2,pierce:1,activeCap:6,coresToNext:0},
].map(Object.freeze));
export function collectCore(level,charge){
 if(!Number.isInteger(level)||level<0||level>=WEAPONS.length||!Number.isInteger(charge)||charge<0)throw Error('Invalid weapon state');
 if(level===WEAPONS.length-1)return {level,charge:0,upgraded:false,score:500};
 if(charge>=WEAPONS[level].coresToNext)throw Error('Unspent weapon upgrade');
 const next=charge+1,upgraded=next>=WEAPONS[level].coresToNext;
 return {level:upgraded?level+1:level,charge:upgraded?0:next,upgraded,score:0};
}
export function corePity(level){return level===0?6:8;}
export function repeatShotMs(level,{automatic=false,turbo=false}={}){
 if(!Number.isInteger(level)||!WEAPONS[level])throw Error('Invalid weapon level');
 return (automatic?460:420)*(WEAPONS[level].fireMs/WEAPONS[0].fireMs)*(turbo?.8:1);
}
export function selectAttack({wave,kind,serial=0,transformed=false}){
 if(wave<1)return 'swoop';
 if(kind==='borer')return 'charge';
 if(transformed)return 'hook';
 return (wave<3?['swoop','hook']:['swoop','hook','crossfire'])[serial% (wave<3?2:3)];
}
export function divePlan({wave,kind,serial=0,transformed=false,x,y,playerX,escort=0}){
 const type=selectAttack({wave,kind,serial,transformed}),side=x<240?-1:1;
 // Target is locked before the warning, allowing the pilot to dodge deliberately.
 const targetX=Math.max(36,Math.min(444,playerX+escort*42));
 const p=type==='charge'?[{x:x+side*16,y:y+95},{x:targetX,y:395}]:
  type==='hook'?[{x:Math.max(20,Math.min(460,x-side*140)),y:y+90},{x:targetX+side*110,y:465}]:
  type==='crossfire'?[{x:480-x,y:y+120},{x:480-targetX,y:420}]:[{x:x+side*85,y:y+80},{x:targetX-side*95,y:470}];
 return {type,start:{x,y},c1:p[0],c2:p[1],end:{x:targetX,y:755},warningMs:type==='charge'?650:450,
  duration:type==='charge'?Math.max(1250,1600-wave*25):type==='hook'?1750:Math.max(1350,1750-wave*25)};
}
export const BONUS=Object.freeze({name:'WINDFALL GAUNTLET',duration:18000,rows:16,firstRow:900,rowInterval:900,fallSpeed:175});
export function hasBonusAfter(wave){return wave===3||wave===7;}
export function bonusRow(index,seed=0){
 const safe=(index+Math.floor(index/3)+(seed%5))%5;
 const lanes=[64,152,240,328,416],free=new Set([safe,(safe+1)%5]);
 return {hazards:lanes.filter((_,i)=>!free.has(i)),seedX:lanes[safe],safeLanes:[...free].map(i=>lanes[i])};
}
export function bonusAward({bumps,collected}){
 if(!Number.isInteger(bumps)||bumps<0||!Number.isInteger(collected)||collected<0||collected>BONUS.rows)throw Error('Invalid bonus result');
 return {score:bumps===0?3000:500,core:bumps===0?1:0,collectedScore:collected*100};
}
// Fixed NES-style browser mapping: A/B fire; A+B is a shield chord.
export function readControllerFrame(pad,previous={}) {
 const down=index=>!!pad?.buttons?.[index]?.pressed;
 const shield=down(0)&&down(1),fire=(down(0)||down(1))&&!shield,start=down(9);
 const left=down(14)||(pad?.axes?.[0]??0)<-.45,right=down(15)||(pad?.axes?.[0]??0)>.45;
 return {fire,shield,start,direction:Number(right)-Number(left),
  firePressed:fire&&!previous.fire,shieldPressed:shield&&!previous.shield,pausePressed:start&&!previous.start};
}
export function applyControllerInput(game,pad) {
 const frame=readControllerFrame(pad,game.controllerState);
 game.controllerState=frame;game.controllerFireHeld=frame.fire;
 // Poll before the scene's paused guard so Start can resume, too.
 if(frame.pausePressed){game.togglePause();return frame;}
 if(!game.paused){if(frame.shieldPressed)game.prune();if(frame.firePressed)game.fire(true);}
 return frame;
}
