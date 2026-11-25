const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const origin='http://127.0.0.1:4205';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{for(const width of [320,390,1000]){
 const p=await b.newPage({viewport:{width,height:960},deviceScaleFactor:2});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 let mode='populated';
 const entries=Array.from({length:12},(_,i)=>({username:['ArborwingAce','Emerald Guardian','CanopyCommander','Very Long Pilot Name','<img src=x onerror=1>'][i%5],score:125000-i*9876,badges:['first-blight','clean-canopy']}));
 await p.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==origin||!['GET','HEAD'].includes(q.method()))return r.abort();
 if(u.pathname==='/api/treeforce89-leaderboard'&&q.headers().authorization)return r.fulfill({json:{username:'ArborwingAce',badges:['first-blight','blight-hunter','grove-guardian','first-canopy','deep-patrol','chain-reaction','ancient-arborwing','perfect-shield','victory-boost','boom-bloom','tyrant-toppler','canopy-ace']}});
 if(u.pathname==='/api/treeforce89-leaderboard')return r.fulfill({status:mode==='error'?503:200,json:{entries:mode==='populated'?entries:[]}});
 if(u.pathname.startsWith('/api/'))return r.fulfill({status:401,json:{error:'Local review'}});
 // Expose the real cabinet component to exercise wallet-backed visual states without a real signature.
 if(u.pathname.endsWith('/index-review-r19.js')){const res=await r.fetch();let text=await res.text();text=text.replace('(0,b.createRoot)','window.__pilotFixture={React:x,jsx:S,Component:_h,createRoot:b.createRoot};(0,b.createRoot)');return r.fulfill({response:res,body:text});}
 return r.continue();});
 await p.goto(origin+'/play/treeforce89/',{waitUntil:'networkidle'});
 const board=p.locator('.pilot-board');await board.locator(':scope > summary').click();
 const rows=board.locator('tbody tr');await rows.nth(9).waitFor();assert.equal(await rows.count(),10);
 assert.equal(await rows.nth(0).locator('th').innerText(),'ArborwingAce\nCANOPY CHAMPION');
 assert.equal(await rows.nth(4).locator('th').textContent(),'<img src=x onerror=1>');assert.equal(await board.locator('tbody img').count(),0);
 assert.equal(await rows.nth(9).locator('td').first().innerText(),'10');
 assert.equal(await rows.nth(0).getAttribute('class'),'pilot-rank pilot-rank-1');
 await board.locator('details > summary').click();
 assert.equal(await board.locator('.pilot-medal').count(),13);
 assert.equal(await board.locator('.pilot-badges small').allTextContents().then(a=>a.every(t=>t==='LOCKED')),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await board.locator('.pilot-table').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 assert.equal(await p.evaluate(()=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>=1200);i.onerror=()=>resolve(false);i.src='/assets/treeforce-achievements/canopy-medals-r19.webp'})),true);
 const insignia=await rows.locator('.pilot-rank-number').evaluateAll(els=>els.map(e=>({art:getComputedStyle(e).backgroundImage,text:e.textContent})));
 assert(insignia[0].art.includes('champion.svg'));assert(insignia[1].art.includes('silver.svg'));assert(insignia[2].art.includes('bronze.svg'));assert(insignia.slice(3).every(e=>e.art.includes('contender.svg')));
 assert.deepEqual(insignia.map(e=>e.text),Array.from({length:10},(_,i)=>String(i+1)));
 for(const asset of ['champion','silver','bronze','contender'])assert.equal(await p.evaluate(name=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(true);i.onerror=()=>resolve(false);i.src='/assets/treeforce-ranks/'+name+'.svg'}),asset),true);
 entries[4].username='Root Runner';entries[9].username='Grove Defender';await board.getByRole('button',{name:'Refresh leaderboard'}).click();await p.getByRole('rowheader',{name:'Root Runner',exact:true}).waitFor();
 await board.locator('.pilot-table').screenshot({path:`docs/treeforce89-pilot-cabinet/leaderboard-${width}.png`});
 await board.locator('.pilot-badges').screenshot({path:`docs/treeforce89-pilot-cabinet/badges-locked-${width}.png`});

 mode='empty';await board.getByRole('button',{name:'Refresh leaderboard'}).click();await p.getByText('No scores yet. Set the first canopy record.').waitFor();
 mode='error';await board.getByRole('button',{name:'Refresh leaderboard'}).click();await p.getByText('Leaderboard could not load.').waitFor();
 mode='populated';await board.getByRole('button',{name:'Refresh leaderboard'}).click();await rows.nth(9).waitFor();

 await p.evaluate(()=>{
 document.querySelector('#root').style.display='none';document.querySelector('.gateway-intro').style.display='none';
 const host=document.createElement('div');host.id='pilot-fixture';host.style.cssText='max-width:880px;margin:auto';document.body.append(host);
 const f=window.__pilotFixture;f.createRoot(host).render(f.jsx.jsx(f.Component,{session:{wallet:'0x'+'1'.repeat(64),sessionToken:'fixture-only',runId:'fixture-run'}}));
 });
 const fixture=p.locator('#pilot-fixture .pilot-board');await fixture.locator(':scope > summary').click();await fixture.locator('details > summary').click();
 await p.waitForFunction(()=>document.querySelectorAll('#pilot-fixture .earned').length===12);
 assert.equal(await fixture.locator('.pilot-badges small').allTextContents().then(a=>a.filter(t=>t==='EARNED').length),12);
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('treeforce-run-ended',{detail:{runId:'fixture-run',ranked:true,score:50000,wave:5,cleanWaves:1}})));
 await p.waitForFunction(()=>document.querySelectorAll('#pilot-fixture .earned').length===13);
 assert.equal(await fixture.locator('.pilot-badges small').allTextContents().then(a=>a.filter(t=>t==='UNLOCKED THIS RUN · SAVE SCORE').length),1);
 await fixture.locator('.pilot-badges').screenshot({path:`docs/treeforce89-pilot-cabinet/badges-earned-${width}.png`});
 if(width===1000)await fixture.locator('.pilot-badges').screenshot({path:'docs/treeforce89-pilot-cabinet/achievement-art-preview.png'});
 assert.deepEqual(errors,[]);results.push({width,topTen:true,trophyMedalsAndCrests:true,safeNames:true,thirteenMedals:true,noOverflow:true,emptyAndError:true,savedAndNewlyUnlocked:true,errors});await p.close();
}fs.writeFileSync('docs/treeforce89-pilot-cabinet/browser-checks.json',JSON.stringify(results,null,2));console.log(results);
}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
