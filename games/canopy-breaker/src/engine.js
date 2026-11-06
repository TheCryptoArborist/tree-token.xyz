// Shared deterministic simulation. The server replays inputs; browser state grants no lives.
import {ORIGINAL_LAYOUTS} from './original-layouts.js';
export const W=800,H=900,FPS=60,PRICE=20000;
export const BIOMES=[{name:'Emerald Crossing',color:'#7ef3a0',dark:'#12382c'},{name:'Amberwood Rise',color:'#ffcd70',dark:'#3e2d21'},{name:'Moonlit Marsh',color:'#96acff',dark:'#1e294a'},{name:'Frostroot Reach',color:'#9be8ed',dark:'#163b48'},{name:'The Blighted Crown',color:'#df8aee',dark:'#36233f'}];
export const PICKUPS=[
 {id:'wide',name:'Branch Reach',good:true,description:'A wider branch makes seeds easier to catch.'},
 {id:'tether',name:'Root Tether',good:true,description:'Your main seed follows the branch.'},
 {id:'hot',name:'Wildfire Seed',good:true,description:'Your seed burns straight through bricks.'},
 {id:'laser',name:'Thorn Volley',good:true,description:'Hold fire to send twin thorns upward.'},
 {id:'multi',name:'Seedburst',good:true,description:'Three extra seeds. Keep protecting the main seed.'},
 {id:'fast',name:'Gale Force',good:false,description:'The seed speeds up. Stay ready.'},
 {id:'slow',name:'Root Snare',good:false,description:'Roots slow the branch’s movement.'},
 {id:'wild',name:'Wild Wind',good:false,description:'Wind bends the seeds into unpredictable paths.'}
];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function emit(s,type,x=400,y=450,text=''){s.eventId++;s.events.push({id:s.eventId,type,x,y,text,tick:s.tick});if(s.events.length>16)s.events.shift();}
export function layout(level){
 const original=ORIGINAL_LAYOUTS[level-1];if(!original)throw Error('Unknown forest screen');
 const biome=Math.floor((level-1)/6);
 return original.map(([x,y,type],id)=>{const hp=1+(biome>0&&(id+type)%4===0?1:0)+(biome>2&&(id+type)%7===0?1:0);return {id,x:40+(x-72)*2.25,y:134+(y-62)*1.3,w:86,h:25,hp,maxHp:hp,kind:type%3};});
}

function seedBall(s){s.balls=[{x:s.paddle,y:806,vx:0,vy:0,primary:true,attached:true}];}
function setLevel(s,level){s.level=level;s.bricks=layout(level);s.pickups=[];s.shots=[];s.hazards=[];s.effects={};s.boss=null;s.combo=0;s.status='ready';s.levelTicks=0;seedBall(s);emit(s,'level',400,450,BIOMES[Math.floor((level-1)/6)].name);}
export function createGame(seed=1){const s={version:1,rng:seed>>>0,tick:0,level:1,score:0,lives:3,paddle:400,balls:[],bricks:[],pickups:[],shots:[],hazards:[],effects:{},combo:0,eventId:0,events:[],fireAt:0,levelTicks:0,status:'ready',boss:null};setLevel(s,1);return s;}
export function restartGame(s,seed=1){if(s.status!=='gameover')throw Error('A restart requires all lives to be lost');return createGame(seed);}
export const paddleWidth=s=>s.effects.wide>0?210:128;
const baseSpeed=s=>Math.min(515,315+(s.level-1)*6)*(s.effects.fast>0?1.4:1);
function launch(s,b,angle=-Math.PI/2+.25){const speed=baseSpeed(s);b.attached=false;b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;s.status='playing';emit(s,'launch',b.x,b.y);}
function hitBrick(s,b){b.hp--;s.combo++;s.score+=25*s.combo;if(b.hp<=0){s.score+=75;emit(s,'break',b.x+b.w/2,b.y+b.h/2);if(rand(s)<.14){const p=PICKUPS[Math.floor(rand(s)*PICKUPS.length)];s.pickups.push({x:b.x+b.w/2,y:b.y,type:p.id});}}else emit(s,'hit',b.x+b.w/2,b.y+b.h/2);}
export function collect(s,type){
 const p=PICKUPS.find(p=>p.id===type);if(!p)return;
 s.score+=p.good?150:300;
 const durations={wide:18,tether:8,hot:7,laser:12,fast:8,slow:8,wild:8};
 if(type==='multi'){
  const b=s.balls.find(b=>b.primary);if(b&&!b.attached){for(let i=0;i<3;i++){const angle=-Math.PI*.8+i*Math.PI*.3;s.balls.push({x:b.x,y:b.y,vx:Math.cos(angle)*baseSpeed(s),vy:Math.sin(angle)*baseSpeed(s),primary:false,attached:false});}s.balls=s.balls.slice(0,7);}
 }else s.effects[type]=durations[type]*FPS;
 emit(s,p.good?'power':'curse',s.paddle,790,p.name);
}
function loseLife(s){s.lives--;s.combo=0;s.effects={};s.pickups=[];s.shots=[];s.hazards=[];emit(s,'life',s.paddle,825);if(s.lives<=0){s.balls=[];s.status='gameover';emit(s,'gameover',400,450,'The canopy needs you.');}else{seedBall(s);s.status='ready';}}
function winLevel(s){s.score+=1000+s.lives*200;if(s.level===30){s.status='won';s.balls=[];emit(s,'victory',400,450,'The canopy stands.');}else{s.status='cleared';s.balls=[];emit(s,'clear',400,450,'Grove restored');}}
function updateBoss(s,dt){
 const boss=s.boss;boss.x=400+Math.sin(s.levelTicks/95)*230;boss.fire--;
 if(boss.fire<=0){boss.fire=80;for(let i=-1;i<=1;i++)s.hazards.push({x:boss.x+i*24,y:boss.y+42,vx:i*32,vy:180});emit(s,'bossShot',boss.x,boss.y);}
 if(boss.hp<=0)winLevel(s);
}
export function step(s,input={}){
 if(['won','gameover'].includes(s.status))return s;
 s.tick++;
 if(s.status==='cleared'){if(input.launch)setLevel(s,s.level+1);return s;}
 const dt=1/FPS,slow=s.effects.slow>0?.48:1,target=clamp(Number.isFinite(input.x)?input.x:s.paddle,36,W-36),pw=paddleWidth(s);
 s.paddle=clamp(s.paddle+clamp(target-s.paddle,-16*slow,16*slow),pw/2+20,W-pw/2-20);
 for(const key of Object.keys(s.effects)){s.effects[key]--;if(s.effects[key]<=0)delete s.effects[key];}
 if(s.status==='ready'){const b=s.balls[0];b.x=s.paddle;b.y=806;if(input.launch)launch(s,b);return s;}
 s.levelTicks++;
 if(s.effects.wild>0&&s.tick%24===0){for(const b of s.balls){const a=-Math.PI*.9+rand(s)*Math.PI*.8,sign=b.vy>0?1:-1;b.vx=Math.cos(a)*baseSpeed(s);b.vy=Math.abs(Math.sin(a)*baseSpeed(s))*sign;}}
 if(s.effects.laser>0&&input.fire&&s.tick>=s.fireAt){s.fireAt=s.tick+15;for(const dx of [-pw/2+14,pw/2-14])s.shots.push({x:s.paddle+dx,y:811});emit(s,'shoot',s.paddle,800);}
 for(const shot of s.shots){shot.y-=650*dt;const brick=s.bricks.find(b=>b.hp>0&&shot.x>=b.x&&shot.x<=b.x+b.w&&shot.y<=b.y+b.h&&shot.y>=b.y);if(brick){hitBrick(s,brick);shot.y=-100;}if(s.boss&&Math.abs(shot.x-s.boss.x)<68&&Math.abs(shot.y-s.boss.y)<42){s.boss.hp--;shot.y=-100;emit(s,'hit',shot.x,s.boss.y);}}
 s.shots=s.shots.filter(b=>b.y>0);
 for(const ball of s.balls){
  const speed=baseSpeed(s),norm=Math.hypot(ball.vx,ball.vy)||speed;ball.vx*=speed/norm;ball.vy*=speed/norm;
  const sub=4;
  for(let n=0;n<sub;n++){
   const px=ball.x,py=ball.y;ball.x+=ball.vx*dt/sub;ball.y+=ball.vy*dt/sub;
   if(s.effects.tether>0&&ball.primary)ball.x=s.paddle;
   if(ball.x<26){ball.x=26;ball.vx=Math.abs(ball.vx);emit(s,'wall',ball.x,ball.y);}if(ball.x>W-26){ball.x=W-26;ball.vx=-Math.abs(ball.vx);emit(s,'wall',ball.x,ball.y);}if(ball.y<94){ball.y=94;ball.vy=Math.abs(ball.vy);emit(s,'wall',ball.x,ball.y);}
   if(ball.vy>0&&py+8<=820&&ball.y+8>=820&&Math.abs(ball.x-s.paddle)<pw/2+7){
    const offset=clamp((ball.x-s.paddle)/(pw/2),-.96,.96),angle=offset*1.13;ball.y=811;ball.vx=Math.sin(angle)*speed;ball.vy=-Math.cos(angle)*speed;s.combo=0;emit(s,'paddle',ball.x,820);
   }
   const brick=s.bricks.find(b=>b.hp>0&&ball.x+8>b.x&&ball.x-8<b.x+b.w&&ball.y+8>b.y&&ball.y-8<b.y+b.h);
   if(brick){hitBrick(s,brick);if(!(s.effects.hot>0)){if(px+8<=brick.x||px-8>=brick.x+brick.w)ball.vx*=-1;else ball.vy*=-1;ball.x=px;ball.y=py;}}
   if(s.boss&&Math.abs(ball.x-s.boss.x)<76&&Math.abs(ball.y-s.boss.y)<50){s.boss.hp-=s.effects.hot>0?2:1;ball.vy=Math.abs(ball.vy);ball.y=s.boss.y+51;s.score+=120;emit(s,'hit',ball.x,s.boss.y);}
  }
 }
 if(s.balls.find(b=>b.primary&&b.y>H+12)){loseLife(s);return s;}
 s.balls=s.balls.filter(b=>b.primary||b.y<=H+12);
 for(const p of s.pickups){p.y+=140*dt;if(p.y>799&&p.y<851&&Math.abs(p.x-s.paddle)<pw/2+12){collect(s,p.type);p.y=1000;}}
 s.pickups=s.pickups.filter(p=>p.y<940);
 if(s.level%6===0&&!s.boss&&s.levelTicks%180===0){s.hazards.push({x:60+rand(s)*680,y:110,vx:(rand(s)-.5)*60,vy:135});}
 for(const h of s.hazards){h.y+=h.vy*dt;h.x+=h.vx*dt;if(h.y>800&&h.y<842&&Math.abs(h.x-s.paddle)<pw/2+12){h.y=1000;s.effects.slow=180;emit(s,'curse',s.paddle,820,'Blight spore · roots snared');}}
 s.hazards=s.hazards.filter(h=>h.y<950);
 s.bricks=s.bricks.filter(b=>b.hp>0);
 if(s.boss)updateBoss(s,dt);
 else if(!s.bricks.length){if(s.level===30){s.boss={x:400,y:230,hp:45,maxHp:45,fire:90};emit(s,'boss',400,230,'The Hollow Harvester');}else winLevel(s);}
 return s;
}
