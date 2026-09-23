import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,proxy:process.env.STI_TEST_PROXY?{server:process.env.STI_TEST_PROXY,bypass:'localhost,127.0.0.1'}:undefined});
const url=process.env.STI_PREVIEW_URL;assert.ok(url?.startsWith('https://')||url?.startsWith('http://localhost'));
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  let release;const held=new Promise(resolve=>{release=resolve});let slushRequested=false;
  await page.route('**/*slush-wallet*',async route=>{slushRequested=true;await held;try{await route.abort()}catch{}});
  if(process.env.LOCAL_WALLET==='1')await page.route('**/scripts/wallet.js*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(new URL('../scripts/wallet.js',import.meta.url),'utf8')}));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.openWalletManager==='function');
  await page.locator('#dappWallet').click();
  await page.locator('#treeWalletDialog[open]').waitFor({timeout:3000});
  assert(slushRequested,'Optional wallet request must still be pending');
  assert.match(await page.locator('#treeWalletDialog').innerText(),/Connect a Sui Wallet/);
  await page.waitForFunction(()=>Boolean(document.getElementById('treeWalletManagerStyles')?.sheet));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#treeWalletDialog').screenshot({path:`${process.env.STI_QA_OUTPUT||'.'}/header-wallet-${width}.png`});
  // Closing and reopening must remain responsive while Slush is still pending.
  await page.keyboard.press('Escape');await page.locator('#dappWallet').click();
  await page.locator('#treeWalletDialog[open]').waitFor({timeout:3000});
  release();await page.close();console.log(JSON.stringify({width,pickerOpenedWithSlushPending:true,reopened:true}));
 }
}finally{await browser.close()}
