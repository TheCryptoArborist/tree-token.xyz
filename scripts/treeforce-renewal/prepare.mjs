import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {accountEffect,navigationEffect} from '../treeforce-session/patch.mjs';
import {renewSession,expiryEffect,refreshEffect,heldAccountEffect,foregroundEffect} from './client.mjs';
const root='release/session-renewal';await fs.mkdir(root+'/assets',{recursive:true});
const get=async p=>{const r=await fetch('https://tree-token.xyz/play/treeforce89/'+p);assert(r.ok);return r.text();};
const [original,game,html]=await Promise.all([get('assets/index-session-r2.js'),get('assets/arcade-session-r2.js'),get('')]);
// Compare against the exact already-published release, not a rebuilt older source.
assert.equal(original,await fs.readFile('release/session-return/assets/index-session-r2.js','utf8'));
assert.equal(game,await fs.readFile('release/session-return/assets/arcade-session-r2.js','utf8'));
const change=(a,b)=>{assert.equal(entry.split(a).length,2,'Source drift: '+a.slice(0,80));entry=entry.replace(a,b);};let entry=original;
change('function Rh(){',renewSession.toString()+';function Rh(){');
change('te=(0,x.useRef)(``);','te=(0,x.useRef)(``);const [renewalState,setRenewalState]=(0,x.useState)(``),lastActivity=(0,x.useRef)(Date.now()),recoveryProof=(0,x.useRef)(null);');
change(accountEffect.toString(),heldAccountEffect.toString().replace("a.current=null;i(null);","if(recoveryProof.current){void sh(recoveryProof.current).catch(()=>{});recoveryProof.current=null;}a.current=null;i(null);"));change(navigationEffect.toString(),foregroundEffect.toString());
change('(0,x.useEffect)(()=>{if(!r)return;let e=window.setTimeout(()=>{a.current=null,i(null),p(`Your game session expired. Verify your NFTree again to play.`),sh(r).catch(()=>{})},Math.max(0,r.expiresAt-Date.now()));return()=>window.clearTimeout(e)},[r])','(0,x.useEffect)('+expiryEffect.toString()+',[r]),(0,x.useEffect)('+refreshEffect.toString()+',[r])');
change('return r&&oh(r,e?.address||r.wallet)?','return r&&r.wallet===(e?.address?rh(e.address):r.wallet)?');
change('!e&&(0,S.jsxs)(`section`,{role:`status`,className:`session-reconnect`,children:[(0,S.jsx)(`p`,{children:`Your run is paused. Reconnect the same wallet to resume. No new verification or payment is needed while your session is valid.`}),(0,S.jsx)(nh,{})]})','(!e||renewalState===`expired`)&&(0,S.jsxs)(`section`,{role:`status`,className:`session-reconnect`,children:[(0,S.jsx)(`p`,{children:renewalState===`expired`?(f||`Your run is paused. Verify to resume.`):`Wallet connection interrupted. Reconnect the same wallet to return to your paused run.`}),!e?(0,S.jsx)(nh,{}):(0,S.jsx)(`button`,{type:`button`,onClick:ne,disabled:c,children:c?u:`Verify & resume run`})]})');
change('hidden:!e,inert:!e,style:!e?{display:`none`}:undefined','hidden:!e||renewalState===`expired`,inert:!e||renewalState===`expired`,style:!e||renewalState===`expired`?{display:`none`}:undefined');
change('_&&(0,S.jsx)(Ih,{session:r','_&&renewalState!==`expired`&&(0,S.jsx)(Ih,{session:r');
change('(0,S.jsx)(_h,{session:r})','(0,S.jsx)(`div`,{inert:renewalState===`expired`,style:renewalState===`expired`?{display:`none`}:undefined,children:(0,S.jsx)(_h,{session:r})})');
change('let o=await ah({wallet:e.address', 'let o=recoveryProof.current||await ah({wallet:e.address');
const accept='w(void 0),te.current=``,h(`game`),a.current=o,i(o)';
change(accept,`if(a.current){const held=a.current;recoveryProof.current=o;d('Restoring paused run…');let restored;try{restored=await renewSession(held,{fresh:o,signal:r.signal});}catch(error){if([401,403,409].includes(error.status)){recoveryProof.current=null;void sh(o).catch(()=>{});}throw error;}if(n!==s.current||a.current!==held||t.stores.$connection.get().account?.address!==e.address){void sh(restored).catch(()=>{});return;}recoveryProof.current=null;a.current=restored;i(restored);setRenewalState('');p('');return;}setRenewalState('');`+accept);
// Verification failure must keep the held scene mounted, even after wallet rejection.
change('n===s.current&&(i(null),p(e instanceof Error?e.message:`Wallet sign-in failed. Please retry.`))','n===s.current&&(a.current?setRenewalState(`expired`):i(null),p(e instanceof Error?e.message:`Wallet sign-in failed. Please retry.`))');
const relink=s=>s.replaceAll('index-session-r2.js','index-renewal-r3.js').replaceAll('arcade-session-r2.js','arcade-renewal-r3.js');
await Promise.all([fs.writeFile(root+'/assets/index-renewal-r3.js',relink(entry)),fs.writeFile(root+'/assets/arcade-renewal-r3.js',relink(game)),fs.writeFile(root+'/index.html',relink(html))]);
const sha=s=>createHash('sha256').update(s).digest('hex');await fs.writeFile(root+'/report.json',JSON.stringify({original:sha(original),entry:sha(relink(entry)),game:sha(relink(game)),newFunction:'treeforce-session-refresh',existingFunctionChanges:0}));console.log('Prepared renewal candidate.');
