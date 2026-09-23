import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FEED} from '../dapp/sti-purchase-core.js';
import {PRICE_ENDPOINT,DATA_TTL} from '../dapp/sti-stats-core.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.STI_PREVIEW_URL;
assert.ok(url?.startsWith('https://')||url?.startsWith('http://localhost'));
const output=process.env.STI_QA_OUTPUT||'sti-stats-qa';fs.mkdirSync(output,{recursive:true});
const badge=JSON.parse(fs.readFileSync(new URL('fixtures/sti-badge.json',import.meta.url)));
const pool=JSON.parse(fs.readFileSync(new URL('fixtures/sti-price.json',import.meta.url)));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,proxy:process.env.STI_TEST_PROXY?{server:process.env.STI_TEST_PROXY,bypass:'localhost,127.0.0.1'}:undefined});
const report=[];
try {
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,740]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.clock.install();
    const timestamp=Date.now();badge.at=timestamp;pool.data.checkpoint.timestamp=new Date(timestamp).toISOString();
    await page.route(FEED,r=>r.fulfill({json:badge}));await page.route(PRICE_ENDPOINT,r=>r.fulfill({json:pool}));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('stiPrice').textContent!=='—'&&document.getElementById('stiNav').textContent!=='—');
    assert.equal(await page.locator('#stiPrice').textContent(),'0.000016582');
    assert.equal(await page.locator('#stiNav').textContent(),'0.000015737');
    assert.equal(await page.locator('.sti-basket-segment').count(),7);
    assert.equal(await page.locator('.sti-basket-segment.is-tree').count(),1);
    assert.match(await page.locator('#stiBasket').getAttribute('aria-label'),/TREE 10\.63%/);
    assert.equal(await page.locator('.sti-index-mark img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const tree=await page.locator('.sti-basket-segment.is-tree').boundingBox();assert.ok(tree.width>10&&tree.height>=12);
    await page.locator('.stats-sti').screenshot({path:`${output}/${name}-stats.png`});
    // Let both snapshots age out. A repeated old response must not keep values alive.
    await page.clock.fastForward(DATA_TTL+15_000);
    await page.waitForFunction(()=>document.getElementById('stiPrice').textContent==='—'&&document.getElementById('stiNav').textContent==='—');
    assert.equal(await page.locator('#stiBasket').isVisible(),false);
    assert.equal(await page.locator('#stiShare').textContent(),'—');
    assert.equal(requests.some(r=>/sti\.boombots\.fun|cloudflareinsights/.test(r)),false);
    assert.deepEqual(errors,[]);report.push({name,width,height,price:'0.000016582',nav:'0.000015737',segments:7,localLogo:true,staleValuesCleared:true,noOverflow:true});await page.close();
  }
  // Corrupt only price/NAV/basket fields: verified TREE membership must survive.
  const page=await browser.newPage({viewport:{width:390,height:844}});
  badge.at=Date.now();badge.perSti='90000';badge.coins[0].share=.9;
  pool.data.checkpoint.timestamp=new Date().toISOString();pool.data.chainIdentifier='wrong-chain';
  await page.route(FEED,r=>r.fulfill({json:badge}));await page.route(PRICE_ENDPOINT,r=>r.fulfill({json:pool}));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('stiMembership').textContent==='is in the Sui Trenches Index'&&document.getElementById('stiPriceStatus').textContent.includes('unavailable'));
  assert.equal(await page.locator('#stiPrice').textContent(),'—');assert.equal(await page.locator('#stiNav').textContent(),'—');
  assert.equal(await page.locator('#stiShare').textContent(),'10.63%');assert.equal(await page.locator('#stiBasket').isVisible(),false);
  await page.locator('#stiOpenBuy').click();assert.equal(await page.locator('#stiPurchase').isVisible(),true);
  report.push({case:'invalid statistics',badValuesCleared:true,treeMembershipPreserved:true,purchasePanelAvailable:true});
  await page.close();
} finally {await browser.close();fs.writeFileSync(`${output}/stats-report.json`,JSON.stringify(report,null,2));}
console.log('STI stats browser QA passed: local branding, price/NAV, basket proportions, stale/invalid data, desktop/mobile.');
