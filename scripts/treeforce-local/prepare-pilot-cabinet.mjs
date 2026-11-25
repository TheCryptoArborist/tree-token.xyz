import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const files={};
const source='production/treeforce-main-r18';
const output=process.argv[2]||'release/treeforce-pilot-cabinet';
const base='/play/treeforce89/';
function put(name,bytes){const target=output+name;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files[name]={bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')};}
function once(s,a,b){assert.equal(s.split(a).length,2,`Unique anchor: ${a}`);return s.replace(a,b);}
const modules=['index-review','arcade-review','graphql-review','holiday-mode','sound-identity'];
for(const name of modules){let s=fs.readFileSync(source+base+'assets/'+name+'-r18.js','utf8');
 for(const dep of modules)s=s.replaceAll(dep+'-r18.js',dep+'-r19.js');
 if(name==='index-review'){
 s=once(s,'children:`Top 50 pilots · best score per wallet`','children:(0,S.jsxs)(`div`,{className:`pilot-hall-title`,children:[(0,S.jsx)(`span`,{className:`pilot-hall-brand`,children:`TREE FORCE ’89`}),(0,S.jsx)(`span`,{className:`pilot-hall-kicker`,children:`CANOPY HALL OF FAME`}),(0,S.jsx)(`strong`,{children:`TOP 10 PILOTS`}),(0,S.jsx)(`span`,{className:`pilot-hall-rule`,children:`Best score per wallet`})]})');
 s=once(s,'children:r.map((e,t)=>(0,S.jsxs)(`tr`,{children:','children:r.slice(0,10).map((e,t)=>(0,S.jsxs)(`tr`,{className:`pilot-rank pilot-rank-${t+1}`,children:');
 s=once(s,'children:t<3?[`🥇`,`🥈`,`🥉`][t]:t+1','children:(0,S.jsx)(`span`,{className:`pilot-rank-number`,children:t+1})');
 s=once(s,'scope:`row`,children:e.username','scope:`row`,children:[(0,S.jsx)(`span`,{className:`pilot-display-name`,children:e.username}),t<3&&(0,S.jsx)(`small`,{className:`pilot-rank-title`,children:[`CANOPY CHAMPION`,`ELITE WING`,`ACE PILOT`][t]})]');
 s=once(s,'children:mh.map(([e,t,n,,,r])=>','children:mh.map(([e,t,n,,,r],badgeIndex)=>');
 s=once(s,'className:`pilot-medal`,"aria-hidden":`true`,children:r','className:`pilot-medal`,"aria-hidden":`true`,style:{backgroundPosition:`${(badgeIndex%4)*100/3}% ${Math.floor(badgeIndex/4)*100/3}%`}');
 }
 put(base+'assets/'+name+'-r19.js',s);
}
let html=fs.readFileSync(source+base+'index.html','utf8');
html=once(html,'index-review-r18.js','index-review-r19.js');
html=once(html,'</head>','  <link rel="stylesheet" href="/play/treeforce89/pilot-cabinet-r19.css">\n  <link rel="stylesheet" href="/play/treeforce89/desktop-r19.css">\n  </head>');
put(base+'index.html',html);
put(base+'desktop-r19.css',fs.readFileSync('styles/treeforce-desktop.css'));
put(base+'pilot-cabinet-r19.css',fs.readFileSync('styles/treeforce-pilot-cabinet.css'));
put('/assets/treeforce-achievements/canopy-medals-r19.webp',fs.readFileSync('assets/treeforce-achievements/canopy-medals-r19.webp'));
put('/assets/treeforce-ranks/hall-of-fame.webp',fs.readFileSync('assets/treeforce-ranks/hall-of-fame.webp'));
for(const name of ['champion','silver','bronze','contender'])put('/assets/treeforce-ranks/'+name+'.svg',fs.readFileSync('assets/treeforce-ranks/'+name+'.svg'));
fs.writeFileSync(output+'/overlay-manifest.json',JSON.stringify({kind:'frontend-overlay-not-full-deployment',source:'production/treeforce-main-r18',files},null,2));
console.log(`Prepared presentation overlay: ${output}. Not a full deployment package.`);
