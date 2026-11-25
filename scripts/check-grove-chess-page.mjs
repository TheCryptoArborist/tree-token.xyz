import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.GROVE_CHESS_BROWSER_MODULE).href);
const base=process.env.GROVE_CHESS_TEST_BASE||'http://127.0.0.1:8765';
fs.mkdirSync('.netlify',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium'}),results=[];
try{for(const [width,height]of [[1440,1000],[390,844],[320,740],[844,390]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<900});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/play/grove-chess/',{waitUntil:'networkidle'});
 await page.locator('.square').last().waitFor();assert.equal(await page.locator('.square').count(),64);
 assert.equal(await page.locator('.square .hero-base').count(),32);
 assert.equal(await page.locator('.square .hero-base').filter({hasText:'PAWN'}).count(),16);
 assert(await page.locator('.pawn-piece img').first().evaluate(i=>i.complete&&i.naturalWidth>0));
 assert(await page.evaluate(async()=>{const i=new Image();i.src='assets/woodland-court.png';await i.decode();return i.naturalWidth>0}));
 const board=await page.locator('#board').boundingBox(),frame=await page.locator('.board-frame').boundingBox();
 assert(Math.abs(board.width-board.height)<2,'Board must be square');
 assert(board.x>=frame.x&&board.x+board.width<=frame.x+frame.width,'Board must fit frame');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
 await page.selectOption('#mode','local');
 await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
 assert(await page.locator('[data-square="e4"]').getAttribute('aria-label').then(x=>x.includes('Pawn')));
 await page.click('#undo');assert(await page.locator('[data-square="e2"]').getAttribute('aria-label').then(x=>x.includes('Pawn')));
 await page.click('#flip');assert.equal(await page.locator('.square').first().getAttribute('data-square'),'h1');
 assert.equal(await page.locator('#top-player').evaluate(e=>getComputedStyle(e).order),'2');
 await page.locator('#legend [data-piece="n"]').click();assert(await page.locator('#piece-info').evaluate(e=>e.open));await page.click('#piece-info-close');
 await page.locator('.board-frame').scrollIntoViewIfNeeded();await page.screenshot({path:`.netlify/grove-chess-board-${width}.png`});
 await page.locator('.piece-guide').scrollIntoViewIfNeeded();await page.screenshot({path:`.netlify/grove-chess-guide-${width}.png`});
 assert.deepEqual(errors,[],'Game browser errors');
 if(process.env.GROVE_CHESS_CABINET_FIXTURE==='1'){
  await page.route(base+'/play/',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('production/arcade-organization-static/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,tag=>/src="\/scripts\/arcade-(organization|navigation-play-share)\.js"/.test(tag)?tag:'')}));
  await page.route(base+'/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/play/')return route.fallback();if(p.startsWith('/api/'))return route.fulfill({status:403,body:'{}'});const f='production/arcade-organization-static/runtime'+p;if(!fs.existsSync('.'+p)&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({path:f});return route.continue()});
 }
 await page.goto(base+'/play/#games',{waitUntil:'networkidle'});
 const cabinet=page.locator('.poster--grove-chess');await cabinet.waitFor();assert.equal(await cabinet.count(),1);
 assert.equal(await page.locator('#reserved-2-title').textContent(),'Tree Army');
 assert.equal(await page.locator('#reserved-3-title').textContent(),'GROVE CHESS');
 assert.equal(await cabinet.locator('a').getAttribute('href'),'/play/grove-chess/');
 await cabinet.scrollIntoViewIfNeeded();await page.screenshot({path:`.netlify/grove-chess-cabinet-${width}.png`});
 await cabinet.locator('a').click();await page.waitForURL('**/play/grove-chess/');await page.locator('.square').last().waitFor();
 results.push({width,height,passed:true});await page.close();
}}finally{await browser.close()}
fs.writeFileSync('.netlify/grove-chess-browser-checks.json',JSON.stringify({base,fixture:process.env.GROVE_CHESS_CABINET_FIXTURE==='1',results},null,2));
console.log('Grove Chess game and cabinet verified at four viewports.');
