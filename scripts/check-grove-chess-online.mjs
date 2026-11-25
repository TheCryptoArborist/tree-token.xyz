import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {PGlite} from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';
import {createGroveHandler} from '../netlify/grove-functions/grove-chess.ts';
const {chromium}=await import(process.env.GROVE_CHESS_BROWSER_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
const root=path.resolve(import.meta.dirname,'..'),db=new PGlite();await db.exec('create schema private;create role anon;create role authenticated;create role service_role;');await db.exec(await fs.readFile(root+'/supabase/migrations/20261125064318_grove_chess_rooms.sql','utf8'));
const handler=createGroveHandler({rpc:async(name,args)=>{assert.equal(name,'grove_chess_v1');const keys=Object.keys(args);return (await db.query('select public.grove_chess_v1('+keys.map((k,i)=>k+'=> $'+(i+1)).join(',')+') as result',Object.values(args))).rows[0].result;}});
const browser=await chromium.launch({headless:true,...process.env.GROVE_CHESS_CHROMIUM?{executablePath:process.env.GROVE_CHESS_CHROMIUM}:{}});
const live=process.env.GROVE_CHESS_LIVE==='1';
const contexts=[];const errors=[];
async function player(width){const c=await browser.newContext({viewport:{width,height:1000}});contexts.push(c);if(!live)await c.route('https://tree-token.xyz/**',async route=>{const req=route.request(),u=new URL(req.url());if(u.pathname==='/api/grove-chess'){const r=await handler(new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...req.method()==='POST'?{body:req.postData()}: {}}));await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()});return;}
 const p=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+'/'))return route.abort();try{await route.fulfill({body:await fs.readFile(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':p.endsWith('.png')?'image/png':'image/webp'});}catch{await route.fulfill({status:404,body:'Not found'});}});const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));return page;}
try{
 const white=await player(1440),black=await player(390),watcher=await player(390);
 await white.goto('https://tree-token.xyz/play/grove-chess/');await white.locator('#mobile-options').click();await white.locator('#mode').selectOption('online');await white.locator('#online-private').click();await white.waitForURL(/room=/);const url=white.url();await white.locator('#mobile-controls-close').click();
 await black.goto(url);await black.locator('#online-join').click();await black.waitForFunction(()=>document.querySelector('#online-note').textContent.includes('You play Pine'));await white.waitForFunction(()=>document.querySelector('#online-note').textContent.includes('You play Birch'));
 await white.locator('[data-square="e2"]').click();await white.waitForTimeout(4500);assert.match(await white.locator('[data-square="e4"]').getAttribute('class'),/legal/,'poll must preserve move selection');await white.locator('[data-square="e4"]').click();
 await black.waitForFunction(()=>document.querySelector('#status').textContent==='Your move.');await black.locator('[data-square="e7"]').click();await black.locator('[data-square="e5"]').click();
 await white.locator('#move-count').filter({hasText:'2 HALF-MOVES'}).waitFor();
 await black.reload();await black.waitForFunction(()=>document.querySelector('#online-note').textContent.includes('You play Pine'));assert.equal(await black.locator('#move-count').textContent(),'2 HALF-MOVES');assert.equal(await black.locator('#undo').isDisabled(),true);
 await watcher.goto(url);await watcher.waitForFunction(()=>document.querySelector('#online-note').textContent.includes('Both seats are taken'));await watcher.locator('[data-square="g1"]').click();await watcher.locator('[data-square="f3"]').click();assert.equal(await watcher.locator('#move-count').textContent(),'2 HALF-MOVES');
 const trial=await black.evaluate(()=>JSON.parse(localStorage.getItem('grove-chess:trial:v1')));assert.equal(trial.used,1);
 await fs.mkdir(root+'/.netlify',{recursive:true});await white.screenshot({path:root+'/.netlify/grove-chess-online-desktop.png',fullPage:true});await black.screenshot({path:root+'/.netlify/grove-chess-online-mobile.png',fullPage:true});
 await black.locator('#mobile-options').click();await black.locator('#online-resign').click();await black.locator('#online-resign-yes').click();await white.locator('#status').filter({hasText:'Birch wins by resignation.'}).waitFor();
 assert.deepEqual(errors,[]);console.log('Passed two separate players, seat protection, legal synchronized moves, poll selection persistence, mobile reload, one trial debit, spectator read-only, and resignation. '+(live?'Live private rooms verified; no Telegram sends.':'No live services or Telegram sends.'));
 await fs.writeFile(root+'/.netlify/grove-chess-online-checks.json',JSON.stringify({passed:true,live,telegramSends:false,separatePlayers:true,reconnect:true,seatProtection:true,trialDebitOnce:true,resignation:true}));
}finally{await browser.close();await db.close();}
