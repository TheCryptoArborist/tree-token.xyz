import assert from 'node:assert/strict';
import test from 'node:test';
import volume from '../netlify/functions/tree-volume.ts';
import liquidity from '../netlify/functions/tree-liquidity.ts';
import { collectVolumeEventPages } from '../netlify/lib/tree-volume-overview.ts';
for(const [name,handler] of [['volume',volume],['liquidity',liquidity]]){
 test(name+' fails closed on upstream failure and malformed coverage',async()=>{
  const original=globalThis.fetch;
  try{
   for(const malformed of [false,true]){
    globalThis.fetch=async url=>{if(!malformed)throw Error('Simulated unavailable venue');return Response.json(String(url).includes('coingecko')?{sui:{usd:1},bitcoin:{usd:100000},'usd-coin':{usd:1},thickquidity:{usd:0.01}}:{data:{}});};
    const r=await handler(new Request('https://example.test/api/tree-'+name));assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).status,'error');
   }
  }finally{globalThis.fetch=original;}
 });
}
test('missing event coverage cannot be represented as zero volume',async()=>{for(const malformed of [{},{nodes:[]},{nodes:[],pageInfo:{}}])await assert.rejects(collectVolumeEventPages(malformed,async()=>({})),/coverage/);});
