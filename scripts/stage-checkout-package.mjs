import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const raw = readFileSync(process.env.CHECKOUT_BUILD_FILE, 'utf8');
const build = JSON.parse(raw.slice(raw.indexOf('{')));
assert.equal(build.modules.length, 1, 'Only checkout may be published');
const bytecode = readFileSync('services/canopy-credits/contract/build/canopy_checkout/bytecode_modules/checkout.mv');
assert.equal(Buffer.from(build.modules[0], 'base64').toString('hex'), bytecode.toString('hex'));
assert.equal(bytecode.subarray(0, 4).toString('hex'), 'a11ceb0b', 'Test bytecode must never be published');
for (const helper of ['new_for_testing', 'destroy_for_testing', 'unit_test_poison']) assert.ok(!bytecode.includes(Buffer.from(helper)));
assert.ok(build.dependencies.length > 0 && build.dependencies.every(x => /^(0x)?[a-f0-9]{1,64}$/.test(x)));
const dependencies = build.dependencies.map(x => '0x' + x.replace(/^0x/, '').padStart(64, '0'));
assert.ok(dependencies.every(x => ['1', '2'].map(n => '0x' + n.padStart(64, '0')).includes(x)));
assert.ok(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA));
const payload = { modules: build.modules, dependencies };
const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const artifact = {
  version: 1, network: 'mainnet', chainIdentifier: '35834a8a',
  admin: '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',
  initiallyPaused: true, sourceCommit: process.env.GITHUB_SHA,
  cli: 'mainnet-v1.81.1', payloadSha256: sha256, ...payload,
};
mkdirSync('staged-checkout', { recursive: true });
writeFileSync('staged-checkout/checkout-package.json', JSON.stringify(artifact, null, 2) + '\n');
console.log('CHECKOUT_PACKAGE=' + JSON.stringify(artifact));
console.log('MOVE_LOCK_BASE64=' + readFileSync('services/canopy-credits/contract/Move.lock').toString('base64'));
console.log('Only public package bytecode produced. No signer or transaction submission.');
