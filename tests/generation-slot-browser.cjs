const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});const cases=[];
try{for(const scenario of [{name:'desktop one day behind',offset:-86400000},{name:'desktop one day ahead',offset:86400000},{name:'genuinely stale server review',offset:0,stale:true}]){
 const page=await browser.newPage();let external=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const packet=JSON.parse(fs.readFileSync(process.env.SLOT_PACKET||'/tmp/slot-handoff.json'));packet.preparedAt=Date.now()-(scenario.stale?121000:0);
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='tree-token.xyz'){external++;return route.abort();}
  if(url.pathname==='/api/generation-slot')return route.fulfill({json:packet,headers:{date:new Date().toUTCString(),'cache-control':'no-store',age:'1'}});
  const file=url.pathname.endsWith('.js')?'app.js':'index.html';
  if(process.env.SERVED_ORIGIN){const r=await fetch(process.env.SERVED_ORIGIN+url.pathname);assert(r.ok);return route.fulfill({body:Buffer.from(await r.arrayBuffer()),contentType:file.endsWith('.js')?'text/javascript':'text/html'});}
  return route.fulfill({body:fs.readFileSync('tools/generation-slot/'+file),contentType:file.endsWith('.js')?'text/javascript':'text/html'});
 });
 await page.addInitScript(({offset})=>{const wall=Date.now;Date.now=()=>wall()+offset;
  const account={address:'0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',chains:['sui:mainnet'],features:['sui:signTransaction'],publicKey:new Uint8Array(32)};
  window.addEventListener('wallet-standard:app-ready',e=>e.detail.register({version:'1.0.0',name:'Slush',icon:'data:image/png;base64,',chains:['sui:mainnet'],accounts:[account],features:{'standard:connect':{version:'1.0.0',connect:async()=>({accounts:[account]})},'standard:events':{version:'1.0.0',on:()=>()=>{}},'sui:signTransaction':{version:'2.0.0',signTransaction:async()=>{throw Error('User rejected test signature');}}}}));
 },scenario);
 await page.goto('https://tree-token.xyz/play/generation-slot/');await page.click('#connect');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await page.click('#refresh');
 if(scenario.stale){await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('stale'));assert(await page.isDisabled('#publish'));}
 else{await page.waitForFunction(()=>!document.querySelector('#publish').disabled);assert.match(await page.textContent('#status'),/Verified empty/);await page.click('#publish');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('User rejected'));}
 assert.equal(external,0);assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(errors,[]);cases.push({name:scenario.name,passed:true,noSubmission:true});if(!scenario.stale){await page.evaluate(()=>localStorage.setItem('tree-generation-empty-slot-v1','pending-test'));await page.reload();assert(await page.isDisabled('#publish'));assert(await page.isDisabled('#refresh'));assert(await page.isVisible('#receipt'));}
 await page.goto('https://tree-token.xyz/play/generation-publication/');assert(await page.isDisabled('#connect'));await page.close();
}console.log(JSON.stringify({cases,realWalletUsed:false},null,2));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
