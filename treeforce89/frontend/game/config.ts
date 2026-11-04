import {WEAPONS} from "./gameplay-rules.mjs";
export const GAME_VERSION="0.6.0";
export const W=480,H=720;
export const palette={
 css:{bg:"#06110d",bgSoft:"#0c2017",panel:"#09170f",cyan:"#9a68ff",gold:"#f2c94c",green:"#65dc79",text:"#fff7df",muted:"#b9c9b6",danger:"#ff6b62"},
 hex:{bg:0x06110d,bgSoft:0x0c2017,panel:0x09170f,cyan:0x9a68ff,gold:0xf2c94c,green:0x65dc79,text:0xfff7df,muted:0xb9c9b6,danger:0xff6b62},
} as const;
export const stages=[
 {name:"SEEDLING",speed:260,mult:1,need:10,scale:1.75,hit:18},
 {name:"SAPLING",speed:252,mult:1.1,need:20,scale:1.7,hit:22},
 {name:"YOUNG TREE",speed:242,mult:1.25,need:35,scale:1.55,hit:27},
 {name:"MATURE",speed:224,mult:1.5,need:50,scale:1.45,hit:32},
 {name:"ANCIENT",speed:203,mult:2,need:50,scale:1.35,hit:38},
] as const;
export const weaponLevels=WEAPONS;
export const tuning={chainMs:2500,pruneInvuln:600,damageInvuln:1250,pruneChargeMax:100,weaponCorePity:12,turboPity:16,turboMs:7000,turboMoveMultiplier:1.22,turboFireMultiplier:.8,holdFireMs:420,autoFireMs:460,enemyProjectiles:{dartSpeed:168,drillSpeed:182,sporeSpeed:108,sporeWobble:28}};
export const enemyConfig={bat:{hp:1,score:100,growth:2,pruneCharge:10},borer:{hp:2,score:250,growth:5,pruneCharge:18},spore:{hp:1,score:200,growth:4,pruneCharge:15},small:{hp:1,score:50,growth:1,pruneCharge:5},boss:{hp:24,score:10000,growth:10,pruneCharge:25}} as const;
export const waves=[
 // Campaign I — the opener teaches movement and firing before the canopy turns hostile.
 {name:"MISTWOOD MUSTER",spawns:[...Array(8)].map((_,i)=>({type:"bat",delay:2200+Math.floor(i/4)*3100+(i%4)*520,pattern:i%4<2?"leftArc":"rightArc"}))},
 {name:"VINEFIRE VOLLEY",spawns:[...Array(16)].map((_,i)=>({type:"bat",delay:600+Math.floor(i/4)*1180+(i%4)*180,pattern:["leftArc","rightArc","cross","sweep"][i%4]}))},
 {name:"ROOTSNARE AMBUSH",spawns:[...Array(18)].map((_,i)=>({type:i%8===0?"borer":i%6===0?"spore":"bat",delay:520+Math.floor(i/4)*940+(i%4)*145,pattern:["sweep","rightArc","leftArc","cross"][i%4]}))},
 {name:"TWILIGHT TALON RAID",spawns:[...Array(24)].map((_,i)=>({type:"bat",delay:360+Math.floor(i/5)*700+(i%5)*100,pattern:["leftArc","cross","rightArc","sweep","cross"][i%5]}))},
 {name:"BLIGHTWING SWARM",spawns:[...Array(22)].map((_,i)=>({type:i%6===0?"spore":"bat",delay:420+Math.floor(i/4)*800+(i%4)*125,pattern:["cross","sweep","leftArc","rightArc"][i%4]}))},
 {name:"BORER BREACH",spawns:[...Array(22)].map((_,i)=>({type:i%5===0?"borer":i%7===0?"spore":"bat",delay:360+Math.floor(i/4)*760+(i%4)*110,pattern:["sweep","rightArc","cross","leftArc"][i%4]}))},
 {name:"THUNDERCANOPY",spawns:[...Array(26)].map((_,i)=>({type:i%8===0?"borer":i%5===0?"spore":"bat",delay:300+Math.floor(i/5)*690+(i%5)*92,pattern:["cross","leftArc","sweep","rightArc","cross"][i%5]}))},
 {name:"WILDFLIGHT RUSH",spawns:[...Array(30)].map((_,i)=>({type:"bat",delay:240+Math.floor(i/5)*570+(i%5)*76,pattern:["leftArc","cross","rightArc","sweep","cross"][i%5]}))},
 {name:"THE ROOTFRONT",spawns:[...Array(28)].map((_,i)=>({type:i%6===0?"borer":i%4===0?"spore":"bat",delay:290+Math.floor(i/4)*670+(i%4)*90,pattern:["sweep","cross","rightArc","leftArc"][i%4]}))},
 {name:"THE CANOPY TYRANT",spawns:[{type:"boss",delay:1400,pattern:"boss"}]},
] as const;
