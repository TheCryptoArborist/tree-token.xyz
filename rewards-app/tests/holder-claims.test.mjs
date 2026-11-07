import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { Inputs, Transaction } from '@mysten/sui/transactions';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
function evaluate(source, names = [], values = []) {
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', ...names, output)(exports, ...values);
  return exports;
}
const { CONFIG } = evaluate(read('src/config.ts'));
const communitySource = read('src/communityRewards.ts');
const packageMatch = communitySource.match(/export const COMMUNITY_REWARDS_PACKAGE_ID\s*=\s*"([^"]+)"/);
assert.ok(packageMatch, 'Community package must be explicit.');
const COMMUNITY_REWARDS_PACKAGE_ID = packageMatch[1];
const source = read('src/HolderApp.tsx');
const parsed = ts.createSourceFile('HolderApp.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helperNames = new Set(['partitionClaimBatches', 'buildClaimBatch']);
const helpers = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && helperNames.has(node.name.text)).map(node => node.getText(parsed)).join('\n');
const { partitionClaimBatches, buildClaimBatch } = evaluate(helpers, ['MAX_CLAIMS_PER_BATCH', 'Transaction', 'Inputs', 'CONFIG', 'COMMUNITY_REWARDS_PACKAGE_ID'], [24, Transaction, Inputs, CONFIG, COMMUNITY_REWARDS_PACKAGE_ID]);
const address = char => `0x${char.repeat(64)}`;
const owner = address('a');
function operation(index, community = false, token = 'tree') {
  const id = `0x${index.toString(16).padStart(64, '0')}`;
  const asset = { id: community ? token : 'sui', round: 1n, amount: 1n, vault: 100n, claimed: new Set(), eligible: new Set([id]) };
  if (community) asset.config = { tokenId: token, symbol: token.toUpperCase(), coinType: `${address(token === 'tree' ? 'b' : 'c')}::coin::COIN`, poolObjectId: address(token === 'tree' ? 'd' : 'e'), poolInitialSharedVersion: 100, eligibilityRegistryObjectId: address(token === 'tree' ? 'f' : '9'), eligibilityRegistryInitialSharedVersion: 101 };
  return { asset, nftreeId: id, key: `${asset.id}:1:${id}` };
}

test('legacy SUI and upgraded community claims are separated into different approvals', () => {
  const operations = [operation(1, true), operation(2), operation(3, true, 'mews'), operation(4)];
  const batches = partitionClaimBatches(operations);
  assert.equal(batches.length, 2);
  assert.ok(batches[0].every(item => !item.asset.config));
  assert.ok(batches[1].every(item => item.asset.config));
  assert.deepEqual(new Set(batches.flat().map(item => item.key)), new Set(operations.map(item => item.key)));
});

test('mixed-family builders fail before simulation or wallet approval', () => {
  assert.throws(() => buildClaimBatch([operation(1), operation(2, true)], owner), /separate wallet approvals/);
});

test('claim families retain the original SUI target and the verified upgraded community target', () => {
  const sui = buildClaimBatch([operation(1)], owner).getData();
  const community = buildClaimBatch([operation(2, true), operation(3, true, 'mews')], owner).getData();
  assert.equal(sui.commands.length, 1);
  assert.equal(sui.commands[0].MoveCall.package, CONFIG.packageId);
  assert.equal(sui.commands[0].MoveCall.function, 'claim');
  assert.equal(community.commands.length, 2);
  for (const command of community.commands) {
    assert.equal(command.MoveCall.package, COMMUNITY_REWARDS_PACKAGE_ID);
    assert.equal(command.MoveCall.function, 'claim_community_token_snapshot');
  }
});

test('large claims stay bounded without losing or duplicating operations', () => {
  const operations = [...Array.from({ length: 25 }, (_, i) => operation(i + 1)), ...Array.from({ length: 49 }, (_, i) => operation(i + 100, true))];
  const batches = partitionClaimBatches(operations);
  assert.deepEqual(batches.map(batch => batch.length), [24, 1, 24, 24, 1]);
  assert.equal(new Set(batches.flat().map(item => item.key)).size, operations.length);
  for (const batch of batches) assert.doesNotThrow(() => buildClaimBatch(batch, owner));
  assert.throws(() => partitionClaimBatches(operations, 25));
  assert.throws(() => buildClaimBatch([], owner));
  assert.throws(() => buildClaimBatch(operations.slice(0, 25), owner));
});

test('holder flow uses family batches and displays the number of approvals', () => {
  assert.match(source, /const batches = partitionClaimBatches\(pending\)/);
  assert.match(source, /approvalCount\} wallet approval/);
  assert.match(source, /href="\/rewards\/\?sponsor=1"/);
});
