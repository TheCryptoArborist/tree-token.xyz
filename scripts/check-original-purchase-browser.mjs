import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=process.cwd(),server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname.endsWith('/')?pathname+'index.html':pathname;
 const file=path.resolve(root,'.'+relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{const bytes=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(bytes)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/play/multichaintest/original/bnb/buy/');await page.waitForFunction(()=>document.getElementById('expected').textContent.startsWith('0x'));
  assert.deepEqual(errors,[]);assert(await page.locator('#connect-wallet').isVisible());assert(await page.locator('#receipt-input').isVisible());assert(await page.locator('#approve').isDisabled());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow at '+width);
  await page.locator('#consent').check();assert(await page.locator('#approve').isDisabled(),'Disconnected consent must never enable signing');
  await page.locator('#connect-wallet').click();assert.match(await page.locator('#status').innerText(),/No EVM extension/);assert(await page.locator('#approve').isDisabled());
  await page.locator('#receipt-input').fill('0x'+'a'.repeat(64));assert(await page.locator('#receipt-check').isDisabled());
  console.log(JSON.stringify({width,loaded:true,errors,overflow:false,connectionAndRecoveryVisible:true,disconnectedSigningBlocked:true,installedExtensionVerified:false}));await page.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
