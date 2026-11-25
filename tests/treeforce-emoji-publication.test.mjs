import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assembleHoliday,REVIEW} from '../scripts/treeforce-local/publish-festive-emojis.mjs';import {fingerprint} from '../scripts/treeforce-local/capture-production-inventory.mjs';import {digest} from '../scripts/treeforce-local/prepare-preserved-candidate.mjs';
const root='production/treeforce-festive-emojis',p=JSON.parse(fs.readFileSync(root+'/candidate.json'));
test('only two festive strings change, every other static path retained',()=>{
 assert.equal(fingerprint(p),fs.readFileSync(root+'/candidate.json.sha256','utf8').trim());const r=assembleHoliday(p.baseline,p);assert.equal(r.payload.length,1);
 const body=fs.readFileSync(root+REVIEW,'utf8');assert.equal(body,p.previousSource.replace('A little Christmas magic arrives in…','🎄✨ A little Christmas magic arrives in…').replace('Keep the Christmas spirit flying! Time remaining…','🎄🎁 Keep the Christmas spirit flying! Time remaining…'));assert.equal(digest(body),p.payload[REVIEW].sha256);assert.equal(digest(body,'sha1'),p.payload[REVIEW].sha1);
 assert.deepEqual(Object.keys(p.baseline.files).filter(k=>p.files[k]!==p.baseline.files[k]),[REVIEW]);
});
test('reject stale source and extra payload',()=>{
 const bad=structuredClone(p);bad.previousSha1='a'.repeat(40);assert.throws(()=>assembleHoliday(p.baseline,bad));const extra=structuredClone(p);extra.payload['/other']=extra.payload[REVIEW];assert.throws(()=>assembleHoliday(p.baseline,extra));
});
