import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const {chromium} = await import(pathToFileURL(process.env.TREE_ARMY_BROWSER_MODULE).href);
const candidate = process.env.TREE_ARMY_TEST_BASE ? null : JSON.parse(fs.readFileSync('.netlify/tree-army-candidate.json'));
if(candidate) assert(/^[a-f0-9]{24}$/.test(candidate.id));
const base = process.env.TREE_ARMY_TEST_BASE || `https://${candidate.id}--tree-token.netlify.app`;
const url = base.replace(/\/$/,'') + '/play/tree-army/test/';
fs.mkdirSync('.netlify',{recursive:true});
const browser = await chromium.launch({headless:true});
const results=[];
try {
  for (const [width,height,label] of [[1440,1000,'desktop'],[390,844,'mobile'],[320,568,'small-mobile'],[844,390,'landscape']]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(url,{waitUntil:'networkidle'});
    assert(response?.ok(),'Playtest page did not load');
    assert.match(await page.title(),/Tree Army/);
    await page.waitForFunction(()=>document.getElementById('asset-status').hidden);
    assert.equal(await page.locator('.unit-portrait').count(),3,'Unit portraits missing');
    assert(await page.locator('.unit-portrait').evaluateAll(nodes=>nodes.every(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0);})), 'Empty portrait artwork');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal page overflow');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
    assert.equal(await page.getByRole('link',{name:/TREE ARCADE/}).getAttribute('href'),'/play/');
    await page.getByRole('button',{name:'Show me how',exact:true}).click();
    await page.getByRole('heading',{name:'Protect the Tree of Life',exact:true}).waitFor();
    await page.getByRole('button',{name:'Next: your hero',exact:true}).click();
    await page.getByRole('heading',{name:'Lead from the front',exact:true}).waitFor();
    await page.getByRole('button',{name:'Next: your army',exact:true}).click();
    await page.getByRole('heading',{name:'Grow your army',exact:true}).waitFor();
    await page.getByRole('button',{name:'Defend the grove',exact:true}).click();
    await page.locator('#overlay').waitFor({state:'hidden'});
    await page.locator('#field-note').waitFor({state:'visible'});
    if(label==='desktop') {
      for(const keys of [['ArrowRight'],['ArrowLeft'],['ArrowUp'],['ArrowDown'],['ArrowRight','ArrowUp'],['ArrowLeft','ArrowDown'],['ArrowLeft','ArrowUp'],['ArrowRight','ArrowDown']]) {
        for(const key of keys)await page.keyboard.down(key);
        await page.waitForTimeout(100);
        for(const key of keys)await page.keyboard.up(key);
      }
      assert.match(await page.locator('#field-note').innerText(),/Summon/);
    } else {
      for(const selector of ['#joystick','#blast','#shield','[data-unit="sprout"]','[data-unit="archer"]','[data-unit="oak"]']) {
        const box=await page.locator(selector).boundingBox();
        assert(box && box.x>=0 && box.y>=0 && box.x+box.width<=width+1 && box.y+box.height<=height+1,selector+' must stay inside phone viewport');
        assert(box.height>=44,selector+' touch target is too short');
      }
      assert(await page.locator('.unit-name').evaluateAll(nodes=>nodes.every(node=>{
        const range=document.createRange();range.selectNodeContents(node);
        const text=range.getBoundingClientRect(),button=node.closest('button').getBoundingClientRect();
        return text.left>=button.left && text.right<=button.right;
      })), 'Troop names must fit their cards');
      const box=await page.locator('#battle').boundingBox();
      const ratio=await page.locator('#battle').evaluate(c=>c.width/c.height);
      assert(Math.abs(ratio-box.width/box.height)<.005,'Mobile canvas must preserve character proportions');
      const client=await context.newCDPSession(page);
      const y=Math.round(box.y+box.height*.45),x=Math.round(box.x+box.width*.45);
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45,y,id:1}]});
      await page.waitForTimeout(200);
      assert.match(await page.locator('#drag-cue').innerText(),/Moving →/);
      assert.match(await page.locator('#field-note').innerText(),/Summon/);
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-45,y,id:1}]});
      assert.match(await page.locator('#drag-cue').innerText(),/Moving ←/);
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-40,id:1}]});
      assert.match(await page.locator('#drag-cue').innerText(),/Moving ↑/);
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert(await page.locator('#drag-cue').isHidden(),'Lifting finger must end drag');
      assert.equal(await page.evaluate(()=>scrollY),0,'Battlefield gesture must not scroll page');
      const stick=await page.locator('#joystick').boundingBox();
      const sx=Math.round(stick.x+stick.width/2),sy=Math.round(stick.y+stick.height/2);
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:2}]});
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+20,y:sy-20,id:2}]});
      assert.match(await page.locator('#drag-cue').innerText(),/Moving ↑→/);
      const summon=await page.locator('[data-unit="sprout"]').boundingBox();
      const multiSap=Number(await page.locator('#sap').innerText());
      const second={x:Math.round(summon.x+summon.width/2),y:Math.round(summon.y+summon.height/2),id:3};
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx+20,y:sy-20,id:2},second]});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[second]});
      await page.waitForFunction(before=>Number(document.getElementById('sap').textContent)<before,multiSap,{timeout:1500});
      assert(await page.locator('#drag-cue').isVisible(),'Summoning must not release the held joystick');
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert(await page.locator('#drag-cue').isHidden(),'Multi-touch release must reset joystick');
      for(const [dx,dy,cue] of [[30,0,'→'],[-30,0,'←'],[0,-30,'↑'],[0,30,'↓'],[20,-20,'↑→'],[-20,20,'↓←'],[-20,-20,'↑←'],[20,20,'↓→']]) {
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:4}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+dx,y:sy+dy,id:4}]});
        await page.waitForTimeout(100);
        assert((await page.locator('#drag-cue').innerText()).includes(cue),'Eight-direction joystick feedback: '+cue);
        await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert(await page.locator('#drag-cue').isHidden(),'Release after '+cue);
      }
      await client.detach();
    }
    await page.waitForFunction(()=>!document.querySelector('[data-unit="sprout"]').disabled);
    const sap=Number(await page.locator('#sap').innerText());
    await page.locator('[data-unit="sprout"]').click();
    await page.waitForFunction(before=>Number(document.getElementById('sap').textContent)<before,sap,{timeout:3000});
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.getByRole('heading',{name:'Take a breath.',exact:true}).waitFor();
    const pausedSap=await page.locator('#sap').innerText();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#sap').innerText(),pausedSap,'Pause did not freeze battle');
    await page.getByRole('button',{name:'Resume battle',exact:true}).click();
    await page.locator('#blast').click();
    await page.waitForTimeout(100);
    assert(await page.locator('#blast').isDisabled(),'Cannon cooldown missing');
    await page.locator('#shield').click();
    await page.waitForTimeout(100);
    assert(await page.locator('#shield').isDisabled(),'Shield cooldown missing');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1600);
    await page.keyboard.up('ArrowRight');
    await page.screenshot({path:`.netlify/tree-army-${label}.png`,fullPage:true});
    assert.equal(errors.length,0,errors.join('\n'));
    results.push({label,width,height,passed:true});
    await context.close();
  }
  const failureContext=await browser.newContext();
  const failurePage=await failureContext.newPage();
  await failurePage.route('**/assets/tree-hero-rig.webp',route=>route.abort());
  await failurePage.goto(url,{waitUntil:'networkidle'});
  await failurePage.getByText('The artwork could not load. Reload this page to try again.',{exact:true}).waitFor();
  assert(await failurePage.locator('#next').isDisabled(),'Failed artwork must block battle start');
  await failureContext.close();
} finally {await browser.close();}
fs.writeFileSync('.netlify/tree-army-browser-checks.json',JSON.stringify({url,results},null,2));
console.log('Tree Army browser checks passed: '+results.map(r=>r.label).join(', '));
