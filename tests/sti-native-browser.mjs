import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.STI_PREVIEW_URL;
assert.ok(url?.startsWith('https://')||url?.startsWith('http://localhost'));
const output=process.env.STI_QA_OUTPUT||'sti-native-qa';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const report=[];
async function quote(page,amount){
 await page.locator('#stiAmount').fill(amount);await page.locator('#stiQuoteButton').click();
 await page.waitForFunction(()=>!document.getElementById('stiQuoteButton').disabled,{},{timeout:60000});
}
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,740]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const errors=[],requests=[];let popups=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('popup',()=>popups++);
  page.on('request',r=>requests.push(r.url()));
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.stats-sti').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.getElementById('stiMembership').textContent.startsWith('Loading'));
  const membership=await page.locator('#stiMembership').textContent();
  assert.match(membership,/is in the Sui Trenches Index|temporarily unavailable/);
  if(membership.includes('unavailable'))assert.equal(await page.locator('#stiShare').textContent(),'—');
  assert.equal(await page.locator('.stats-sti iframe').count(),0);
  const section=await page.locator('.stats-sti').boundingBox(),market=await page.locator('[data-stats-group="market"]').boundingBox(),burn=await page.locator('.stats-public-burn').boundingBox();
  assert.ok(section.y>=market.y+market.height&&burn.y>=section.y+section.height);
  await page.locator('.stats-sti').screenshot({path:`${output}/${name}-card.png`});
  await page.locator('#stiOpenBuy').click();
  assert.equal(await page.locator('#stiPurchase').isVisible(),true);
  await quote(page,'0.1');
  if(!await page.locator('#stiQuoteDetails').isVisible())throw Error('Quote failed: '+await page.locator('#stiPurchaseStatus').textContent());
  assert.match(await page.locator('#stiEstimated').textContent(),/^\d/);
  assert.equal(await page.locator('#stiBuyButton').textContent(),'Connect wallet');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(page.url(),url);assert.equal(popups,0);
  assert.equal(requests.some(r=>r.includes('sti.boombots.fun')||r.includes('cloudflareinsights')),false,'No STI iframe, scripts or telemetry');
  await page.locator('.stats-sti').screenshot({path:`${output}/${name}-purchase.png`});
  // Ensure edits immediately invalidate the old quote.
  await page.locator('#stiAmount').fill('0.2');assert.equal(await page.locator('#stiQuoteDetails').isVisible(),false);
  await quote(page,'1e3');assert.match(await page.locator('#stiPurchaseStatus').textContent(),/up to 9 decimal/);
  await page.locator('#stiCloseBuy').click();assert.equal(await page.locator('#stiPurchase').isVisible(),false);
  await page.locator('.app-nav a[href="#swap"]').click();assert.equal(await page.locator('.stats-sti').isVisible(),false);
  await page.locator('.app-nav a[href="#stats"]').click();assert.equal(await page.locator('.stats-sti').isVisible(),true);
  report.push({name,width,height,membership,errors,requests:requests.filter(r=>/sti-|fullnode|esm.run/.test(r)),noNavigation:true});
  assert.deepEqual(errors,[]);
  await context.close();
 }
 // Fresh browser with an explicit non-signing wallet stub. All pool reads and
 // simulation remain real; the wallet boundary throws instead of signing.
 {
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.signAndExecuteTransactionBlock==='function');
  await page.evaluate(()=>{
   window.__stiSignCalls=0;window.playerAddress='0x0de00c55730739622b2f7acc92ca571d3c344b219e7c0d63a3660d58774c83f1';
   window.signAndExecuteTransactionBlock=async tx=>{window.__stiSignCalls++;window.__stiSignedData=tx.getData();throw Error('User rejected test purchase');};
   window.dispatchEvent(new CustomEvent('tree:wallet-changed'));
  });
  await page.locator('#stiOpenBuy').click();await quote(page,'0.1');
  assert.equal(await page.locator('#stiBuyButton').isEnabled(),true);
  await page.evaluate(()=>{window.__originalNow=Date.now;Date.now=()=>window.__originalNow()+31000;});
  await page.waitForFunction(()=>document.getElementById('stiBuyButton').disabled);
  assert.equal(await page.evaluate(()=>window.__stiSignCalls),0);
  await page.evaluate(()=>{Date.now=window.__originalNow;});
  await quote(page,'0.1');
  await page.locator('#stiBuyButton').click();
  await page.waitForFunction(()=>document.getElementById('stiPurchaseStatus').textContent.includes('cancelled'),{},{timeout:60000});
  assert.equal(await page.evaluate(()=>window.__stiSignCalls),1);
  assert.equal(await page.locator('#stiQuoteDetails').isVisible(),false);
  assert.equal(await page.locator('#stiBuyButton').isDisabled(),true);
  report.push({case:'real browser simulation with non-signing wallet stub',signBoundaryReached:1,expiredQuoteBlocked:true,rejectionHandled:true,transactionsSubmitted:0});
  await page.locator('#stiPurchase').screenshot({path:`${output}/wallet-rejection.png`});
  await context.close();
 }
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.route('https://sti-keeper-production.up.railway.app/badge',route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.stats-sti').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.getElementById('stiMembership').textContent.includes('unavailable'));
  assert.equal(await page.locator('#stiShare').textContent(),'—');
  await page.locator('#stiOpenBuy').click();await quote(page,'0.1');assert.equal(await page.locator('#stiQuoteDetails').isVisible(),true);
  await page.locator('.stats-sti').screenshot({path:`${output}/feed-unavailable.png`});
  report.push({case:'feed failure',staleMetricsHidden:true,poolQuoteIndependent:true});await context.close();
 }
}finally{await browser.close();fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));}
console.log('Native STI browser QA passed: desktop/mobile, real quotes, no redirects/iframe, quote expiry, edits, wallet rejection after real simulation, feed failure. No transactions signed or submitted.');
