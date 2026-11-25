const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];try{
for(const [width,height] of [[390,844],[1280,720],[1440,900],[1920,1080],[2560,1440]]){
const p=await b.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/**',r=>r.fulfill({json:{entries:[]}}));
await p.goto('http://127.0.0.1:4205/play/treeforce89/',{waitUntil:'networkidle'});await p.locator('canvas').waitFor();
const measure=()=>p.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return{width:r.width,height:r.height,top:r.top,bottom:r.bottom,internalWidth:c.width,internalHeight:c.height,overflow:document.documentElement.scrollWidth>innerWidth}});
await p.locator('link[href*="desktop-r19"]').evaluate(e=>e.disabled=true);await p.waitForTimeout(150);const before=await measure();
await p.locator('link[href*="desktop-r19"]').evaluate(e=>e.disabled=false);await p.waitForTimeout(150);const after=await measure();
assert.equal(after.overflow,false);assert(Math.abs(after.width/after.height-2/3)<.002);assert.equal(before.internalWidth,after.internalWidth);assert.equal(before.internalHeight,after.internalHeight);
if(width<1000)assert.deepEqual(before,after);else{assert(after.width>before.width);assert(after.bottom<=height);}
if(width===1440||width===1920)await p.locator('.game-frame').screenshot({path:`docs/treeforce89-pilot-cabinet/desktop-${width}.png`});
assert.deepEqual(errors,[]);results.push({width,height,before,after,increasePercent:Math.round((after.width/before.width-1)*100),errors});await p.close();
}fs.writeFileSync('docs/treeforce89-pilot-cabinet/desktop-checks.json',JSON.stringify(results,null,2));console.log(results);}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
