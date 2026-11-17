const R=require('../src/rules.cjs');
function simulate(seed,recordTrace=false){
 const s=R.fresh(seed),w=R.world(seed),trace=[];
 const call=(op,...args)=>{const out=op==='move'?R.move(s,w,...args):op==='act'?R.act(s,w,...args):R[op](s,...args);if(recordTrace)trace.push({op,args,result:out});if(s.gameover)throw Error(`Seed ${seed}: ${s.reason} @ ${s.x},${s.y}, day ${s.day}`);if(!out.ok)throw Error(`Seed ${seed} ${op} ${args}: ${out.text}`);return out;};
 for(const id of ['filter','boots','blade','amber','leaf','seed'])call('buy',id);
 const hold=id=>{if(s.held!==id)call('equip',id);};
 function maintain(){
  if(s.water<22&&R.nearWater(s,w)){hold('filter');call('act','refill');}
  const t=w.tiles[s.y][s.x],k=R.key(s.x,s.y);
  if(s.food<=15&&R.station(s)<0&&!s.foraged[k]&&['meadow','grove','pine'].includes(t))call('act','forage');
  if(s.samples<4&&R.station(s)<0&&!s.gathered[k]&&['pine','grove','bog'].includes(t))call('act','sample');
  hold('blade');
 }
 function path(tx,ty){const start=R.key(s.x,s.y),end=R.key(tx,ty),q=[[s.x,s.y,0]],cost=new Map([[start,0]]),prev=new Map();
  while(q.length){q.sort((a,b)=>a[2]-b[2]);const [x,y,n]=q.shift(),k=R.key(x,y);if(n!==cost.get(k))continue;if(k===end)break;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,c=R.moveCost(s,w,nx,ny);if(c.blocked)continue;const nk=R.key(nx,ny),nn=n+c.effort;if(nn<(cost.get(nk)??Infinity)){cost.set(nk,nn);prev.set(nk,[k,dx,dy]);q.push([nx,ny,nn]);}}}
  const list=[];let k=end;while(k!==start){if(!prev.has(k))throw Error('No reachable route');const [from,dx,dy]=prev.get(k);list.unshift([dx,dy]);k=from;}return list;
 }
 function travel(tx,ty){hold('blade');for(const [dx,dy]of path(tx,ty)){maintain();call('move',dx,dy);}maintain();}
 // Four nearby field sites are collected by legal exploration, not state edits.
 const nearby=[];for(let y=0;y<7;y++)for(let x=0;x<8;x++)if(['pine','grove'].includes(w.tiles[y][x])&&R.STATIONS.every(p=>p.x!==x||p.y!==y))nearby.push({x,y,d:Math.abs(x-2)+Math.abs(y-2)});
 nearby.sort((a,b)=>a.d-b.d);for(const p of nearby){if(s.samples>=4)break;travel(p.x,p.y);}
 travel(6,18);call('gift','leaf');
 travel(13,18); // Explicit safe resupply at the southern bridge.
 travel(25,18);call('gift','seed');
 travel(25,4);call('gift','amber');
 travel(15,3); // Northern bridge refill before the inland search.
 // Deduce the target from earned text, rather than reading s.heart.
 const pine=s.reports.find(r=>r.guide===1).text,mush=s.reports.find(r=>r.guide===2).text;
 const x=pine.includes('duskward')?19:23,y=mush.includes('highwind')?11:15;
 travel(x,y);if(s.won)throw Error('Walking auto-won');hold('trowel');call('act','dig');
 if(!s.won)throw Error('Did not win');
 return {seed,day:s.day,effort:s.effort,steps:s.steps,hp:s.hp,water:s.water,food:s.food,credits:s.credits,samples:s.samples,trace};
}
module.exports={simulate};
if(require.main===module){const all=Array.from({length:100},(_,i)=>simulate(i+1));console.log(JSON.stringify({count:all.length,dayRange:[Math.min(...all.map(s=>s.day)),Math.max(...all.map(s=>s.day))],minHp:Math.min(...all.map(s=>s.hp)),minCredits:Math.min(...all.map(s=>s.credits))},null,2));require('node:fs').writeFileSync(require('node:path').join(__dirname,'campaign-results.json'),JSON.stringify(all,null,2));require('node:fs').writeFileSync(require('node:path').join(__dirname,'campaign-trace.json'),JSON.stringify(simulate(19,true),null,2));}
