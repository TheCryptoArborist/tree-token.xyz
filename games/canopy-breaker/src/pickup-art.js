import {TREE_PALETTE as TREE} from './theme.js';
// Enchanted wooden relics. Falling sprites, guide and notices share this art.
const path=(d,fill='none',stroke='icon',width=2.3)=>({d,fill,stroke,width});
export const PICKUP_ART={
 wide:{color:TREE.emerald,paths:[
  path('M-20 12Q-11 6-1 7L-1-6 3-7 4 6Q12 5 21 11L19 16Q2 9-18 17Z','wood','metal',1.2),
  path('M-13 7L-17-6M11 7L15-6','none','#c5a26c',3),
  path('M-17-5C-29-10-24-20-17-13C-17-25-5-24-10-13C-11-9-14-7-17-5Z','leaf','#bdfad0',1),
  path('M15-5C27-10 22-20 15-13C15-25 3-24 8-13C9-9 12-7 15-5Z','leaf','#bdfad0',1),
  path('M1-7C-9-12-4-23 2-16C10-25 15-12 1-7Z','leaf','#d6ffbf',1.2),
  path('M-17-6L-19-14M15-6L17-14M1-7L2-17','none','#f0ffc6',1)
 ]},
 tether:{color:TREE.teal,paths:[
  path('M0-10C-13-10-13 5 0 10C13 5 13-10 0-10Z','seed','#fff1af',1.2),
  path('M-12-8Q0-17 12-8L10-3Q0-8-10-3Z','wood','metal',1.2),
  path('M0-14V-19L5-22','none','#bda06d',2.3),
  path('M-15-4C-24 9-9 18 0 15C9 18 24 9 15-4M0 10V23M0 16C-11 10-20 22-10 23M0 16C11 10 20 22 10 23','none','icon',2.8),
  path('M-3-1Q-6 4-1 7','none','#fff6cd',1.5),
  path('M-14-6C-23-18-12-19-10-9Z','leaf','none')
 ]},
 hot:{color:TREE.gold,paths:[
  path('M0-25C3-13 15-13 17 0C19 12 10 22 0 22C-13 22-21 10-15-3C-13 5-9 6-8 1C-11-11-2-14 0-25Z','ember','#ffeab1',1.3),
  path('M0-1C-13-1-12 13 0 18C12 13 13-1 0-1Z','seed','#fff6d0',1.2),
  path('M-10 1Q0-7 10 1L8 5Q0 2-8 5Z','wood','#f8d575',1),
  path('M0-4L2-9','none','#f3e2ad',2),path('M-2 9Q-4 13 0 15','none','#fff9dd',1.8)
 ]},
 laser:{color:TREE.cyan,paths:[
  path('M-13 21L-10-15-6-14-7 21Z','wood','metal',1),path('M7 21L6-14 10-15 13 21Z','wood','metal',1),
  path('M-9-25L-16-7-9-12-3-7Z','icon','#d8fcff',1),path('M9-25L3-7 9-12 16-7Z','icon','#d8fcff',1),
  path('M-10 7L-20 0-11 1M10 7L20 0 11 1M-8-1L-2-7M8-1L2-7','none','leaf',3),
  path('M-13 13Q0 18 13 13M-13 17Q0 22 13 17','none','metal',2.5),
  path('M-20-15L-24-20M20-15L24-20','none','#c6fff1',1.3)
 ]},
 multi:{color:TREE.emerald,paths:[
  path('M0 22V11M0 16Q-11 6-15 7M0 16Q11 6 15 7','none','wood',3.3),
  path('M0-19C-12-18-11-4 0 0C11-4 12-18 0-19Z','leaf','#c5ffe2',1.1),
  path('M-10-17Q0-23 10-17L8-13Q0-17-8-13Z','wood','metal',1),
  path('M-14-1C-25 0-24 13-14 17C-4 13-3 0-14-1Z','seed','#fff1b7',1.1),
  path('M14-1C3 0 4 13 14 17C24 13 25 0 14-1Z','icon','#d8ffe7',1.1),
  path('M-24 0Q-14-7-4 0L-6 4Q-14 0-22 4ZM4 0Q14-7 24 0L22 4Q14 0 6 4Z','wood','metal',1),
  path('M-16 7Q-18 11-14 13M12 7Q10 11 14 13M-2-10Q-4-7 0-5','none','#f0ffd1',1.3)
 ]},
 fast:{color:TREE.amber,paths:[
  path('M-22-11Q-7-19 8-11M-24-3Q-13-7-3-3M-23 5Q-15 1-7 5','none','#ffe6a3',2),
  path('M-5 8C-4-11 10-14 23-13C17-5 20 12 6 17C0 19-5 15-5 8Z','ember','#ffe3aa',1.2),
  path('M-10 21L17-7M3 7L4-3M9 1L18 0','none','#533522',1.8),
  path('M-19 14Q-13 10-7 13','none','icon',2.3)
 ]},
 slow:{color:TREE.amber,paths:[
  path('M-21-4L20-2 19 9-21 6Z','wood','metal',1),
  path('M-10-22C-23-17-7-10-10-2C-14 9-5 19 1 10C7 3-5-2-1-10C3-18-1-24-7-18M12-20C25-12 8-5 9 4C10 12 20 11 17 23','none','seed',3.5),
  path('M-9 13L-16 23M10 12L4 24M-15-13L-22-9','none','#d3a367',2),
  path('M-3-15C-12-26-1-28 3-18C12-24 14-14 3-13Z','#8b9763','#d7c484',1)
 ]},
 wild:{color:'#b194ff',paths:[
  path('M-1 3C-10 1-7-12 3-9C19-4 10 17-5 13C-28 7-18-24 5-20C24-17 28 5 14 20','none','blight',5.5),
  path('M-2 1C-8-1-4-9 2-6C13-2 7 11-4 9C-21 4-13-19 5-16','none','#dabdff',1.3),
  path('M-19 10C-31 14-25 25-17 20C-13 18-14 13-19 10Z','blight','#dbb8ff',1),
  path('M14 16C26 12 27 24 17 24C12 24 9 19 14 16Z','blight','#dbb8ff',1),
  path('M17-22L19-27M22-17L28-18','none',TREE.gold,1.5)
 ]}
};
const goodType=type=>!['fast','slow','wild'].includes(type);
const goodFrame='M-15-24Q0-30 15-24L24-15Q28 0 21 19L9 27H-9L-21 19Q-28 0-24-15Z';
const badFrame='M0-30L30 0 0 30-30 0Z';
const materialStops={wood:['#c7a574','#7b5738','#382a20'],core:['#143d38','#071d25','#030c15'],metal:['#fff1ad',TREE.gold,'#a37529'],seed:['#fff5b9','#e5bd5b','#a7712c'],leaf:['#bcffd8',TREE.emerald,'#09744d'],blight:['#e1c8ff','#a178e5','#4e256b'],ember:['#ffedaa',TREE.amber,'#b25022']};
function frameParts(good){return good?[
 path(goodFrame,'wood','#d8bd79',1.2),path('M-14-19Q0-24 14-19L19-12Q23 0 16 16L7 21H-7L-16 16Q-23 0-19-12Z','core','metal',.8),
 path('M-23 11Q-28-5-20-22M21-16Q28 0 20 20','none','#4b3526',1.8),
 path('M-23-13C-34-23-22-27-21-18C-17-28-8-23-18-16Z','leaf','#c6f9bc',.8),
 path('M22 10C34 8 32 23 22 19C22 28 12 25 19 17Z','leaf','#b8e8a0',.8),
 path('M-23-14L-26-21M22 18L28 14M-6 26H6M-9 23H9','none','metal',1.2)
 ]:[
 path(badFrame,'wood','#d99b51',1.4),path('M0-24L24 0 0 24-24 0Z','core',TREE.amber,.9),
 path('M-22-10L-30-15-26-3M21 9L30 15 25 2M-8 23L-13 31-1 27','none','#a37847',2.3),
 path('M-17-18L-11-16M13 19L19 13M-3-27L3-27','none','#f8d28b',1.1)
 ];}
const canvasPaths=new Map();
function canvasPath(d){if(!canvasPaths.has(d))canvasPaths.set(d,new Path2D(d));return canvasPaths.get(d);}
function resolve(color,art,materials){return color==='icon'?art.color:materials[color]||color;}
export function drawPickup(c,type,x,y,{size=68,time=0,motion=true}={}){
 const art=PICKUP_ART[type];if(!art)return;const good=goodType(type);
 c.save();c.translate(x,y);if(motion)c.rotate(Math.sin(time*2.3+x*.01)*.07);c.scale(size/72,size/72);
 const materials={};for(const[key,stops]of Object.entries(materialStops)){const g=c.createLinearGradient(0,-29,0,29);stops.forEach((color,i)=>g.addColorStop(i/(stops.length-1),color));materials[key]=g;}
 c.shadowColor=art.color;c.shadowBlur=motion?9+Math.sin(time*3)*2:9;c.fillStyle='#302219';c.save();c.translate(0,2);c.fill(canvasPath(good?goodFrame:badFrame));c.restore();c.shadowBlur=0;
 c.lineJoin='round';c.lineCap='round';
 for(const p of [...frameParts(good),...art.paths]){const shape=canvasPath(p.d);if(p.fill!=='none'){c.fillStyle=resolve(p.fill,art,materials);c.fill(shape);}if(p.stroke!=='none'){c.strokeStyle=resolve(p.stroke,art,materials);c.lineWidth=p.width;c.stroke(shape);}}
 c.restore();
}
let sequence=0;
export function pickupIcon(type,{size=48,label=null}={}){
 const art=PICKUP_ART[type];if(!art)return null;const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),good=goodType(type),id='forest-relic-'+sequence++,materials={};
 svg.setAttribute('viewBox','-36 -36 72 72');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('focusable','false');svg.classList.add('pickup-icon');
 if(label){svg.setAttribute('role','img');svg.setAttribute('aria-label',label);}else svg.setAttribute('aria-hidden','true');
 const defs=document.createElementNS(ns,'defs');
 for(const[key,stops]of Object.entries(materialStops)){const g=document.createElementNS(ns,'linearGradient');g.setAttribute('id',id+'-'+key);g.setAttribute('x2','0');g.setAttribute('y2','1');stops.forEach((color,i)=>{const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',i/(stops.length-1));stop.setAttribute('stop-color',color);g.append(stop);});defs.append(g);materials[key]=`url(#${id}-${key})`;}
 svg.append(defs);
 for(const p of [...frameParts(good),...art.paths]){const node=document.createElementNS(ns,'path');for(const[k,v]of Object.entries({d:p.d,fill:resolve(p.fill,art,materials),stroke:resolve(p.stroke,art,materials),'stroke-width':p.width,'stroke-linecap':'round','stroke-linejoin':'round'}))node.setAttribute(k,String(v));svg.append(node);}
 return svg;
}
