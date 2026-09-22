import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const url=process.env.STI_PREVIEW_URL;assert.ok(url?.startsWith('https://'));
try {for(const scenario of ['dashboard-unavailable','wallet-unavailable','manager-error']){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 if(process.env.LOCAL_BOOTSTRAP==='1')await page.route('**/dapp/interaction-bootstrap.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(new URL('../dapp/interaction-bootstrap.js',import.meta.url),'utf8')}));
 if(scenario==='dashboard-unavailable')await page.route('**/dapp/app.js*',r=>r.abort());
 if(scenario==='wallet-unavailable')await page.route('**/scripts/wallet.js*',r=>r.abort());
 await page.goto(url,{waitUntil:'domcontentloaded'});
 if(scenario!=='wallet-unavailable')await page.waitForFunction(()=>typeof window.openWalletManager==='function');
 if(scenario==='manager-error')await page.evaluate(()=>{window.openWalletManager=async()=>{throw Error('Test wallet connection failure');};});
 await page.locator('#dappWallet').click();
 if(scenario==='dashboard-unavailable'){
  await page.locator('#treeWalletDialog[open]').waitFor({timeout:3000});
  await page.keyboard.press('Escape');await page.locator('#dappWallet').click();
  await page.locator('#treeWalletDialog[open]').waitFor({timeout:3000});
 }else{
  await page.waitForFunction(()=>document.querySelector('#dappWalletConnectionStatus')?.dataset.error==='true',null,{timeout:11000});
  assert(await page.locator('#dappWalletConnectionStatus').isVisible());
  assert.match(await page.locator('#dappWalletConnectionStatus').textContent(),scenario==='wallet-unavailable'?/could not load/:/Test wallet connection failure/);
  assert.equal(await page.locator('#dappWallet').getAttribute('aria-busy'),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.screenshot({path:`${process.env.STI_QA_OUTPUT||'.'}/wallet-${scenario}.png`});
 console.log(JSON.stringify({scenario,passed:true}));await page.close();
}}finally{await browser.close()}
