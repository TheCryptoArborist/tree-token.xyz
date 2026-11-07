import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
function evaluateHelpers(source, names = [], values = []) {
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', ...names, output)(exports, ...values);
  return exports;
}
const { CONFIG } = evaluateHelpers(read('src/config.ts'));
const registry = evaluateHelpers(read('src/rewardTokens.ts').replace(/^import .*;\n/gm, ''), ['CONFIG'], [CONFIG]);
const snapshotSource = read('src/holderSnapshot.ts');
const blockers = snapshotSource.slice(snapshotSource.indexOf('export function holderSnapshotPayoutBlockers'), snapshotSource.indexOf('\nexport async function fetchHolderSnapshot'));
const { holderSnapshotPayoutBlockers } = evaluateHelpers(blockers, ['CONFIG'], [CONFIG]);
// Exercise exported allocation and receipt guards without mounting a wallet provider or a browser UI.
const managerSource = read('src/ManageApp.tsx').split('export function ManageApp()')[0].replace(/^import .*;\n/gm, '');
const held = new Set();
const navigator = { locks: { async request(name, _options, action) {
  if (held.has(name)) return action(null);
  held.add(name);
  try { return await action({ name }); } finally { held.delete(name); }
} } };
const helpers = evaluateHelpers(managerSource,
  ['CONFIG', 'REGISTERED_REWARD_TOKENS', 'holderSnapshotPayoutBlockers', 'normalizeStructTag', 'normalizeSuiAddress', 'navigator'],
  [CONFIG, registry.REGISTERED_REWARD_TOKENS, holderSnapshotPayoutBlockers, normalizeStructTag, normalizeSuiAddress, navigator]);
const { parseRewardBudget, allocateHolderRewards, validateDistributionManifest, validatePaymentReceipt, preventStalePaymentOverwrite, withDistributionLock } = helpers;
const address = char => `0x${char.repeat(64)}`;
const token = registry.REGISTERED_REWARD_TOKENS.find(item => item.tokenId === 'tree');
const digest = '5'.repeat(44);
function snapshot() {
  return { nftreeType: CONFIG.nftreeType, source: 'indexer-graphql', complete: true, checkpoint: '123', checkpointDigest: 'checkpoint-evidence', chainIdentifier: 'mainnet', manifestHash: `sha256:${'f'.repeat(64)}`, snapshotTime: new Date().toISOString(), unresolvedNFTrees: 0, unresolved: [], eligibleNFTrees: 3, totalNFTrees: 3, excludedProjectWalletNFTrees: 0, eligibleHolderWallets: 2, nftrees: [
    { nftreeObjectId: address('1'), ownerAddress: address('b') },
    { nftreeObjectId: address('2'), ownerAddress: address('c') },
    { nftreeObjectId: address('3'), ownerAddress: address('b') },
  ] };
}
function manifest() {
  const snap = snapshot(); const recipients = allocateHolderRewards(snap, 100n);
  return { version: 1, id: 'test-distribution', sender: CONFIG.adminAddress.toLowerCase(), network: 'mainnet', tokenId: token.tokenId, coinType: token.coinType, symbol: token.symbol, decimals: token.decimals, budget: '100', perNFTree: '33', allocated: '99', remainder: '1', snapshot: snap, recipients, batches: [{ index: 0, status: 'ready' }] };
}
function receipt(m = manifest()) {
  return { Transaction: { digest, status: { success: true, error: null }, transaction: { sender: m.sender }, balanceChanges: m.recipients.map(item => ({ coinType: m.coinType, address: item.address, amount: item.amount })) } };
}

test('budgets retain token precision and reject ambiguous or out-of-range inputs', () => {
  assert.equal(parseRewardBudget('1.000001', 6), 1_000_001n);
  assert.equal(parseRewardBudget('0.000001', 6), 1n);
  for (const amount of ['-1', '1e6', '1.0000001', '1,000', '0', 'NaN', '18446744073709551616']) assert.throws(() => parseRewardBudget(amount, 6));
});
test('each NFT gets one equal share and a wallet receives the combined shares', () => {
  const recipients = allocateHolderRewards(snapshot(), 100n);
  assert.deepEqual(recipients.map(item => [item.address, item.amount, item.nftreeIds.length]), [[address('b'), '66', 2], [address('c'), '33', 1]]);
  assert.equal(recipients.reduce((sum, item) => sum + BigInt(item.amount), 0n), 99n);
  assert.throws(() => allocateHolderRewards(snapshot(), 2n));
});
test('incomplete snapshots, unresolved custody, missing checkpoint evidence and wrong collections block payouts', () => {
  for (const change of [{ complete: false }, { unresolvedNFTrees: 1 }, { checkpoint: undefined }, { checkpointDigest: undefined }, { chainIdentifier: undefined }, { manifestHash: undefined }, { nftreeType: '0x2::other::NFT' }, { totalNFTrees: 5 }]) assert.throws(() => allocateHolderRewards({ ...snapshot(), ...change }, 100n));
});
test('duplicate NFT IDs and project wallet NFTs cannot enter a payout', () => {
  const snap = snapshot();
  assert.throws(() => allocateHolderRewards({ ...snap, nftrees: [...snap.nftrees, snap.nftrees[0]], eligibleNFTrees: 4, totalNFTrees: 4 }, 100n));
  assert.throws(() => allocateHolderRewards({ ...snap, nftrees: [{ nftreeObjectId: address('1'), ownerAddress: CONFIG.adminAddress }], eligibleNFTrees: 1, totalNFTrees: 1, eligibleHolderWallets: 1 }, 100n));
});
test('manifest validation rejects altered recipient amounts and fabricated pending receipt state', () => {
  const m = manifest(); validateDistributionManifest(m);
  assert.throws(() => validateDistributionManifest({ ...m, recipients: m.recipients.map((item, index) => index ? item : { ...item, amount: '67' }) }));
  assert.throws(() => validateDistributionManifest({ ...m, batches: [{ index: 0, status: 'signed' }] }));
  assert.throws(() => validateDistributionManifest({ ...m, batches: [{ index: 0, status: 'ready', digest }] }));
});
test('receipt must credit every expected wallet in the expected token from the expected sender', () => {
  const m = manifest(); const result = receipt(m);
  assert.equal(validatePaymentReceipt(result, m, 0, digest).success, true);
  assert.throws(() => validatePaymentReceipt({ Transaction: { ...result.Transaction, transaction: { sender: address('f') } } }, m, 0, digest));
  assert.throws(() => validatePaymentReceipt({ Transaction: { ...result.Transaction, balanceChanges: result.Transaction.balanceChanges.slice(1) } }, m, 0, digest));
  assert.throws(() => validatePaymentReceipt({ Transaction: { ...result.Transaction, balanceChanges: result.Transaction.balanceChanges.map((change, index) => index ? change : { ...change, amount: '67' }) } }, m, 0, digest));
  assert.throws(() => validatePaymentReceipt({ Transaction: { ...result.Transaction, balanceChanges: result.Transaction.balanceChanges.map(change => ({ ...change, coinType: '0x2::sui::SUI' })) } }, m, 0, digest));
  assert.throws(() => validatePaymentReceipt({ Transaction: { ...result.Transaction, balanceChanges: [...result.Transaction.balanceChanges, { coinType: m.coinType, address: address('f'), amount: '1' }] } }, m, 0, digest));
  assert.throws(() => validatePaymentReceipt(result, m, 0, '6'.repeat(44)));
  assert.throws(() => validatePaymentReceipt(undefined, m, 0, digest));
});
test('failed chain receipts remain failed and cannot be mistaken for completed payments', () => {
  const m = manifest();
  const failed = { FailedTransaction: { digest, status: { success: false, error: { message: 'Insufficient gas' } }, transaction: { sender: m.sender }, balanceChanges: [] } };
  const state = validatePaymentReceipt(failed, m, 0, digest);
  assert.equal(state.success, false); assert.equal(state.error, 'Insufficient gas');
});
test('stale browser records cannot overwrite signed or confirmed batches', () => {
  const m = manifest(); const signed = { ...m, batches: [{ index: 0, status: 'signed', digest }] }; const confirmed = { ...m, batches: [{ index: 0, status: 'confirmed', digest }] };
  assert.throws(() => preventStalePaymentOverwrite(signed, m));
  assert.throws(() => preventStalePaymentOverwrite(confirmed, signed));
  assert.throws(() => preventStalePaymentOverwrite(confirmed, { ...confirmed, recipients: [] }));
  preventStalePaymentOverwrite(signed, { ...m, batches: [{ index: 0, status: 'failed', digest }] });
});
test('concurrent tabs cannot enter the same payment lock and the lock releases after completion', async () => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const first = withDistributionLock('concurrent-test', () => hold);
  await assert.rejects(withDistributionLock('concurrent-test', async () => null), /another tab/);
  release(); await first;
  assert.equal(await withDistributionLock('concurrent-test', async () => 'ready'), 'ready');
});
