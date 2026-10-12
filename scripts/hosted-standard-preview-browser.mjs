/** Real hosted browser sign-in/purchase lookup; no purchase or game grant. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const require=createRequire(process.env.PLAYWRIGHT_TEST_PACKAGE);
const {chromium}=require('playwright');
const gameRequire=createRequire(resolve(process.env.PAID_GAME_ROOT,'app/game/tree-payments/package.json'));
const {Ed25519Keypair}=await import(pathToFileURL(gameRequire.resolve('@mysten/sui/keypairs/ed25519')));
const origin='https://deploy-preview-3--treeforce89.netlify.app';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
const errors=[],responses=[],signer=new Ed25519Keypair(),address=signer.toSuiAddress();let loggedIn=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url()===origin+'/api/tree-continue')responses.push(r.status());});
async function post(path,data){const r=await context.request.post(origin+path,{data,headers:{Origin:origin},timeout:30000,maxRedirects:0});assert.equal(r.status(),200);return r.json();}
try{
 const challenge=await post('/api/tree-account-inline',{action:'challenge',family:'sui',address,chainId:'sui:mainnet'});
 const signature=(await signer.signPersonalMessage(new TextEncoder().encode(challenge.message))).signature;
 const login=await post('/api/tree-account-inline',{action:'verify',signature});assert.equal(login.identity?.authenticated,true);loggedIn=true;
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('button',{name:'SIGN OUT',exact:true}).waitFor({timeout:30000});
 const entry=page.locator('.game-frame > .tree-purchase-recovery');
 for(const width of [390,320,1200]){
  await page.setViewportSize({width,height:1000});await entry.scrollIntoViewIfNeeded();
  assert.equal(await entry.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector('.screen-bezel').getBoundingClientRect();return a.bottom<=b.top+1&&a.width<=innerWidth;}),true);
  await entry.click();const panel=page.getByRole('dialog',{name:'Recover TREE purchase',exact:true});
  await panel.getByText('No purchases were found for this signed-in account.',{exact:true}).waitFor({timeout:30000});
  await panel.getByRole('button',{name:'CLOSE',exact:true}).click();
  console.log('HOSTED_STANDARD_BROWSER_CHECK',width,'purchase panel reachable and empty');
 }
 assert.deepEqual(errors,[]);assert.equal(responses.length,3);assert.ok(responses.every(s=>s===200));
 await page.getByRole('button',{name:'SIGN OUT',exact:true}).click();loggedIn=false;
 await page.getByRole('button',{name:'SIGN IN',exact:true}).waitFor({timeout:20000});
 console.log('HOSTED_STANDARD_BROWSER_RESULT',JSON.stringify({viewportWidths:[390,320,1200],purchaseLookups:3,realHostedSession:true,pageErrors:0,purchasesCreated:0,transactionsSigned:0,paidContinuesActivated:0,installedWallet:false}));
}finally{if(loggedIn)await post('/api/tree-account',{action:'logout'}).catch(()=>{});await browser.close();}
