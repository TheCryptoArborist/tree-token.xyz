import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAINNET, decimal, digest32, timestampMs, canonicalAddress, eventJson, normalizeNetwork,
  normalizeMetadata, normalizeTransaction, createMainnetReader, TX_MASK } from '../mainnet-reader.mjs';
const D = MAINNET.genesisDigest, A = n => '0x' + n.repeat(64), now = 1800000000000;
const time = { seconds: BigInt(now / 1000), nanos: 0 };
const value = v => ({ kind: { oneofKind: typeof v === 'string' ? 'stringValue' : 'numberValue', [typeof v === 'string' ? 'stringValue' : 'numberValue']: v } });
function fixture() {
  const network = { chainId: D, chain: 'mainnet', checkpointHeight: 123n, timestamp: time };
  const metadata = { coinType: MAINNET.treeType, metadata: { id: A('4'), decimals: 6, name: 'Fixture only', symbol: 'TREE' } };
  const event = { eventType: A('3') + '::checkout::Purchase', packageId: A('3'), sender: A('1'),
    contents: { value: new Uint8Array([1, 2, 3]) }, json: { kind: { oneofKind: 'structValue', structValue: { fields: { amountRaw: value('9007199254740993') } } } } };
  const tx = { digest: D, checkpoint: 123n, timestamp: time, transaction: { sender: A('1') },
    effects: { digest: D, transactionDigest: D, status: { success: true }, eventsDigest: D },
    events: { digest: D, events: [event] }, balanceChanges: [{ address: A('1'), coinType: MAINNET.treeType, amount: '-100' }] };
  const cp = { sequenceNumber: 123n, digest: D, summary: { timestamp: time, contentDigest: D }, contents: { digest: D, transactions: [{ transaction: D, effects: D }] } };
  const calls = [], sleepCalls = [];
  const services = Object.fromEntries(Object.entries({ getServiceInfo: network, getCoinInfo: metadata, getTransaction: { transaction: tx }, getCheckpoint: { checkpoint: cp } })
    .map(([name, response]) => [name, async (r, options) => { calls.push({ name, r, options }); return { response }; }]));
  const options = { now: () => now, sleep: async ms => sleepCalls.push(ms) };
  return { network, metadata, tx, cp, calls, sleepCalls, services, options, reader: createMainnetReader(services, options) };
}
test('mainnet identity is anchored to the complete canonical genesis digest', () => {
  const f = fixture(), n = normalizeNetwork(f.network, now);
  assert.equal(n.genesisDigest, D); assert.equal(n.chainIdentifier, '35834a8a');
  assert.equal(n.checkpointHeight, '123'); assert.equal(n.network, 'sui:mainnet');
});
for (const [name, edit, pattern] of [
  ['different genesis', n => n.chainId = 'A'.repeat(43), /genesis/],
  ['misleading chain label', n => n.chain = 'testnet', /genesis/],
  ['missing timestamp', n => delete n.timestamp, /integer/],
  ['stale endpoint', n => n.timestamp = { seconds: time.seconds - 181n, nanos: 0 }, /stale/],
  ['future endpoint time', n => n.timestamp = { seconds: time.seconds + 31n, nanos: 0 }, /stale/],
]) test('identity rejects ' + name, () => { const f = fixture(); edit(f.network); assert.throws(() => normalizeNetwork(f.network, now), pattern); });
test('metadata precision comes from returned TREE metadata, not test-price defaults', () => {
  const f = fixture(); f.metadata.metadata.decimals = 9;
  assert.equal(normalizeMetadata(f.metadata, now).baseUnitsPerTree, '1000000000');
});
for (const edit of [m => m.coinType = '0x2::sui::SUI', m => delete m.metadata, m => delete m.metadata.decimals,
  m => m.metadata.decimals = 19, m => m.metadata.id = '0x0', m => m.metadata.symbol = null])
  test('malformed/mismatched metadata is rejected: ' + edit.toString(), () => { const f = fixture(); edit(f.metadata); assert.throws(() => normalizeMetadata(f.metadata, now)); });
test('u64 stays exact above safe Number range; missing or numeric values fail closed', () => {
  assert.equal(decimal(9007199254740993n), '9007199254740993');
  for (const v of [123, undefined, null, '-1', '1.5', '18446744073709551616']) assert.throws(() => decimal(v));
});
test('timestamp conversion checks nanos and overflow', () => {
  assert.equal(timestampMs({ seconds: 1n, nanos: 999999999 }), 1999);
  for (const t of [{ seconds: 1n }, { seconds: 1n, nanos: -1 }, { seconds: 1n, nanos: 1e9 }, { seconds: '18446744073709551615', nanos: 0 }]) assert.throws(() => timestampMs(t));
});
test('base58 digest length is decoded rather than only regex checked', () => {
  assert.equal(digest32(D), D); assert.equal(digest32('1'.repeat(32)), '1'.repeat(32));
  for (const d of ['A'.repeat(32), '1'.repeat(43), '0'.repeat(44), 'z'.repeat(44), D + '1']) assert.throws(() => digest32(d));
});
test('protobuf event strings preserve exact large integers; unsafe numbers are rejected', () => {
  assert.equal(eventJson(value('9007199254740993')), '9007199254740993');
  assert.throws(() => eventJson(value(9007199254740992)), /unsafe/);
  assert.throws(() => eventJson(value(1.1)), /unsafe/);
});
test('protobuf structs safely handle prototype property names and nesting limits', () => {
  const fields = Object.fromEntries([['__proto__', value('literal')], ['constructor', value('safe')]]);
  const parsed = eventJson({ kind: { oneofKind: 'structValue', structValue: { fields } } });
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype); assert.equal(parsed.__proto__, 'literal');
  let v = value('x'); for (let i = 0; i < 34; i++) v = { kind: { oneofKind: 'listValue', listValue: { values: [v] } } };
  assert.throws(() => eventJson(v), /deep/);
});
test('complete successful transaction is normalized but ordinary JSON is NOT a checkout receipt', () => {
  const f = fixture(), tx = normalizeTransaction(f.tx, D, f.cp);
  assert.equal(tx.status, 'success'); assert.equal(tx.finalized, true); assert.equal(tx.simulated, false);
  assert.equal(tx.checkpoint, '123'); assert.equal(tx.events[0].json.amountRaw, '9007199254740993');
  assert.equal(tx.events[0].fields, null); assert.equal(tx.events[0].bcsBase64, 'AQID');
  assert.equal(tx.balanceChanges[0].owner, A('1')); assert.equal(tx.finalitySource, 'trusted-rpc-checkpoint-inclusion');
});
for (const [name, edit, pattern] of [
  ['wrong tx digest', f => f.tx.digest = 'A'.repeat(43), /digest/],
  ['wrong effects tx digest', f => f.tx.effects.transactionDigest = 'A'.repeat(43), /digest/],
  ['no checkpoint', f => delete f.tx.checkpoint, /integer/],
  ['wrong checkpoint height', f => f.cp.sequenceNumber = 122n, /sequence/],
  ['missing checkpoint inclusion', f => f.cp.contents.transactions = [], /not-in/],
  ['duplicate checkpoint inclusion', f => f.cp.contents.transactions.push(f.cp.contents.transactions[0]), /not-in/],
  ['mismatched committed effects', f => f.cp.contents.transactions[0].effects = 'A'.repeat(43), /not-in/],
  ['mismatched checkpoint commitment', f => f.cp.summary.contentDigest = 'A'.repeat(43), /content/],
  ['different checkpoint time', f => f.cp.summary.timestamp = { seconds: time.seconds + 1n, nanos: 0 }, /time/],
  ['missing status', f => delete f.tx.effects.status, /status/],
  ['contradictory status', f => f.tx.effects.status.error = {}, /status/],
  ['missing event list', f => delete f.tx.events, /events/],
  ['wrong events digest', f => f.tx.events.digest = 'A'.repeat(43), /events/],
  ['missing balance changes', f => delete f.tx.balanceChanges, /balance/],
  ['unsafe numeric balance amount', f => f.tx.balanceChanges[0].amount = 100, /balance/],
  ['renumbered event', f => f.tx.events.events[0].eventIndex = 1, /index/],
  ['wrong event sender', f => f.tx.events.events[0].sender = A('2'), /sender/],
  ['missing event BCS', f => delete f.tx.events.events[0].contents, /bcs/],
]) test('reader rejects ' + name, () => { const f = fixture(); edit(f); assert.throws(() => normalizeTransaction(f.tx, D, f.cp), pattern); });
test('failed transactions retain failure status; absent legitimate events are handled', () => {
  const f = fixture(); f.tx.effects.status = { success: false, error: { description: 'fixture failure' } };
  delete f.tx.effects.eventsDigest; delete f.tx.events;
  const tx = normalizeTransaction(f.tx, D, f.cp); assert.equal(tx.status, 'failed'); assert.equal(tx.events.length, 0);
});
test('type address normalization does not modify token names or exact amounts', () => {
  const f = fixture(); f.tx.balanceChanges[0].coinType = '0x2::sui::SUI';
  const b = normalizeTransaction(f.tx, D, f.cp).balanceChanges[0];
  assert.equal(b.coinType, canonicalAddress('0x2') + '::sui::SUI'); assert.equal(b.amount, '-100');
});
test('only an explicit receipt decoder can interpret checkout fields', () => {
  const f = fixture(); const codec = { eventType: f.tx.events.events[0].eventType, decode: e => ({ amountRaw: e.json.amountRaw }) };
  assert.equal(normalizeTransaction(f.tx, D, f.cp, codec).events[0].fields.amountRaw, '9007199254740993');
});
test('reader requests masks including all effects, events and balance changes', async () => {
  const f = fixture(); const tx = await f.reader.getFinalizedTransaction(D);
  assert.equal(tx.digest, D);
  assert.deepEqual(f.calls.map(c => c.name), ['getServiceInfo', 'getTransaction', 'getCheckpoint']);
  assert.deepEqual(f.calls[1].r.readMask.paths, [...TX_MASK]);
  assert.ok(f.calls.every(c => c.options.abort instanceof AbortSignal));
});
test('wrong chain never proceeds to metadata or transaction reads', async () => {
  const f = fixture(); f.network.chainId = 'A'.repeat(43);
  await assert.rejects(f.reader.getTreeMetadata(), /genesis/); assert.equal(f.calls.length, 1);
});
test('identity cached briefly, then rechecked; height need not be a JS number', async () => {
  const f = fixture(); let clock = now; f.network.checkpointHeight = 9007199254740993n;
  const r = createMainnetReader(f.services, { ...f.options, now: () => clock });
  await r.getNetworkIdentity(); await r.getTreeMetadata(); assert.equal(f.calls.filter(c => c.name === 'getServiceInfo').length, 1);
  clock += 16000; await r.getNetworkIdentity(); assert.equal(f.calls.filter(c => c.name === 'getServiceInfo').length, 2);
});
test('transient outages retry at most three times, no successful data invented', async () => {
  const f = fixture(); let tries = 0;
  f.services.getServiceInfo = async () => { tries++; throw Object.assign(new Error('unavailable'), { code: 'UNAVAILABLE' }); };
  const r = createMainnetReader(f.services, f.options);
  await assert.rejects(r.getNetworkIdentity(), /unavailable/); assert.equal(tries, 3); assert.equal(f.sleepCalls.length, 2);
});
test('not-found and malformed responses are not blindly retried', async () => {
  const f = fixture(); let tries = 0; f.services.getServiceInfo = async () => { tries++; throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' }); };
  await assert.rejects(createMainnetReader(f.services, f.options).getNetworkIdentity()); assert.equal(tries, 1);
});
test('recent transaction discovery is bounded and does not query wallet balances', async () => {
  const f = fixture(); const result = await f.reader.getRecentTransactionDigests('123');
  assert.deepEqual(result.digests, [D]); assert.equal(f.calls.at(-1).r.checkpointId.sequenceNumber, 123n);
  assert.deepEqual(Object.keys(f.reader).sort(), ['getFinalizedTransaction', 'getNetworkIdentity', 'getRecentTransactionDigests', 'getTreeMetadata']);
});
