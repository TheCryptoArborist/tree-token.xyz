import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFTREE_COLLECTION_PACKAGE, NFTREE_COLLECTION_TYPE, NFTREE_PURCHASE_PACKAGE,
  NFTREE_MINT_CONFIG, NFTREE_POOL_IDS, NFTREE_NETWORK,
  formatMist, isValidTransactionDigest, validateSaleInventory, loadSaleInventory,
  validatePendingRecord, createMintCoordinator,
} from '../scripts/arcade-nftree-access-core.mjs';
import { verifyMintReceipt, confirmMintReceiptWithClient } from '../vendor/nftree-mint/receipt.mjs';

const NOW = 1_793_470_000_000;
const ACCOUNT = `0x${'a'.repeat(64)}`;
const OTHER_ACCOUNT = `0x${'b'.repeat(64)}`;
const NFT = `0x${'c'.repeat(64)}`;
const DIGEST = 'Ej9Wyaf8fWyLUf9sBAwu65wn2QWaVZYWkeY5DtfqyRvA';
const OTHER_DIGEST = 'Da64RXmgZQDzdUqyi7PD2nJhKTeB3KgHJj9VxZn8q8y4';
const inventory = (overrides = {}) => ({
  collectionPackageId: NFTREE_COLLECTION_PACKAGE, latestPackageId: NFTREE_PURCHASE_PACKAGE,
  mintConfigId: NFTREE_MINT_CONFIG, mintPriceMist: '25000000000', totalAvailable: 8,
  activePoolId: NFTREE_POOL_IDS[0], source: 'sui-grpc', fetchedAt: new Date(NOW).toISOString(),
  pools: NFTREE_POOL_IDS.map((poolId) => ({ poolId, count: 2 })), ...overrides,
});
const pendingRecord = (overrides = {}) => ({ version: 1, network: NFTREE_NETWORK, digest: DIGEST,
  walletName: 'Test wallet', accountAddress: ACCOUNT, poolId: NFTREE_POOL_IDS[0],
  mintPriceMist: '25000000000', createdAt: NOW, status: 'submitted', ...overrides });
const confirmed = (overrides = {}) => ({ status: 'confirmed', digest: DIGEST, accountAddress: ACCOUNT,
  poolId: NFTREE_POOL_IDS[0], nftObjectId: NFT, nftType: NFTREE_COLLECTION_TYPE, ...overrides });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function harness(options = {}) {
  let saved = options.pending || null;
  let connection = { walletName: 'Test wallet', accountAddress: ACCOUNT };
  const calls = [];
  let mint = options.mint || (async () => ({ digest: DIGEST }));
  let receipt = options.receipt || (async () => confirmed());
  const wallet = {
    async getSuiBalance({ accountAddress }) { calls.push('balance'); return { accountAddress, balanceMist: '100000000000' }; },
    async mintWithConnectedWallet(args) { calls.push('mint'); return mint(args); },
    async confirmMintReceipt(args) { calls.push('confirm'); assert.equal(saved?.digest, args.digest); return receipt(args); },
    ...options.wallet,
  };
  const coordinator = createMintCoordinator({ wallet, loadInventory: options.loadInventory || (async () => inventory()),
    getConnection: () => connection, now: () => NOW,
    persistPending: options.persistPending || (async (record) => { calls.push(`persist:${record.status}`); saved = record; }),
    readPending: options.readPending || (() => saved),
    clearPending: options.clearPending || (async () => { calls.push('clear'); saved = null; }),
    onState: options.onState || (() => {}),
  });
  return { coordinator, calls, wallet, get saved() { return saved; },
    setConnection(value) { connection = value; }, setMint(value) { mint = value; }, setReceipt(value) { receipt = value; } };
}

test('inventory validation accepts the official complete snapshot and exact amounts', () => {
  const value = validateSaleInventory(inventory(), { now: NOW });
  assert.equal(value.totalAvailable, 8);
  assert.equal(value.activePoolLabel, 'Pool 1');
  assert.equal(formatMist('25000000000'), '25 SUI');
  assert.equal(formatMist('25000000001'), '25.000000001 SUI');
  assert.equal(formatMist('18446744073709551615'), '18446744073.709551615 SUI');
  assert.ok(Object.isFrozen(value.pools));
  assert.ok(isValidTransactionDigest(DIGEST));
  assert.equal(isValidTransactionDigest('0'.repeat(44)), false);
  assert.equal(isValidTransactionDigest('z'.repeat(44)), false);
});

test('inventory fails closed on stale, fake, incomplete, inconsistent, or untrusted data', () => {
  const bad = [
    { error: 'upstream timeout' }, { source: 'last-verified' }, { latestPackageId: OTHER_ACCOUNT },
    { collectionPackageId: OTHER_ACCOUNT }, { mintConfigId: OTHER_ACCOUNT },
    { fetchedAt: new Date(NOW - 90_001).toISOString() }, { fetchedAt: new Date(NOW + 10_001).toISOString() },
    { mintPriceMist: '0' }, { mintPriceMist: '-1' }, { mintPriceMist: 25000000000 },
    { mintPriceMist: '18446744073709551616' }, { totalAvailable: 9 }, { activePoolId: NFTREE_POOL_IDS[1] },
    { pools: [{ poolId: NFTREE_POOL_IDS[0], count: 8 }] },
    { pools: NFTREE_POOL_IDS.map(() => ({ poolId: NFTREE_POOL_IDS[0], count: 2 })) },
    { pools: NFTREE_POOL_IDS.map((poolId) => ({ poolId, count: -1 })) },
  ];
  for (const change of bad) assert.throws(() => validateSaleInventory(inventory(change), { now: NOW }), JSON.stringify(change));
  const empty = validateSaleInventory(inventory({ totalAvailable: 0, activePoolId: '',
    pools: NFTREE_POOL_IDS.map((poolId) => ({ poolId, count: 0 })) }), { now: NOW });
  assert.equal(empty.totalAvailable, 0);
});

test('inventory HTTP errors/non-JSON/malformed bodies never substitute historical counts', async () => {
  for (const response of [new Response('{}', { status: 502, headers: { 'content-type': 'application/json' } }),
    new Response('<html>SPA fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    new Response('{', { status: 200, headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(loadSaleInventory({ fetchImpl: async () => response, now: () => NOW }));
  }
  const result = await loadSaleInventory({ now: () => NOW, fetchImpl: async (url, options) => {
    assert.ok(url.startsWith('https://nftree.net/api/nftree-sale-pools?t='));
    assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify(inventory()), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(result.totalAvailable, 8);
});

test('price or pool changes require a different explicit quote review, without signing', async () => {
  for (const change of [{ mintPriceMist: '26000000000' }, { activePoolId: NFTREE_POOL_IDS[1], totalAvailable: 6,
    pools: NFTREE_POOL_IDS.map((poolId, index) => ({ poolId, count: index ? 2 : 0 })) }]) {
    let reads = 0;
    const h = harness({ loadInventory: async () => inventory(++reads > 1 ? change : {}) });
    const quote = await h.coordinator.prepare();
    const state = await h.coordinator.submit(quote.id);
    assert.equal(state.status, 'review-required'); assert.equal(state.code, 'QUOTE_CHANGED');
    assert.notEqual(state.quote.id, quote.id); assert.equal(h.calls.includes('mint'), false);
  }
});

test('disconnected or switched accounts cannot use an old quote', async () => {
  const h = harness(); const quote = await h.coordinator.prepare();
  h.setConnection({ walletName: 'Test wallet', accountAddress: OTHER_ACCOUNT });
  const state = await h.coordinator.submit(quote.id);
  assert.equal(state.code, 'NFTREE_ACCOUNT_CHANGED'); assert.equal(h.calls.includes('mint'), false);
});

test('account switch during the vendor balance await is caught by the immediate pre-sign guard', async () => {
  const gate = deferred(); let reachedWalletSign = false;
  const h = harness({ mint: async ({ assertBeforeSign }) => {
    await gate.promise; assertBeforeSign(); reachedWalletSign = true; return { digest: DIGEST };
  } });
  const quote = await h.coordinator.prepare(); const submission = h.coordinator.submit(quote.id);
  await new Promise((resolve) => setImmediate(resolve));
  h.setConnection({ walletName: 'Test wallet', accountAddress: OTHER_ACCOUNT });
  h.coordinator.resetReview(); gate.resolve();
  const state = await submission;
  assert.equal(reachedWalletSign, false); assert.equal(state.status, 'error'); assert.equal(h.saved, null);
});

test('insufficient SUI cannot progress to a wallet purchase', async () => {
  const h = harness({ wallet: { getSuiBalance: async () => ({ accountAddress: ACCOUNT, balanceMist: '25000000000' }) } });
  await assert.rejects(h.coordinator.prepare(), { code: 'NFTREE_INSUFFICIENT_SUI' });
  assert.equal(h.calls.includes('mint'), false);
});

test('duplicate clicks sign once, and a digest is durable before receipt confirmation', async () => {
  const gate = deferred(); const h = harness({ mint: async () => { await gate.promise; return { digest: DIGEST }; } });
  const quote = await h.coordinator.prepare(); const first = h.coordinator.submit(quote.id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.saved.status, 'awaiting-wallet');
  await h.coordinator.submit(quote.id); gate.resolve();
  const state = await first;
  assert.equal(h.calls.filter((value) => value === 'mint').length, 1);
  assert.ok(h.calls.indexOf('persist:submitted') < h.calls.indexOf('confirm'));
  assert.equal(state.status, 'confirmed'); assert.equal(h.saved, null);
});

test('known user cancellation clears the unsent intent without retrying', async () => {
  const h = harness({ mint: async () => { throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); } });
  const quote = await h.coordinator.prepare(); const state = await h.coordinator.submit(quote.id);
  assert.equal(state.status, 'cancelled'); assert.equal(h.saved, null);
  assert.equal(h.calls.filter((value) => value === 'mint').length, 1);
});

test('unknown wallet error remains durable and blocked across reload; it never means nothing was charged', async () => {
  const h = harness({ mint: async () => { throw new Error('Wallet connection lost'); } });
  const quote = await h.coordinator.prepare(); const state = await h.coordinator.submit(quote.id);
  assert.equal(state.status, 'pending'); assert.equal(h.saved.digest, null);
  await assert.rejects(h.coordinator.prepare(), { code: 'PURCHASE_UNRESOLVED' });
  const restored = harness({ pending: h.saved });
  assert.equal(restored.coordinator.getState().status, 'pending'); assert.deepEqual(restored.calls, []);
  await restored.coordinator.submit(quote.id); assert.deepEqual(restored.calls, []);
});

test('unknown receipt stays pending, while Check status only confirms the original transaction', async () => {
  const h = harness({ receipt: async () => confirmed({ status: 'pending', reason: 'CONFIRMATION_UNAVAILABLE' }) });
  const quote = await h.coordinator.prepare(); assert.equal((await h.coordinator.submit(quote.id)).status, 'pending');
  assert.equal(h.saved.digest, DIGEST);
  assert.equal(h.saved.digestSource, 'wallet');
  h.setReceipt(async () => confirmed());
  assert.equal((await h.coordinator.checkStatus()).status, 'confirmed');
  assert.equal(h.calls.filter((value) => value === 'mint').length, 1);
});

test('recovery validates and persists a supplied digest before doing any receipt lookup', async () => {
  const h = harness({ pending: pendingRecord({ digest: null, status: 'awaiting-wallet' }) });
  assert.equal((await h.coordinator.checkStatus({ digest: 'bad' })).code, 'INVALID_DIGEST');
  assert.equal(h.calls.includes('confirm'), false);
  assert.equal((await h.coordinator.checkStatus({ digest: DIGEST })).status, 'confirmed');
  assert.ok(h.calls.indexOf('persist:submitted') < h.calls.indexOf('confirm'));
  assert.equal(h.calls.includes('mint'), false);
});

test('a wrong manual digest can be corrected after reload without enabling another purchase', async () => {
  const h = harness({ pending: pendingRecord({ digest: null, status: 'awaiting-wallet' }),
    receipt: async ({ digest }) => confirmed({ digest, status: 'pending', reason: 'PURCHASE_SCOPE_MISMATCH' }) });
  assert.equal(h.coordinator.getState().pending.digestSource, null);
  const unmatched = await h.coordinator.checkStatus({ digest: OTHER_DIGEST });
  assert.equal(unmatched.status, 'pending'); assert.equal(unmatched.pending.digestSource, 'manual');
  assert.equal(h.saved.digest, OTHER_DIGEST);
  await assert.rejects(h.coordinator.prepare(), { code: 'PURCHASE_UNRESOLVED' });
  const restored = harness({ pending: h.saved });
  assert.equal(restored.coordinator.getState().pending.digestSource, 'manual');
  assert.equal((await restored.coordinator.checkStatus({ digest: DIGEST })).status, 'confirmed');
  assert.equal(h.calls.includes('mint'), false); assert.equal(restored.calls.includes('mint'), false);
});

test('wallet-returned and legacy stored digests remain immutable even after manual re-entry', async () => {
  for (const digestSource of [undefined, 'wallet']) {
    const h = harness({ pending: pendingRecord({ digestSource }),
      receipt: async () => confirmed({ status: 'pending', reason: 'CONFIRMATION_UNAVAILABLE' }) });
    assert.equal(h.coordinator.getState().pending.digestSource, 'wallet');
    assert.equal((await h.coordinator.checkStatus({ digest: OTHER_DIGEST })).code, 'INVALID_DIGEST');
    assert.equal(h.calls.includes('confirm'), false);
    await h.coordinator.checkStatus({ digest: DIGEST });
    assert.equal(h.saved.digestSource, 'wallet');
    assert.equal((await h.coordinator.checkStatus({ digest: OTHER_DIGEST })).code, 'INVALID_DIGEST');
    assert.equal(h.saved.digest, DIGEST); assert.equal(h.calls.includes('mint'), false);
  }
  assert.throws(() => validatePendingRecord(pendingRecord({ digestSource: 'untrusted' })), { code: 'PENDING_RECORD_INVALID' });
  assert.throws(() => validatePendingRecord(pendingRecord({ digest: null, digestSource: 'manual', status: 'awaiting-wallet' })), { code: 'PENDING_RECORD_INVALID' });
});

test('storage failures and malformed saved records fail closed before signing', async () => {
  const h = harness({ persistPending: async () => { throw new Error('Storage unavailable'); } });
  const quote = await h.coordinator.prepare(); await h.coordinator.submit(quote.id);
  assert.equal(h.calls.includes('mint'), false);
  assert.throws(() => harness({ readPending: () => { throw new Error('Malformed storage'); } }), /Malformed storage/);
  assert.throws(() => validatePendingRecord(pendingRecord({ digest: 'not-a-digest' })), { code: 'PENDING_RECORD_INVALID' });
});

function receiptFixture(overrides = {}) {
  const amount = Buffer.alloc(8); amount.writeBigUInt64LE(25_000_000_000n);
  return { $kind: 'Transaction', Transaction: {
    digest: DIGEST, status: { success: true, error: null },
    transaction: { sender: ACCOUNT, inputs: [{ Pure: { bytes: amount.toString('base64') } },
      { Object: { SharedObject: { objectId: NFTREE_POOL_IDS[0] } } },
      { Object: { SharedObject: { objectId: NFTREE_MINT_CONFIG } } }],
    commands: [{ SplitCoins: { coin: { GasCoin: true }, amounts: [{ Input: 0 }] } },
      { MoveCall: { package: NFTREE_PURCHASE_PACKAGE, module: 'collection', function: 'purchase', typeArguments: [],
        arguments: [{ Input: 1 }, { NestedResult: [0, 0] }, { Input: 2 }] } }] },
    effects: { transactionDigest: DIGEST, status: { success: true, error: null }, changedObjects: [{
      objectId: NFT, inputState: 'DoesNotExist', idOperation: 'None', outputState: 'ObjectWrite',
      outputOwner: { $kind: 'AddressOwner', AddressOwner: ACCOUNT },
    }] }, objectTypes: { [NFT]: NFTREE_COLLECTION_TYPE }, ...overrides,
  } };
}

test('a receipt must prove the exact purchase and a single NFTree transferred to its payer', () => {
  assert.equal(verifyMintReceipt(receiptFixture(), pendingRecord()).status, 'confirmed');
  const mutations = [
    (r) => { r.Transaction.digest = 'other'; },
    (r) => { r.Transaction.transaction.sender = OTHER_ACCOUNT; },
    (r) => { r.Transaction.transaction.commands[1].MoveCall.package = OTHER_ACCOUNT; },
    (r) => { r.Transaction.transaction.inputs[1].Object.SharedObject.objectId = NFTREE_POOL_IDS[1]; },
    (r) => { r.Transaction.status.success = false; },
    (r) => { r.Transaction.effects.changedObjects[0].outputOwner.AddressOwner = OTHER_ACCOUNT; },
    (r) => { r.Transaction.effects.changedObjects.push({ ...r.Transaction.effects.changedObjects[0] }); },
    (r) => { r.Transaction.objectTypes[NFT] = `${OTHER_ACCOUNT}::collection::NFT`; },
    (r) => { r.Transaction.transaction.inputs[0].Pure.bytes = Buffer.alloc(8).toString('base64'); },
  ];
  for (const mutate of mutations) { const receipt = receiptFixture(); mutate(receipt);
    assert.equal(verifyMintReceipt(receipt, pendingRecord()).status, 'pending'); }
  const failure = receiptFixture(); failure.$kind = 'FailedTransaction'; failure.FailedTransaction = failure.Transaction;
  delete failure.Transaction; failure.FailedTransaction.status.success = false; failure.FailedTransaction.effects.status.success = false;
  assert.equal(verifyMintReceipt(failure, pendingRecord()).status, 'failed');
});

test('confirmation requires a checkpoint and current direct ownership; read failures remain pending', async () => {
  const expected = pendingRecord({ createdAt: Date.now() });
  const client = {
    async waitForTransaction(args) { assert.deepEqual(args.include, { effects: true, objectTypes: true, transaction: true }); return receiptFixture(); },
    ledgerService: { async getTransaction() { return { response: { transaction: { digest: DIGEST, checkpoint: 1n,
      timestamp: { seconds: BigInt(Math.floor(expected.createdAt / 1000)), nanos: 0 } } } }; } },
    async getObject() { return { object: { objectId: NFT, type: NFTREE_COLLECTION_TYPE,
      owner: { $kind: 'AddressOwner', AddressOwner: ACCOUNT } } }; },
  };
  assert.equal((await confirmMintReceiptWithClient(client, expected)).status, 'confirmed');
  client.getObject = async () => ({ object: { objectId: NFT, type: NFTREE_COLLECTION_TYPE,
    owner: { $kind: 'AddressOwner', AddressOwner: OTHER_ACCOUNT } } });
  assert.equal((await confirmMintReceiptWithClient(client, expected)).status, 'pending');
  client.waitForTransaction = async () => { throw new Error('timeout'); };
  assert.equal((await confirmMintReceiptWithClient(client, expected)).status, 'pending');
});
