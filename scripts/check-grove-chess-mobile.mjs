import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.GROVE_CHESS_BROWSER_MODULE).href);
const base=process.env.GROVE_CHESS_TEST_BASE||'http://127.0.0.1:8766';
const browser=await chromium.launch({headless:true,...(process.env.GROVE_CHESS_CHROMIUM?{executablePath:process.env.GROVE_CHESS_CHROMIUM}:{channel:'chromium'})});
const results=[];fs.mkdirSync('.netlify',{recursive:true});
try{for(const [width,height] of [[390,664],[320,568],[430,740]]){
 const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
 await page.goto(base+'/play/grove-chess/',{waitUntil:'networkidle'});await page.locator('.square').last().waitFor();
 const rect=await page.locator('#board').boundingBox(),tools=await page.locator('.board-tools').boundingBox();
 assert(rect.y>=0&&rect.y+rect.height<=height,'Entire board visible on arrival');
 assert(tools.y+tools.height<=height,'Move controls visible without scrolling');
 assert.equal(await page.evaluate(()=>scrollY),0);
 const retained=await page.locator('[data-square="e2"]').elementHandle();
 const tap=async square=>{const box=await page.locator(`[data-square="${square}"]`).boundingBox();assert(box.y>=0&&box.y+box.height<=height);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>scrollY),0,'Tapping must not move the viewport');};
 await tap('e2');await tap('e4');await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='2 HALF-MOVES');
 assert.equal(await page.evaluate(()=>scrollY),0,'Computer reply must not move the viewport');
 assert(await retained.evaluate(e=>e.isConnected),'Board squares keep their DOM identity between turns');
 assert.equal(await page.locator('#mobile-turn').textContent(),'Your move.');
 await page.locator('#undo').tap();assert.equal(await page.evaluate(()=>scrollY),0);
 await page.locator('#flip').tap();assert.equal(await page.evaluate(()=>scrollY),0);
 await page.locator('#flip').tap();
 await page.locator('#mobile-options').tap();await page.waitForTimeout(600);
 await page.selectOption('#mode','local');await page.locator('#mobile-return').tap();await page.waitForTimeout(600);
 const boardY=await page.locator('#board').evaluate(e=>e.getBoundingClientRect().top);assert(boardY>=0&&boardY+rect.height<=height);
 const scroll=await page.evaluate(()=>scrollY);
 for(const sq of ['e2','e4','e7','e5','g1','f3','b8','c6']){const b=await page.locator(`[data-square="${sq}"]`).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(70);assert.equal(await page.evaluate(()=>scrollY),scroll,'Local turns must preserve scroll');}
 await page.locator('[data-square="e2"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.dataset.square),'f2','Keyboard navigation retained');
 await page.screenshot({path:`.netlify/grove-chess-mobile-play-${width}.png`});results.push({width,height,boardAndControlsVisible:true,touchMovesStable:true,computerReplyStable:true,localMovesStable:true,keyboardNavigation:true});await page.close();
}}finally{await browser.close()}
fs.writeFileSync('.netlify/grove-chess-mobile-checks.json',JSON.stringify({base,results},null,2));console.log('Mobile board, controls and scroll stability verified at three phone sizes.');
