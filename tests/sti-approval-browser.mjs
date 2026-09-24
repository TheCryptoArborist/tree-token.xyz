import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STI,SUI,POOL} from '../dapp/sti-purchase-core.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=new URL(process.env.STI_PREVIEW_URL).origin;
const output=process.env.STI_QA_OUTPUT||'sti-approval-qa';fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(new URL('../dapp/index.html',import.meta.url),'utf8');
const section=html.match(/<section class="data-group stats-sti"[\s\S]*?<\/section>/)[0];
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,390,320]) {
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.STI_DEBUG==='1'){page.on('console',m=>console.log(m.type(),m.text()));page.on('requestfailed',r=>console.log('requestfailed',r.url(),r.failure()));}
  await page.route('https://**/*',route=>route.abort());
  await page.route('**/@mysten/wallet-standard@*',route=>route.fulfill({contentType:'text/javascript',body:`
    const account={address:'0x'+'1'.repeat(64),chains:['sui:mainnet'],features:['sui:signAndExecuteTransaction'],publicKey:new Uint8Array(32)};
    const wallet={name:'Test Sui Wallet',id:'test-sui',version:'1.0.0',accounts:[],features:{
      'standard:connect':{connect:async()=>{wallet.accounts=[account];return {accounts:wallet.accounts};}},
      'standard:disconnect':{disconnect:async()=>{wallet.accounts=[];}},
      'sui:signAndExecuteTransaction':{version:'2.0.0'}}};
    export const getWallets=()=>({get:()=>[wallet],on:()=>()=>{}});
    export const signAndExecuteTransaction=()=>{window.testSignCalls=(window.testSignCalls||0)+1;window.testUserActivation=navigator.userActivation.isActive;throw Error('User rejected test purchase');};
  `}));
  await page.route('**/@mysten/slush-wallet@*',route=>route.fulfill({contentType:'text/javascript',body:'export const registerSlushWallet=()=>{};'}));
  await page.route('**/@mysten/sui@*/utils',route=>route.fulfill({contentType:'text/javascript',body:'export const fromBase64=()=>{};export const toBase64=()=>{};'}));
  await page.route('**/@mysten/sui@*/transactions',route=>route.fulfill({contentType:'text/javascript',body:`
    export class Transaction {constructor(){this.gas={};this.pure={u64:x=>x,u128:x=>x,bool:x=>x};}setSender(){}setGasBudget(){}moveCall(){return {};}object(){return {};}splitCoins(){return [{}];}async build(){return new Uint8Array([1,2,3]);}static from(bytes){return {bytes};}}
  `}));
  await page.route('**/@mysten/sui@*/grpc',route=>route.fulfill({contentType:'text/javascript',body:`
    export class SuiGrpcClient {core={getChainIdentifier:async()=>({chainIdentifier:'4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S'}),getCoinMetadata:async()=>({coinMetadata:{decimals:9,symbol:'STI'}}),getBalance:async()=>({balance:{balance:'10000000000'}}),simulateTransaction:async()=>{
      await new Promise(resolve=>setTimeout(resolve,6000));
      return {Transaction:{effects:{status:{success:true}},balanceChanges:[{address:'0x'+'1'.repeat(64),coinType:'${STI}',amount:'6007891535512'},{address:'0x'+'1'.repeat(64),coinType:'${SUI}',amount:'-101463516'}]}};
    }};}
  `}));
  await page.route('**/@cetusprotocol/sui-clmm-sdk@*',route=>route.fulfill({contentType:'text/javascript',body:`
    export const CetusClmmSDK={createSDK:()=>({Pool:{getPool:async()=>({id:'${POOL}',coin_type_a:'${STI}',coin_type_b:'${SUI}',fee_rate:'2500',pool_status:{disable_swap:false},liquidity:'19616957339841',current_sqrt_price:'75118023302009553'})},Swap:{preSwap:async({amount})=>({pool_address:'${POOL}',estimated_amount_in:amount,estimated_amount_out:'6007891535512',estimated_fee_amount:'250000',is_exceed:false,amount,a2b:false,by_amount_in:true})}})};
  `}));
  await page.route('**/dapp/sti-approval-test.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/dapp/styles.css"><link rel="stylesheet" href="/dapp/wallet-manager.css"></head><body><main style="max-width:700px;margin:auto;padding:12px"><div id="stats">${section}</div></main><script type="module" src="/scripts/wallet.js"></script></body></html>`}));
  await page.goto(origin+'/dapp/sti-approval-test.html');
  await page.waitForFunction(()=>typeof window.getWalletConnectionState==='function');
  // Reproduce the misleading cached/public address without an internal session.
  await page.evaluate(()=>{window.playerAddress='0x'+'1'.repeat(64);});
  await page.locator('#stiOpenBuy').click();
  assert.equal(await page.locator('#stiBuyButton').textContent(),'Connect wallet');
  await page.locator('#stiWalletButton').click();await page.locator('#treeWalletDialog[open]').waitFor();
  await page.screenshot({path:`${output}/${width}-picker.png`,fullPage:true});
  await page.getByRole('button',{name:/Test Sui Wallet/}).click();
  await page.waitForFunction(()=>document.getElementById('stiWalletButton').textContent.includes('Manage'));
  assert.equal(await page.evaluate(()=>window.getWalletConnectionState().connected),true);
  await page.locator('#stiAmount').fill('0.1');await page.locator('#stiQuoteButton').click();
  await page.locator('#stiBuyButton').filter({hasText:'Review purchase'}).waitFor();
  await page.locator('#stiBuyButton').click();
  await page.waitForFunction(()=>document.getElementById('stiBuyButton').textContent==='Approve purchase in wallet');
  assert.equal(await page.evaluate(()=>window.testSignCalls||0),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#stiPurchase').screenshot({path:`${output}/${width}-ready.png`});
  await page.locator('#stiBuyButton').click();
  await page.waitForFunction(()=>document.getElementById('stiPurchaseStatus').textContent.includes('cancelled'));
  assert.equal(await page.evaluate(()=>window.testSignCalls),1);
  assert.equal(await page.evaluate(()=>window.testUserActivation),true,'Fresh user activation reaches wallet after slow preparation');
  assert.equal(await page.locator('#stiQuoteDetails').isVisible(),false);
  await page.locator('#stiPurchase').screenshot({path:`${output}/${width}-rejection.png`});
  await page.locator('#stiWalletButton').click();await page.getByRole('button',{name:/Disconnect.*forget/i}).click();
  await page.waitForFunction(()=>!window.getWalletConnectionState().connected);
  assert.deepEqual(errors,[]);console.log(`STI approval browser ${width}px passed: explicit connection, slow preparation, fresh approval gesture, rejection, disconnect. No real transaction.`);
  await context.close();
 }
}finally{await browser.close();}
