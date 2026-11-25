import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assembleHoliday,REVIEW} from '../scripts/treeforce-local/publish-holiday-utc.mjs';
import {fingerprint} from '../scripts/treeforce-local/capture-production-inventory.mjs';
import {digest} from '../scripts/treeforce-local/prepare-preserved-candidate.mjs';
const root='production/treeforce-holiday-utc-r17',p=JSON.parse(fs.readFileSync(root+'/candidate.json'));
test('only review entry changes; five versioned additions match approved bytes',()=>{
 assert.equal(fingerprint(p),fs.readFileSync(root+'/candidate.json.sha256','utf8').trim());
 const r=assembleHoliday(p.baseline,p);assert.equal(r.payload.length,6);
 for(const [name,hash]of Object.entries(p.baseline.files))if(name!==REVIEW)assert.equal(r.files[name],hash);
 for(const f of r.payload){const b=fs.readFileSync(root+f.path);assert.equal(digest(b),f.sha256);assert.equal(digest(b,'sha1'),f.sha1);}
 const policy=fs.readFileSync(root+'/play/treeforce89/assets/holiday-mode-r17.js','utf8');assert(policy.includes('November 27 at 06:00 UTC'));assert(policy.includes('2026-11-27T06:00:00Z'));assert(!policy.includes('holidayPreviewNow'));
});
test('reject incorrect entry predecessor, stale baseline, extra payload and module collision',()=>{
 const wrong=structuredClone(p);wrong.previousReviewSha1='a'.repeat(40);assert.throws(()=>assembleHoliday(wrong.baseline,wrong));
 const b=structuredClone(p.baseline);b.files['/index.html']='a'.repeat(40);assert.throws(()=>assembleHoliday(b,p));
 const extra=structuredClone(p);extra.payload['/extra.js']=Object.values(p.payload)[0];assert.throws(()=>assembleHoliday(p.baseline,extra));
 const collision=structuredClone(p);collision.baseline.files['/PLAY/TREEFORCE89/ASSETS/HOLIDAY-MODE-R17.JS']='a'.repeat(40);assert.throws(()=>assembleHoliday(collision.baseline,collision));
});
