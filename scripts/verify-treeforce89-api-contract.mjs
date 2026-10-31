import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

/**
 * Contract check between pinned TREE FORCE frontend and the TREE Token
 * same-origin preview function reservations.
 * No credentials, wallet requests, deployment or database writes occur.
 */
const root=resolve(process.argv[2]||'treeforce89');
const host=resolve(process.argv[3]||'tree-token');
const read=path=>readFileSync(join(root,path),'utf8');
const routes=new Map([
 ['tree-challenge','app/game/gateway-client.mjs'],
 ['tree-session','app/game/gateway-client.mjs'],
 ['tree-logout','app/game/gateway-client.mjs'],
 ['tree-run','app/game/gateway-client.mjs'],
 ['tree-continue-offer','app/game/continuation-review-client.mjs'],
 ['tree-continue','netlify/functions/tree-continue.mjs'],
]);
for(const [name,source] of routes){
 const input=read(source);
 if(name!=='tree-continue' && !input.includes('/.netlify/functions/'+name))
  throw Error('Missing game client API route: '+name);
 const fn=join(host,'netlify/preview-functions/'+name+'.ts');
 if(!existsSync(fn))throw Error('Missing same-origin preview handler: '+name);
 const code=readFileSync(fn,'utf8');
 if(['tree-continue','tree-continue-offer'].includes(name)){
  if(!code.includes('status:503')||!code.includes('authorized:false')||!code.includes('enabled:false'))
   throw Error('Checkout API not safely disabled: '+name);
 } else if(!code.includes('createIntegratedGatewayHandler'))
  throw Error('Authentication API is not using the isolated deployment gate: '+name);
 if(/\bfetch\s*\(/.test(code))throw Error('Preview API forwards requests: '+name);
}
const gateway=read('app/NFTreeGateway.tsx');
const kit=read('app/dapp-kit.ts');
if(!gateway.includes('signPersonalMessage') || !kit.includes('autoConnect:false'))
 throw Error('Wallet sign-in or auto-connect behavior changed unexpectedly');
const review=read('app/ContinuationReview.tsx');
if(!review.includes('disabled>Payments disabled'))
 throw Error('Checkout payment button unexpectedly enabled');
const html=read('index.html');
if(/<iframe\b/i.test(html))throw Error('Game must not be embedded in an iframe');
console.log('Verified '+routes.size+' same-origin route contracts, wallet sign-in and disabled checkout.');
console.log('Authentication uses isolated preview guards. Both checkout endpoints remain disabled.');
