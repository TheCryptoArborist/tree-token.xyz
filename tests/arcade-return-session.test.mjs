import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Run with jsdom installed, or set ARCADE_TEST_JSDOM to its module path.
const {JSDOM} = await import(process.env.ARCADE_TEST_JSDOM || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js',import.meta.url).href);
import {createDailyGrowth} from '../scripts/arcade-refresh/arcade-daily-growth.js';
const KEY='tree-arcade:daily-growth:session:v1';
const address='0x'+'a'.repeat(64);
const tick=()=>new Promise(r=>setTimeout(r,20));
async function setup({expired=false,resetDuringRestore=false,persistent=false}={}) {
 const dom=new JSDOM(fs.readFileSync(new URL('../production/arcade-refresh-static/index.html',import.meta.url),'utf8'),{url:'https://tree-token.xyz/play/'});
 const w=dom.window;let actual=null,notify=()=>{},restores=0;
 const session={version:1,token:'test-session',wallet:address,walletId:'Test Wallet',walletName:'Test Wallet',expiresAt:new Date(Date.now()+(expired?-1000:600000)).toISOString()};
 (persistent?w.localStorage:w.sessionStorage).setItem(KEY,JSON.stringify(session));
 const bridge={getWalletState:()=>actual||{connected:false},getAvailableWallets:()=>[{id:'Test Wallet',name:'Test Wallet'}],subscribeWalletState:fn=>(notify=fn,()=>{}),subscribeWallets:()=>()=>{},restoreWallet:async()=>{restores++;if(resetDuringRestore){actual=null;notify();}actual={connected:true,address,walletId:'Test Wallet',walletName:'Test Wallet'};notify();}};
 const app=createDailyGrowth({root:w.document.querySelector('#arcade-daily-growth'),loadWallet:async()=>bridge,fetchImpl:async()=>{throw Error('Controlled API outage');}});
 await app.ready;
 return {w,app,disconnect(){actual=null;notify();},switchAccount(){actual={connected:true,address:'0x'+'b'.repeat(64),walletId:'Test Wallet'};notify();},get restores(){return restores},close(){app.destroy();w.close();}};
}
test('same-wallet session restores at load and after a transient game-return disconnect',async()=>{const x=await setup();try{assert.equal(x.restores,1);assert.match(x.w.document.querySelector('#growth-wallet-state').textContent,/Signed in/);x.disconnect();assert.ok(x.w.localStorage.getItem(KEY));await tick();x.w.dispatchEvent(new x.w.Event('pageshow'));await tick();assert.ok(x.restores>=2);assert.match(x.w.document.querySelector('#growth-wallet-state').textContent,/Signed in/);assert.ok(x.w.localStorage.getItem(KEY));}finally{x.close()}});
test('switching accounts clears the saved sign-in',async()=>{const x=await setup();try{x.switchAccount();await tick();assert.equal(x.w.localStorage.getItem(KEY),null);assert.doesNotMatch(x.w.document.querySelector('#growth-wallet-state').textContent,/Signed in/);}finally{x.close()}});
test('expired sign-in is never restored',async()=>{const x=await setup({expired:true});try{assert.equal(x.restores,0);assert.equal(x.w.localStorage.getItem(KEY),null);}finally{x.close()}});
test('explicit sign-out removes saved session',async()=>{const x=await setup();try{await x.app.signOut();assert.equal(x.w.localStorage.getItem(KEY),null);x.w.dispatchEvent(new x.w.Event('focus'));await tick();assert.equal(x.restores,1);}finally{x.close()}});

test('bridge reset during silent reconnect does not invalidate the saved session',async()=>{const x=await setup({resetDuringRestore:true});try{x.disconnect();x.w.dispatchEvent(new x.w.Event('pageshow'));await tick();assert.match(x.w.document.querySelector('#growth-wallet-state').textContent,/Signed in/);assert.ok(x.w.localStorage.getItem(KEY));}finally{x.close()}});
test('a new lobby document restores an unexpired persistent sign-in',async()=>{const x=await setup({persistent:true});try{assert.equal(x.restores,1);assert.match(x.w.document.querySelector('#growth-wallet-state').textContent,/Signed in/);}finally{x.close()}});

test('one connect action signs one message and saves today without a transaction',async()=>{
 const dom=new JSDOM(fs.readFileSync(new URL('../production/arcade-refresh-static/index.html',import.meta.url),'utf8'),{url:'https://tree-token.xyz/play/'}),w=dom.window;
 let actual=null,notify=()=>{},signatures=0,connections=0,checked=false;const calls=[];
 const envelope=authenticated=>({status:'ok',authenticated,dateKey:'2026-11-07',monthKey:'2026-11',configuration:{enabledGames:[],eligibleGames:[]},...(authenticated?{progress:{wallet:address,monthKey:'2026-11',dateKey:'2026-11-07',calendar:Array.from({length:30},(_,i)=>({dateKey:`2026-11-${String(i+1).padStart(2,'0')}`,checkedIn:i===6&&checked,questCompleted:false,gameIds:[]})),checkedInDays:checked?1:0,questDays:0,today:{checkedIn:checked,questCompleted:false,gameIds:[]},passport:{monthKey:'2026-11',enabledGames:[],completedGameIds:[],complete:false},milestones:[],badges:[]}}:{})});
 const bridge={getWalletState:()=>actual||{connected:false},getAvailableWallets:()=>[{id:'Test Wallet',name:'Test Wallet'}],subscribeWalletState:fn=>(notify=fn,()=>{}),subscribeWallets:()=>()=>{},connectWallet:async()=>{connections++;actual={connected:true,address,walletId:'Test Wallet',walletName:'Test Wallet'};notify();},signPersonalMessage:async()=>{signatures++;return {signature:'test-signature'}}};
 const app=createDailyGrowth({root:w.document.querySelector('#arcade-daily-growth'),loadWallet:async()=>bridge,fetchImpl:async(url,options)=>{
  const action=new URL(url,'https://tree-token.xyz').searchParams.get('action');calls.push(action);let body;
  if(action==='challenge')body={status:'ok',challenge:{wallet:address,challengeId:'test-challenge',message:'Sign in to Tree Arcade',expiresAt:new Date(Date.now()+60000).toISOString()}};
  else if(action==='session')body={...envelope(true),session:{wallet:address,token:'a'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString()}};
  else {if(action==='check-in')checked=true;body=envelope(Boolean(options.headers.Authorization));}
  return new Response(JSON.stringify(body),{status:200});
 }});
 try{await app.ready;w.document.querySelector('[data-wallet-id="Test Wallet"]').click();await tick();await tick();assert.equal(connections,1);assert.equal(signatures,1);assert.equal(calls.filter(a=>a==='check-in').length,1);assert.ok(checked);assert.match(w.document.querySelector('#growth-wallet-state').textContent,/Signed in/);assert.ok(w.localStorage.getItem(KEY));await app.checkIn();assert.equal(calls.filter(a=>a==='check-in').length,1);}finally{app.destroy();w.close()}
});
