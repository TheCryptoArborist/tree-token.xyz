// Read-only inspection of the completed, single-original-NFT trial. This is not
// a production entitlement reader. Even a fully backed Active observation must
// return gameplayAuthorized:false; this one-shot route is never admitted.
import { createHash } from 'node:crypto';
import { bcs } from '@mysten/sui/bcs';
import { ObjectError } from '@mysten/sui/client';
import { getAddress, parseAbi } from 'viem';

const P = Object.freeze({
  chainIdentifier: '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S',
  package: '0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4',
  packageDigest: '6wkE7TgJ3rjAoaZAeVPeFK7TmocHNPcqSZacXtoGPvqp',
  packageBcsSha256: '47c9cfedbba902b8aa289329106035449bc7bf93ea3174fd486caa8f9e424b1a',
  publication: '9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2',
  registry: '0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92',
  vault: '0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c',
  oapp: '0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1',
  oappPackage: '0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24',
  upgrade: '0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7',
  upgradeDigest: 'BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH',
  vaultAdmin: '0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322',
  oappAdmin: '0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e',
  adminOwner: '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4',
  nft: '0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba',
  nftType: '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT',
  peerTable: '0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913',
  peerField: '0x2dce7263cfb5454ed8f423ec46e3141957ce4cd4833955d97b2b0b34bb95384e',
  optionsTable: '0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1',
  utilsPackage: '0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc',
  vaultCallCap: '0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80',
  oappCallCap: '0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1',
  pass: '0x1d3da001e586a7defd397b77fadb29ed6f039c13',
  adapter: '0x90b5292a5074cfdd665c726b433cc0a97e0da6ab',
  controller: '0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae',
  endpoint: '0x1a44076050125825900e736c501f859c50fe728c',
  currency: '0x55d398326f99059ff775485246999027b3197955',
  treasury: '0xc440f06bbc7e58b0d055815f915447e4ae0e3720',
  passCodeSha256: '714bee6acddef5999864affbc06b7c0025060d2c11827f47d19e99b23a4b2712',
  adapterCodeSha256: '7613e9c518ae74c8a46371ec1db80c113bde8982400532d5885453ee3a98c6bd',
  endpointCodeSha256: 'c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039',
  request: '0x76f08f56cc030f0b7db560cf46df3fee212d1ddcfa2c8135d1fbee4e85e38497',
  redemptionGuid: '0x1c493300e7be4fddd4f5cb61cd6b003e59b6873246df438a52d303dac89bb87d',
  acknowledgementGuid: '0xe9b1c9627995eb8c09471150e121847770e7b28d9d705acd7b2a7f42b5a44c8c',
  acknowledgementHash: '0xeae29b0d6562d0bb6cd4aa315b1a0901980e92df930af54c987db0d5675f9f9a',
});
const SUI2 = '0x' + '0'.repeat(63) + '2';
const ZERO = '0x' + '0'.repeat(64);
const PEER = '0x' + P.adapter.slice(2).padStart(64, '0');
const OBJECT_IDS = Object.freeze([P.package, P.registry, P.vault, P.oapp,
  P.upgrade, P.vaultAdmin, P.oappAdmin, P.peerField, P.nft]);
const MAX_READ_MS = 20_000, MAX_AGE_MS = 90_000, MAX_FUTURE_MS = 10_000;
const ADDRESS = /^0x[0-9a-f]{40}$/i, WORD = /^0x[0-9a-f]{64}$/i;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const STATES = Object.freeze(['Unconfirmed', 'Ready', 'Active', 'Locked', 'Retired']);
const CODES = new Set(['backing-check-unavailable', 'backing-check-timeout',
  'backing-wrong-chain', 'backing-state-stale', 'backing-source-changed',
  'backing-block-changed', 'backing-runtime-mismatch', 'backing-invalid-source',
  'backing-invalid-destination', 'backing-state-inconsistent', 'backing-invalid-wallet']);

export class BnbBackingReadError extends Error {
  constructor(code = 'backing-check-unavailable') {
    const safe = CODES.has(code) ? code : 'backing-check-unavailable';
    super(safe); this.name = 'BnbBackingReadError'; this.code = safe; this.status = 503;
    this.gameplayAuthorized = false;
  }
}
const requireThat = (value, code) => { if (!value) throw new BnbBackingReadError(code); };
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = bytes => '0x' + Buffer.from(bytes).toString('hex');
const equalBytes = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && Buffer.from(a).equals(Buffer.from(b));
const canonical = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const freeze = value => {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
};
const ref = object => ({ objectId: object.objectId, version: object.version, digest: object.digest });

// Exact deployed Move layout, decoded from raw struct BCS rather than varying
// provider JSON layouts. Parsing is followed by byte-for-byte canonical encoding
// so trailing bytes, alternate encodings and partial layouts cannot be accepted.
const Nft = bcs.struct('NFT', { id: bcs.Address, number: bcs.u64(), name: bcs.string(),
  description: bcs.string(), image_url: bcs.string(), rarity: bcs.string() });
const CallCap = bcs.struct('CallCap', { id: bcs.Address,
  cap_type: bcs.enum('CapType', { Individual: null, Package: bcs.Address }) });
const Table = bcs.struct('Table', { id: bcs.Address, size: bcs.u64() });
const Registry = bcs.struct('Registry', { id: bcs.Address, version: bcs.u64(), cap: bcs.option(CallCap),
  oapp: bcs.Address, slot: bcs.option(bcs.Address), backing: bcs.Address, nft_type: bcs.byteVector() });
const Vault = bcs.struct('Vault', { id: bcs.Address, version: bcs.u64(), registry: bcs.Address,
  cap: CallCap, oapp: bcs.Address, nft: bcs.option(Nft), backing: bcs.byteVector(),
  route: bcs.byteVector(), peer: bcs.byteVector(), bound: bcs.bool(), paused: bcs.bool(),
  phase: bcs.u8(), announced: bcs.bool(), ack_sent: bcs.bool(), request: bcs.byteVector(), recipient: bcs.byteVector() });
const OApp = bcs.struct('OApp', { id: bcs.Address, oapp_cap: CallCap, admin_cap: bcs.Address,
  peer: bcs.struct('Peer', { peers: Table }), enforced_options: bcs.struct('EnforcedOptions', { options: Table }),
  sending_call: bcs.option(bcs.Address) });
const Upgrade = bcs.struct('UpgradeCap', { id: bcs.Address, package: bcs.Address, version: bcs.u64(), policy: bcs.u8() });
const VaultAdmin = bcs.struct('AdminCap', { id: bcs.Address, registry: bcs.Address });
const OAppAdmin = bcs.struct('AdminCap', { id: bcs.Address });
const PeerField = bcs.struct('Field', { id: bcs.Address, name: bcs.u32(), value: bcs.byteVector() });

function decode(schema, object) {
  requireThat(object.content instanceof Uint8Array && object.content.length > 0 && object.content.length <= 100_000,
    'backing-invalid-source');
  let decoded;
  try { decoded = schema.parse(object.content); }
  catch { throw new BnbBackingReadError('backing-invalid-source'); }
  requireThat(equalBytes(schema.serialize(decoded).toBytes(), object.content), 'backing-invalid-source');
  requireThat(decoded.id === object.objectId, 'backing-invalid-source');
  return decoded;
}
function validOwner(owner) {
  if (!owner || typeof owner !== 'object') return false;
  if (owner.$kind === 'AddressOwner') return WORD.test(owner.AddressOwner || '');
  if (owner.$kind === 'ObjectOwner') return WORD.test(owner.ObjectOwner || '');
  if (owner.$kind === 'Shared') return /^[1-9][0-9]*$/.test(owner.Shared?.initialSharedVersion || '');
  if (owner.$kind === 'Immutable') return owner.Immutable === true;
  if (owner.$kind === 'ConsensusAddressOwner') return WORD.test(owner.ConsensusAddressOwner?.owner || '')
    && /^[1-9][0-9]*$/.test(owner.ConsensusAddressOwner?.startVersion || '');
  return false;
}
function validateObject(object, id, type) {
  requireThat(object && !(object instanceof Error) && object.objectId === id && object.type === type
    && typeof object.version === 'string' && /^[1-9][0-9]*$/.test(object.version)
    && DIGEST.test(object.digest || '') && validOwner(object.owner), 'backing-invalid-source');
  return object;
}
const shared = (object, version) => requireThat(object.owner.$kind === 'Shared'
  && object.owner.Shared.initialSharedVersion === version, 'backing-invalid-source');
const adminOwned = object => requireThat(object.owner.$kind === 'AddressOwner'
  && object.owner.AddressOwner === P.adminOwner, 'backing-invalid-source');
function packageCap(cap, id) {
  requireThat(cap.id === id && cap.cap_type.$kind === 'Package' && cap.cap_type.Package === P.package,
    'backing-invalid-source');
}
function validateNft(nft) {
  requireThat(nft && nft.id === P.nft && nft.number === '2720', 'backing-invalid-source');
}
function sourceSnapshot(response) {
  requireThat(Array.isArray(response?.objects) && response.objects.length === OBJECT_IDS.length, 'backing-invalid-source');
  const objects = response.objects;
  const [pkg, registry, vault, oapp, upgrade, vaultAdmin, oappAdmin, peerField, nft] = objects;
  validateObject(pkg, P.package, 'package');
  requireThat(pkg.version === '1' && pkg.digest === P.packageDigest && pkg.owner.$kind === 'Immutable'
    && pkg.objectBcs instanceof Uint8Array && pkg.objectBcs.length <= 30_000
    && hash(pkg.objectBcs) === P.packageBcsSha256, 'backing-runtime-mismatch');
  // The pinned complete package envelope includes the on-chain substituted
  // module addresses, module code, type origins, dependencies and publish digest.
  const packageEnvelope = bcs.Object.parse(pkg.objectBcs);
  requireThat(packageEnvelope.data.$kind === 'Package'
    && packageEnvelope.data.Package.id === P.package && packageEnvelope.data.Package.version === '1'
    && packageEnvelope.previousTransaction === P.publication, 'backing-runtime-mismatch');
  validateObject(registry, P.registry, `${P.package}::vault::Registry`); shared(registry, '1');
  validateObject(vault, P.vault, `${P.package}::vault::Vault<${P.nftType}>`); shared(vault, '2');
  validateObject(oapp, P.oapp, `${P.oappPackage}::oapp::OApp`); shared(oapp, '1');
  validateObject(upgrade, P.upgrade, `${SUI2}::package::UpgradeCap`); adminOwned(upgrade);
  validateObject(vaultAdmin, P.vaultAdmin, `${P.package}::vault::AdminCap`); adminOwned(vaultAdmin);
  validateObject(oappAdmin, P.oappAdmin, `${P.oappPackage}::oapp::AdminCap`); adminOwned(oappAdmin);
  validateObject(peerField, P.peerField, `${SUI2}::dynamic_field::Field<u32,${P.utilsPackage}::bytes32::Bytes32>`);
  requireThat(peerField.owner.$kind === 'ObjectOwner' && peerField.owner.ObjectOwner === P.peerTable,
    'backing-invalid-source');
  const r = decode(Registry, registry), v = decode(Vault, vault), o = decode(OApp, oapp),
    u = decode(Upgrade, upgrade), va = decode(VaultAdmin, vaultAdmin), oa = decode(OAppAdmin, oappAdmin),
    peer = decode(PeerField, peerField);
  requireThat(r.version === '1' && r.cap === null && r.oapp === P.oapp && r.slot === P.vault
    && r.backing === P.nft && Buffer.from(r.nft_type).toString('utf8') === P.nftType.slice(2), 'backing-invalid-source');
  requireThat(v.version === '1' && v.registry === P.registry && v.oapp === P.oapp
    && hex(v.backing) === P.nft && hex(v.route) === P.vault && hex(v.peer) === PEER && v.bound === true,
  'backing-invalid-source');
  packageCap(v.cap, P.vaultCallCap); packageCap(o.oapp_cap, P.oappCallCap);
  requireThat(o.admin_cap === P.oappAdmin && o.peer.peers.id === P.peerTable && o.peer.peers.size === '1'
    && o.enforced_options.options.id === P.optionsTable && o.enforced_options.options.size === '2'
    && o.sending_call === null && peer.name === 30102 && hex(peer.value) === PEER, 'backing-invalid-source');
  requireThat(upgrade.version === '1' && upgrade.digest === P.upgradeDigest && u.package === P.package
    && u.version === '1' && u.policy === 0 && va.registry === P.registry && oa.id === P.oappAdmin, 'backing-invalid-source');
  requireThat([0, 1, 2].includes(v.phase), 'backing-invalid-source');
  if (v.phase === 1) validateNft(v.nft);
  else requireThat(v.nft === null, 'backing-invalid-source');
  requireThat(WORD.test(hex(v.request)) && WORD.test(hex(v.recipient)), 'backing-invalid-source');
  if (v.phase === 2) requireThat(v.announced && hex(v.request) === P.request
    && hex(v.recipient) === P.adminOwner, 'backing-invalid-source');
  else requireThat(hex(v.request) === ZERO && hex(v.recipient) === ZERO && !v.ack_sent, 'backing-invalid-source');
  if (v.phase === 0) requireThat(!v.announced, 'backing-invalid-source');

  // Missing-by-ID can mean wrapped, deleted or unavailable. It never establishes
  // custody. Only the exact NFT value inside the exact typed Vault does that.
  let currentNft = null, missingReason = null;
  if (nft instanceof ObjectError) {
    requireThat(nft.objectId === P.nft && ['notFound', 'deleted'].includes(nft.reason), 'backing-invalid-source');
    missingReason = nft.reason;
  } else {
    validateObject(nft, P.nft, P.nftType); validateNft(decode(Nft, nft)); currentNft = nft;
  }
  requireThat(v.phase !== 1 || currentNft === null, 'backing-state-inconsistent');
  return { objects, v, currentNft, missingReason, packageRef: ref(pkg), registryRef: ref(registry), vaultRef: ref(vault) };
}
function unchangedSource(before, after) {
  for (let i = 0; i < before.objects.length; i++) {
    const a = before.objects[i], b = after.objects[i];
    if (a instanceof ObjectError || b instanceof ObjectError) {
      requireThat(a instanceof ObjectError && b instanceof ObjectError && a.reason === b.reason && a.objectId === b.objectId,
        'backing-source-changed');
    } else {
      requireThat(canonical(ref(a)) === canonical(ref(b)) && a.type === b.type && canonical(a.owner) === canonical(b.owner)
        && (i === 0 ? equalBytes(a.objectBcs, b.objectBcs) : equalBytes(a.content, b.content)), 'backing-source-changed');
    }
  }
}
function milliseconds(timestamp) {
  requireThat(typeof timestamp?.seconds === 'bigint' && Number.isInteger(timestamp.nanos)
    && timestamp.nanos >= 0 && timestamp.nanos < 1_000_000_000, 'backing-state-stale');
  const value = Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000);
  requireThat(Number.isSafeInteger(value) && value > 0, 'backing-state-stale'); return value;
}
function fresh(timestamp, now) {
  requireThat(Number.isSafeInteger(now) && now > 0 && now - timestamp <= MAX_AGE_MS
    && timestamp - now <= MAX_FUTURE_MS, 'backing-state-stale');
}
function serviceInfo(result, now) {
  const info = result?.response;
  requireThat(info?.chainId === P.chainIdentifier && info.chain === 'mainnet', 'backing-wrong-chain');
  requireThat(typeof info.checkpointHeight === 'bigint' && info.checkpointHeight > 0n, 'backing-invalid-source');
  const time = milliseconds(info.timestamp); fresh(time, now);
  return { sequenceNumber: info.checkpointHeight.toString(), timestamp: new Date(time).toISOString(), time };
}
function bnbBlock(block, now) {
  requireThat(typeof block?.number === 'bigint' && block.number > 0n && WORD.test(block.hash || '') && !same(block.hash, ZERO)
    && typeof block.timestamp === 'bigint' && block.timestamp > 0n, 'backing-invalid-destination');
  const time = Number(block.timestamp) * 1000;
  requireThat(Number.isSafeInteger(time), 'backing-state-stale'); fresh(time, now); return block;
}
const PASS_ABI = parseAbi([
  'function state() view returns (uint8)', 'function ownerOf(uint256) view returns (address)',
  'function canPlay(address) view returns (bool)', 'function backingNFT() view returns (bytes32)',
  'function route() view returns (bytes32)', 'function adapter() view returns (address)',
  'function currency() view returns (address)', 'function treasury() view returns (address)',
  'function PRICE() view returns (uint256)', 'function TOKEN_ID() view returns (uint256)',
  'function controller() view returns (address)', 'function initialBuyer() view returns (address)',
  'function redemption() view returns (bytes32)', 'function recipient() view returns (bytes32)',
]);
const ADAPTER_ABI = parseAbi([
  'function pass() view returns (address)', 'function backingNFT() view returns (bytes32)',
  'function route() view returns (bytes32)', 'function suiPeer() view returns (bytes32)',
  'function binder() view returns (address)', 'function endpoint() view returns (address)',
  'function SUI_EID() view returns (uint32)', 'function redemptionSent() view returns (bool)',
  'function redemptionGuid() view returns (bytes32)', 'function delivered(bytes32) view returns (bytes32)',
]);
const ENDPOINT_ABI = parseAbi(['function eid() view returns (uint32)']);
async function destinationSnapshot(client, block, wallet) {
  const blockNumber = block.number;
  const codes = await Promise.all([[P.pass, P.passCodeSha256], [P.adapter, P.adapterCodeSha256], [P.endpoint, P.endpointCodeSha256]]
    .map(async ([address, expected]) => {
      const code = await client.getBytecode({ address, blockNumber });
      requireThat(typeof code === 'string' && /^0x(?:[0-9a-f]{2})+$/i.test(code) && code.length <= 100_000
        && hash(Buffer.from(code.slice(2), 'hex')) === expected, 'backing-runtime-mismatch');
      return expected;
    }));
  const pass = (functionName, args = []) => client.readContract({ address: P.pass, abi: PASS_ABI, functionName, args, blockNumber });
  const adapter = (functionName, args = []) => client.readContract({ address: P.adapter, abi: ADAPTER_ABI, functionName, args, blockNumber });
  const state = await pass('state');
  requireThat(typeof state === 'number' && Number.isInteger(state) && state >= 0 && state <= 4, 'backing-invalid-destination');
  // In particular, a burned token must not turn an expected retirement into an
  // ownerOf-revert outage. Only the Active state needs a current-owner read.
  const names = ['backingNFT', 'route', 'adapter', 'currency', 'treasury', 'PRICE', 'TOKEN_ID', 'controller', 'initialBuyer', 'redemption', 'recipient'];
  const adapterNames = ['pass', 'backingNFT', 'route', 'suiPeer', 'binder', 'endpoint', 'SUI_EID', 'redemptionSent', 'redemptionGuid'];
  const [values, adapterValues, canPlay, owner, delivered, eid] = await Promise.all([
    Promise.all(names.map(name => pass(name))), Promise.all(adapterNames.map(name => adapter(name))),
    pass('canPlay', [wallet]), state === 2 ? pass('ownerOf', [1n]) : null,
    adapter('delivered', [P.acknowledgementGuid]),
    client.readContract({ address: P.endpoint, abi: ENDPOINT_ABI, functionName: 'eid', blockNumber }),
  ]);
  const p = Object.fromEntries(names.map((name, i) => [name, values[i]]));
  const a = Object.fromEntries(adapterNames.map((name, i) => [name, adapterValues[i]]));
  for (const [name, expected] of Object.entries({ backingNFT: P.nft, route: P.vault, adapter: P.adapter,
    currency: P.currency, treasury: P.treasury, controller: P.controller, initialBuyer: P.controller })) {
    requireThat(same(p[name], expected), 'backing-invalid-destination');
  }
  for (const [name, expected] of Object.entries({ pass: P.pass, backingNFT: P.nft, route: P.vault,
    suiPeer: P.package, binder: P.controller, endpoint: P.endpoint })) {
    requireThat(same(a[name], expected), 'backing-invalid-destination');
  }
  requireThat(p.PRICE === 25_000_000_000_000_000_000n && p.TOKEN_ID === 1n && a.SUI_EID === 30378 && eid === 30102
    && typeof a.redemptionSent === 'boolean' && WORD.test(a.redemptionGuid || '') && WORD.test(delivered || '')
    && typeof canPlay === 'boolean' && WORD.test(p.redemption || '') && WORD.test(p.recipient || ''), 'backing-invalid-destination');
  const ownerMatches = state === 2 && same(owner, wallet);
  requireThat((state !== 2 || ADDRESS.test(owner || '')) && canPlay === ownerMatches, 'backing-state-inconsistent');
  if (state < 3) requireThat(same(p.redemption, ZERO) && same(p.recipient, ZERO) && !a.redemptionSent
    && same(a.redemptionGuid, ZERO) && same(delivered, ZERO), 'backing-state-inconsistent');
  else requireThat(same(p.redemption, P.request) && same(p.recipient, P.adminOwner)
    && (a.redemptionSent ? same(a.redemptionGuid, P.redemptionGuid) : same(a.redemptionGuid, ZERO)), 'backing-state-inconsistent');
  if (state === 4) requireThat(a.redemptionSent && same(delivered, P.acknowledgementHash), 'backing-state-inconsistent');
  else requireThat(same(delivered, ZERO), 'backing-state-inconsistent');
  return { state, owner: owner === null ? null : getAddress(owner).toLowerCase(), ownerMatches, canPlay,
    redemptionSent: a.redemptionSent, request: p.redemption.toLowerCase(), recipient: p.recipient.toLowerCase(), codes };
}
function classify(source, destination) {
  const v = source.v, state = destination.state;
  if (state === 4) {
    requireThat(v.phase === 2 && v.ack_sent, 'backing-state-inconsistent'); return 'trial-retired';
  }
  if (state === 3) {
    requireThat((v.phase === 1 || v.phase === 2) && v.announced, 'backing-state-inconsistent');
    if (v.phase === 2) requireThat(destination.redemptionSent, 'backing-state-inconsistent');
    return 'trial-redemption-pending';
  }
  requireThat(v.phase !== 2, 'backing-state-inconsistent');
  if (state === 2) {
    requireThat(v.phase === 1 && v.announced, 'backing-state-inconsistent'); return 'trial-active-backed';
  }
  if (state === 1) requireThat(v.phase === 1 && v.announced, 'backing-state-inconsistent');
  return v.phase === 0 ? 'trial-unfunded' : 'trial-reserve-pending';
}

/**
 * Inspect only the pinned completed one-slot trial. Clients are trusted server
 * dependencies, never objects supplied by an HTTP request. RPC/provider trust
 * remains explicit: a finalized BNB observation and stable Sui object rereads
 * are not an atomic cross-chain snapshot or permission to play.
 */
export async function inspectBnbOriginalBacking({ wallet, suiClient, bnbClient, now = Date.now, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_READ_MS);
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const readSignal = controller.signal;
  let rejectAbort;
  const interrupted = new Promise((_resolve, reject) => { rejectAbort = () => reject(new BnbBackingReadError('backing-check-timeout'));
    readSignal.addEventListener('abort', rejectAbort, { once: true }); });
  try {
    requireThat(typeof wallet === 'string' && ADDRESS.test(wallet), 'backing-invalid-wallet');
    const inspectedWallet = getAddress(wallet).toLowerCase(), started = now();
    requireThat(Number.isSafeInteger(started) && started > 0 && suiClient?.core?.getObjects
      && suiClient?.ledgerService?.getServiceInfo && bnbClient?.getChainId && bnbClient?.getBlock
      && bnbClient?.getBytecode && bnbClient?.readContract, 'backing-check-unavailable');
    requireThat(!readSignal.aborted, 'backing-check-timeout');
    const work = async () => {
      const [info, chainId, blockResult] = await Promise.all([
        suiClient.ledgerService.getServiceInfo({}, { abort: readSignal }), bnbClient.getChainId(),
        bnbClient.getBlock({ blockTag: 'finalized' }),
      ]);
      requireThat(chainId === 56, 'backing-wrong-chain');
      const beforeCheckpoint = serviceInfo(info, now()), block = bnbBlock(blockResult, now());
      const readSource = () => suiClient.core.getObjects({ objectIds: [...OBJECT_IDS],
        include: { content: true, objectBcs: true }, signal: readSignal });
      const [sourceResult, destination] = await Promise.all([readSource(), destinationSnapshot(bnbClient, block, inspectedWallet)]);
      const source = sourceSnapshot(sourceResult);
      const [againResult, finalInfo, againBlock, finalChainId] = await Promise.all([
        readSource(), suiClient.ledgerService.getServiceInfo({}, { abort: readSignal }),
        bnbClient.getBlock({ blockNumber: block.number }), bnbClient.getChainId(),
      ]);
      requireThat(finalChainId === 56, 'backing-wrong-chain');
      unchangedSource(source, sourceSnapshot(againResult));
      const checkpoint = serviceInfo(finalInfo, now()); bnbBlock(againBlock, now());
      requireThat(againBlock.number === block.number && same(againBlock.hash, block.hash)
        && againBlock.timestamp === block.timestamp, 'backing-block-changed');
      requireThat(BigInt(checkpoint.sequenceNumber) >= BigInt(beforeCheckpoint.sequenceNumber)
        && checkpoint.time >= beforeCheckpoint.time, 'backing-source-changed');
      const ended = now();
      requireThat(Number.isSafeInteger(ended) && ended >= started && ended - started <= MAX_READ_MS
        && !readSignal.aborted, 'backing-check-timeout');
      fresh(beforeCheckpoint.time, ended); fresh(checkpoint.time, ended); fresh(Number(block.timestamp) * 1000, ended);
      const classification = classify(source, destination), v = source.v;
      const nftOwner = source.currentNft?.owner;
      return freeze({
        schemaVersion: 1, mode: 'original-one-slot-diagnostic', classification,
        checkedAt: new Date(ended).toISOString(), inspectedWallet,
        eligible: false, productionReady: false, gameplayAuthorized: false,
        blockers: ['production-backing-registry-not-approved', 'one-slot-trial-not-production',
          ...(classification === 'trial-retired' ? ['retired-one-slot-trial'] : [])],
        backing: { nftId: P.nft, nftType: P.nftType, lifecycle: ['unfunded', 'held', 'released'][v.phase],
          sourceCustodyConfirmed: v.phase === 1, redemptionPending: destination.state === 3,
          releasedTo: v.phase === 2 ? hex(v.recipient) : null,
          currentNftObservation: source.currentNft ? 'queryable' : 'not-queryable-by-id',
          currentNftOwnerType: nftOwner?.$kind ?? null,
          currentNftOwner: nftOwner?.AddressOwner ?? nftOwner?.ObjectOwner ?? nftOwner?.ConsensusAddressOwner?.owner ?? null },
        sui: { network: 'sui:mainnet', chainIdentifier: P.chainIdentifier,
          checkpoint: { sequenceNumber: checkpoint.sequenceNumber, timestamp: checkpoint.timestamp },
          checkpointStart: { sequenceNumber: beforeCheckpoint.sequenceNumber, timestamp: beforeCheckpoint.timestamp },
          consistency: 'stable-objects-reread', package: source.packageRef,
          packageBcsSha256: P.packageBcsSha256, registry: source.registryRef, vault: source.vaultRef,
          upgradePolicy: 'compatible-version-1-pinned', sourcePaused: v.paused },
        bnb: { chainId: 56, blockNumber: block.number.toString(), blockHash: block.hash.toLowerCase(),
          blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(), finality: 'finalized',
          passAddress: P.pass, adapterAddress: P.adapter, tokenId: '1', passState: STATES[destination.state],
          passStateCode: destination.state, owner: destination.owner, ownerMatches: destination.ownerMatches,
          canPlay: destination.canPlay, passCodeSha256: destination.codes[0], adapterCodeSha256: destination.codes[1] },
      });
    };
    return await Promise.race([work(), interrupted]);
  } catch (error) {
    if (error instanceof BnbBackingReadError) throw error;
    throw new BnbBackingReadError(readSignal.aborted ? 'backing-check-timeout' : 'backing-check-unavailable');
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort); readSignal.removeEventListener('abort', rejectAbort);
  }
}
