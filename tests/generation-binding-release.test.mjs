import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assemble,preserve,SITE,FN} from '../scripts/release-generation-binding.mjs';
const recorded=JSON.parse(fs.readFileSync(new URL('../production/arcade-cutoff-deployment-20261118.json',import.meta.url)));
function fixture(){const baseline={id:'a'.repeat(24),site_id:SITE,available_functions:structuredClone(recorded.available_functions),function_schedules:structuredClone(recorded.function_schedules),...recorded.runtime};
 const added={...structuredClone(baseline.available_functions[0]),n:FN,d:'f'.repeat(64)};const candidate={...structuredClone(baseline),id:'b'.repeat(24),available_functions:[...structuredClone(baseline.available_functions),added]};return {baseline,candidate,added};}
test('static assembly adds exactly two paths without replacing existing content',()=>{const base={'/index.html':'a'.repeat(40)};const files=assemble(base);assert.equal(files['/index.html'],base['/index.html']);assert.equal(Object.keys(files).length,3);assert.equal(Object.keys(base).length,1);});
test('refuses collision with existing canonical signing path',()=>assert.throws(()=>assemble({'/play/generation-binding/app.js':'a'.repeat(40)})));
test('preserves complete records and allows only pinned addition',()=>{const {candidate,baseline,added}=fixture();preserve(candidate,baseline,added);});
for(const [label,mutate] of [
 ['provider mutation',c=>c.available_functions[0].a='other'],
 ['package mutation',c=>c.available_functions[0].d='0'.repeat(64)],
 ['schedule deletion',c=>c.function_schedules.pop()],
 ['runtime mutation',c=>c.blobs_region='other'],
 ['extra backend',c=>c.available_functions.push({...c.available_functions[0],n:'unapproved'})],
 ['missing backend',c=>c.available_functions.splice(1,1)],
 ['changed addition',c=>c.available_functions.at(-1).d='e'.repeat(64)],
])test('reject '+label,()=>{const {candidate,baseline,added}=fixture();const expected=structuredClone(added);mutate(candidate);assert.throws(()=>preserve(candidate,baseline,expected));});
