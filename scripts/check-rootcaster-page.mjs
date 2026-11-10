import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const state=JSON.parse(fs.readFileSync('.netlify/rootcaster-candidate.json'));
assert(/^[a-f0-9]{24}$/.test(state.id));
const base=`https://${state.id}--tree-token.netlify.app/rootcaster/`;
for(const name of ['index.html','rootcaster.css','whisperleaf-watch.webp']) {
  const response=await fetch(base+name,{redirect:'error',signal:AbortSignal.timeout(30000)});
  assert(response.ok,'Candidate static file failed');
  const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(fs.readFileSync('rootcaster/'+name)),'Candidate bytes differ');
}
const {chromium}=await import(pathToFileURL(process.env.ROOTCASTER_BROWSER_MODULE).href);
const browser=await chromium.launch();
try {
  for(const [width,height,label] of [[1440,1000,'desktop'],[390,844,'mobile']]) {
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base,{waitUntil:'networkidle'});
    assert(response.ok());assert.equal(await page.locator('h1').count(),1);
    assert(await page.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0),'Artwork did not load');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
    for(const href of ['https://tree-token.xyz/','https://tree-token.xyz/dapp/','https://tree-token.xyz/play/','https://nftree.net/','https://tree-token.xyz/rewards/']) assert(await page.locator(`a[href="${href}"]`).count(),'Missing ecosystem destination');
    assert.equal(errors.length,0,'Browser script error');
    await page.screenshot({path:`.netlify/rootcaster-${label}.png`,fullPage:true});
    await page.close();console.log(label+' layout and artwork checks passed');
  }
} finally {await browser.close();}
