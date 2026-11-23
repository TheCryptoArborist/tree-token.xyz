import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assemble,preserve,SITE} from '../scripts/release-bnb-return.mjs';
const recorded=JSON.parse(fs.readFileSync(new URL('../production/arcade-cutoff-deployment-20261118.json',import.meta.url)));
const base=()=>({id:'a'.repeat(24),site_id:SITE,available_functions:structuredClone(recorded.available_functions),function_schedules:structuredClone(recorded.function_schedules),...recorded.runtime});
test('adds exactly two new paths and preserves all baseline hashes',()=>{const b={'/index.html':'a'.repeat(40)};const out=assemble(b);assert.equal(Object.keys(out).length,3);assert.equal(out['/index.html'],b['/index.html']);});
test('existing handoff paths block accidental replacement',()=>assert.throws(()=>assemble({'/play/bnb-return/app.js':'a'.repeat(40)})));
test('all existing provider records preserved exactly',()=>{const b=base();preserve(structuredClone(b),b);});
for(const [label,mutate]of [['provider change',b=>b.available_functions[0].a='different'],['function removal',b=>b.available_functions.pop()],['schedule change',b=>b.function_schedules[0].cron='1 * * * *'],['runtime change',b=>b.blobs_region='other']])test('reject '+label,()=>{const b=base(),c=structuredClone(b);mutate(c);assert.throws(()=>preserve(c,b));});
