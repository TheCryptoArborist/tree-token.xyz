import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {parsePoolPrice,parseNav,parseBasket,DATA_TTL} from '../dapp/sti-stats-core.js';
const badge=JSON.parse(readFileSync(new URL('fixtures/sti-badge.json',import.meta.url)));
const pool=JSON.parse(readFileSync(new URL('fixtures/sti-price.json',import.meta.url)));
const now=Date.parse(pool.data.checkpoint.timestamp);
const changedPool=fields=>{const copy=structuredClone(pool);Object.assign(copy.data.object.asMoveObject.contents.json,fields);return copy;};

test('spot price uses the pinned STI/SUI pool, correct direction and 9-decimal units',()=>{
  assert.deepEqual(parsePoolPrice(pool,now),{priceMist:16582n,at:now});
  assert.equal(parsePoolPrice(changedPool({current_sqrt_price:String(1n<<64n)}),now).priceMist,1_000_000_000n);
  assert.equal(parsePoolPrice(changedPool({current_sqrt_price:String(1n<<63n)}),now).priceMist,250_000_000n);
});
test('price fails closed on wrong chain, identity, type, liquidity, pause, fee and numeric fields',()=>{
  const cases=[{is_pause:true},{liquidity:'0'},{fee_rate:'3000'},{current_sqrt_price:'0'},{current_sqrt_price:'<script>'},{current_sqrt_price:String(1n<<128n)},{id:'0x1'}].map(changedPool);
  for(const mutate of [p=>p.data.chainIdentifier='testnet',p=>p.data.object.address='0x1',p=>p.data.object.asMoveObject.contents.type.repr='fake',p=>p.errors=[{message:'Partial data'}]]){const p=structuredClone(pool);mutate(p);cases.push(p);}
  for(const p of cases)assert.throws(()=>parsePoolPrice(p,now));
});
test('price and NAV reject stale, missing and future timestamps',()=>{
  for(const delta of [-60_001,DATA_TTL+1]){assert.throws(()=>parsePoolPrice(pool,now+delta));assert.throws(()=>parseNav(badge,badge.at+delta));}
  assert.throws(()=>parsePoolPrice({data:{...pool.data,checkpoint:{timestamp:'unknown'}}},now));
  assert.throws(()=>parseNav({...badge,at:null},now));
});
test('NAV matches basket value divided by circulating STI supply in raw units',()=>{
  assert.equal(parseNav(badge,badge.at).priceMist,15737n);
  for(const fields of [{perSti:'15738'},{perSti:null},{perSti:'0'},{supply:'0'},{navMist:'-1'},{navMist:'18446744073709551616'},{supply:1},{perSti:'<img>'}])assert.throws(()=>parseNav({...badge,...fields},badge.at));
});
test('basket uses all validated proportions and highlights the full TREE coin identity',()=>{
  const parts=parseBasket(badge,badge.at);
  assert.equal(parts.length,7);assert.equal(parts.filter(p=>p.tree).length,1);
  assert.equal(parts.find(p=>p.tree).share,0.10626613901082381);
  assert.ok(parts.every((p,i)=>i===0||parts[i-1].share>=p.share));
  const spoof=structuredClone(badge);spoof.coins[0].symbol='Tree';spoof.coins[3].retiring=true;
  assert.equal(parseBasket(spoof,badge.at).some(p=>p.tree),false);
});
test('basket rejects malformed, duplicate and incomplete allocations; text is bounded',()=>{
  for(const alter of [d=>d.coins=[],d=>d.coins.push(d.coins[0]),d=>d.coins.pop(),d=>d.coins[0].share=-1,d=>d.coins[0].share='0.5',d=>d.coins[0].type='javascript:alert(1)']){const d=structuredClone(badge);alter(d);assert.throws(()=>parseBasket(d,badge.at));}
  const d=structuredClone(badge);d.coins[0].symbol='<img src=x onerror=alert(1)>';
  assert.equal(parseBasket(d,badge.at)[0].symbol,'Basket token');
});
