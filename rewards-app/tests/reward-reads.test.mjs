import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Run the project's TypeScript with Node 24 without an extra test dependency.
registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/src/') && !context.parentURL.includes('/node_modules/') &&
    specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
}});
const { bcs } = await import('@mysten/sui/bcs');
const { rewardClient, moveInteger, claimKeyBytes, fetchRewardField, fetchRewardCoins } = await import('../src/rewardClient.ts');
const { fetchRewardPoolState, fetchClaimedNFTrees } = await import('../src/pool.ts');
const { fetchCommunityTokenPoolState, fetchCommunityEligibilityForNFTrees, fetchCommunityEligibilityPreflight, COMMUNITY_REWARD_TOKEN_CONFIGS } = await import('../src/communityRewards.ts');
const address = `0x${'1'.repeat(64)}`;
const nft = `0x${'2'.repeat(64)}`;

function mock(object, method, implementation, t) {
  const previous = object[method];
  object[method] = implementation;
  t.after(() => { object[method] = previous; });
}
function fieldResponse(type, value, keyBytes) {
  const content = new Uint8Array(32 + keyBytes.length + value.length);
  content.set(keyBytes, 32);
  content.set(value, 32 + keyBytes.length);
  return { response: { objects: [{ result: { oneofKind: 'object', object: {
    objectType: `0x2::dynamic_field::Field<u64, ${type}>`, contents: { value: content },
  } } }] } };
}

test('balances keep exact atomic amounts and reject unknown or unsafe values', () => {
  assert.equal(moveInteger({ value: '18446744073709551615' }, 'balance'), 18446744073709551615n);
  assert.equal(moveInteger({ fields: { balance: '0' } }, 'balance'), 0n);
  assert.throws(() => moveInteger(undefined, 'balance'), /unavailable/);
  assert.throws(() => moveInteger(Number.MAX_SAFE_INTEGER + 1, 'balance'), /invalid/);
});

test('pool reads preserve round and amounts; missing fields reject instead of appearing empty', async t => {
  const fields = { current_round: '7', per_nftree_mist: '46511627', vault: '2186046547',
    total_funded: '4000000000', total_claimed: '1813953453', total_claims: '39', claimed: { id: address, size: '39' } };
  mock(rewardClient, 'getObject', async () => ({ object: { json: fields } }), t);
  const pool = await fetchRewardPoolState();
  assert.equal(pool.currentRound, 7n);
  assert.equal(pool.vaultBalance, 2186046547n);
  delete fields.vault;
  await assert.rejects(fetchRewardPoolState(), /vault balance.*unavailable/);
});

test('claim key contains u64 round and exact NFT ID', () => {
  const bytes = claimKeyBytes(7n, nft);
  assert.equal(bytes.length, 40);
  assert.equal(bcs.u64().parse(bytes.slice(0, 8)), '7');
  assert.equal(bcs.Address.parse(bytes.slice(8)), nft);
});

test('only explicit per-field NOT_FOUND is unclaimed; provider and malformed errors reject', async t => {
  mock(rewardClient.ledgerService, 'batchGetObjects', async () => ({ response: { objects: [{ result: {
    oneofKind: 'error', error: { code: 5, message: 'Object not found' },
  } }] } }), t);
  assert.equal(await fetchRewardField(address, 'u64', bcs.u64().serialize(1).toBytes()), undefined);
  rewardClient.ledgerService.batchGetObjects = async () => ({ response: { objects: [{ result: {
    oneofKind: 'error', error: { code: 14, message: 'Provider unavailable' },
  } }] } });
  await assert.rejects(fetchClaimedNFTrees(address, 7n, [nft]), /Provider unavailable/);
  rewardClient.ledgerService.batchGetObjects = async () => ({ response: { objects: [] } });
  await assert.rejects(fetchClaimedNFTrees(address, 7n, [nft]), /response is unavailable/);
});

test('confirmed receipt and snapshot owner decode from BCS', async t => {
  const key = claimKeyBytes(7n, nft);
  mock(rewardClient.ledgerService, 'batchGetObjects', async () => fieldResponse('bool', bcs.bool().serialize(true).toBytes(), key), t);
  assert.deepEqual([...await fetchClaimedNFTrees(address, 7n, [nft])], [nft]);
  const config = COMMUNITY_REWARD_TOKEN_CONFIGS[0];
  mock(rewardClient, 'getObject', async () => ({ object: { json: {
    pool_id: config.poolObjectId, eligible_owners: { id: address, size: '1' }, snapshot_counts: { id: nft, size: '1' },
  } } }), t);
  rewardClient.ledgerService.batchGetObjects = async () => fieldResponse('address', bcs.Address.serialize(address).toBytes(), key);
  const eligibility = await fetchCommunityEligibilityForNFTrees(config, 7n, [nft], address);
  assert.equal(eligibility.eligibleNFTreeIds.has(nft), true);
  assert.equal(eligibility.ownerByNFTreeId[nft], address);
});

test('community pool parses flattened gRPC IDs and balance, retains exact token units', async t => {
  const config = COMMUNITY_REWARD_TOKEN_CONFIGS[0];
  mock(rewardClient, 'getObject', async () => ({ object: {
    type: `0x1::rewards::CommunityTokenRewardPool<${config.coinType}>`,
    owner: { $kind: 'Shared', Shared: { initialSharedVersion: '921100177' } },
    json: { current_round: '3', per_nftree_amount: '12000000000', vault: '24000000000',
      total_funded: '36000000000', total_claimed: '12000000000', total_claims: '1', claimed: { id: address, size: '1' } },
  } }), t);
  const pool = await fetchCommunityTokenPoolState(config);
  assert.equal(pool.perNftreeAmount, 12000000000n);
  assert.equal(pool.claimedTableId, address);
  assert.equal(pool.source, 'mainnet');
});

test('coin scans follow pagination and do not silently truncate repeated cursors', async t => {
  let calls = 0;
  mock(rewardClient, 'listCoins', async () => ++calls === 1 ? {
    objects: [{ objectId: address, balance: '10' }], hasNextPage: true, cursor: 'next',
  } : { objects: [{ objectId: nft, balance: '20' }], hasNextPage: false, cursor: null }, t);
  assert.deepEqual(await fetchRewardCoins(address, '0x2::sui::SUI'), [
    { coinObjectId: address, balance: '10' }, { coinObjectId: nft, balance: '20' },
  ]);
  rewardClient.listCoins = async () => ({ objects: [], hasNextPage: true, cursor: 'same' });
  await assert.rejects(fetchRewardCoins(address, '0x2::sui::SUI'), /new page cursor/);
});


test('finalized snapshot count still verifies every exact NFTree owner and rejects duplicates', async t => {
  const config = COMMUNITY_REWARD_TOKEN_CONFIGS[0];
  const key = claimKeyBytes(7n, nft);
  let count = 1;
  let ownerMode = 'valid';
  let calls = 0;
  mock(rewardClient, 'getObject', async () => ({ object: { json: {
    pool_id: config.poolObjectId, eligible_owners: { id: address, size: '1' }, snapshot_counts: { id: nft, size: '1' },
  } } }), t);
  mock(rewardClient.ledgerService, 'batchGetObjects', async () => {
    calls += 1;
    if (calls % 2 === 1) return fieldResponse('u64', bcs.u64().serialize(count).toBytes(), bcs.u64().serialize(7).toBytes());
    if (ownerMode === 'missing') return { response: { objects: [{ result: { oneofKind: 'error', error: { code: 5, message: 'Object not found' } } }] } };
    if (ownerMode === 'unavailable') return { response: { objects: [{ result: { oneofKind: 'error', error: { code: 14, message: 'Unavailable' } } }] } };
    return fieldResponse('address', bcs.Address.serialize(address).toBytes(), key);
  }, t);
  const run = async (pairs) => { calls = 0; return fetchCommunityEligibilityPreflight(config, 7n, pairs); };
  const pair = { nftreeObjectId: nft, ownerAddress: address };
  const correct = await run([pair]);
  assert.equal(correct.status, 'snapshot-finalized');
  assert.equal(correct.publishedPairs.length, 1);
  assert.equal(calls, 2, 'finalized round must read the actual owner');
  const wrongOwner = await run([{ ...pair, ownerAddress: nft }]);
  assert.equal(wrongOwner.snapshotFinalizedCount, 1);
  assert.equal(wrongOwner.status, 'owner-mismatch');
  assert.equal(wrongOwner.ownerMismatchPairs[0].existingOwnerAddress, address);
  ownerMode = 'missing';
  assert.equal((await run([pair])).status, 'snapshot-mismatch');
  ownerMode = 'unavailable';
  assert.equal((await run([pair])).status, 'unavailable');
  ownerMode = 'valid'; count = 2;
  // With two duplicate IDs the count can match, but this still is not a valid finalized manifest.
  rewardClient.ledgerService.batchGetObjects = async () => {
    calls += 1;
    return calls === 1
      ? fieldResponse('u64', bcs.u64().serialize(count).toBytes(), bcs.u64().serialize(7).toBytes())
      : fieldResponse('address', bcs.Address.serialize(address).toBytes(), key);
  };
  assert.equal((await run([pair, pair])).status, 'snapshot-mismatch');
});

test('snapshot registry or finalized-count read failures remain unavailable', async t => {
  const config = COMMUNITY_REWARD_TOKEN_CONFIGS[0];
  mock(rewardClient, 'getObject', async () => { throw new Error('Registry unavailable'); }, t);
  const result = await fetchCommunityEligibilityPreflight(config, 7n, [{ nftreeObjectId: nft, ownerAddress: address }]);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.unavailablePairs.length, 1);
});
