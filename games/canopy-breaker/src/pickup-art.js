// One vector design for the falling pickups, field guide and pickup notices.
// Shapes remain crisp at every canvas scale and do not rely on font glyphs.
const path=(d,fill='none',stroke='icon',width=2.3)=>({d,fill,stroke,width});
export const PICKUP_ART={
 wide:{color:'#9affae',paths:[
  path('M-17 8Q0 0 17 8','none','#bda26b',4),path('M0 6V-10M-7 5L-12-2M7 5L12-2'),
  path('M0-10C-11-18-13-8 0-6C13-8 11-18 0-10Z','icon','none'),
  path('M-11 14H-21M-17 10L-21 14-17 18M11 14H21M17 10L21 14 17 18','none','#f1ffd2',2)
 ]},
 tether:{color:'#76f2e0',paths:[
  path('M0-4V8M0 7C-15 0-18 18-9 18M0 7C15 0 18 18 9 18M0 8V20'),
  path('M0-19C-10-13-8-4 0-3C8-4 10-13 0-19Z','#e8ffc9','icon',1.8),
  path('M-12-6C-21 4-11 12 0 11C11 12 21 4 12-6','none','icon',1.8)
 ]},
 hot:{color:'#ffb457',paths:[
  path('M0-22C3-11 14-9 15 2C18 14 9 21 0 21C-12 21-19 10-14 0C-13 6-8 7-7 3C-10-8-2-12 0-22Z','#ffad43','#ffe5a0',1.5),
  path('M0-3C-10 7-7 17 0 17C8 17 10 7 0-3Z','#fff2ab','none'),
  path('M0 15Q-3 8 1 5','none','#c96b28',1.4)
 ]},
 laser:{color:'#7eeaff',paths:[
  path('M-10 19V-11M10 19V-11','none','icon',3),
  path('M-10-20L-16-7-10-10-4-7Z','icon','none'),path('M10-20L4-7 10-10 16-7Z','icon','none'),
  path('M-10 10L-17 3M-10 3L-4-3M10 10L17 3M10 3L4-3','none','#baf7a7',2),
  path('M0-19V-24M-20-14L-23-17M20-14L23-17','none','#d9fffc',1.5)
 ]},
 multi:{color:'#c5a3ff',paths:[
  path('M0 20V11M0 11Q-2 2-12-1M0 11Q2 2 12-1','none','#b0f3d8',2),
  path('M0-21C-10-16-10-4 0-3C10-4 10-16 0-21Z','icon','#f0e2ff',1.4),
  path('M-13-3C-23 3-21 15-13 16C-5 15-3 3-13-3Z','#94dfef','#e8faff',1.4),
  path('M13-3C3 3 5 15 13 16C21 15 23 3 13-3Z','#c5a3ff','#f0e2ff',1.4),
  path('M-14 12L-16 5M12 12L10 5M-1-7L-3-14','none','#5c668f',1.4)
 ]},
 fast:{color:'#ffd17b',paths:[
  path('M-15-13L-1 0-15 13M1-13L15 0 1 13','none','icon',4),
  path('M-21-6H-17M-22 0H-11M-21 6H-17','none','#fff0be',1.8)
 ]},
 slow:{color:'#e6ba85',paths:[
  path('M-20-4L19-1 18 9-20 5Z','#8e6845','#cfa574',1.5),
  path('M-10-20C-21-15-7-10-10-2C-14 9-5 17 1 10C7 3-5-2-1-10C3-16-1-22-7-17M12-19C22-11 8-5 9 4C10 12 19 11 17 20','none','icon',3),
  path('M-8 14L-13 21M10 12L6 21','none','icon',2)
 ]},
 wild:{color:'#e6adf5',paths:[
  path('M-2 2C-9-2-4-11 4-8C17-2 8 16-6 11C-25 4-14-23 6-18C23-14 25 6 13 18','none','icon',2.6),
  path('M12 18L12 11M12 18L19 15','none','#fff0ff',2),
  path('M-20 11C-26 17-22 22-18 20C-14 18-16 14-20 11Z','#b6f7d9','none'),
  path('M17-19L19-23M21-16L25-17','none','#ffdf9f',1.6)
 ]}
};
const framePath=good=>good?'M-14-24H14Q24-24 24-14V14Q24 24 14 24H-14Q-24 24-24 14V-14Q-24-24-14-24Z':'M0-27L27 0 0 27-27 0Z';
const goodType=type=>!['fast','slow','wild'].includes(type),border=good=>good?'#85eaaa':'#ffbd71';
const resolve=(color,art)=>color==='icon'?art.color:color;
const canvasPaths=new Map();
function canvasPath(d){if(!canvasPaths.has(d))canvasPaths.set(d,new Path2D(d));return canvasPaths.get(d);}
export function drawPickup(c,type,x,y,{size=56,time=0,motion=true}={}){
 const art=PICKUP_ART[type];if(!art)return;const good=goodType(type);
 c.save();c.translate(x,y);if(motion)c.rotate(Math.sin(time*3+x*.01)*.065);c.scale(size/56,size/56);
 c.shadowColor=art.color;c.shadowBlur=motion?13+Math.sin(time*4)*3:12;
 c.fillStyle='#091b20';c.strokeStyle=border(good);c.lineWidth=2.2;
 const frame=canvasPath(framePath(good));c.fill(frame);c.stroke(frame);c.shadowBlur=0;
 c.lineJoin='round';c.lineCap='round';
 for(const p of art.paths){const shape=canvasPath(p.d);if(p.fill!=='none'){c.fillStyle=resolve(p.fill,art);c.fill(shape);}if(p.stroke!=='none'){c.strokeStyle=resolve(p.stroke,art);c.lineWidth=p.width;c.stroke(shape);}}
 c.restore();
}
export function pickupIcon(type,{size=40,label=null}={}){
 const art=PICKUP_ART[type];if(!art)return null;const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),good=goodType(type);
 svg.setAttribute('viewBox','-30 -30 60 60');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('focusable','false');svg.classList.add('pickup-icon');
 if(label){svg.setAttribute('role','img');svg.setAttribute('aria-label',label);}else svg.setAttribute('aria-hidden','true');
 const append=p=>{const node=document.createElementNS(ns,'path');for(const[k,v]of Object.entries(p))node.setAttribute(k,String(v));svg.append(node);};
 append({d:framePath(good),fill:'#091b20',stroke:border(good),'stroke-width':2.2});
 for(const p of art.paths)append({d:p.d,fill:resolve(p.fill,art),stroke:resolve(p.stroke,art),'stroke-width':p.width,'stroke-linecap':'round','stroke-linejoin':'round'});
 return svg;
}
