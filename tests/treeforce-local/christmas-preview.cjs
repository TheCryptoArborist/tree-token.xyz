const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin=process.env.TREEFORCE_URL || 'http://127.0.0.1:4195';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const out=process.env.TREEFORCE_OUTPUT || 'docs/treeforce89-christmas-preview';fs.mkdirSync(out,{recursive:true});const results=[];
 try {
 for(const width of [390,1000]) for(const theme of ['normal','christmas']) {
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
   if(url.pathname.endsWith('christmas.html')){const response=await route.fetch();return route.fulfill({response,body:(await response.text()).replace('game = createCanopyGame','game = window.__game = createCanopyGame')});}
   return route.continue();
  });
  await page.goto(`${origin}/__local/christmas.html?lab=1&revision=r15&theme=${theme}`);
  await page.waitForFunction(()=>window.__game?.scene.getScene('game')?.player);
  await page.evaluate(()=>{const s=__game.scene.getScene('game');s.guideClose?.();if(s.paused)s.togglePause();});
  await page.waitForTimeout(2500);
  const state=await page.evaluate(()=>{const s=__game.scene.getScene('game');const snow=s.children.getByName('christmas-snow');return {ribbon:!!s.children.getByName('christmas-arborwing'),snow:!!snow,depth:snow?.depth,physics:!!snow?.body,player:!!s.player.active};});
  assert.equal(state.ribbon,theme==='christmas');assert.equal(state.snow,theme==='christmas');assert.equal(state.physics,false);assert.equal(state.player,true);
  if(theme==='christmas')assert.equal(state.depth,-2);
  await page.locator('#practice canvas').screenshot({path:`${out}/${theme}-${width}.png`});
  assert.deepEqual(errors,[]);results.push({width,theme,...state,errors});await page.close();
 }
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify(results,null,2));console.log(results);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
