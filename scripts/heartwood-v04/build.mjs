import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const rules=readFileSync(new URL('./src/rules.cjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('./src/ui.js',import.meta.url),'utf8');
export function upgradeHeartwood(source){
 const bytes=Buffer.from(source),hash=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
 if(hash!=='9983eb220d302ac7341fd31c136e3497cc9ba753')throw new Error('Heartwood v0.3 source changed. Reconcile the strategy overlay before rebuilding.');
 const once=(a,b)=>{if(source.split(a).length!==2)throw new Error('Missing or ambiguous Heartwood patch anchor: '+a.slice(0,90));source=source.replace(a,b);};
 once("SAVE='tree-heartwood-expedition-v1'","SAVE='tree-heartwood-expedition-strategy-v4'");
 once('ECOSYSTEM PLAYTEST · V0.3 · FREE PLAY','STRATEGY PLAYTEST · V0.4 · FREE PLAY');
 once('const colors={',"const colors={bridge:'#a18b56',");
 once("river:'River'};","river:'River',bridge:'Bridge'};");
 const start=source.indexOf('function rng(seed)'),end=source.indexOf('// Discrete-pixel landscape renderer');
 if(start<0||end<=start)throw new Error('Missing rules boundaries');
 source=source.slice(0,start)+rules+'\n'+ui+'\n'+source.slice(end);
 once('<div class="tools">','<div class="tools"><button id="pack">Pack & tools</button><button id="fieldGuide">Field guide</button>');
 once('<div class="legend">','<div id="expeditionState" class="legend" aria-live="polite"></div><div class="legend">');
 once("terrainSprite(type,(x*17+y*19)%4)","terrainSprite(type==='bridge'?'river':type,(x*17+y*19)%4)");
 once('if(known&&s.reports.length>=3&&x===s.heart.x&&y===s.heart.y)','if(known&&s.won&&x===s.heart.x&&y===s.heart.y)');
 once('const i=stationAt(x,y);if(i>=0){if(known)',`if(known){
    if(type==='bridge'){ctx.fillStyle='#a78049';ctx.fillRect(px,py+tile*.25,tile,tile*.5);ctx.strokeStyle='#624424';ctx.lineWidth=2;for(let b=0;b<5;b++){ctx.beginPath();ctx.moveTo(px+b*tile/5,py+tile*.25);ctx.lineTo(px+b*tile/5,py+tile*.75);ctx.stroke();}}
    const landmark=R.LANDMARKS.find(p=>p.x===x&&p.y===y),site=R.SITES.some(p=>p.x===x&&p.y===y),ruin=R.RUINS.some(p=>p.x===x&&p.y===y);
    if(site){ctx.strokeStyle=s.excavated[k]?'#888776':'#c6b98c';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(px+tile*.5,py+tile*.65,tile*.32,tile*.18,0,0,Math.PI*2);ctx.stroke();mapLabel(s.excavated[k]?'SEARCHED':'ROOT CIRCLE',px+tile*.5,py+tile*.91);}
    if(ruin){ctx.fillStyle='#ada88c';ctx.fillRect(px+tile*.3,py+tile*.35,tile*.4,tile*.3);mapLabel(s.excavated[k]?'EMPTY RUIN':'RUIN',px+tile*.5,py+tile*.88);}
    if(landmark)mapLabel(landmark.name,px+tile*.5,py+tile*.45);
  }
  const i=stationAt(x,y);if(i>=0){if(known)`);
 once("c.strokeStyle='#fff5b1';",`R.LANDMARKS.forEach(p=>{if(s.seen[key(p.x,p.y)]){c.fillStyle='#edc987';c.font='bold 10px sans-serif';c.fillText(p.short,p.x*10+1,p.y*10+9);}});
 R.SITES.forEach(p=>{if(s.seen[key(p.x,p.y)]){c.strokeStyle='#cfb3e3';c.strokeRect(p.x*10+1,p.y*10+1,8,8);}});
 c.strokeStyle='#fff5b1';`);
 once("else{s=fresh();reveal(2,2,3);update();briefing();}","else{s=fresh();s.started=false;reveal(2,2,3);update();briefing();}");
 once('Your map, reports, samples and supplies are saved. TREE Hero now leads the expedition, with Oak, Pine, Mushroom and Willow as your guides.','Your strategy expedition is saved: equipment, held tool, station caches, earned reports, explored map, supplies and remaining season.');
 once('Glowing roots: Heartseed','Root circles: investigate · S/A/F: landmarks');
 once('Ecosystem playtest 0.3','Strategy playtest 0.4');
 return source;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=process.argv[2]||new URL('./base.html',import.meta.url),output=process.argv[3]||new URL('./index.html',import.meta.url);
 writeFileSync(output,upgradeHeartwood(readFileSync(input,'utf8')));
}
