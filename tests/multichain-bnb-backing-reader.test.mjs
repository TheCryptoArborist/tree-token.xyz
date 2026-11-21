import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { bcs } from '@mysten/sui/bcs';
import { ObjectError } from '@mysten/sui/client';
import { inspectBnbOriginalBacking, BnbBackingReadError } from '../scripts/multichain/bnb-backing-reader.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = read('./fixtures/bnb-backing-reader/original-one-slot.json');
const reviewed = read('../docs/multichain/bnb-one-slot/reviewed-artifacts.json');
const endpoint = read('../docs/multichain/original-trial/bnb-endpoint-code.json');
const published = read('../docs/multichain/one-slot-vault/publication-bytecode.json');
const NOW = Date.parse('2026-11-21T15:24:50.000Z');
const WALLET = '0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae';
const OTHER = '0x' + '22'.repeat(20), OTHER_SUI = '0x' + '33'.repeat(32), ZERO = '0x' + '0'.repeat(64);
const [PKG, REGISTRY, VAULT, OAPP, UPGRADE, VAULT_ADMIN, OAPP_ADMIN, PEER_FIELD, NFT] = fixture.objects.map(x => x.objectId);
const NFT_TYPE = fixture.objects[8].type;
const PASS = '0x1d3da001e586a7defd397b77fadb29ed6f039c13';
const ADAPTER = '0x90b5292a5074cfdd665c726b433cc0a97e0da6ab';
const ENDPOINT = endpoint.address.toLowerCase();
const REQUEST = '0x76f08f56cc030f0b7db560cf46df3fee212d1ddcfa2c8135d1fbee4e85e38497';
const RECIPIENT = '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
const ACK = '0xe9b1c9627995eb8c09471150e121847770e7b28d9d705acd7b2a7f42b5a44c8c';
const ACK_HASH = '0xeae29b0d6562d0bb6cd4aa315b1a0901980e92df930af54c987db0d5675f9f9a';
const REDEMPTION_GUID = '0x1c493300e7be4fddd4f5cb61cd6b003e59b6873246df438a52d303dac89bb87d';
const block = Object.freeze({ number: 134910661n, hash: '0xb17971bc2e4d2b7b71064a37e0dcfbeea4b8d4d6777c335efe1badbca5ea9583',
  timestamp: BigInt(NOW / 1000 - 5) });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = word => Uint8Array.from(Buffer.from(word.slice(2), 'hex'));

// Construct the immutable-substituted runtimes from the independently reviewed
// deployment artifacts. These are fixtures only; no network or signer exists.
function runtime(name, values) {
  const artifact = reviewed.contracts[name]; let result = artifact.runtimeTemplate.slice(2);
  assert.deepEqual(Object.keys(artifact.immutableReferences).sort(), Object.keys(values).sort());
  for (const [key, refs] of Object.entries(artifact.immutableReferences)) for (const ref of refs) {
    assert.equal(ref.length, 32); const start = ref.start * 2;
    assert.equal(result.slice(start, start + 64), '0'.repeat(64));
    result = result.slice(0, start) + values[key].slice(2).padStart(64, '0') + result.slice(start + 64);
  }
  return '0x' + result;
}
const codes = {
  [PASS]: runtime('TreeSuitePass', { '870': ADAPTER, '872': WALLET, '874': WALLET, '876': VAULT }),
  [ADAPTER]: runtime('TreePassAdapter', { '61': PKG, '63': VAULT, '65': WALLET }),
  [ENDPOINT]: endpoint.code,
};
// Fixture encoders follow the published Move layout; they let adversarial cases
// change one real BCS field rather than replacing the production parser.
const Nft = bcs.struct('NFT', { id: bcs.Address, number: bcs.u64(), name: bcs.string(), description: bcs.string(), image_url: bcs.string(), rarity: bcs.string() });
const Cap = bcs.struct('CallCap', { id: bcs.Address, cap_type: bcs.enum('CapType', { Individual: null, Package: bcs.Address }) });
const Table = bcs.struct('Table', { id: bcs.Address, size: bcs.u64() });
const schemas = {
  [REGISTRY]: bcs.struct('Registry', { id: bcs.Address, version: bcs.u64(), cap: bcs.option(Cap), oapp: bcs.Address, slot: bcs.option(bcs.Address), backing: bcs.Address, nft_type: bcs.byteVector() }),
  [VAULT]: bcs.struct('Vault', { id: bcs.Address, version: bcs.u64(), registry: bcs.Address, cap: Cap, oapp: bcs.Address, nft: bcs.option(Nft), backing: bcs.byteVector(), route: bcs.byteVector(), peer: bcs.byteVector(), bound: bcs.bool(), paused: bcs.bool(), phase: bcs.u8(), announced: bcs.bool(), ack_sent: bcs.bool(), request: bcs.byteVector(), recipient: bcs.byteVector() }),
  [OAPP]: bcs.struct('OApp', { id: bcs.Address, oapp_cap: Cap, admin_cap: bcs.Address, peer: bcs.struct('Peer', { peers: Table }), enforced_options: bcs.struct('EnforcedOptions', { options: Table }), sending_call: bcs.option(bcs.Address) }),
  [UPGRADE]: bcs.struct('Upgrade', { id: bcs.Address, package: bcs.Address, version: bcs.u64(), policy: bcs.u8() }),
  [VAULT_ADMIN]: bcs.struct('AdminCap', { id: bcs.Address, registry: bcs.Address }),
  [OAPP_ADMIN]: bcs.struct('AdminCap', { id: bcs.Address }),
  [PEER_FIELD]: bcs.struct('Field', { id: bcs.Address, name: bcs.u32(), value: bcs.byteVector() }),
  [NFT]: Nft,
};
function originalObjects() {
  return fixture.objects.map(x => ({ ...structuredClone(x),
    ...(x.content ? { content: Uint8Array.from(Buffer.from(x.content, 'base64')) } : {}),
    ...(x.objectBcs ? { objectBcs: Uint8Array.from(Buffer.from(x.objectBcs, 'base64')) } : {}) }));
}
function mutate(objects, id, fn) {
  const object = objects.find(x => x.objectId === id), schema = schemas[id];
  const value = schema.parse(object.content); fn(value); object.content = schema.serialize(value).toBytes();
}
function missingNft(objects, reason = 'notFound') {
  const index = objects.findIndex(x => x.objectId === NFT);
  objects[index] = new ObjectError('notExists', 'Fixture missing object', { reason, objectId: NFT });
}
function context() {
  const trace = [], objects = originalObjects(); let sourceReads = 0, infoReads = 0, blockReads = 0;
  const pass = { state: 4, ownerOf: WALLET, canPlay: false, backingNFT: NFT, route: VAULT, adapter: ADAPTER,
    currency: '0x55d398326f99059ff775485246999027b3197955', treasury: '0xc440f06bbc7e58b0d055815f915447e4ae0e3720',
    PRICE: 25_000_000_000_000_000_000n, TOKEN_ID: 1n, controller: WALLET, initialBuyer: WALLET, redemption: REQUEST, recipient: RECIPIENT };
  const adapter = { pass: PASS, backingNFT: NFT, route: VAULT, suiPeer: PKG, binder: WALLET, endpoint: ENDPOINT,
    SUI_EID: 30378, redemptionSent: true, redemptionGuid: REDEMPTION_GUID, delivered: ACK_HASH };
  const c = { trace, objects, pass, adapter, codes: { ...codes }, wallet: WALLET, now: () => NOW,
    onSourceRead: null, onInfoRead: null, onBlockRead: null, chainId: 56,
    suiClient: {
      core: { getObjects: async args => {
        sourceReads++; trace.push(['source', sourceReads]);
        assert.deepEqual(args.objectIds, fixture.objects.map(x => x.objectId));
        assert.deepEqual(args.include, { content: true, objectBcs: true }); assert(args.signal instanceof AbortSignal);
        // Preserve actual ObjectError identity (structuredClone strips subclass fields).
        const result = { objects: objects.map(x => x instanceof ObjectError ? x : structuredClone(x)) };
        c.onSourceRead?.(result, sourceReads); return result;
      } },
      ledgerService: { getServiceInfo: async (args, opts) => {
        infoReads++; trace.push(['service', infoReads]); assert.deepEqual(args, {}); assert(opts.abort instanceof AbortSignal);
        const result = { response: { chainId: '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S', chain: 'mainnet',
          checkpointHeight: 347679369n + BigInt(infoReads), timestamp: { seconds: BigInt(NOW / 1000 - 1), nanos: 0 } } };
        c.onInfoRead?.(result, infoReads); return result;
      } },
    },
    bnbClient: {
      getChainId: async () => c.chainId,
      getBlock: async args => {
        blockReads++; trace.push(['block', args]);
        assert.deepEqual(args, blockReads === 1 ? { blockTag: 'finalized' } : { blockNumber: block.number });
        const result = { ...block }; c.onBlockRead?.(result, blockReads); return result;
      },
      getBytecode: async ({ address, blockNumber }) => {
        trace.push(['code', address, blockNumber]); assert.equal(blockNumber, block.number); return c.codes[address];
      },
      readContract: async ({ address, abi, functionName, args = [], blockNumber }) => {
        trace.push(['contract', address, functionName, args, blockNumber]); assert.equal(blockNumber, block.number);
        assert(abi.some(f => f.name === functionName));
        if (functionName === 'ownerOf') { assert.equal(pass.state, 2, 'ownerOf must never run for a burned/unminted/locked pass'); assert.deepEqual(args, [1n]); }
        if (functionName === 'canPlay') assert.deepEqual(args, [c.wallet.toLowerCase()]);
        if (functionName === 'delivered') assert.deepEqual(args, [ACK]);
        if (address === ENDPOINT) { assert.equal(functionName, 'eid'); return 30102; }
        assert([PASS, ADAPTER].includes(address)); return (address === PASS ? pass : adapter)[functionName];
      },
    },
  };
  c.inspect = extras => inspectBnbOriginalBacking({ wallet: c.wallet, suiClient: c.suiClient, bnbClient: c.bnbClient, now: c.now, ...extras });
  c.active = () => {
    const nft = Nft.parse(objects[8].content);
    mutate(objects, VAULT, v => { v.phase = 1; v.nft = nft; v.ack_sent = false; v.request = bytes(ZERO); v.recipient = bytes(ZERO); });
    missingNft(objects); pass.state = 2; pass.canPlay = true; pass.redemption = ZERO; pass.recipient = ZERO;
    adapter.redemptionSent = false; adapter.redemptionGuid = ZERO; adapter.delivered = ZERO;
  };
  return c;
}
async function rejects(c, code) {
  await assert.rejects(c.inspect(), error => {
    assert(error instanceof BnbBackingReadError); assert.equal(error.status, 503); assert.equal(error.gameplayAuthorized, false);
    if (code) assert.equal(error.code, code); assert.equal(error.message, error.code); return true;
  });
}

test('published Sui module code differs from reviewed build only by the two published self-address substitutions', () => {
  const raw = Buffer.from(fixture.objects[0].objectBcs, 'base64');
  const pkg = bcs.Object.parse(raw).data.Package;
  assert.equal(pkg.id, PKG); assert.equal(pkg.version, '1');
  for (const [index, [name, code]] of [...pkg.moduleMap].entries()) {
    const built = Buffer.from(published.modules[index], 'base64');
    const offset = { codec: 216, vault: 2430 }[name]; assert(Number.isInteger(offset));
    assert.equal(built.subarray(offset, offset + 32).toString('hex'), '0'.repeat(64));
    Buffer.from(PKG.slice(2), 'hex').copy(built, offset);
    assert.deepEqual(built, Buffer.from(code));
  }
  assert.equal(sha(raw), '47c9cfedbba902b8aa289329106035449bc7bf93ea3174fd486caa8f9e424b1a');
  assert.equal(sha(Buffer.from(codes[PASS].slice(2), 'hex')), '714bee6acddef5999864affbc06b7c0025060d2c11827f47d19e99b23a4b2712');
  assert.equal(sha(Buffer.from(codes[ADAPTER].slice(2), 'hex')), '7613e9c518ae74c8a46371ec1db80c113bde8982400532d5885453ee3a98c6bd');
});
test('completed trial is retired/released at a single finalized block; burned ownerOf is never queried', async () => {
  const c = context(), report = await c.inspect();
  assert.equal(report.classification, 'trial-retired'); assert.equal(report.backing.lifecycle, 'released');
  assert.equal(report.backing.sourceCustodyConfirmed, false); assert.equal(report.backing.releasedTo, RECIPIENT);
  assert.equal(report.inspectedWallet, WALLET); assert.equal(report.bnb.owner, null);
  assert.equal(report.bnb.ownerMatches, false); assert.equal(report.bnb.canPlay, false);
  assert.equal(report.bnb.passState, 'Retired'); assert.equal(report.bnb.passStateCode, 4);
  assert.equal(report.bnb.blockNumber, block.number.toString()); assert.equal(report.bnb.blockHash, block.hash);
  assert.equal(report.bnb.finality, 'finalized'); assert.equal(report.sui.consistency, 'stable-objects-reread');
  for (const flag of ['eligible', 'productionReady', 'gameplayAuthorized']) assert.equal(report[flag], false);
  assert(report.blockers.includes('production-backing-registry-not-approved')); assert(report.blockers.includes('retired-one-slot-trial'));
  assert.equal(c.trace.filter(x => x[0] === 'source').length, 2);
  assert.equal(c.trace.filter(x => x[0] === 'service').length, 2);
  assert.equal(c.trace.filter(x => x[2] === 'ownerOf').length, 0);
  assert(Object.isFrozen(report) && Object.isFrozen(report.bnb) && Object.isFrozen(report.blockers));
  assert.doesNotThrow(() => JSON.stringify(report));
});
test('fully held/Active fixture remains excluded from production gameplay', async () => {
  const c = context(); c.active(); const report = await c.inspect();
  assert.equal(report.classification, 'trial-active-backed'); assert.equal(report.backing.lifecycle, 'held');
  assert.equal(report.backing.sourceCustodyConfirmed, true); assert.equal(report.bnb.ownerMatches, true);
  assert.equal(report.bnb.canPlay, true); assert.equal(report.bnb.passState, 'Active');
  assert.equal(report.eligible, false); assert.equal(report.productionReady, false); assert.equal(report.gameplayAuthorized, false);
});
test('current owner is re-read for each active observation; transfer removes prior-wallet match', async () => {
  const c = context(); c.active(); assert.equal((await c.inspect()).bnb.ownerMatches, true);
  // A fresh call uses independent snapshots/block markers as the production caller must.
  const d = context(); d.active(); d.pass.ownerOf = OTHER; d.pass.canPlay = false;
  const report = await d.inspect(); assert.equal(report.bnb.owner, OTHER); assert.equal(report.bnb.ownerMatches, false);
  assert.equal(report.gameplayAuthorized, false);
});
test('redemption pending can still hold backing; source release while BNB remains locked is also pending', async () => {
  const c = context(); c.active(); c.pass.state = 3; c.pass.canPlay = false; c.pass.redemption = REQUEST; c.pass.recipient = RECIPIENT;
  const held = await c.inspect(); assert.equal(held.classification, 'trial-redemption-pending'); assert.equal(held.backing.sourceCustodyConfirmed, true);
  const d = context(); d.pass.state = 3; d.adapter.delivered = ZERO;
  const released = await d.inspect(); assert.equal(released.classification, 'trial-redemption-pending'); assert.equal(released.backing.lifecycle, 'released');
});
test('release remains historical after NFT changes owners or is no longer directly queryable', async () => {
  const c = context(); c.objects[8].owner.AddressOwner = OTHER_SUI;
  const report = await c.inspect(); assert.equal(report.backing.releasedTo, RECIPIENT); assert.equal(report.backing.currentNftOwner, OTHER_SUI);
  const d = context(); missingNft(d.objects); const missing = await d.inspect();
  assert.equal(missing.classification, 'trial-retired'); assert.equal(missing.backing.currentNftOwner, null);
  assert.equal(missing.backing.currentNftObservation, 'not-queryable-by-id'); assert.equal(missing.backing.sourceCustodyConfirmed, false);
});

for (const [name, id, change] of [
  ['registry slot', REGISTRY, x => { x.slot = OTHER_SUI; }],
  ['registry original NFT', REGISTRY, x => { x.backing = OTHER_SUI; }],
  ['registry type admission', REGISTRY, x => { x.nft_type = new TextEncoder().encode('wrong::collection::NFT'); }],
  ['registry source OApp', REGISTRY, x => { x.oapp = OTHER_SUI; }],
  ['vault registry', VAULT, x => { x.registry = OTHER_SUI; }],
  ['vault source OApp', VAULT, x => { x.oapp = OTHER_SUI; }],
  ['vault route', VAULT, x => { x.route = bytes(OTHER_SUI); }],
  ['vault backing', VAULT, x => { x.backing = bytes(OTHER_SUI); }],
  ['vault peer', VAULT, x => { x.peer = bytes(OTHER_SUI); }],
  ['vault package capability', VAULT, x => { x.cap.cap_type = { Package: OTHER_SUI }; }],
  ['vault request', VAULT, x => { x.request = bytes(OTHER_SUI); }],
  ['vault recipient', VAULT, x => { x.recipient = bytes(OTHER_SUI); }],
  ['vault version', VAULT, x => { x.version = '2'; }],
  ['OApp package capability', OAPP, x => { x.oapp_cap.cap_type = { Package: OTHER_SUI }; }],
  ['OApp admin binding', OAPP, x => { x.admin_cap = OTHER_SUI; }],
  ['OApp peer table', OAPP, x => { x.peer.peers.id = OTHER_SUI; }],
  ['source peer value', PEER_FIELD, x => { x.value = bytes(OTHER_SUI); }],
  ['source peer endpoint', PEER_FIELD, x => { x.name = 30101; }],
  ['upgrade package', UPGRADE, x => { x.package = OTHER_SUI; }],
  ['upgrade version', UPGRADE, x => { x.version = '2'; }],
  ['vault admin relation', VAULT_ADMIN, x => { x.registry = OTHER_SUI; }],
]) test(`rejects changed ${name} in authoritative BCS`, async () => {
  const c = context(); mutate(c.objects, id, change); await rejects(c, 'backing-invalid-source');
});
for (const [name, change] of [
  ['wrong exact vault type', c => { c.objects[2].type = `${PKG}::vault::Vault<${OTHER_SUI}::collection::NFT>`; }],
  ['wrong shared version', c => { c.objects[2].owner.Shared.initialSharedVersion = '1'; }],
  ['changed administrator custody', c => { c.objects[5].owner.AddressOwner = OTHER_SUI; }],
  ['peer field parent', c => { c.objects[7].owner.ObjectOwner = OTHER_SUI; }],
  ['trailing BCS bytes', c => { c.objects[2].content = Uint8Array.from([...c.objects[2].content, 0]); }],
  ['truncated BCS bytes', c => { c.objects[2].content = c.objects[2].content.slice(0, -1); }],
  ['partial source batch', c => { c.onSourceRead = r => { r.objects.pop(); }; }],
  ['duplicated source object', c => { c.onSourceRead = r => { r.objects[1] = r.objects[2]; }; }],
  ['generic NFT lookup outage', c => { c.objects[8] = new Error('private provider error'); }],
  ['unclassified NFT lookup error', c => { missingNft(c.objects, 'unknown'); }],
]) test(`fails closed on ${name}`, async () => { const c = context(); change(c); await rejects(c, 'backing-invalid-source'); });

test('absence is never custody proof; wrong/missing wrapped NFT fails even when direct lookup is notFound', async () => {
  for (const change of [v => { v.nft = null; }, v => { v.nft.id = OTHER_SUI; }]) {
    const c = context(); c.active(); mutate(c.objects, VAULT, change); await rejects(c, 'backing-invalid-source');
  }
  const c = context(); c.active(); c.objects[8] = originalObjects()[8]; await rejects(c, 'backing-state-inconsistent');
});
test('released source cannot qualify as an active BNB-backed observation', async () => {
  const c = context(); c.pass.state = 2; c.pass.canPlay = true; c.pass.redemption = ZERO; c.pass.recipient = ZERO;
  c.adapter.redemptionSent = false; c.adapter.redemptionGuid = ZERO; c.adapter.delivered = ZERO;
  await rejects(c, 'backing-state-inconsistent');
});
test('retirement requires released custody and source acknowledgement', async () => {
  const c = context(); mutate(c.objects, VAULT, v => { v.ack_sent = false; }); await rejects(c, 'backing-state-inconsistent');
});
test('a locked pass cannot precede the source reserve announcement', async () => {
  const c = context(); c.active(); c.pass.state = 3; c.pass.canPlay = false; c.pass.redemption = REQUEST; c.pass.recipient = RECIPIENT;
  mutate(c.objects, VAULT, v => { v.announced = false; }); await rejects(c, 'backing-state-inconsistent');
});

for (const table of ['pass', 'adapter']) for (const field of table === 'pass'
  ? ['backingNFT', 'route', 'adapter', 'currency', 'treasury', 'controller', 'initialBuyer']
  : ['pass', 'backingNFT', 'route', 'suiPeer', 'binder', 'endpoint']) {
  test(`rejects changed BNB ${table}.${field} at the pinned block`, async () => {
    const c = context(); c[table][field] = '0x' + '77'.repeat(c[table][field].length === 42 ? 20 : 32);
    await rejects(c, 'backing-invalid-destination');
  });
}
test('rejects malformed destination state and booleans, changed request/recipient/acknowledgement/guid', async () => {
  for (const [table, field, value] of [['pass', 'state', 4n], ['pass', 'state', 5], ['pass', 'canPlay', 0],
    ['pass', 'redemption', OTHER_SUI], ['pass', 'recipient', OTHER_SUI], ['adapter', 'delivered', OTHER_SUI],
    ['adapter', 'redemptionGuid', OTHER_SUI], ['adapter', 'redemptionSent', false], ['pass', 'TOKEN_ID', 2n],
    ['pass', 'PRICE', 25n], ['adapter', 'SUI_EID', 30101]]) {
    const c = context(); c[table][field] = value; await rejects(c);
  }
});
test('immutable source package/upgrade and destination runtime changes fail closed', async () => {
  for (const which of ['package-content', 'package-digest', 'package-version', 'upgrade-digest', 'pass', 'adapter', 'endpoint']) {
    const c = context();
    if (which === 'package-content') c.objects[0].objectBcs[20] ^= 1;
    else if (which === 'package-digest') c.objects[0].digest = c.objects[1].digest;
    else if (which === 'package-version') c.objects[0].version = '2';
    else if (which === 'upgrade-digest') c.objects[4].digest = c.objects[1].digest;
    else c.codes[{ pass: PASS, adapter: ADAPTER, endpoint: ENDPOINT }[which]] = '0x60006000';
    await rejects(c, which === 'upgrade-digest' ? 'backing-invalid-source' : 'backing-runtime-mismatch');
  }
});
test('both chain identities are checked on each observation', async () => {
  const c = context(); c.chainId = 1; await rejects(c, 'backing-wrong-chain');
  const d = context(); d.onInfoRead = r => { r.response.chainId = '35834a8a'; }; await rejects(d, 'backing-wrong-chain');
  const e = context(); e.onInfoRead = (r, n) => { if (n === 2) r.response.chain = 'testnet'; }; await rejects(e, 'backing-wrong-chain');
});
test('stale/future source checkpoints and finalized block timestamps fail closed', async () => {
  for (const age of [-100, 100]) {
    const c = context(); c.onInfoRead = r => { r.response.timestamp.seconds += BigInt(age); }; await rejects(c, 'backing-state-stale');
    const d = context(); d.onBlockRead = r => { r.timestamp += BigInt(age); }; await rejects(d, 'backing-state-stale');
  }
});
test('backward source progress and stale wall-clock completion are rejected', async () => {
  const c = context(); c.onInfoRead = (r, n) => { if (n === 2) r.response.checkpointHeight -= 3n; };
  await rejects(c, 'backing-source-changed');
  const d = context(); let time = NOW; d.now = () => time;
  d.onInfoRead = (_r, n) => { if (n === 2) time += 20_001; }; await rejects(d, 'backing-check-timeout');
});
test('same-version changed contents and newer source versions are rejected on reread', async () => {
  for (const change of [objects => { objects[2].version = '1100579542'; },
    objects => mutate(objects, NFT, x => { x.name += ' changed'; }),
    objects => { objects[8].owner.AddressOwner = OTHER_SUI; }]) {
    const c = context(); c.onSourceRead = (r, n) => { if (n === 2) change(r.objects); };
    await rejects(c, 'backing-source-changed');
  }
});
test('changed finalized block hash fails instead of combining fork observations', async () => {
  const c = context(); c.onBlockRead = (r, n) => { if (n === 2) r.hash = OTHER_SUI; };
  await rejects(c, 'backing-block-changed');
});
test('provider errors never leak messages and never produce a report', async () => {
  const c = context(); c.bnbClient.getBytecode = async () => { throw new Error('secret endpoint token example'); };
  await assert.rejects(c.inspect(), e => e.code === 'backing-check-unavailable' && !JSON.stringify(e).includes('secret'));
});
test('missing clients, invalid wallet and caller cancellation fail closed', async () => {
  await assert.rejects(inspectBnbOriginalBacking({ wallet: WALLET }), e => e.code === 'backing-check-unavailable');
  const c = context(); c.wallet = 'not-an-address'; await rejects(c, 'backing-invalid-wallet');
  const d = context(), controller = new AbortController(); controller.abort();
  await assert.rejects(d.inspect({ signal: controller.signal }), e => e.code === 'backing-check-timeout');
  const e = context(), cancelled = new AbortController();
  e.bnbClient.getChainId = () => new Promise(() => {});
  const pending = e.inspect({ signal: cancelled.signal }); cancelled.abort();
  await assert.rejects(pending, x => x.code === 'backing-check-timeout');
});
