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
  for (const [width,height,label] of [[1440,1000,'desktop'],[390,844,'mobile'],[320,740,'small-mobile'],[844,390,'landscape']]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(url,{waitUntil:'networkidle'});
    assert(response?.ok(),'Playtest page did not load');
    assert.match(await page.title(),/Tree Army/);
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
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(250);
      await page.keyboard.up('ArrowRight');
      assert.match(await page.locator('#field-note').innerText(),/Summon/);
    } else {
      const box=await page.locator('#right').boundingBox();
      await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    }
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
    await page.screenshot({path:`.netlify/tree-army-${label}.png`,fullPage:true});
    assert.equal(errors.length,0,errors.join('\n'));
    results.push({label,width,height,passed:true});
    await context.close();
  }
} finally {await browser.close();}
fs.writeFileSync('.netlify/tree-army-browser-checks.json',JSON.stringify({url,results},null,2));
console.log('Tree Army browser checks passed: '+results.map(r=>r.label).join(', '));
