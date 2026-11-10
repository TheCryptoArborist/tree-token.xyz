import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {accountEffect,navigationEffect,patch,fingerprints,sha} from '../scripts/treeforce-session/patch.mjs';
import fs from 'node:fs';
function fixture({wallet='0x123',expiresAt=2000,account=wallet}={}){
 const calls={revoke:[],state:[],errors:[],paused:0},window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
 window.addEventListener('treeforce-session-suspend',()=>calls.paused++);
 const ctx={window,document,Event,Date:{now:()=>1000},e:account?{address:account}:undefined,a:{current:{wallet,expiresAt,sessionToken:'private',runId:'existing'}},s:{current:0},o:{current:{abort(){}}},l(){},p:error=>calls.errors.push(error),i:session=>calls.state.push(session),sh:async session=>calls.revoke.push(session)};
 return{ctx,calls,run:fn=>vm.runInNewContext('('+fn.toString()+')()',ctx)};
}
test('same connected wallet preserves the existing mounted run and session',()=>{const f=fixture(),old=f.ctx.a.current;f.run(accountEffect);assert.equal(f.ctx.a.current,old);assert.deepEqual(f.calls.revoke,[]);assert.deepEqual(f.calls.state,[])});
test('temporary wallet disconnect pauses without destroying or revoking the run',()=>{const f=fixture({account:null}),old=f.ctx.a.current;f.run(accountEffect);assert.equal(f.ctx.a.current,old);assert.equal(f.calls.paused,1);assert.equal(f.calls.revoke.length,0);f.ctx.e={address:old.wallet};f.run(accountEffect);assert.equal(f.ctx.a.current,old);assert.equal(f.calls.state.length,0)});
test('a different wallet invalidates and revokes the prior session',()=>{const f=fixture({account:'0x999'});f.run(accountEffect);assert.equal(f.ctx.a.current,null);assert.deepEqual(f.calls.state,[null]);assert.equal(f.calls.revoke.length,1)});
test('leaving and returning through back-forward cache pauses and keeps a valid credential',()=>{const f=fixture(),cleanup=f.run(navigationEffect),old=f.ctx.a.current;f.ctx.window.dispatchEvent(new Event('pagehide'));f.ctx.window.dispatchEvent(new Event('pageshow'));assert.equal(f.ctx.a.current,old);assert.equal(f.calls.revoke.length,0);assert.equal(f.calls.paused,2);cleanup();f.ctx.window.dispatchEvent(new Event('pageshow'));assert.equal(f.calls.paused,2);assert.equal(f.calls.revoke.length,0)});
test('expiry is checked immediately on restoration even when background timers were frozen',()=>{const f=fixture();f.run(navigationEffect);f.ctx.Date.now=()=>3000;f.ctx.window.dispatchEvent(new Event('pageshow'));assert.equal(f.ctx.a.current,null);assert.deepEqual(f.calls.state,[null]);assert.equal(f.calls.revoke.length,1);assert.match(f.calls.errors[0],/expired/)});
test('returning to a visible tab rechecks expiry',()=>{const f=fixture();f.run(navigationEffect);f.ctx.Date.now=()=>3000;f.ctx.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.ctx.a.current,null);assert.equal(f.calls.revoke.length,1)});
test('StrictMode effect cleanup does not sign the player out',()=>{const f=fixture();f.run(navigationEffect)();assert.equal(f.calls.revoke.length,0);assert.ok(f.ctx.a.current)});
test('production patch rejects unreviewed source fingerprints',()=>{assert.throws(()=>patch('changed','changed'),/Live entry changed/)});
test('candidate retains authentication, explicit logout, price, payment and score contracts',()=>{
 const root='release/session-return/assets/';if(!fs.existsSync(root+'index-original.js'))return;
 const entry=fs.readFileSync(root+'index-original.js','utf8'),game=fs.readFileSync(root+'arcade-original.js','utf8');assert.equal(sha(entry),fingerprints.entry);
 const out=patch(entry,game);
 for(const name of ['ah','oh','sh','ch','Lh']){const start=entry.indexOf('function '+name+'('),end=entry.indexOf('}function ',start);if(end>start)assert.ok(out.entry.includes(entry.slice(start,end+1)),name+' contract changed');}
 assert.ok(out.entry.includes('try{e&&await sh(e)}catch'));assert.ok(out.entry.includes('t.stores.$connection.get().account?.address!==r.wallet'));
 assert.match(out.entry,/Pay 20,000 TREE & Continue/);assert.match(out.game,/20,000 TREE · RESTORE 3 LIVES/);
 assert.equal((out.entry.match(/autoConnect:!1,storage:null/g)||[]).length,1);
});
