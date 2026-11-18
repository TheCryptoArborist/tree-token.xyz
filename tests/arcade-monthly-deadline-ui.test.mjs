import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import(process.env.ARCADE_TEST_JSDOM||new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js',import.meta.url).href);
import {createMonthlyPanel} from '../scripts/arcade-monthly.js';
const wallet='0x'+'a'.repeat(64),token='b'.repeat(64),digest='1'.repeat(44),wait=()=>new Promise(r=>setTimeout(r,20));
const pending={wallet,intentId:'11111111-1111-4111-8111-111111111111',dateKey:'2026-11-29',digest:null,expiresAt:'2026-12-01T00:00:00.000Z',seasonEndsAt:'2026-12-01T00:00:00.000Z'};
const progress={wallet,monthKey:'2026-12',attendance:{streak:2,checkedInDays:2,missedDates:['2026-12-01'],recoveredDates:[]},monthlyReward:{requiredQuestDays:20,verifiedQuestDays:0,qualified:false,todayQualified:false}};
function page(saved){
 const dom=new JSDOM(fs.readFileSync(new URL('../production/arcade-refresh-static/index.html',import.meta.url),'utf8'),{url:'https://tree-token.xyz/play/'}),w=dom.window;
 w.localStorage.setItem('tree-arcade:daily-growth:session:v1',JSON.stringify({wallet,token,walletId:'Test Wallet',expiresAt:new Date(Date.now()+600000).toISOString()}));
 if(saved)w.sessionStorage.setItem('tree-arcade:recovery:pending:v1',JSON.stringify(saved));
 return {dom,w,root:w.document.querySelector('#arcade-daily-growth'),loadBridge:async()=>({getWalletState:()=>({connected:true,address:wallet,walletId:'Test Wallet'})})};
}
test('expired November checkout retains verification in December and never offers another payment',async()=>{
 const p=page(pending),calls=[];let paid=0;
 const app=createMonthlyPanel({...p,now:()=>Date.parse('2026-12-02T12:00:00Z'),loadPayment:async()=>({payForRecovery:async()=>{paid++;}}),fetchImpl:async(url,options)=>{calls.push({action:new URL(url,'https://tree-token.xyz').searchParams.get('action'),body:options.body&&JSON.parse(options.body)});return new Response(JSON.stringify({status:'ok',progress}),{status:200});}});
 try{await wait();const d=p.w.document;
  assert.match(d.querySelector('#monthly-recovery-deadline').textContent,/expired for new payments/);
  assert.equal(d.querySelector('#monthly-retry').hidden,false);assert.equal(d.querySelector('#monthly-retry').disabled,false);assert.equal(d.querySelector('#monthly-pay').disabled,true);
  d.querySelector('#monthly-digest').value=digest;d.querySelector('#monthly-retry').click();await wait();
  assert.deepEqual(calls.filter(x=>x.action!=='status'),[{action:'verify',body:{intentId:pending.intentId,digest}}]);assert.equal(paid,0);assert.equal(p.w.sessionStorage.getItem('tree-arcade:recovery:pending:v1'),null);
 }finally{app.destroy();p.w.close();}
});
test('expiry refresh preserves a digest the player has pasted',async()=>{
 const p=page(pending);let now=Date.parse('2026-11-30T23:59:50Z'),onExpiry;
 p.w.setTimeout=callback=>{onExpiry=callback;return 1;};p.w.clearTimeout=()=>{};
 const app=createMonthlyPanel({...p,now:()=>now,fetchImpl:async()=>new Response(JSON.stringify({status:'ok',progress}),{status:200})});
 try{await wait();const d=p.w.document;assert.match(d.querySelector('#monthly-recovery-deadline').textContent,/Dec 1, 2026, 00:00:00 UTC/);
  d.querySelector('#monthly-digest').value=digest;now=Date.parse(pending.expiresAt);onExpiry();
  assert.equal(d.querySelector('#monthly-digest').value,digest);assert.match(d.querySelector('#monthly-recovery-deadline').textContent,/expired/);assert.equal(d.querySelector('#monthly-retry').disabled,false);
 }finally{app.destroy();p.w.close();}
});
test('a checkout that expires while the payment module loads never opens the wallet payment',async()=>{
 const p=page();let now=Date.parse('2026-11-30T23:59:59Z'),paid=0;
 const currentProgress={...progress,monthKey:'2026-11',attendance:{...progress.attendance,missedDates:['2026-11-29']}};
 const app=createMonthlyPanel({...p,now:()=>now,loadPayment:async()=>{now=Date.parse(pending.expiresAt);return {payForRecovery:async()=>{paid++;}};},fetchImpl:async(url)=>new Response(JSON.stringify(new URL(url,'https://tree-token.xyz').searchParams.get('action')==='intent'?{status:'ok',intent:{...pending,id:pending.intentId}}:{status:'ok',progress:currentProgress}),{status:200})});
 try{await wait();p.w.document.querySelector('#monthly-pay').click();await wait();
  assert.equal(paid,0);assert.match(p.w.document.querySelector('#monthly-status').textContent,/expired.*No new wallet payment was requested/);assert.equal(JSON.parse(p.w.sessionStorage.getItem('tree-arcade:recovery:pending:v1')).intentId,pending.intentId);
 }finally{app.destroy();p.w.close();}
});
