import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.TREE_ARMY_BROWSER_MODULE).href);
const base=process.env.TREE_ARMY_TEST_BASE || 'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,channel:'chromium'});
const results=[];
try {
  for(const [width,height] of [[1440,1000],[390,844],[320,740],[844,390]]) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:width<900});
    page.setDefaultTimeout(15000);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    if(process.env.TREE_ARMY_CABINET_FIXTURE==='1') {
      // Captured Arcade DOM with navigation and presentation modules only.
      // Local review does not initialize wallet/progress/network runtimes.
      await page.route(base+'/play/',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('production/arcade-organization-static/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, tag=>/src="\/scripts\/arcade-(organization|navigation-play-share)\.js"/.test(tag)?tag:'')}));
      await page.route(base+'/**',async route=>{
        const pathname=new URL(route.request().url()).pathname;
        if(pathname==='/play/')return route.fallback();
        if(pathname.startsWith('/api/'))return route.fulfill({status:403,contentType:'application/json',body:'{"error":"local-review"}'});
        if(fs.existsSync('.'+pathname))return route.continue();
        const file='production/arcade-organization-static/runtime'+pathname;
        if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
        return route.continue();
      });
    }
    await page.goto(base+'/play/#games',{waitUntil:'networkidle'});
    const button=page.getByRole('button',{name:'Watch Preview',exact:true});
    await button.waitFor();
    assert.equal(await button.count(),1,'Duplicate cabinet');
    assert.equal(await page.locator('#reserved-2-title').textContent(),'Tree Army');
    await button.scrollIntoViewIfNeeded();
    await page.screenshot({path:`.netlify/tree-army-cabinet-${width}.png`,fullPage:false});
    await button.focus();
    await page.keyboard.press('Enter');
    const dialog=page.locator('#tree-army-preview');
    assert(await dialog.evaluate(d=>d.open),'Keyboard must open preview');
    const video=dialog.locator('video');
    await video.evaluate(v=>{v.play().catch(()=>{});});
    await page.waitForFunction(()=>document.querySelector('#tree-army-preview video').currentTime>.25);
    assert(Math.abs(await video.evaluate(v=>v.duration)-10)<.1,'Preview must be ten seconds');
    assert(await video.evaluate(v=>v.videoWidth>0),'Video must decode');
    const rect=await dialog.boundingBox();
    assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,'Preview must fit viewport');
    await page.screenshot({path:`.netlify/tree-army-preview-${width}.png`});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.getElementById('tree-army-preview').open && document.querySelector('#tree-army-preview video').paused);
    assert(await video.evaluate(v=>v.paused),'Close must stop playback');
    assert(await button.evaluate(b=>b===document.activeElement),'Return focus to cabinet');
    if(width<900)await button.tap();else await button.click();
    await page.getByRole('button',{name:'Close Tree Army preview'}).click();
    assert(!await dialog.evaluate(d=>d.open));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
    assert.deepEqual(errors,[],'Browser errors');
    results.push({width,height,passed:true});
    await page.close();
  }
} finally {await browser.close();}
fs.writeFileSync('.netlify/tree-army-cabinet-checks.json',JSON.stringify({base,fixture:process.env.TREE_ARMY_CABINET_FIXTURE==='1',results},null,2));
console.log('Tree Army cabinet checks passed: '+results.map(r=>r.width).join(', '));
