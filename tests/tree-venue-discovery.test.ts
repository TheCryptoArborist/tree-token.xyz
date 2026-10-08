import assert from 'node:assert/strict';
import { TREE_TYPE } from '../netlify/lib/tree-swap-route.ts';
import { discoverAcrossVenues, TREE_DISCOVERY_VENUES } from '../netlify/lib/tree-venue-discovery.ts';

assert.deepEqual(TREE_DISCOVERY_VENUES, ['suidex', 'turbos', 'aftermath', 'cetus', 'flowx']);

const result = await discoverAcrossVenues([
  { venue: 'suidex', discover: async () => [
    { venue: 'suidex', poolId: '0xABC', coinTypes: ['0x2::sui::SUI', TREE_TYPE], discoverySource: 'test' },
    { venue: 'suidex', poolId: '0xabc', coinTypes: ['0x2::sui::SUI', TREE_TYPE], discoverySource: 'test' },
  ] },
  { venue: 'aftermath', discover: async () => [
    { venue: 'aftermath', poolId: '0xBOOM', coinTypes: ['0x3766e534b5dc6cdb7defd998debf19f72565f4a7b8224e36b050f690b71a8819::boom::BOOM', TREE_TYPE], discoverySource: 'test' },
  ] },
  { venue: 'cetus', discover: async () => { throw new Error('temporary outage'); } },
]);
assert.equal(result.candidates.length, 2);
assert.equal(result.candidates[0].poolId, '0xabc');
assert.equal(result.failures.length, 1);
assert.equal(result.failures[0].venue, 'cetus');
console.log('TREE multi-venue discovery framework: PASS');
