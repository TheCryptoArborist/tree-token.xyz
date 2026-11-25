import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.argv[2]||'/workspace/treeforce-arborwing-preview',base='/play/treeforce89/assets/';
function put(p,b){fs.mkdirSync(path.dirname(root+p),{recursive:true});fs.writeFileSync(root+p,b)}
function once(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const names=['index-review','arcade-review','graphql-review','holiday-mode','sound-identity'];
for(const name of names){let s=fs.readFileSync('production/treeforce-pilot-r19'+base+name+'-r19.js','utf8');for(const n of names)s=s.replaceAll(n+'-r19.js',n+'-r20.js');if(name==='arcade-review'){
 s='import {installDesktopRenderReview} from "./desktop-render-review.mjs";\nimport {installSeedlingTexture} from "./arborwing-hd-review.mjs";\n'+s;
 s=once(s,'preload(){this.load.image(`hero-photo`','preload(){this.load.image(`seedling-hd-review`,`/assets/arborwing-review/seedling-hd.png`);this.load.image(`hero-photo`');
 s=once(s,'installMobileTouchbar(game,e);','installDesktopRenderReview(game);installMobileTouchbar(game,e);');
 s=once(s,'create(){X(this);let e=this.game.registry','create(){X(this);installSeedlingTexture(this);let e=this.game.registry');
 }put(base+name+'-r20.js',s)}
put(base+'desktop-render-review.mjs',fs.readFileSync('treeforce89/frontend/game/desktop-render-review.mjs'));
put(base+'arborwing-hd-review.mjs',fs.readFileSync('treeforce89/frontend/game/arborwing-hd-review.mjs'));
put('/assets/arborwing-review/seedling-hd.png',fs.readFileSync('assets/arborwing-review/seedling-hd.png'));
let html=fs.readFileSync('scripts/treeforce-local/practice.html','utf8').replace('"r14", "r15"','"r14", "r15", "r20"').replace('game = createCanopyGame','game = window.__game = createCanopyGame');
html=html.replace('max-width: 480px','max-width: 860px').replace('</style>','</style><link rel="stylesheet" href="/play/treeforce89/desktop-r19.css">');
put('/arborwing-review.html',html);console.log('Prepared localhost-only r20 artwork comparison');
