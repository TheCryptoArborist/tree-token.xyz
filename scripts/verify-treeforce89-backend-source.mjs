import {readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';

// Audit the pinned TREE FORCE backend modules as source only. They MUST NOT be
// installed as production Netlify Functions without replacing the original
// site/branch guards and validating isolated database credentials.
const dir=resolve(process.argv[2]||'stage/backend/treeforce89');
const paths=[];
function walk(base){
  for(const entry of readdirSync(base)){
    const file=join(base,entry);
    if(statSync(file).isDirectory())walk(file);
    else if(/\.(mjs|js|json)$/.test(file))paths.push(file);
  }
}
walk(dir);
const needed=['netlify/gateway-runtime.mjs','netlify/functions/tree-challenge.mjs',
 'netlify/functions/tree-session.mjs','netlify/functions/tree-logout.mjs',
 'netlify/functions/tree-run.mjs','netlify/functions/tree-continue-offer.mjs',
 'app/game/wallet-gateway-service.mjs','app/game/preview-access.mjs'];
for(const name of needed){
 if(!paths.some(p=>relative(dir,p).replaceAll('\\','/')===name))
   throw Error('Missing pinned TREE FORCE backend source: '+name);
}
const hashes={};
for(const path of paths){
 const rel=relative(dir,path).replaceAll('\\','/');
 const bytes=readFileSync(path);
 const content=bytes.toString('utf8');
 if(/(?:postgres(?:ql)?:\/\/|NETLIFY_DATABASE_URL\s*=|DATABASE_URL\s*=)/i.test(content))
   throw Error('Possible embedded database connection in '+rel);
 hashes[rel]=createHash('sha256').update(bytes).digest('hex');
}
const guard=readFileSync(join(dir,'app/game/preview-access.mjs'),'utf8');
if(!guard.includes('35f5591a-5c7d-4bc6-ae9a-3e61e816b641'))
 throw Error('Expected source Netlify site guard changed: review required');
const runtime=readFileSync(join(dir,'netlify/gateway-runtime.mjs'),'utf8');
if(!runtime.includes("getDatabase().pool"))
 throw Error('Database connection model changed: review required');
console.log('Staged '+paths.length+' pinned backend source files for audit only.');
console.log('Original TREE FORCE site-ID guard is intentionally still present.');
console.log('Do not deploy these functions on TREE Token without separate site/context/DB security review.');
console.log('Source fingerprint: '+createHash('sha256').update(JSON.stringify(hashes)).digest('hex'));
