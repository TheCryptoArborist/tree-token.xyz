import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertScopedFunctions,TARGET} from '../scripts/release-treeforce89-scoped-api.mjs';
const original=JSON.parse(readFileSync('docs/treeforce89-payment-readiness-baseline.json')).functions;
test('scoped release allows one package change and rejects unrelated identities or runtime drift',()=>{
 const actual=structuredClone(original),next=actual.find(f=>f.n===TARGET),digest='a'.repeat(64);
 next.d=digest;next.id='new-id';next.c='new-created';next.s+=100;
 assert.doesNotThrow(()=>assertScopedFunctions(actual,original,digest));
 for(const mutate of [a=>a.find(f=>f.n!==TARGET).d='b'.repeat(64),a=>a.find(f=>f.n===TARGET).m=2048,a=>a.find(f=>f.n===TARGET).ro=[],a=>a.push(a[0])]){
  const changed=structuredClone(actual);mutate(changed);assert.throws(()=>assertScopedFunctions(changed,original,digest));
 }
});
