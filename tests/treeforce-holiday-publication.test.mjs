import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assembleHoliday} from '../scripts/treeforce-local/publish-holiday-review.mjs';
import {fingerprint} from '../scripts/treeforce-local/capture-production-inventory.mjs';
import {digest} from '../scripts/treeforce-local/prepare-preserved-candidate.mjs';
const root='production/treeforce-holiday-review-r16',p=JSON.parse(fs.readFileSync(root+'/candidate.json'));
test('approved eight additions retain all existing paths and exact bytes',()=>{
 assert.equal(fingerprint(p),fs.readFileSync(root+'/candidate.json.sha256','utf8').trim());
 const r=assembleHoliday(p.baseline,p);assert.equal(r.payload.length,8);
 for(const [name,hash]of Object.entries(p.baseline.files))assert.equal(r.files[name],hash);
 for(const f of r.payload){const b=fs.readFileSync(root+f.path);assert.equal(digest(b),f.sha256);assert.equal(digest(b,'sha1'),f.sha1);}
});
test('reject changed baseline, extra payload, and case-insensitive collision',()=>{
 const b=structuredClone(p.baseline);b.files['/index.html']='a'.repeat(40);assert.throws(()=>assembleHoliday(b,p));
 const extra=structuredClone(p);extra.payload['/extra.js']=Object.values(p.payload)[0];assert.throws(()=>assembleHoliday(p.baseline,extra));
 const collision=structuredClone(p);collision.baseline.files['/PLAY/TREEFORCE89/REVIEW/HOLIDAY/INDEX.HTML']='a'.repeat(40);assert.throws(()=>assembleHoliday(collision.baseline,collision));
});
