import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
const directory=resolve(process.argv[2]||'stage/play/treeforce89');
const html=readFileSync(join(directory,'index.html'),'utf8');
const files=[];
function walk(path,relative=''){
 for(const name of readdirSync(path)){
  const item=join(path,name), rel=join(relative,name);
  if(statSync(item).isDirectory())walk(item,rel);
  else files.push({path:rel,content:readFileSync(item)});
 }
}
walk(directory);
if(!files.some(f=>/^assets[\\/].*\.js$/.test(f.path)))
 throw Error('Native build has no JavaScript bundle');
if(!html.includes('/play/treeforce89/assets/'))
 throw Error('HTML asset base is not the native TREE Arcade path');
if(/(?:src|href)=["']\/assets\//i.test(html))
 throw Error('Root-relative asset link would escape the game path');
if(/<iframe\b/i.test(html))throw Error('Native build unexpectedly embeds an iframe');
for(const file of files){
 if(!/\.(html|js|css|json|map)$/.test(file.path))continue;
 const text=file.content.toString('utf8');
 if(/["']\/assets\/(?:hero|backgrounds|powerups|arborwing)\//.test(text))
  throw Error('Phaser asset URL escapes the native game route: '+file.path);
 if(/https?:\/\/(?:feature-tree-paid-continue--)?treeforce89\.netlify\.app/i.test(text))
  throw Error('Old Netlify game origin embedded in '+file.path);
}
console.log('Verified '+files.length+' native TREE FORCE assets; game is NOT deployed.');
console.log('Wallet API calls still need same-origin backend integration before canonical testing.');
