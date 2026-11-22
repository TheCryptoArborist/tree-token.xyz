import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMonthUnlock, mountNextMonthUnlocks } from '../scripts/arcade-next-month-unlocks.js';
import { ADVENT_MONTH, ADVENT_DAYS, adventDayStatus, adventTreeSVG, mountAdventGrove } from '../scripts/arcade-advent-grove.js';

const { JSDOM } = await import(process.env.ARCADE_TEST_JSDOM || new URL('../vendor/arcade-monthly/node_modules/jsdom/lib/api.js', import.meta.url).href);
const A='0x'+'a'.repeat(64), B='0x'+'b'.repeat(64);
const snapshot=(wallet=A, checkedDates=['2026-12-01','2026-12-02','2026-12-05'], recoveredDates=['2026-12-05'])=>({
  wallet, monthKey:ADVENT_MONTH, dateKey:'2026-12-06', checkedDates, recoveredDates,
  missedDates:['2026-12-03','2026-12-04'], streak:1, checkedInDays:checkedDates.length
});
test('next December unlock uses UTC midnight and the configured Christmas Guardians collection',()=>{
 const t=nextMonthUnlock(Date.parse('2026-11-30T23:59:59Z'));
 assert.equal(t.key,'2026-12');assert.equal(t.iso,'2026-12-01T00:00:00.000Z');
 assert.equal(t.remaining,1);assert.equal(t.collectionTitle,'December · Christmas Guardians');
 assert.equal(t.collectionConfigured,true);
});
test('January rollover never promises a January badge collection that has not been configured',()=>{
 const t=nextMonthUnlock(Date.parse('2026-12-31T23:59:59Z'));
 assert.equal(t.key,'2027-01');assert.equal(t.remaining,1);
 assert.equal(t.collectionConfigured,false);assert.equal(t.collectionTitle,null);
});
test('advent uses 31 named trees with one emblem-shaped SVG and no permanent water drop',()=>{
 assert.equal(ADVENT_DAYS.length,31);
 assert.equal(new Set(ADVENT_DAYS).size,31);
 assert.match(adventTreeSVG(25),/Tree Hero Christmas Tree/);
 assert.doesNotMatch(adventTreeSVG(5),/M19-16C19-16/);
});
test('saved, restored, missed, current, future, and unvisited status derives from wallet attendance',()=>{
 const p=snapshot();
 assert.equal(adventDayStatus(1,p),'saved');
 assert.equal(adventDayStatus(5,p),'recovered');
 assert.equal(adventDayStatus(3,p),'missed');
 assert.equal(adventDayStatus(6,p),'today');
 assert.equal(adventDayStatus(7,p),'future');
 assert.equal(adventDayStatus(1,p,false),'future');
 assert.equal(adventDayStatus(1,{...p,monthKey:'2026-11'}),'future');
});
test('advent calendar never shows the word Recovered on tiles and restores detail only after click',()=>{
 const dom=new JSDOM('<div id="arcade-daily-growth"><section class="arcade-attendance-forest"><div class="forest-landscape"></div></section></div>',{url:'https://tree-token.xyz/play/'});
 const doc=dom.window.document,card=doc.querySelector('.arcade-attendance-forest');
 const widget=mountAdventGrove({card,doc});
 widget.update(snapshot(),{wallet:A,fresh:true});
 const tile=doc.querySelector('[data-advent-day="5"]');
 assert.equal(tile.dataset.adventStatus,'recovered');
 assert.doesNotMatch(tile.textContent,/Recovered|Restored/i);
 assert.match(tile.getAttribute('aria-label'),/restored/);
 tile.click();
 assert.match(doc.querySelector('[data-advent-detail]').textContent,/December 5 check-in restored/);
 widget.update(snapshot(B,['2026-12-01'],[]),{wallet:B,fresh:true});
 assert.equal(doc.querySelector('[data-advent-day="5"]').disabled,true);
 widget.update(null,{wallet:null,fresh:false});
 assert.equal(doc.querySelector('#arcade-advent-grove').hidden,true);
 widget.destroy();dom.window.close();
});
test('countdown tiles render on Daily, Monthly, and Badges and differentiate unscheduled badges',()=>{
 const dom=new JSDOM('<section id="growth-today-panel"><div id="arcade-attendance-forest"></div></section><section id="growth-month-panel"></section><section id="growth-badges-panel"></section>');
 const doc=dom.window.document;
 let current=Date.parse('2026-11-22T12:00:00Z'),callback,removed=false;
 const widget=mountNextMonthUnlocks({root:doc,now:()=>current,timers:{setInterval(fn){callback=fn;return 11;},clearInterval(n){assert.equal(n,11);removed=true;}}});
 assert.equal(doc.querySelectorAll('[data-arcade-next-unlock]').length,3);
 assert.match(doc.querySelector('[data-unlock-badge-name]').textContent,/Christmas Guardians/);
 assert.ok(doc.querySelector('[data-unlock-badges]').textContent.includes('d '));
 current=Date.parse('2026-12-01T00:00:00Z');callback();
 assert.match(doc.querySelector('[data-unlock-badges]').textContent,/Not announced/);
 assert.match(doc.querySelector('[data-unlock-date]').textContent,/No badge release date/);
 widget.destroy();assert.equal(removed,true);
 assert.equal(doc.querySelectorAll('[data-arcade-next-unlock]').length,0);
 dom.window.close();
});
