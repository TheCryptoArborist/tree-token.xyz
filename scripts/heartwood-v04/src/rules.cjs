/* Heartwood Expedition v0.4: original, deterministic expedition rules.
   Pure state transitions; no DOM, wallets, networking, timers or external dependencies. */
const HeartwoodRules = (() => {
  'use strict';
  const VERSION=4, W=30, H=22, LIMIT=120, PACK=9;
  const STATIONS=[{x:2,y:2,name:'Sprout Station',guide:'Oak'},{x:25,y:4,name:'Ridge Outpost',guide:'Pine'},{x:6,y:18,name:'Moss Camp',guide:'Mushroom'},{x:25,y:18,name:'Elder Watch',guide:'Willow'}];
  const LANDMARKS=[{x:21,y:8,name:'Splitstone',short:'S'},{x:25,y:13,name:'Hollow Arch',short:'A'},{x:14,y:10,name:'Lantern Falls',short:'F'}];
  const SITES=[{x:19,y:11},{x:23,y:11},{x:19,y:15},{x:23,y:15}];
  const RUINS=[{x:8,y:6},{x:10,y:16},{x:24,y:8}];
  const ITEMS={
    trowel:{name:'Root trowel',price:12,slots:1,help:'Hold to excavate marked ruins or a suspected Heartseed grove.'},
    rope:{name:'Climbing rope',price:16,slots:1,help:'Hold on rocky ridges: 1 travel effort instead of 3.'},
    blade:{name:'Trail blade',price:16,slots:1,help:'Hold in dense mixed forest: 1 effort instead of 2. It is a trail tool, not a combat system.'},
    canoe:{name:'Folding canoe',price:24,slots:3,help:'Hold to enter unbridged river. Carrying it adds 1 effort per land step; cache it when not needed.'},
    boots:{name:'Marsh boots',price:16,slots:1,help:'Carried boots reduce wetland effort from 3 to 1 and prevent mire exposure.'},
    filter:{name:'Water filter',price:14,slots:1,help:'Hold beside the river or on a bridge; refill costs 2 effort, no credits.'},
    medicine:{name:'Field medicine',price:10,slots:1,consumable:true,help:'Consume to heal 25 health and clear mire exposure. Costs 1 effort.'},
    amber:{name:'Amber token',price:6,slots:1,gift:true,help:'A gift favored by those who follow the resin trails.'},
    leaf:{name:'Pressed-leaf folio',price:6,slots:1,gift:true,help:'A gift for those who preserve the forest’s smaller details.'},
    seed:{name:'Carved seed charm',price:6,slots:1,gift:true,help:'A keepsake valued by the keeper of old growth.'}
  };
  const PREFS=[null,'amber','leaf','seed'];
  const key=(x,y)=>`${x},${y}`;
  function rng(seed){return ()=>{seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
  function world(seed){const r=rng(seed),tiles=[];for(let y=0;y<H;y++){const row=[];for(let x=0;x<W;x++){const n=r();row.push(x===14?'river':x>20&&y<10&&n<.55?'stone':y>12&&x<12&&n<.38?'bog':n<.22?'meadow':n<.55?'pine':'grove');}tiles.push(row);}
    // Guaranteed public routes and two bridges. Gear opens shorter alternatives.
    for(const y of [2,3,18])for(let x=0;x<W;x++)if(x!==14)tiles[y][x]='meadow';
    for(const x of [2,6,25])for(let y=0;y<H;y++)tiles[y][x]='meadow';
    for(const y of [3,18])tiles[y][14]='bridge';
    for(const p of STATIONS)tiles[p.y][p.x]='meadow';
    for(const p of SITES)tiles[p.y][p.x]='grove';
    for(const p of RUINS)tiles[p.y][p.x]='meadow';
    for(const p of LANDMARKS)if(p.x!==14)tiles[p.y][p.x]='meadow';
    const target=SITES[Math.floor(r()*SITES.length)];
    return {tiles,heart:{...target},landmarks:LANDMARKS,sites:SITES,ruins:RUINS};
  }
  function fresh(seed){if(!Number.isInteger(seed))seed=Math.floor(Math.random()*2147483647)+1;const w=world(seed);const s={version:VERSION,seed,heart:w.heart,x:2,y:2,day:1,effort:0,steps:0,hp:100,food:18,water:25,credits:90,samples:0,inventory:{trowel:1},held:'trowel',visited:{},reports:[],seen:{},gathered:{},foraged:{},excavated:{},caches:{},log:[],dry:0,hungry:0,exposure:false,exposedTicks:0,started:true,won:false,gameover:false,reason:''};reveal(s,3);visit(s,0);log(s,'TREE Hero sets out. Read the field guide before choosing equipment and gifts.');return s;}
  function log(s,t){s.log.unshift(`DAY ${s.day} · ${t}`);s.log=s.log.slice(0,40);}
  function reveal(s,r){for(let y=Math.max(0,s.y-r);y<=Math.min(H-1,s.y+r);y++)for(let x=Math.max(0,s.x-r);x<=Math.min(W-1,s.x+r);x++)if((x-s.x)**2+(y-s.y)**2<=(r+.3)**2)s.seen[key(x,y)]=1;}
  const station=s=>STATIONS.findIndex(p=>p.x===s.x&&p.y===s.y);
  const has=(s,id)=>(s.inventory[id]||0)>0;
  const load=s=>Object.entries(s.inventory).reduce((n,[id,q])=>n+ITEMS[id].slots*q,0);
  const active=s=>s.started&&!s.won&&!s.gameover;
  const result=(ok,text,extra={})=>({ok,text,...extra});
  function add(s,id,q=1){if(!ITEMS[id]||q<1||load(s)+ITEMS[id].slots*q>PACK)return false;s.inventory[id]=(s.inventory[id]||0)+q;return true;}
  function remove(s,id){if(!has(s,id))return false;if(--s.inventory[id]===0)delete s.inventory[id];if(s.held===id&&!has(s,id))s.held=null;return true;}
  function spend(s,n){const before=s.effort;s.effort+=n;s.day=1+Math.floor(s.effort/6);s.water=Math.max(0,s.water-(Math.floor(s.effort/2)-Math.floor(before/2)));s.food=Math.max(0,s.food-(Math.floor(s.effort/6)-Math.floor(before/6)));
    if(s.water===0){s.dry++;if(s.dry>=3)s.hp-=3;}else s.dry=0;
    if(s.food===0){s.hungry++;if(s.hungry>=3)s.hp-=2;}else s.hungry=0;
    if(s.exposure){s.exposedTicks+=n;if(s.exposedTicks>=6){s.hp-=2;s.exposedTicks%=6;}}
    if(s.day>LIMIT){s.gameover=true;s.reason='The 120-day restoration season ended.';}
    if(s.hp<=0){s.hp=0;s.gameover=true;s.reason='The expedition ended from exhaustion.';}
    if(s.gameover)log(s,s.reason);
    return !s.gameover;
  }
  function clue(s,i){const west=s.heart.x<21,north=s.heart.y<13;return i===0?'The Heartseed rests beyond Lantern Falls, on the eastern side of the river. Four old root circles survive there; only one shelters the seed.':i===1?`The true circle lies ${west?'duskward':'dawnward'} of Splitstone. The ridge scouts use the sun’s rising and setting to name east and west.`:i===2?`The living root circle is ${north?'highwind':'rootward'} of Hollow Arch. The field lexicon explains the wetland keepers’ directional words.`:`From Hollow Arch, walk ${25-s.heart.x} paces duskward, then ${Math.abs(13-s.heart.y)} paces ${north?'highwind':'rootward'}. Search beneath the roots; merely walking there will not restore anything.`;}
  function award(s,i){if(s.reports.some(r=>r.guide===i))return false;s.reports.push({guide:i,station:STATIONS[i].name,text:clue(s,i)});log(s,STATIONS[i].guide+' shared a field report.');return true;}
  function visit(s,i){if(s.visited[i])return false;s.visited[i]=true;s.food=Math.min(24,s.food+2);s.water=Math.min(25,s.water+4);s.hp=Math.min(100,s.hp+8);if(i===0)award(s,0);log(s,STATIONS[i].guide+' welcomes you. Other guides require the right gift before sharing their report.');return true;}
  function moveCost(s,w,x,y){if(x<0||x>=W||y<0||y>=H)return {blocked:'The trail ends at the map boundary.',effort:0};const t=w.tiles[y][x];if(t==='river'&&!(has(s,'canoe')&&s.held==='canoe'))return {blocked:'River crossing needs the canoe in hand. Use a bridge on row 4 or row 19 instead.',effort:0};let n=t==='stone'?(s.held==='rope'&&has(s,'rope')?1:3):t==='grove'?(s.held==='blade'&&has(s,'blade')?1:2):t==='bog'?(has(s,'boots')?1:3):1;if(has(s,'canoe')&&t!=='river')n++;return {effort:n,terrain:t,exposure:t==='bog'&&!has(s,'boots')};}
  function move(s,w,dx,dy){if(!active(s)||Math.abs(dx)+Math.abs(dy)!==1)return result(false,'No movement available.');const x=s.x+dx,y=s.y+dy,c=moveCost(s,w,x,y);if(c.blocked)return result(false,c.blocked);s.x=x;s.y=y;s.steps++;if(c.exposure&&!s.exposure){s.exposure=true;log(s,'Mire exposure: marsh boots prevent it; medicine or station rest cures it.');}spend(s,c.effort);reveal(s,2);let first=false;const i=station(s);if(!s.gameover&&i>=0)first=visit(s,i);return result(true,`Travel used ${c.effort} effort. ${s.water<=5?'Water is low: refill or visit a station.':s.food<=3?'Food is low: forage or buy supplies.':''}`,{station:i,first});}
  function gift(s,id){const i=station(s);if(!active(s)||i<1||!ITEMS[id]?.gift||!has(s,id))return result(false,'Present an owned gift in person at a guide’s station.');if(s.reports.some(r=>r.guide===i))return result(false,'This guide has already shared their report. Keep your gift.');spend(s,1);if(s.gameover)return result(false,s.reason);if(PREFS[i]!==id){log(s,STATIONS[i].guide+' declined the gift. It was returned; one effort was spent.');return result(false,'Not a suitable gift. It is returned. Check this guide’s preferences in the field guide.');}remove(s,id);award(s,i);return result(true,STATIONS[i].guide+' accepts the gift and records a new clue in your journal.');}
  function buy(s,id){if(!active(s)||station(s)<0)return result(false,'You must be at a station.');const it=ITEMS[id];if(!it)return result(false,'Unknown equipment.');if(!it.gift&&!it.consumable&&has(s,id))return result(false,'You already own this equipment.');if(s.credits<it.price)return result(false,'Not enough credits.');if(!add(s,id))return result(false,'Pack full. Cache equipment at a station to free space.');s.credits-=it.price;log(s,`Bought ${it.name} for ${it.price} credits.`);return result(true,`${it.name} added to your pack. Select Hold to use a hand tool.`);}
  function supply(s,kind){if(!active(s)||station(s)<0)return result(false,'Supplies are sold at stations only.');if(kind==='sample'){if(s.samples<=4)return result(false,'Keep four samples for restoration.');s.samples--;s.credits+=6;return result(true,'One surplus sample traded for 6 credits.');}const d={water:['water',25,10,5],food:['food',24,8,6],rest:['hp',100,25,6]}[kind];if(!d)return result(false,'Unknown supply.');const [field,cap,gain,price]=d;if(s[field]>=cap&&!(kind==='rest'&&s.exposure))return result(false,'Already at capacity.');if(s.credits<price)return result(false,'Not enough credits.');s.credits-=price;const before=s[field];s[field]=Math.min(cap,s[field]+gain);if(kind==='rest'){s.exposure=false;s.exposedTicks=0;spend(s,2);}if(kind==='water')s.dry=0;if(kind==='food')s.hungry=0;return result(true,`${kind==='rest'?'Rest':'Supplies'}: +${s[field]-before} ${field}; ${price} credits${kind==='rest'?', 2 effort':''}.`);}
  function equip(s,id){if(!active(s)||id!==null&&!has(s,id))return result(false,'That item is not in your pack.');s.held=id;return result(true,id?ITEMS[id].name+' is in hand.':'Hands free.');}
  function cache(s,id,take=false){if(!active(s)||station(s)<0||!ITEMS[id])return result(false,'Use caches at stations.');const k=String(station(s)),c=s.caches[k]||(s.caches[k]={});if(take){if(!c[id])return result(false,'Not stored here.');if(!add(s,id))return result(false,'No pack space.');if(--c[id]===0)delete c[id];}else{if(!remove(s,id))return result(false,'Item not carried.');c[id]=(c[id]||0)+1;}return result(true,ITEMS[id].name+(take?' retrieved.':' safely cached at this station.'));}
  function nearWater(s,w){if(w.tiles[s.y][s.x]==='river'||w.tiles[s.y][s.x]==='bridge')return true;return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>w.tiles[s.y+dy]?.[s.x+dx]==='river');}
  function act(s,w,type){if(!active(s))return result(false,'This expedition is not active.');const k=key(s.x,s.y),t=w.tiles[s.y][s.x];
    if(type==='sample'){if(station(s)>=0||!['pine','grove','bog'].includes(t))return result(false,'Collect samples in woodland or wetland, away from stations.');if(s.gathered[k])return result(false,'Already sampled. Leave this habitat intact.');if(!spend(s,1))return result(false,s.reason);s.gathered[k]=true;s.samples++;return result(true,'One field sample collected.');}
    if(type==='forage'){if(!['pine','grove','meadow'].includes(t)||station(s)>=0)return result(false,'Forage on woodland or meadow trails, away from stations.');if(s.foraged[k])return result(false,'This site has already been foraged.');if(s.food>=24)return result(false,'Food pack is full.');if(!spend(s,2))return result(false,s.reason);s.foraged[k]=true;s.food=Math.min(24,s.food+3);s.hungry=0;return result(true,'Found 3 food; 2 effort spent. This site will not replenish.');}
    if(type==='refill'){if(s.held!=='filter'||!has(s,'filter'))return result(false,'Hold a water filter first.');if(!nearWater(s,w))return result(false,'Stand beside the river, on a bridge or in the canoe.');if(s.water>=25)return result(false,'Canteen is full.');if(!spend(s,2))return result(false,s.reason);s.water=25;s.dry=0;return result(true,'Filtered river water. Canteen full; 2 effort spent.');}
    if(type==='medicine'){if(!has(s,'medicine'))return result(false,'No field medicine carried.');if(s.hp>=100&&!s.exposure)return result(false,'You do not need medicine.');remove(s,'medicine');s.exposure=false;s.exposedTicks=0;s.hp=Math.min(100,s.hp+25);spend(s,1);return result(true,'Medicine used: +25 health, mire exposure cleared.');}
    if(type==='survey'){if(s.credits<2)return result(false,'Survey costs 2 credits.');s.credits-=2;if(!spend(s,1))return result(false,s.reason);reveal(s,4);return result(true,'Nearby terrain surveyed; 2 credits and 1 effort. No report or target revealed.');}
    if(type==='dig'){if(s.held!=='trowel'||!has(s,'trowel'))return result(false,'Hold the root trowel before searching below ground.');if(!spend(s,2))return result(false,s.reason);if(s.x===s.heart.x&&s.y===s.heart.y){if(s.reports.length<3||s.samples<4)return result(true,'Living roots found, but restoration needs 3 reports and 4 samples. You may return and search again.');s.won=true;log(s,'The buried Heartseed is restored.');return result(true,'The buried Heartseed is restored!',{win:true});}if(!s.excavated[k]&&RUINS.some(p=>p.x===s.x&&p.y===s.y)){s.excavated[k]=true;s.credits+=18;return result(true,'Recovered a salvage token worth 18 credits. This ruin is now empty.');}s.excavated[k]=true;return result(true,'No Heartseed here. Compare the landmarks and your field reports.');}
    return result(false,'Unknown field action.');
  }
  function valid(s){if(!s||s.version!==VERSION||!Number.isInteger(s.seed)||s.seed<1||s.seed>2147483647)return false;for(const [k,max]of [['x',W-1],['y',H-1]])if(!Number.isInteger(s[k])||s[k]<0||s[k]>max)return false;for(const k of ['effort','steps','day','hp','water','food','credits','samples','dry','hungry','exposedTicks'])if(!Number.isInteger(s[k])||s[k]<0)return false;if(s.hp>100||s.water>25||s.food>24||s.day!==1+Math.floor(s.effort/6))return false;for(const k of ['started','won','gameover','exposure'])if(typeof s[k]!=='boolean')return false;if(!Array.isArray(s.reports)||!Array.isArray(s.log)||s.log.some(t=>typeof t!=='string')||s.log.length>40)return false;for(const k of ['seen','visited','gathered','foraged','excavated','caches','inventory'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))return false;for(const [id,q]of Object.entries(s.inventory))if(!ITEMS[id]||!Number.isInteger(q)||q<1||q>PACK)return false;if(load(s)>PACK||s.held!==null&&!has(s,s.held))return false;const reports=new Set();for(const r of s.reports){if(!Number.isInteger(r.guide)||r.guide<0||r.guide>3||reports.has(r.guide)||!s.visited[r.guide])return false;reports.add(r.guide);}for(const [i,c]of Object.entries(s.caches)){if(!['0','1','2','3'].includes(i)||!c||Array.isArray(c))return false;for(const [id,q]of Object.entries(c))if(!ITEMS[id]||!Number.isInteger(q)||q<1)return false;}
    const h=world(s.seed).heart;if(!s.heart||s.heart.x!==h.x||s.heart.y!==h.y)return false;return true;}
  function restore(raw){try{const s=JSON.parse(raw);if(!valid(s))return null;s.reports=s.reports.map(r=>({guide:r.guide,station:STATIONS[r.guide].name,text:clue(s,r.guide)}));return s;}catch{return null;}}
  return {VERSION,W,H,LIMIT,PACK,STATIONS,LANDMARKS,SITES,RUINS,ITEMS,PREFS,key,rng,world,fresh,log,reveal,station,has,load,active,moveCost,move,gift,buy,supply,equip,cache,nearWater,act,clue,restore,valid};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=HeartwoodRules;
