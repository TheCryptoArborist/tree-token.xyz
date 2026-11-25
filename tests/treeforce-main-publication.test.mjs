import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fingerprint} from '../scripts/treeforce-local/capture-production-inventory.mjs';import {digest} from '../scripts/treeforce-local/prepare-preserved-candidate.mjs';
import {HOLIDAY_START,HOLIDAY_END,holidayMessage,holidayCountdown} from '../treeforce89/frontend/game/holiday-season.mjs';
const root='production/treeforce-main-r18',p=JSON.parse(fs.readFileSync(root+'/candidate.json'));
test('exactly two authorized HTML changes and seven additions; payload hashes match',()=>{
 assert.equal(fingerprint(p),fs.readFileSync(root+'/candidate.json.sha256','utf8').trim());assert.equal(Object.keys(p.payload).length,9);
 const changed=Object.keys(p.baseline.files).filter(k=>p.files[k]!==p.baseline.files[k]);assert.deepEqual(changed.sort(),['/play/index.html','/play/treeforce89/index.html']);
 for(const [name,f]of Object.entries(p.payload)){const b=fs.readFileSync(root+name);assert.equal(digest(b),f.sha256);assert.equal(digest(b,'sha1'),f.sha1);}
 const game=fs.readFileSync(root+'/play/treeforce89/index.html','utf8');assert.equal(game,p.originals['/play/treeforce89/index.html'].replace('/assets/index-share-r4.js','/assets/index-review-r18.js').replace('/mobile-r1.css','/mobile-review-r5.css'));
 const lobby=fs.readFileSync(root+'/play/index.html','utf8');const stripped=lobby.replace(/\n<div id="treeforce-holiday-cabinet"[\s\S]*?<\/div>/,'').replace('<script type="module" src="/scripts/treeforce-cabinet-holiday-r18.mjs"></script>\n','');assert.equal(stripped,p.originals['/play/index.html']);
});
test('shared approved messages and countdowns transition on exact UTC boundaries',()=>{
 assert.equal(holidayMessage(HOLIDAY_START-1),'A little Christmas magic arrives in…');assert.equal(holidayCountdown(HOLIDAY_START-1),'0d 00h 00m 01s');
 assert.equal(holidayMessage(HOLIDAY_START),'Keep the Christmas spirit flying! Time remaining…');assert.equal(holidayCountdown(HOLIDAY_START),'35d 00h 00m 00s');assert.equal(holidayMessage(HOLIDAY_END),'');assert.equal(holidayCountdown(HOLIDAY_END),'');
});

test('publication assembler rejects unauthorized path, stale baseline and module collision',async()=>{
 const {assembleHoliday}=await import('../scripts/treeforce-local/publish-main-holiday.mjs');assert.equal(assembleHoliday(p.baseline,p).payload.length,9);
 const bad=structuredClone(p);const [name,value]=Object.entries(bad.payload).find(([k])=>k.endsWith('holiday-mode-r18.js'));delete bad.payload[name];bad.payload['/unapproved.js']=value;assert.throws(()=>assembleHoliday(bad.baseline,bad));
 const stale=structuredClone(p.baseline);stale.files['/index.html']='a'.repeat(40);assert.throws(()=>assembleHoliday(stale,p));
 const collision=structuredClone(p);collision.baseline.files['/SCRIPTS/TREEFORCE-SEASON-R18.MJS']='a'.repeat(40);assert.throws(()=>assembleHoliday(collision.baseline,collision));
});
