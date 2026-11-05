// Local arcade rules only: no lives, token grants or payment entitlements.
export const SHIELD_MS=3000;
export const BONUS_INTRO=Object.freeze({titleMs:3000,readyMs:650,goMs:450});
export function bonusIntroPhase(elapsed){return elapsed<BONUS_INTRO.titleMs?'title':elapsed<BONUS_INTRO.titleMs+BONUS_INTRO.readyMs?'ready':elapsed<BONUS_INTRO.titleMs+BONUS_INTRO.readyMs+BONUS_INTRO.goMs?'go':'complete';}
export const CHALLENGE=Object.freeze({targets:40,firstSpawn:1700,interval:360,flightMs:5600,perfectBonus:10000,targetScore:100});
export function bonusKindAfter(wave){return wave===1||wave===5?'challenge':wave===3||wave===7?'windfall':null;}
export function challengeRoute(index,round=0){
 const right=(Math.floor(index/5)+round)%2===1,mirror=x=>right?480-x:x;
 return {start:{x:mirror(-35),y:100+(index%5)*22},c1:{x:mirror(470),y:130},c2:{x:mirror(35),y:430-(index%5)*15},end:{x:mirror(520),y:110+(index%5)*24},duration:CHALLENGE.flightMs-(round%2)*350};
}
export function challengeResult({destroyed,escaped,shots=0,hits=0}){
 if(![destroyed,escaped,shots,hits].every(Number.isInteger)||[destroyed,escaped,shots,hits].some(n=>n<0)||destroyed+escaped!==CHALLENGE.targets||hits>shots)throw Error('Incomplete challenge result');
 const perfect=destroyed===CHALLENGE.targets;
 return {perfect,bonus:perfect?CHALLENGE.perfectBonus:0,accuracy:shots?Math.round(hits/shots*100):0};
}
const SECTORS=Object.freeze([
 {name:'MISTWOOD PATROL',hint:'LEARN THE ARCS · WATCH THE ROOT SNARE',color:0x65dc79},
 {name:'ROOTFRONT ASSAULT',hint:'BREAK ESCORTS · GUARDIAN IN WAVE 6',color:0xc99aff},
 {name:'STORM CANOPY',hint:'CROSSING DIVES · MIXED ENEMY FIRE',color:0x79c9ef},
 {name:'THE ROOT CROWN',hint:'DODGE THE FAN · CRACK THE TYRANT ARMOUR',color:0xf2c94c},
]);
export function sectorForWave(wave){return SECTORS[wave===9?3:Math.min(2,Math.floor(wave/3))];}
