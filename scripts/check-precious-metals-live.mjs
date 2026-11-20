// Actual third-party TradingView smoke test (not mocked). Read-only chart visits.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fingerprint} from './release-preserved-production.mjs';
const plan=JSON.parse(await fs.readFile('.netlify/precious-metals/plan.json'));
const candidate=JSON.parse(await fs.readFile('.netlify/precious-metals/candidate.json'));
const modulePath=process.env.PRECIOUS_METALS_BROWSER_MODULE;
assert(modulePath,'Browser module required');
const {chromium}=await import(pathToFileURL(modulePath).href);
const origin='https://'+candidate.id+'--tree-token.netlify.app';
const symbols=[['GOLD','TVC:GOLD',/gold/i],['SILVER','TVC:SILVER',/silver/i],['GOLDSILVER','TVC:GOLDSILVER',/gold.*silver/i]];
const report={schemaVersion:1,result:'failed',testOnly:false,sourceCommit:plan.sourceCommit,sourceTree:plan.sourceTree,candidateId:candidate.id,planSha256:fingerprint(plan),origin,checkedAt:new Date().toISOString(),noWalletOrPaymentActions:true,provider:'TradingView',symbols:symbols.map(x=>x[1]),viewportWidths:[1363],checks:{goldChartRendered:false,silverChartRendered:false,goldSilverRatioRendered:false,ratioCorrectDirection:false,chartInteraction:false,sourceLinks:false},charts:[],observations:[]};
await fs.mkdir('.netlify/precious-metals-live',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1363,height:950}});
 const res=await page.goto(origin+'/market-insights/',{waitUntil:'domcontentloaded',timeout:35000});
 assert(res?.ok(),'Candidate unavailable');
 await page.locator('#mi-tab-market').click();
 for(const [key,symbol,label] of symbols){
   await page.locator('[data-tv-symbol="'+key+'"]').click();
   await page.waitForFunction(k=>document.querySelector('[data-tv-symbol="'+k+'"]')?.getAttribute('aria-pressed')==='true',key,{timeout:12000});
   let evidence=null;
   for(let i=0;i<12&&!evidence;i++){
     await page.waitForTimeout(2000);
     for(const frame of page.frames().filter(f=>f!==page.mainFrame()&&/tradingview/i.test(f.url()))){
       try{
         const state=await frame.evaluate(()=>({title:document.title,text:(document.body?.innerText||'').slice(0,8000),canvases:[...document.querySelectorAll('canvas')].filter(c=>c.width>180&&c.height>90).length}));
         if(i===1||i===6||i===11)console.log(JSON.stringify({key,attempt:i,frameURL:frame.url(),title:state.title,canvases:state.canvases,text:state.text.slice(0,220)}));
         if(state.canvases>0&&label.test(state.title+' '+state.text)&&!/invalid symbol|symbol not found/i.test(state.text)){evidence={title:state.title,canvasCount:state.canvases,textSample:state.text.slice(0,300)};break;}
       }catch{}
     }
   }
   assert(evidence,'Real TradingView '+symbol+' chart did not render');
   const source=new URL(await page.locator('#mi-tv-stage .tradingview-widget-copyright a').getAttribute('href'));
   assert.equal(source.hostname,'www.tradingview.com');
   if(key==='GOLDSILVER')assert.equal(source.pathname,'/symbols/TVC-GOLDSILVER/');
   await page.locator('#mi-pane-market').screenshot({path:'.netlify/precious-metals-live/'+key.toLowerCase()+'.png'});
   report.charts.push({key,symbol,evidence,source:source.href});
 }
 const desc=await page.locator('#mi-goldsilver-guide').innerText();
 assert.match(desc,/gold price divided by silver price/i);
 assert.match(desc,/rising ratio means gold/i);
 assert.match(desc,/falling ratio means silver/i);
 for(const k of Object.keys(report.checks))report.checks[k]=true;
 report.result='passed';
 report.observations.push('Actual TradingView frames displayed matching metal instruments and chart canvases, without synthetic provider fixtures.');
}catch(err){report.error=String(err.stack||err);}
finally{
 report.checkedAt=new Date().toISOString();
 await fs.writeFile('.netlify/precious-metals-live-review.json',JSON.stringify(report,null,2)+'\n');
 await browser.close();
}
console.log(JSON.stringify({result:report.result,charts:report.charts,error:report.error},null,2));
if(report.result!=='passed')process.exitCode=1;
