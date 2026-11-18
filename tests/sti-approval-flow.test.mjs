import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as core from '../production/sti-purchase-static/sti-purchase-core.js';
import * as stats from '../dapp/sti-stats-core.js';

// Run the actual widget event handlers with deterministic RPC/wallet boundaries.
// Only SDK loading is replaced. No keys, signing, or external RPC are involved.
const source=readFileSync(new URL('../production/sti-purchase-static/sti-widget.js',import.meta.url),'utf8')
  .replace(/^import .*\n/gm,'')
  .replace(/async function runtime\(\) \{[\s\S]*?\nfunction invalidate/, 'async function runtime(){return testRuntime;}\nfunction invalidate');
const address='0x'+'1'.repeat(64);
function setup({connected=true,impactBps=25n,amount='0.1'}={}) {
  const elements=new Map(),events=new Map(),timers=[],intervals=[],transactions=[];
  class Element {
    constructor(id){this.id=id;this.hidden=['stiPurchase','stiQuoteDetails','stiImpactWarning','stiReceipt','stats'].includes(id);this.value=amount;this.checked=false;this.disabled=false;this.textContent='';this.dataset={};this.handlers={};}
    addEventListener(name,callback){this.handlers[name]=callback;}
    setAttribute(){} focus(){} replaceChildren(){} append(){}
  }
  const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  let time=Date.now(),signCalls=0,poolCalls=0,simulateCalls=0,pickerCalls=0,inClick=false;
  let walletResult=()=>{throw Error('User rejected purchase');},balance='10000000000',simulateSuccess=true;
  let connectionAddress=address,lastQuote=null,simulationBarrier=null;
  const window={playerAddress:address,currentWallet:{name:'Test Wallet'},currentAccount:{address},
    getWalletConnectionState:()=>({connected,address:connected?connectionAddress:null,name:'Test Wallet'}),
    openWalletManager:async()=>{pickerCalls++;return {action:'cancel'};},
    signAndExecuteTransactionBlock:tx=>{signCalls++;assert.ok(inClick,'wallet called synchronously inside final click');assert.deepEqual([...tx.bytes],[1,2,3]);return walletResult();},
    addEventListener:(name,callback)=>events.set(name,callback)};
  class Transaction {
    constructor(){this.gas={};this.calls=[];this.pure={u64:x=>x,u128:x=>x,bool:x=>x};transactions.push(this);}
    setSender(value){this.sender=value;}setGasBudget(){}moveCall(call){this.calls.push(call);return {};}object(){return {};}splitCoins(){return [{}];}
    async build(){return new Uint8Array([1,2,3]);}
    static from(bytes){return {bytes};}
  }
  // A synthetic unit-price pool makes requested basis-point impacts exact.
  // Quote and simulation outputs follow the amount; no live RPC is called.
  const pool={id:core.POOL,coin_type_a:core.STI,coin_type_b:core.SUI,fee_rate:'2500',pool_status:{disable_swap:false},liquidity:'19616957339841',current_sqrt_price:(1n<<64n).toString()};
  const client={core:{getBalance:async()=>({balance:{balance}}),simulateTransaction:async()=>{
    simulateCalls++;
    if(simulationBarrier){simulationBarrier.started();await simulationBarrier.wait;}
    const sender=transactions.at(-1).sender;
    return {Transaction:{effects:{status:{success:simulateSuccess}},balanceChanges:[{address:sender,coinType:core.STI,amount:lastQuote.out.toString()},{address:sender,coinType:core.SUI,amount:String(-lastQuote.amount-1463516n)}]}};
  },waitForTransaction:async()=>{throw Error('Confirmation pending');}}};
  const context={...core,...stats,validateQuote:(q,a)=>core.validateQuote(q,a,time),buildPurchase:(T,a,q,_now,acceptedQuote)=>core.buildPurchase(T,a,q,time,acceptedQuote),window,document:{hidden:true,getElementById:el,addEventListener(){}},location:{hostname:'localhost'},
    MutationObserver:class{observe(){}},Date:class extends Date{static now(){return time;}},
    setInterval:(fn,delay)=>{intervals.push({fn,delay});},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    testRuntime:{Transaction,client,sdk:{Pool:{getPool:async()=>{poolCalls++;return pool;}},Swap:{preSwap:async({amount})=>{
      const input=BigInt(amount),out=input*(10000n-impactBps)/10000n;
      lastQuote={amount:input,out};
      return {pool_address:core.POOL,estimated_amount_in:amount,estimated_amount_out:out.toString(),estimated_fee_amount:String(input*25n/10000n),is_exceed:false,amount,a2b:false,by_amount_in:true};
    }}}}};
  vm.runInNewContext(source,context);
  const click=async id=>{inClick=true;let result;try{result=el(id).handlers.click();}finally{inClick=false;}await result;};
  const getQuote=async()=>{await click('stiOpenBuy');await click('stiQuoteButton');};
  const review=async()=>{await getQuote();await click('stiBuyButton');};
  const accept=async checked=>{el('stiImpactAccept').checked=checked;await el('stiImpactAccept').handlers.change();};
  const input=async value=>{el('stiAmount').value=value;await el('stiAmount').handlers.input();};
  const reviewAccepted=async()=>{await getQuote();await accept(true);await click('stiBuyButton');};
  return {el,window,click,getQuote,review,reviewAccepted,accept,input,events,timers,transactions,counts:()=>({signCalls,poolCalls,simulateCalls,pickerCalls}),
    impact:value=>{impactBps=value;},connect:value=>{connected=value;},
    wallet:value=>{connectionAddress=value;window.currentAccount={address:value};window.currentWallet={name:'Changed Wallet'};events.get('tree:wallet-changed')();},
    tick:ms=>{time+=ms;for(const {fn,delay} of intervals)if(delay===1000)fn();},
    pauseSimulation:()=>{let started,release;const startedPromise=new Promise(resolve=>{started=resolve;});const wait=new Promise(resolve=>{release=resolve;});simulationBarrier={started,wait};return {started:startedPromise,release};},
    result:fn=>{walletResult=fn;},badSimulation:()=>{simulateSuccess=false;},lowBalance:()=>{balance='1';}};
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
test('quotes above 3% through 5% remain visible but cannot simulate or sign without acknowledgment',async()=>{
  for(const impactBps of [301n,350n,500n]){
    const s=setup({impactBps,amount:'2'});await s.getQuote();
    assert.equal(s.el('stiQuoteDetails').hidden,false);assert.equal(s.el('stiImpactWarning').hidden,false);
    assert.equal(s.el('stiImpact').textContent,(Number(impactBps)/100).toFixed(2)+'%');
    assert.equal(s.el('stiImpactAccept').checked,false);assert.equal(s.el('stiBuyButton').disabled,true);
    assert.deepEqual(s.counts(),{signCalls:0,poolCalls:1,simulateCalls:0,pickerCalls:0});
    // Invoke the handler directly as well: disabling the control is not the guard.
    await s.click('stiBuyButton');
    assert.equal(s.counts().simulateCalls,0);assert.equal(s.counts().signCalls,0);
    assert.match(s.el('stiPurchaseStatus').textContent,/Review and accept.*this quote/);
  }
});
test('exactly 3% needs no acknowledgment while an accepted 3.50% quote keeps 1% slippage',async()=>{
  const defaultLimit=setup({impactBps:300n,amount:'2'});await defaultLimit.review();
  assert.equal(defaultLimit.el('stiImpactWarning').hidden,true);
  assert.equal(defaultLimit.el('stiImpactAccept').checked,false);
  assert.equal(defaultLimit.el('stiBuyButton').textContent,'Approve purchase in wallet');
  assert.equal(defaultLimit.counts().simulateCalls,1);assert.equal(defaultLimit.counts().signCalls,0);

  const s=setup({impactBps:350n,amount:'2'});await s.getQuote();
  assert.equal(s.el('stiEstimated').textContent,'1.93');assert.equal(s.el('stiMinimum').textContent,'1.9107');
  assert.match(s.el('stiImpactExplanation').textContent,/3\.50%.*Slippage remains 1%/);
  assert.equal(s.el('stiImpactAcceptanceText').textContent,'I accept 3.50% price impact for this quote.');
  await s.accept(true);
  assert.equal(s.el('stiBuyButton').disabled,false);assert.equal(s.counts().simulateCalls,0);assert.equal(s.counts().signCalls,0);
  await s.click('stiBuyButton');
  assert.equal(s.counts().simulateCalls,1);assert.equal(s.counts().signCalls,0);
  assert.equal(s.el('stiBuyButton').textContent,'Approve purchase in wallet');
  const call=s.transactions.at(-1).calls[1];
  assert.equal(call.arguments[5],2000000000n);assert.equal(call.arguments[6],1910700000n);
  await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,1);assert.equal(s.counts().poolCalls,1);
  assert.match(s.el('stiPurchaseStatus').textContent,/cancelled/);
  assert.equal(s.el('stiImpactAccept').checked,false);
});
test('same-amount refreshes and different quotes cannot inherit acknowledgment or prepared approval',async()=>{
  for(const nextImpact of [350n,400n]){
    const s=setup({impactBps:350n,amount:'2'});await s.reviewAccepted();
    assert.equal(s.el('stiBuyButton').textContent,'Approve purchase in wallet');
    s.impact(nextImpact);await s.click('stiQuoteButton');
    assert.equal(s.el('stiAmount').value,'2');assert.equal(s.el('stiQuoteDetails').hidden,false);
    assert.equal(s.el('stiImpactAccept').checked,false);assert.equal(s.el('stiBuyButton').disabled,true);
    assert.equal(s.el('stiBuyButton').textContent,'Review purchase');
    assert.equal(s.counts().simulateCalls,1);assert.equal(s.counts().signCalls,0);
    // A checkbox property alone does not acknowledge the new quote identity.
    s.el('stiImpactAccept').checked=true;await s.click('stiBuyButton');
    assert.equal(s.counts().simulateCalls,1);assert.equal(s.counts().signCalls,0);
    assert.match(s.el('stiPurchaseStatus').textContent,/Review and accept/);
  }
});
test('amount edits, wallet changes and closing the panel reset high-impact acknowledgment',async()=>{
  for(const action of ['amount','wallet','close']){
    const s=setup({impactBps:350n,amount:'2'});await s.reviewAccepted();
    if(action==='amount')await s.input('1');
    else if(action==='wallet')s.wallet('0x'+'2'.repeat(64));
    else await s.click('stiCloseBuy');
    assert.equal(s.el('stiImpactAccept').checked,false,action);
    assert.equal(s.el('stiImpactWarning').hidden,true,action);
    assert.equal(s.el('stiQuoteDetails').hidden,true,action);
    assert.equal(s.el('stiBuyButton').disabled,true,action);
    await s.getQuote();
    assert.equal(s.el('stiQuoteDetails').hidden,false,action);
    assert.equal(s.el('stiImpactAccept').checked,false,action);
    assert.equal(s.el('stiBuyButton').disabled,true,action);
    await s.click('stiBuyButton');
    assert.equal(s.counts().signCalls,0,action);assert.equal(s.counts().simulateCalls,1,action);
  }
});
test('expiry clears high-impact acknowledgment and a fresh quote requires new consent',async()=>{
  const s=setup({impactBps:350n,amount:'2'});await s.reviewAccepted();s.tick(30000);
  assert.equal(s.el('stiImpactAccept').checked,false);assert.equal(s.el('stiImpactAccept').disabled,true);
  assert.equal(s.el('stiBuyButton').disabled,true);assert.match(s.el('stiExpiry').textContent,/Expired/);
  await s.accept(true);await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.equal(s.counts().simulateCalls,1);
  await s.getQuote();
  assert.equal(s.el('stiImpactAccept').checked,false);assert.equal(s.el('stiBuyButton').disabled,true);
  await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.equal(s.counts().simulateCalls,1);
});
test('revoking acknowledgment discards preparation and reaccepting requires another review',async()=>{
  const s=setup({impactBps:350n,amount:'2'});await s.reviewAccepted();await s.accept(false);
  assert.equal(s.el('stiBuyButton').textContent,'Review purchase');assert.equal(s.el('stiBuyButton').disabled,true);
  assert.equal(s.counts().signCalls,0);
  await s.accept(true);
  assert.equal(s.el('stiBuyButton').textContent,'Review purchase');assert.equal(s.el('stiBuyButton').disabled,false);
  await s.click('stiBuyButton');
  assert.equal(s.counts().simulateCalls,2);assert.equal(s.counts().signCalls,0);
  assert.equal(s.el('stiBuyButton').textContent,'Approve purchase in wallet');
  await s.click('stiBuyButton');assert.equal(s.counts().signCalls,1);
});
test('final approval rechecks the actual checkbox even if no change event fired',async()=>{
  const s=setup({impactBps:350n,amount:'2'});await s.reviewAccepted();s.el('stiImpactAccept').checked=false;
  await s.click('stiBuyButton');
  assert.equal(s.counts().signCalls,0);assert.equal(s.counts().simulateCalls,1);
  assert.match(s.el('stiPurchaseStatus').textContent,/Accept.*before approval/);
});
test('revocation during simulation cannot prepare a later wallet approval',async()=>{
  const s=setup({impactBps:350n,amount:'2'});await s.getQuote();await s.accept(true);
  const barrier=s.pauseSimulation(),review=s.click('stiBuyButton');await barrier.started;
  await s.accept(false);barrier.release();await review;
  assert.equal(s.counts().simulateCalls,1);assert.equal(s.counts().signCalls,0);
  assert.equal(s.el('stiImpactAccept').checked,false);assert.equal(s.el('stiBuyButton').disabled,true);
  assert.match(s.el('stiPurchaseStatus').textContent,/Review and accept/);
});
test('quotes above 5% expose no reviewable quote and cannot simulate or request a wallet',async()=>{
  for(const impactBps of [501n,600n]){
    const s=setup({impactBps,amount:'2'});await s.getQuote();
    assert.equal(s.el('stiQuoteDetails').hidden,true);assert.equal(s.el('stiImpactWarning').hidden,true);
    assert.equal(s.el('stiBuyButton').disabled,true);assert.equal(s.el('stiImpactAccept').checked,false);
    assert.match(s.el('stiPurchaseStatus').textContent,/above the 5% maximum.*No purchase was submitted/);
    await s.accept(true);await s.click('stiBuyButton');
    assert.equal(s.counts().simulateCalls,0);assert.equal(s.counts().signCalls,0);
  }
});
