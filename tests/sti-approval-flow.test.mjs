import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as core from '../dapp/sti-purchase-core.js';
import * as stats from '../dapp/sti-stats-core.js';

// Run the actual widget event handlers with deterministic RPC/wallet boundaries.
// Only SDK loading is replaced. No keys, signing, or external RPC are involved.
const source=readFileSync(new URL('../dapp/sti-widget.js',import.meta.url),'utf8')
  .replace(/^import .*\n/gm,'')
  .replace(/async function runtime\(\) \{[\s\S]*?\nfunction invalidate/, 'async function runtime(){return testRuntime;}\nfunction invalidate');
const address='0x'+'1'.repeat(64);
function setup({connected=true}={}) {
  const elements=new Map(),events=new Map(),timers=[];
  class Element {
    constructor(id){this.id=id;this.hidden=['stiPurchase','stiQuoteDetails','stiReceipt','stats'].includes(id);this.value='0.1';this.textContent='';this.dataset={};this.handlers={};}
    addEventListener(name,callback){this.handlers[name]=callback;}
    setAttribute(){} focus(){} replaceChildren(){} append(){}
  }
  const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  let time=Date.now(),signCalls=0,poolCalls=0,simulateCalls=0,pickerCalls=0,inClick=false;
  let walletResult=()=>{throw Error('User rejected purchase');},balance='10000000000',simulateSuccess=true;
  const window={playerAddress:address,currentWallet:{name:'Test Wallet'},currentAccount:{address},
    getWalletConnectionState:()=>({connected,address:connected?address:null,name:'Test Wallet'}),
    openWalletManager:async()=>{pickerCalls++;return {action:'cancel'};},
    signAndExecuteTransactionBlock:tx=>{signCalls++;assert.ok(inClick,'wallet called synchronously inside final click');assert.deepEqual([...tx.bytes],[1,2,3]);return walletResult();},
    addEventListener:(name,callback)=>events.set(name,callback)};
  class Transaction {
    constructor(){this.gas={};this.pure={u64:x=>x,u128:x=>x,bool:x=>x};}
    setSender(){}setGasBudget(){}moveCall(){return {};}object(){return {};}splitCoins(){return [{}];}
    async build(){return new Uint8Array([1,2,3]);}
    static from(bytes){return {bytes};}
  }
  const pool={id:core.POOL,coin_type_a:core.STI,coin_type_b:core.SUI,fee_rate:'2500',pool_status:{disable_swap:false},liquidity:'19616957339841',current_sqrt_price:'75118023302009553'};
  const client={core:{getBalance:async()=>({balance:{balance}}),simulateTransaction:async()=>{
    simulateCalls++;return {Transaction:{effects:{status:{success:simulateSuccess}},balanceChanges:[{address,coinType:core.STI,amount:'6007891535512'},{address,coinType:core.SUI,amount:'-101463516'}]}};
  },waitForTransaction:async()=>{throw Error('Confirmation pending');}}};
  const context={...core,...stats,validateQuote:(q,a)=>core.validateQuote(q,a,time),buildPurchase:(T,a,q)=>core.buildPurchase(T,a,q,time),window,document:{hidden:true,getElementById:el,addEventListener(){}},location:{hostname:'localhost'},
    MutationObserver:class{observe(){}},Date:class extends Date{static now(){return time;}},
    setInterval(){},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    testRuntime:{Transaction,client,sdk:{Pool:{getPool:async()=>{poolCalls++;return pool;}},Swap:{preSwap:async({amount})=>({pool_address:core.POOL,estimated_amount_in:amount,estimated_amount_out:'6007891535512',estimated_fee_amount:'250000',is_exceed:false,amount,a2b:false,by_amount_in:true})}}}};
  vm.runInNewContext(source,context);
  const click=async id=>{inClick=true;let result;try{result=el(id).handlers.click();}finally{inClick=false;}await result;};
  const getQuote=async()=>{await click('stiOpenBuy');await click('stiQuoteButton');};
  const review=async()=>{await getQuote();await click('stiBuyButton');};
  return {el,window,click,getQuote,review,events,timers,counts:()=>({signCalls,poolCalls,simulateCalls,pickerCalls}),
    connect:value=>{connected=value;},tick:ms=>{time+=ms;},result:fn=>{walletResult=fn;},badSimulation:()=>{simulateSuccess=false;},lowBalance:()=>{balance='1';}};
}
test('cached address without signer offers connection, not approval',async()=>{
  const s=setup({connected:false});await s.getQuote();
  assert.equal(s.el('stiBuyButton').textContent,'Connect wallet');
  await s.click('stiBuyButton');assert.equal(s.counts().pickerCalls,1);assert.equal(s.counts().signCalls,0);
  assert.match(s.el('stiPurchaseStatus').textContent,/selection closed/);
});
test('missing and failing wallet manager show actionable errors',async()=>{
  const s=setup({connected:false});delete s.window.openWalletManager;await s.click('stiWalletButton');
  assert.match(s.el('stiPurchaseStatus').textContent,/unavailable/);
  s.window.openWalletManager=async()=>{throw Error('Connection popup closed');};await s.click('stiWalletButton');
  assert.match(s.el('stiPurchaseStatus').textContent,/Connection popup closed/);
});
test('review only simulates; final approval calls wallet directly and reports rejection without re-quote',async()=>{
  const s=setup();await s.review();
  assert.deepEqual(s.counts(),{signCalls:0,poolCalls:1,simulateCalls:1,pickerCalls:0});
  assert.equal(s.el('stiBuyButton').textContent,'Approve purchase in wallet');
  await s.click('stiBuyButton');assert.equal(s.counts().signCalls,1);assert.equal(s.counts().poolCalls,1);
  assert.match(s.el('stiPurchaseStatus').textContent,/cancelled.*reconnect/);assert.equal(s.el('stiQuoteDetails').hidden,true);
});
test('expired prepared quote cannot reach the wallet or renew its timer',async()=>{
  const s=setup();await s.review();s.tick(31000);await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.match(s.el('stiPurchaseStatus').textContent,/expired/);assert.equal(s.counts().poolCalls,1);
});
test('account replacement invalidates the prepared transaction',async()=>{
  const s=setup();await s.review();s.window.currentAccount={address:'0x'+'2'.repeat(64)};await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.match(s.el('stiPurchaseStatus').textContent,/changed/);
});
test('disconnect during prepared state returns to connection',async()=>{
  const s=setup();await s.review();s.connect(false);s.events.get('tree:wallet-changed')();await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.equal(s.counts().pickerCalls,1);
});
test('amount edit and close discard the prepared transaction',async()=>{
  const s=setup();await s.review();s.el('stiAmount').value='0.2';s.el('stiAmount').handlers.input();await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.match(s.el('stiPurchaseStatus').textContent,/expired or changed/);
  s.el('stiAmount').value='0.1';await s.review();await s.click('stiCloseBuy');await s.click('stiBuyButton');assert.equal(s.counts().signCalls,0);
});
test('failed simulation and insufficient gas reserve cannot request approval',async()=>{
  for(const fail of ['badSimulation','lowBalance']){const s=setup();s[fail]();await s.review();assert.equal(s.counts().signCalls,0);assert.equal(s.el('stiPurchaseStatus').dataset.error,'true');}
});
test('wallet with no transaction ID reports uncertainty rather than success',async()=>{
  const s=setup();await s.review();s.result(()=>({}));await s.click('stiBuyButton');
  assert.match(s.el('stiPurchaseStatus').textContent,/No transaction ID.*Check your wallet activity/);assert.equal(s.counts().poolCalls,1);
});
test('pending wallet blocks duplicate approval and preserves a visible waiting message',async()=>{
  const s=setup();await s.review();let release;s.result(()=>new Promise(resolve=>{release=resolve;}));
  const signing=s.click('stiBuyButton');await s.click('stiBuyButton');s.timers.at(-1)();
  assert.equal(s.counts().signCalls,1);assert.equal(s.el('stiWalletButton').disabled,true);assert.match(s.el('stiPurchaseStatus').textContent,/Still waiting/);
  release({});await signing;
});
test('submitted transaction only offers confirmation, never an automatic second purchase',async()=>{
  const s=setup();await s.review();s.result(()=>({digest:'test-digest'}));await s.click('stiBuyButton');
  assert.equal(s.el('stiBuyButton').textContent,'Check confirmation');assert.equal(s.el('stiWalletButton').disabled,true);
  s.connect(false);await s.click('stiBuyButton');assert.equal(s.counts().signCalls,1);assert.match(s.el('stiPurchaseStatus').textContent,/confirmation is pending/);
});
