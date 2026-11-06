import {BLOCK_STYLES,TREE_PALETTE} from './theme.js';
const outline=(w,h,i=0)=>`M${6+i} ${i}H${w-6-i}L${w-i} ${5+i}V${h-5-i}L${w-6-i} ${h-i}H${6+i}L${i} ${h-5-i}V${5+i}Z`;
const cache=new Map();
function shape(d){if(!cache.has(d))cache.set(d,new Path2D(d));return cache.get(d);}
const emblem='M0 6V-3M0 0C-9-2-9-9-1-6C0-5 0-3 0 0M0-3C1-10 10-10 8-4C7-1 3 0 0 0';
export function drawBlock(c,b){
 const p=BLOCK_STYLES[b.kind%BLOCK_STYLES.length],w=b.w,h=b.h,face=shape(outline(w,h));
 c.save();c.translate(b.x,b.y);
 c.save();c.translate(0,4);c.fillStyle='#0008';c.fill(face);c.restore();
 c.save();c.translate(0,2);c.fillStyle=p.deep;c.fill(face);c.restore();
 const fill=c.createLinearGradient(0,0,0,h);fill.addColorStop(0,p.top);fill.addColorStop(.13,p.light);fill.addColorStop(.5,p.face);fill.addColorStop(1,p.base);
 c.fillStyle=fill;c.fill(face);c.strokeStyle=p.edge;c.lineWidth=1.3;c.stroke(face);
 c.save();c.clip(face);
 c.strokeStyle='#001b2580';c.lineWidth=1;
 for(let i=0;i<3;i++){const y=6+i*7;c.beginPath();c.moveTo(5,y);c.bezierCurveTo(w*.19,y-4,w*.29,y+5,w*.38,y);c.moveTo(w*.64,y+1);c.bezierCurveTo(w*.77,y-3,w*.83,y+4,w-4,y-1);c.stroke();}
 c.strokeStyle='#effff5a0';c.lineWidth=1.2;c.beginPath();c.moveTo(8,3);c.lineTo(w-8,3);c.stroke();
 c.strokeStyle='#05241f99';c.beginPath();c.moveTo(6,h-3);c.lineTo(w-6,h-3);c.stroke();
 c.save();c.translate(w/2,h/2);c.fillStyle='#062027c9';c.strokeStyle=p.edge;c.lineWidth=.8;c.beginPath();c.moveTo(0,-9);c.lineTo(12,0);c.lineTo(0,9);c.lineTo(-12,0);c.closePath();c.fill();c.stroke();c.strokeStyle=p.etch;c.lineWidth=1.6;c.lineCap='round';c.stroke(shape(emblem));c.restore();
 if(b.maxHp>1){
  c.strokeStyle=TREE_PALETTE.gold;c.lineWidth=2.2;c.beginPath();c.moveTo(9,1);c.lineTo(4,5);c.lineTo(4,h-5);c.moveTo(w-9,1);c.lineTo(w-4,5);c.lineTo(w-4,h-5);c.stroke();
  for(let i=0;i<b.maxHp;i++){c.fillStyle=i<b.hp?'#fff3be':'#25332c';c.fillRect(w-22+i*5,h-7,3,3);}
 }
 if(b.hp<b.maxHp){c.strokeStyle='#061720';c.lineWidth=1.8;c.beginPath();c.moveTo(w*.29,0);c.lineTo(w*.24,h*.45);c.lineTo(w*.31,h*.6);c.lineTo(w*.27,h);c.stroke();c.strokeStyle='#e2ffcd8c';c.lineWidth=.6;c.stroke();}
 c.restore();c.restore();
}
// The public, non-playable background uses the same palette and silhouettes.
export function blockSVG(b){
 const p=BLOCK_STYLES[b.kind%BLOCK_STYLES.length],id='brick-'+b.id,d=outline(b.w,b.h);
 return `<defs><linearGradient id="${id}" x2="0" y2="1"><stop stop-color="${p.top}"/><stop offset=".13" stop-color="${p.light}"/><stop offset=".5" stop-color="${p.face}"/><stop offset="1" stop-color="${p.base}"/></linearGradient></defs><g transform="translate(${b.x} ${b.y})"><path d="${d}" transform="translate(0 3)" fill="${p.deep}"/><path d="${d}" fill="url(#${id})" stroke="${p.edge}" stroke-width="1.3"/><path d="M8 3H${b.w-8}" stroke="#effff5" stroke-opacity=".6"/><g transform="translate(${b.w/2} ${b.h/2})"><path d="M0-9L12 0 0 9-12 0Z" fill="#062027" fill-opacity=".8" stroke="${p.edge}" stroke-width=".8"/><path d="${emblem}" fill="none" stroke="${p.etch}" stroke-width="1.6" stroke-linecap="round"/></g></g>`;
}
