import assert from 'node:assert/strict';
import fs from 'node:fs';
// Set PLAYWRIGHT_MODULE to a local playwright entry point if it is not installed here.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.STI_PREVIEW_URL;
assert.ok(url?.startsWith('https://') || url?.startsWith('http://localhost'), 'STI_PREVIEW_URL required');
const output = process.env.STI_QA_OUTPUT || 'sti-qa';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined});
const reports=[];
try {
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,740]]) {
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  const requests=[],errors=[];
  page.on('request',r=>{if(/sti[.-]|fonts\.google|fonts\.gstatic|boombots/.test(r.url()))requests.push({url:r.url(),type:r.resourceType(),method:r.method()});});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const section=page.locator('.stats-sti');
  await section.scrollIntoViewIfNeeded();
  const iframe=section.locator('iframe');
  await iframe.waitFor({state:'visible'});
  assert.equal(await iframe.count(),1);
  assert.match(await iframe.getAttribute('src'), /^https:\/\/sti\.boombots\.fun\/embed\/\?coin=TREE&id=sti-badge-\d+$/);
  const frame=page.frameLocator('.stats-sti iframe');
  await frame.locator('#badge:not([hidden])').waitFor();
  await frame.locator('.sym').filter({hasText:/tree/i}).waitFor();
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Page horizontal overflow');
  const dimensions=await iframe.evaluate(el=>({width:el.clientWidth,height:el.clientHeight,parent:el.parentElement.clientWidth}));
  assert.ok(dimensions.width<=dimensions.parent);
  const contentHeight=await frame.locator('#badge').evaluate(el=>Math.ceil(el.getBoundingClientRect().height));
  assert.ok(dimensions.height>=contentHeight,'Widget must not clip');
  const marketBox=await page.locator('[data-stats-group="market"]').boundingBox();
  const sectionBox=await section.boundingBox();
  const burnBox=await page.locator('.stats-public-burn').boundingBox();
  assert.ok(sectionBox.y>=marketBox.y+marketBox.height,'STI must follow primary market stats');
  assert.ok(burnBox.y>=sectionBox.y+sectionBox.height,'STI must precede burn and supply');
  await section.screenshot({path:`${output}/${name}-sti.png`});
  await page.screenshot({path:`${output}/${name}-page.png`,fullPage:true});
  // Production intentionally hides the internal Stats subtabs.
  assert.equal(await page.locator('.stats-tabs').isVisible(),false);
  await page.locator('.app-nav a[href="#swap"]').click();
  assert.equal(await section.isVisible(),false);
  await page.locator('.app-nav a[href="#stats"]').click();
  assert.equal(await section.isVisible(),true);
  assert.equal(await iframe.count(),1,'Revisiting Stats must not duplicate the widget');
  reports.push({name,width,height,dimensions,contentHeight,requests,errors});
  await context.close();
 }
 // Simulate loader/network failure and an upstream change rejected by SRI.
 for(const mode of ['blocked','integrity-mismatch']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.route('https://sti.boombots.fun/embed.js',route=>mode==='blocked'?route.abort():route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/javascript'},body:'window.STI_UNREVIEWED_EXECUTED = true;'}));
  await page.goto(url,{waitUntil:'networkidle'});
  const section=page.locator('.stats-sti');
  await section.scrollIntoViewIfNeeded();
  assert.equal(await section.locator('iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.STI_UNREVIEWED_EXECUTED),undefined);
  assert.equal(await section.getByRole('link',{name:/visit the STI site/}).isVisible(),true);
  await section.screenshot({path:`${output}/${mode}.png`});
  reports.push({mode,fallbackVisible:true,unreviewedScriptExecuted:false});
  await context.close();
 }
} finally {await browser.close();fs.writeFileSync(`${output}/browser-report.json`,JSON.stringify(reports,null,2));}
console.log('STI browser checks passed: desktop, mobile, 320px, tab routing, no duplicate/clipping/overflow, blocked loader, SRI rejection.');
