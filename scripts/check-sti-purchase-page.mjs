// Isolated CI browser checks. Synthetic quotes and a rejecting test wallet only;
// this never connects to the managed browser or sends a blockchain transaction.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STI, SUI, POOL } from '../production/sti-purchase-static/sti-purchase-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = {
  'dapp/index.html': 'index.html',
  'dapp/sti-widget.js': 'sti-widget.js',
  'dapp/sti-purchase-core.js': 'sti-purchase-core.js',
  'dapp/sti-purchase.css': 'sti-purchase.css',
};
if (process.argv[2] === '--prepare-static') {
  const destination = path.resolve(process.argv[3] || '');
  assert(process.argv[3] && destination !== root && !destination.startsWith(root + path.sep), 'Use a separate temporary directory.');
  execFileSync(process.execPath, ['scripts/check-stats-market-page.mjs', '--prepare-static', destination], { cwd: root, stdio: 'inherit' });
  for (const [publicPath, source] of Object.entries(sources)) {
    await fs.copyFile(path.join(root, 'production/sti-purchase-static', source), path.join(destination, publicPath));
  }
  console.log('Prepared current Stats page with the four STI purchase overlays.');
  process.exit(0);
}

const baseURL = new URL(process.env.STI_PURCHASE_TEST_BASE || 'http://127.0.0.1:8766').origin;
const targetURL = new URL('/dapp/#stats', baseURL).href;
const output = path.join(root, '.netlify');
const widths = [320, 390, 768, 1363];
const badge = JSON.parse(await fs.readFile(path.join(root, 'tests/fixtures/sti-badge.json'), 'utf8'));
const price = JSON.parse(await fs.readFile(path.join(root, 'tests/fixtures/sti-price.json'), 'utf8'));
const address = '0x' + '1'.repeat(64);
const report = {
  baseURL, targetURL,
  sourceCommit: process.env.STI_PURCHASE_SOURCE_COMMIT || process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || null,
  candidateId: process.env.STI_PURCHASE_CANDIDATE_ID || null,
  source: 'scripts/check-sti-purchase-page.mjs', startedAt: new Date().toISOString(), testOnly: true,
  networkPolicy: 'Only first-party static GET/HEAD requests are sent. All APIs, SDK calls and wallet operations use CI fixtures. The test wallet always rejects approval; no transaction is signed or submitted.',
  limitations: ['Actual Slush approval and on-chain execution require the user; live provider availability is checked separately.'],
  results: [],
};
await fs.mkdir(output, { recursive: true });

function sdkFixture(url) {
  if (url === 'https://esm.run/@mysten/wallet-standard@0.21.14') return `
    const account={address:'${address}',chains:['sui:mainnet'],features:['sui:signAndExecuteTransaction'],publicKey:new Uint8Array(32)};
    const wallet={name:'Test Sui Wallet',id:'sti-test-wallet',version:'1.0.0',accounts:[],features:{
      'standard:connect':{connect:async()=>{wallet.accounts=[account];return {accounts:wallet.accounts};}},
      'standard:disconnect':{disconnect:async()=>{wallet.accounts=[];}},
      'sui:signAndExecuteTransaction':{version:'2.0.0'}}};
    export const getWallets=()=>({get:()=>[wallet],on:()=>()=>{}});
    export const signAndExecuteTransaction=()=>{
      window.__testSignCalls=(window.__testSignCalls||0)+1;
      window.__testUserActivation=navigator.userActivation.isActive;
      throw Error('User rejected CI test purchase');
    };
  `;
  if (url === 'https://esm.run/@mysten/slush-wallet@1.1.14') return 'export const registerSlushWallet=()=>{};';
  if (url === 'https://esm.run/@mysten/sui@2.23.1/utils') return `
    export const fromBase64=v=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
    export const toBase64=v=>btoa(Array.from(v,b=>String.fromCharCode(b)).join(''));
  `;
  if (url === 'https://esm.run/@mysten/sui@2.23.1/transactions') return `
    export class Transaction {
      constructor(){this.gas={};this.pure={u64:x=>x,u128:x=>x,bool:x=>x};}
      setSender(x){this.owner=x;}setGasBudget(){}object(id){return {id};}splitCoins(){return [{}];}
      moveCall(call){if(call.target.endsWith('::swap_b2a'))this.swap=call;return {};}
      async build(){
        const value={owner:this.owner,amount:String(this.swap.arguments[5]),minOut:String(this.swap.arguments[6])};
        window.__testBuiltPurchase=value;
        return new TextEncoder().encode(JSON.stringify(value));
      }
      static from(bytes){return {bytes};}
    }
  `;
  if (url === 'https://esm.run/@mysten/sui@2.23.1/grpc') return `
    export class SuiGrpcClient {
      core={
        getChainIdentifier:async()=>({chainIdentifier:'4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S'}),
        getCoinMetadata:async()=>({coinMetadata:{decimals:9,symbol:'STI'}}),
        getBalance:async()=>({balance:{balance:'10000000000'}}),
        listCoins:async()=>({objects:[],hasNextPage:false,nextCursor:null}),
        simulateTransaction:async({transaction})=>{
          window.__testSimulations=(window.__testSimulations||0)+1;
          const value=JSON.parse(new TextDecoder().decode(transaction));
          return {Transaction:{effects:{status:{success:true}},balanceChanges:[
            {address:value.owner,coinType:'${STI}',amount:value.minOut},
            {address:value.owner,coinType:'${SUI}',amount:String(-BigInt(value.amount)-1463516n)}
          ]}};
        },
        executeTransaction:async()=>{throw Error('CI: real execution is disabled');},
        waitForTransaction:async()=>{throw Error('CI: confirmation is disabled');},
      };
    }
  `;
  if (url === 'https://esm.run/@mysten/sui@2.23.1/bcs') return 'export const bcs={u64:()=>({parse:()=>0n})};';
  if (url === 'https://esm.run/@cetusprotocol/sui-clmm-sdk@1.4.7') return `
    export const CetusClmmSDK={createSDK:()=>({
      Pool:{getPool:async()=>({id:'${POOL}',coin_type_a:'${STI}',coin_type_b:'${SUI}',fee_rate:'2500',
        pool_status:{disable_swap:false},liquidity:'24230343470405',current_sqrt_price:'45139874400909872'})},
      Swap:{preSwap:async({amount})=>{
        const outputs={'100000000':'16630359647625','1000000000':'163827250354404','2000000000':'322321683251131'};
        const spot=BigInt(amount)*(1n<<128n)/(45139874400909872n**2n);
        return {pool_address:'${POOL}',estimated_amount_in:amount,estimated_amount_out:outputs[amount]||String(spot*9400n/10000n),
          estimated_fee_amount:String(BigInt(amount)*25n/10000n),is_exceed:false,amount,a2b:false,by_amount_in:true};
      }}
    })};
  `;
}

async function configureNetwork(context, result) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.origin === baseURL && url.pathname.startsWith('/api/')) {
      result.apiRequests.push({ method: request.method(), path: url.pathname });
      if (!['GET', 'HEAD'].includes(request.method())) {
        result.unexpectedMutations.push(request.method() + ' ' + url.pathname);
        return json({ status: 'error', testOnly: true });
      }
      if (url.pathname === '/api/tree-dashboard') return json({testOnly:true,generatedAt:new Date().toISOString(),warnings:[],live:{status:'ok',source:'Noodles.fi',verifiedAt:new Date().toISOString(),data:{price:0.00002,priceChange24h:1.5,holderCount:606,marketCap:20000}},snapshot:{tree:{totalSupply:1e9,zeroAddressBalance:6e7,effectiveSupply:94e7,moonbagsLocked:54e6,nextUnlock2027:34e6,nextUnlock2028:20e6}}});
      if (/^\/api\/tree-exposure(?:-preview)?$/.test(url.pathname)) return json({testOnly:true,status:'ok',provider:'tree-exposure-snapshot',methodologyVersion:'verified-tree-exposure-v1',snapshotGeneratedAt:new Date().toISOString(),snapshotAgeMs:0,refreshState:'complete',entries:[],displayedCount:0,eligibleOwnerCount:2197,source:{direct:{verifiedAddressOwners:2198,pagesScanned:409,objectsScanned:20424}},summary:{},coverage:{totalExposureComplete:true},warnings:[]});
      if (url.pathname === '/api/tree-v3-overview') return json({status:'ok',market:{suiUsd:1.5},venues:[]});
      if (url.pathname === '/api/tree-liquidity') return json({status:'ok',source:'CI fixture',generatedAt:new Date().toISOString(),liquidity:{recognizedLiquidityUsd:15000}});
      if (url.pathname === '/api/tree-volume') return json({status:'ok',generatedAt:new Date().toISOString(),volume24hUsd:25,venues:{suiDexV2:10,suiDexV3:5,turbos:5,cetus:5}});
      return json({ status: 'not-ready', testOnly: true, entries: [], warnings: [] });
    }
    if (url.href === 'https://sti-keeper-production.up.railway.app/badge') return json({ ...badge, at: Date.now() });
    if (url.href === 'https://graphql.mainnet.sui.io/graphql') {
      const value = structuredClone(price); value.data.checkpoint.timestamp = new Date().toISOString(); return json(value);
    }
    if (url.origin === baseURL && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    result.mockedExternalRequests.push(url.origin + url.pathname);
    if (request.resourceType() === 'document') return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{background:#081820;color:#a0b9bf;font:14px system-ui;padding:20px;overflow-wrap:anywhere}</style><p>CI TEST ONLY · External chart placeholder</p>'});
    if (request.resourceType() === 'script') {
      const fixture = sdkFixture(url.href);
      return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:fixture ?? 'throw Error('+JSON.stringify('CI: unexpected external module '+url.href)+');'});
    }
    return json({testOnly:true,status:'not-ready'});
  });
}

async function checkLayout(page, result, view) {
  const measured = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth, failures = [];
    for (const element of document.querySelectorAll('.stats-sti, .stats-sti *')) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (!rect.width || !rect.height || !element.getClientRects().length || style.visibility === 'hidden') continue;
      if (rect.left < -1 || rect.right > viewport + 1 || (element.clientWidth && !element.matches('input') && element.scrollWidth > element.clientWidth + 1)) {
        failures.push(element.id || element.tagName);
      }
    }
    return {viewport,documentWidth:document.documentElement.scrollWidth,failures};
  });
  result.layouts.push({view,...measured});
  assert(measured.documentWidth <= measured.viewport + 1, view+': document overflow');
  assert.deepEqual(measured.failures, [], view+': STI component overflow');
}
async function capture(page, result, view) {
  await page.evaluate(() => {
    const banner=document.createElement('div');banner.id='ci-test-watermark';
    banner.textContent='CI TEST ONLY · Synthetic quotes · Test wallet rejects approval';
    banner.style.cssText='background:#ffda70;color:#111;padding:8px;font:700 12px/1.4 system-ui';
    document.querySelector('.stats-sti').prepend(banner);
  });
  try {
    const filename='sti-purchase-'+result.width+'-'+view+'.png';
    await page.locator('.stats-sti').screenshot({path:path.join(output,filename),animations:'disabled'});
    result.screenshots.push('.netlify/'+filename);
  } finally {await page.locator('#ci-test-watermark').evaluate(el=>el.remove()).catch(()=>{});}
}
async function quote(page, amount) {
  await page.locator('#stiAmount').fill(amount);
  await page.locator('#stiQuoteButton').click();
  await page.waitForFunction(()=>!document.getElementById('stiQuoteButton').disabled);
}
async function ready(page) {
  await page.locator('#stiBuyButton').click();
  await page.waitForFunction(()=>document.getElementById('stiBuyButton').textContent==='Approve purchase in wallet');
}

let browser;
try {
  const modulePath=process.env.STI_PURCHASE_BROWSER_MODULE;
  assert(modulePath,'Set STI_PURCHASE_BROWSER_MODULE to the isolated Playwright module.');
  const {chromium}=await import(modulePath.startsWith('file:')?modulePath:pathToFileURL(path.resolve(modulePath)).href);
  browser=await chromium.launch({headless:true,executablePath:process.env.STI_PURCHASE_CHROME_PATH||undefined});report.browserVersion=browser.version();
  for (const width of widths) {
    const result={width,passed:false,cases:[],layouts:[],screenshots:[],pageErrors:[],apiRequests:[],unexpectedMutations:[],mockedExternalRequests:[]};
    report.results.push(result);
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
    await configureNetwork(context,result);
    const page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',error=>result.pageErrors.push(error.message));
    try {
      await page.clock.install();
      const response=await page.goto(targetURL,{waitUntil:'domcontentloaded',timeout:30000});
      assert(response?.ok());
      await page.waitForFunction(()=>typeof window.openWalletManager==='function'&&document.getElementById('stiMembership').textContent.includes('Sui Trenches Index'));
      assert(await page.locator('#stats').isVisible());
      await page.locator('#stiOpenBuy').click();
      await quote(page,'2');
      assert.equal(await page.locator('#stiImpact').textContent(),'3.50%');
      assert.equal(await page.locator('#stiEstimated').textContent(),'322321.683251131');
      assert.equal(await page.locator('#stiMinimum').textContent(),'319098.466418619');
      assert(await page.locator('#stiImpactWarning').isVisible());
      assert.equal(await page.locator('#stiBuyButton').textContent(),'Connect wallet');
      result.cases.push('3.50% quote visible with expected/minimum STI and disconnected wallet state');
      await page.locator('#stiWalletButton').click();
      await page.getByRole('button',{name:/Test Sui Wallet/}).click();
      await page.waitForFunction(()=>window.getWalletConnectionState().connected);
      await quote(page,'2');
      assert.equal(await page.locator('#stiImpactAccept').isChecked(),false);
      assert.equal(await page.locator('#stiBuyButton').isEnabled(),false);
      assert.equal(await page.evaluate(()=>window.__testSimulations||0),0);
      assert.equal(await page.evaluate(()=>window.__testSignCalls||0),0);
      await checkLayout(page,result,'unaccepted');await capture(page,result,'unaccepted');
      result.cases.push('No simulation or wallet call until explicit acceptance; mobile warning fits');
      await page.locator('#stiImpactAccept').focus();await page.locator('#stiImpactAccept').press('Space');
      assert(await page.locator('#stiBuyButton').isEnabled());
      await ready(page);
      assert.deepEqual(await page.evaluate(()=>window.__testBuiltPurchase),{owner:address,amount:'2000000000',minOut:'319098466418619'});
      assert.equal(await page.evaluate(()=>window.__testSignCalls||0),0);
      await checkLayout(page,result,'ready');await capture(page,result,'ready');
      await page.locator('#stiBuyButton').click();
      await page.waitForFunction(()=>document.getElementById('stiPurchaseStatus').textContent.includes('cancelled'));
      assert.equal(await page.evaluate(()=>window.__testSignCalls),1);
      assert.equal(await page.evaluate(()=>window.__testUserActivation),true);
      assert.equal(await page.locator('#stiQuoteDetails').isVisible(),false);
      result.cases.push('Keyboard acceptance, exact minimum output, separate active-gesture wallet approval and rejection');

      await quote(page,'2');await page.locator('#stiImpactAccept').check();await ready(page);
      await page.locator('#stiImpactAccept').uncheck();
      assert.equal(await page.locator('#stiBuyButton').isEnabled(),false);
      await page.locator('#stiImpactAccept').check();
      assert.equal(await page.locator('#stiBuyButton').textContent(),'Review purchase');
      await page.locator('#stiQuoteButton').click();
      await page.waitForFunction(()=>!document.getElementById('stiQuoteButton').disabled);
      assert.equal(await page.locator('#stiImpactAccept').isChecked(),false);
      assert.equal(await page.locator('#stiBuyButton').isEnabled(),false);
      await page.locator('#stiImpactAccept').check();await page.locator('#stiAmount').fill('1');
      assert.equal(await page.locator('#stiImpactWarning').isVisible(),false);
      await quote(page,'1');
      assert.equal(await page.locator('#stiImpact').textContent(),'1.91%');
      assert.equal(await page.locator('#stiImpactWarning').isVisible(),false);
      assert(await page.locator('#stiBuyButton').isEnabled());
      result.cases.push('Revocation discards preparation; refresh resets consent; lower-impact amount uses normal flow');

      await quote(page,'2');await page.locator('#stiImpactAccept').check();await ready(page);
      await page.clock.fastForward(31000);
      assert.equal(await page.locator('#stiImpactAccept').isChecked(),false);
      assert.equal(await page.locator('#stiBuyButton').isEnabled(),false);
      assert.match(await page.locator('#stiExpiry').textContent(),/Expired/);
      await quote(page,'2');await page.locator('#stiImpactAccept').check();
      await page.locator('#stiCloseBuy').click();await page.locator('#stiOpenBuy').click();
      assert.equal(await page.locator('#stiImpactAccept').isChecked(),false);
      assert.equal(await page.locator('#stiQuoteDetails').isVisible(),false);
      result.cases.push('Expiry and panel close discard quote acceptance and prepared transaction');
      await quote(page,'3');
      assert.match(await page.locator('#stiPurchaseStatus').textContent(),/above the 5% limit/);
      assert.equal(await page.locator('#stiQuoteDetails').isVisible(),false);
      assert.equal(await page.locator('#stiBuyButton').isEnabled(),false);
      assert.equal(await page.evaluate(()=>window.__testSignCalls),1);
      result.cases.push('Quote above 5% remains blocked with no new approval call');

      await quote(page,'2');await page.locator('#stiImpactAccept').check();
      await page.locator('#stiWalletButton').click();
      await page.getByRole('button',{name:/Disconnect.*forget/i}).click();
      await page.waitForFunction(()=>!window.getWalletConnectionState().connected);
      assert.equal(await page.locator('#stiImpactAccept').isChecked(),false);
      assert.equal(await page.locator('#stiBuyButton').textContent(),'Connect wallet');
      await page.locator('#stiCloseBuy').click();
      await page.locator('.app-nav a[href="#swap"]').click();assert(await page.locator('#swap').isVisible());
      await page.locator('.app-nav a[href="#stats"]').click();assert(await page.locator('#stats').isVisible());
      assert.equal(await page.locator('.studio-command-link').getAttribute('href'),'/play/profile-studio/');
      result.cases.push('Wallet disconnect clears acceptance; Stats/Swap and Profile Studio navigation remain intact');
      assert.deepEqual(result.pageErrors,[],'Unexpected page JavaScript error');
      assert.deepEqual(result.unexpectedMutations,[],'Unexpected first-party mutation attempted');
      result.passed=true;
    } catch(error) {
      result.error=error.stack||String(error);
      await capture(page,result,'failure').catch(e=>{result.screenshotError=e.message;});
    } finally {await context.close();}
  }
} catch(error) {report.error=error.stack||String(error);}
finally {
  await browser?.close();report.completedAt=new Date().toISOString();
  report.passed=!report.error&&report.results.length===widths.length&&report.results.every(r=>r.passed);
  await fs.writeFile(path.join(output,'sti-purchase-browser-checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({baseURL,passed:report.passed,error:report.error,results:report.results.map(({width,passed,cases,error})=>({width,passed,cases:cases.length,error}))},null,2));
  if(!report.passed)process.exitCode=1;
}
