import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nextMonthUnlock, mountNextMonthUnlocks } from '../scripts/arcade-next-month-unlocks.js';
import { ADVENT_MONTH, ADVENT_DAYS, ADVENT_ART_ASSET, ADVENT_ILLUSTRATED_DAYS, adventDayStatus, adventTreeSVG, mountAdventGrove } from '../scripts/arcade-advent-grove.js';
import { createAdventPreviewSnapshot, mountAdventPreview } from '../scripts/arcade-advent-preview.js';

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

test('the four approved dated illustrations use the shared original artwork sheet',()=>{
 assert.deepEqual(ADVENT_ILLUSTRATED_DAYS,[1,3,10,25]);
 for(const day of ADVENT_ILLUSTRATED_DAYS){
  const dom=new JSDOM(adventTreeSVG(day,true));
  const svg=dom.window.document.querySelector('svg');
  assert.equal(svg.dataset.adventIllustration,String(day));
  assert.equal(svg.querySelector('image').getAttribute('href'),ADVENT_ART_ASSET);
  assert.equal(svg.getAttribute('aria-label'),ADVENT_DAYS[day-1]);
  assert.ok(svg.getAttribute('viewBox').split(' ').every(value=>Number.isFinite(Number(value))));
  dom.window.close();
 }
 assert.doesNotMatch(adventTreeSVG(2),/data-advent-illustration/);
});

test('wallet mismatch hides and clears prior earned artwork before showing another account',()=>{
 const dom=new JSDOM('<section class="arcade-attendance-forest"><div class="forest-landscape"></div></section>');
 const doc=dom.window.document,widget=mountAdventGrove({card:doc.querySelector('section')});
 widget.update(snapshot(),{wallet:A,fresh:true});
 assert.equal(doc.querySelectorAll('[data-advent-day]').length,31);
 widget.update(snapshot(),{wallet:B,fresh:true});
 assert.equal(doc.querySelector('#arcade-advent-grove').hidden,true);
 assert.equal(doc.querySelector('[data-advent-detail]').textContent,'');
 assert.equal(doc.querySelectorAll('[data-advent-day]').length,0);
 widget.update(snapshot(B,['2026-12-01'],[]),{wallet:B,fresh:false});
 assert.equal(doc.querySelector('#arcade-advent-grove').hidden,false);
 assert.match(doc.querySelector('.advent-freshness').textContent,/last saved attendance/);
 assert.equal(doc.querySelector('[data-advent-day="5"]').disabled,true);
 widget.destroy();dom.window.close();
});

test('selecting an earned date preserves keyboard focus and a new recovery selects its exact date',()=>{
 const dom=new JSDOM('<section class="arcade-attendance-forest"><div class="forest-landscape"></div></section>',{pretendToBeVisual:true});
 const doc=dom.window.document,widget=mountAdventGrove({card:doc.querySelector('section')});
 const before=snapshot(A,['2026-12-01','2026-12-05'],[]);
 widget.update(before,{wallet:A,fresh:true});
 const first=doc.querySelector('[data-advent-day="1"]');first.focus();first.click();
 assert.equal(doc.activeElement.dataset.adventDay,'1');
 assert.equal(doc.querySelector('[data-advent-day="1"]').getAttribute('aria-pressed'),'true');
 const after=snapshot(A,['2026-12-01','2026-12-03','2026-12-05'],['2026-12-03']);
 after.missedDates=['2026-12-04'];
 widget.update(after,{wallet:A,fresh:true});
 assert.equal(doc.querySelector('[data-advent-day="3"]').getAttribute('aria-pressed'),'true');
 assert.equal(doc.querySelector('[data-advent-detail] [data-advent-illustration]').dataset.adventIllustration,'3');
 assert.match(doc.querySelector('[data-advent-detail]').textContent,/December 3 check-in restored/);
 assert.equal(doc.activeElement.dataset.adventDay,'1');
 widget.destroy();dom.window.close();
});

test('sample recovery restores one exact date without inventing a connected streak',()=>{
 const initial=createAdventPreviewSnapshot();
 assert.deepEqual(initial.checkedDates,['2026-12-01','2026-12-10']);
 assert.equal(initial.streak,0);
 const recovered=createAdventPreviewSnapshot({recovered:true});
 assert.deepEqual(recovered.recoveredDates,['2026-12-03']);
 assert.equal(recovered.checkedInDays,3);assert.equal(recovered.streak,0);
 const both=createAdventPreviewSnapshot({recovered:true,revealed:true});
 assert.equal(both.checkedInDays,4);assert.equal(both.streak,1);
 assert.equal(both.missedDates.includes('2026-12-24'),true);
 assert.equal(adventDayStatus(26,both),'future');
});

test('standalone preview reveals, recovers and resets sample progress without an API request',async()=>{
 const html=await readFile(new URL('../play/advent-preview/index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://tree-token.xyz/play/advent-preview/',pretendToBeVisual:true});
 const doc=dom.window.document;let requests=0;
 dom.window.fetch=()=>{requests++;throw new Error('Preview must not request wallet or attendance data');};
 const widget=mountAdventPreview({doc});
 assert.ok(widget);assert.equal(doc.querySelectorAll('[data-advent-day]').length,31);
 assert.match(doc.querySelector('.preview-brand').textContent,/TREE ON SUI/);
 assert.equal(doc.querySelector('[data-preview-count]').textContent,'2 / 31');
 assert.equal(doc.querySelector('[data-advent-day="25"]').dataset.adventStatus,'today');
 assert.equal(doc.querySelector('[data-advent-day="26"]').disabled,true);
 doc.querySelector('[data-preview-reveal]').click();
 assert.equal(doc.querySelector('[data-preview-count]').textContent,'3 / 31');
 assert.equal(doc.querySelector('[data-preview-streak]').textContent,'1 day');
 assert.equal(doc.querySelector('[data-preview-deadline]').textContent,'Dec 27 · 00:00 UTC');
 assert.equal(doc.querySelector('[data-advent-day="25"]').getAttribute('aria-pressed'),'true');
 assert.match(doc.querySelector('[data-advent-detail]').textContent,/Today’s reveal/);
 doc.querySelector('[data-preview-recover]').click();
 assert.equal(doc.querySelector('[data-preview-count]').textContent,'4 / 31');
 assert.equal(doc.querySelector('[data-preview-streak]').textContent,'1 day');
 assert.equal(doc.querySelector('[data-advent-day="3"]').dataset.adventStatus,'recovered');
 assert.match(doc.querySelector('[data-advent-detail]').textContent,/December 3 check-in restored/);
 doc.querySelector('[data-preview-reset]').click();
 assert.equal(doc.querySelector('[data-preview-count]').textContent,'2 / 31');
 assert.equal(doc.querySelector('[data-preview-streak]').textContent,'0 days');
 assert.equal(doc.querySelector('[data-advent-day="25"]').dataset.adventStatus,'today');
 assert.equal(doc.querySelector('[data-advent-day="3"]').dataset.adventStatus,'missed');
 assert.equal(doc.querySelector('[data-advent-day="10"]').getAttribute('aria-pressed'),'true');
 assert.equal(doc.querySelector('[data-preview-reveal]').disabled,false);
 assert.equal(requests,0);
 widget.destroy();dom.window.close();
});
