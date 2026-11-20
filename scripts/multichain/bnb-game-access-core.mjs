// Isolated BNB access foundation. This is NOT wired to live Arcade routes.
// Only trusted server-side callers may supply challenge records, sessions and a
// verified production registry reader. The retired one-NFT pilot is never valid.
import { getAddress, keccak256, parseAbi, toHex } from 'viem';

export const BNB_CHAIN_ID = 56;
export const BNB_IDENTITY_SCOPE = 'eip155:56:treeforce89-test:v1';
export const BNB_ORIGIN = 'https://tree-token.xyz';
export const BNB_LOGIN_URI = BNB_ORIGIN + '/play/multichaintest/game/bnb/';
export const BNB_PILOT_PASS = '0x1d3da001E586a7DEFD397B77FADB29eD6F039c13';
const MAX_CHALLENGE_MS = 5 * 60_000;
const HEX32 = /^0x[a-f0-9]{64}$/i;
const NONCE = /^[a-zA-Z0-9]{16,64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const passAbi = parseAbi([
  'function state() view returns (uint8)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function canPlay(address player) view returns (bool)',
  'function backingNFT() view returns (bytes32)',
  'function route() view returns (bytes32)',
  'function adapter() view returns (address)',
]);
const adapterAbi = parseAbi([
  'function pass() view returns (address)',
  'function backingNFT() view returns (bytes32)',
  'function route() view returns (bytes32)',
  'function suiPeer() view returns (bytes32)',
]);

export class BnbAccessError extends Error {
  constructor(code, status = 403) { super(code); this.name = 'BnbAccessError'; this.code = code; this.status = status; }
}
const denied = reason => new BnbAccessError(reason);
const unavailable = () => new BnbAccessError('entitlement-unavailable', 503);
const eq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const address = value => {
  if (typeof value !== 'string' || !ADDRESS.test(value)) throw denied('invalid-wallet');
  return getAddress(value);
};
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function formatBnbChallenge(challenge) {
  return [
    'tree-token.xyz wants you to sign in with your Ethereum account:',
    challenge.address, '',
    'TREE Arcade BNB-only test sign-in. No payment, token approval or Sui wallet is requested.', '',
    'URI: ' + challenge.uri,
    'Version: 1',
    'Chain ID: 56',
    'Nonce: ' + challenge.nonce,
    'Issued At: ' + challenge.issuedAt,
    'Expiration Time: ' + challenge.expiresAt,
  ].join('\n');
}

// The caller MUST store this exact record in durable, single-use server storage.
export function issueBnbChallenge({ wallet, nonce, now = Date.now() }) {
  const addr = address(wallet);
  if (typeof nonce !== 'string' || !NONCE.test(nonce) || !Number.isSafeInteger(now) || now <= 0) {
    throw denied('invalid-challenge');
  }
  const record = Object.freeze({
    address: addr, origin: BNB_ORIGIN, uri: BNB_LOGIN_URI, chainId: BNB_CHAIN_ID,
    scope: BNB_IDENTITY_SCOPE, nonce,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_CHALLENGE_MS).toISOString(),
  });
  return { record, message: formatBnbChallenge(record) };
}

function validStoredChallenge(record, now) {
  if (!record || typeof record !== 'object' || !Number.isFinite(now) ||
      record.origin !== BNB_ORIGIN || record.uri !== BNB_LOGIN_URI ||
      record.chainId !== BNB_CHAIN_ID || record.scope !== BNB_IDENTITY_SCOPE ||
      !NONCE.test(record.nonce || '') || !iso(record.issuedAt) || !iso(record.expiresAt)) throw denied('invalid-challenge');
  const issued = Date.parse(record.issuedAt), expires = Date.parse(record.expiresAt);
  if (issued > now + 30_000 || expires <= now || issued >= expires || expires - issued > MAX_CHALLENGE_MS) {
    throw denied('expired-challenge');
  }
  return address(record.address);
}

// Verifies EOA and contract-account signatures through viem's public client,
// then atomically consumes the server challenge. NEVER trust a browser nonce.
export async function verifyBnbChallenge({ record, message, signature, wallet, client, consumeNonce, now = Date.now() }) {
  const signer = validStoredChallenge(record, now);
  if (!eq(signer, address(wallet)) || message !== formatBnbChallenge(record) ||
      typeof signature !== 'string' || !/^0x(?:[a-f0-9]{2}){1,2048}$/i.test(signature) ||
      typeof client?.verifyMessage !== 'function' || typeof consumeNonce !== 'function') throw denied('invalid-proof');
  try {
    if ((await client.getChainId()) !== BNB_CHAIN_ID) throw denied('wrong-chain');
    if (!(await client.verifyMessage({ address: signer, message, signature }))) throw denied('signature-mismatch');
  } catch (error) {
    if (error instanceof BnbAccessError) throw error;
    throw unavailable();
  }
  // Only a database transaction can make this operation atomic across instances.
  const consumed = await consumeNonce({
    nonce: record.nonce, wallet: signer.toLowerCase(), origin: BNB_ORIGIN,
    scope: BNB_IDENTITY_SCOPE, messageHash: keccak256(toHex(message)),
  }).catch(() => { throw unavailable(); });
  if (consumed !== true) throw denied('challenge-used');
  return Object.freeze({ wallet: signer.toLowerCase(), chainId: 56, origin: BNB_ORIGIN, scope: BNB_IDENTITY_SCOPE, authenticated: true });
}

function validatePolicy(p) {
  if (!p || p.kind !== 'reviewed-original-backed-production' || p.chainId !== 56 ||
      !p.pass || !p.adapter || !p.registry || !HEX32.test(p.nftId || '') ||
      !HEX32.test(p.route || '') || !HEX32.test(p.suiPeer || '') ||
      !Number.isSafeInteger(p.generation) || p.generation < 1 ||
      typeof p.tokenId !== 'bigint' || p.tokenId < 1n) throw unavailable();
  for (const item of [p.pass, p.adapter, p.registry]) {
    if (!item || !ADDRESS.test(item.address || '') || !HEX32.test(item.codeHash || '')) throw unavailable();
  }
  if (eq(p.pass.address, BNB_PILOT_PASS) || eq(p.pass.address, p.adapter.address) || eq(p.adapter.address, p.registry.address)) throw unavailable();
}

// No default production manifest / registry exists. A valid manifest must be
// approved separately and supplied ONLY from privileged server configuration.
// Recheck for EVERY run and paid action; never cache the success as access.
export async function verifyBnbGameEntitlement({ session, policy, client, readRegistryRecord }) {
  if (!session || session.authenticated !== true || session.chainId !== BNB_CHAIN_ID ||
      session.origin !== BNB_ORIGIN || session.scope !== BNB_IDENTITY_SCOPE) throw denied('wrong-session-scope');
  const wallet = address(session.wallet).toLowerCase();
  validatePolicy(policy);
  if (typeof readRegistryRecord !== 'function' || !client?.readContract || !client?.getBytecode || !client?.getBlockNumber) throw unavailable();
  let blockNumber;
  try {
    if ((await client.getChainId()) !== BNB_CHAIN_ID) throw denied('wrong-chain');
    blockNumber = await client.getBlockNumber();
    if (typeof blockNumber !== 'bigint' || blockNumber <= 0n) throw unavailable();
    const code = await Promise.all([policy.pass, policy.adapter, policy.registry].map(x => client.getBytecode({address:x.address, blockNumber})));
    if (code.some((value, i) => !value || !eq(keccak256(value), [policy.pass, policy.adapter, policy.registry][i].codeHash))) throw unavailable();
    const pass = async (functionName, args=[]) => client.readContract({address:policy.pass.address, abi:passAbi, functionName, args, blockNumber});
    const adapter = async functionName => client.readContract({address:policy.adapter.address, abi:adapterAbi, functionName, blockNumber});
    // Check state before ownerOf; burned/locked ERC-721s may revert ownerOf.
    const state = await pass('state');
    if (BigInt(state) !== 2n) throw denied('pass-not-active');
    const [owner, canPlay, nft, route, adapterAddress, boundPass, adapterNft, adapterRoute, peer, registry] = await Promise.all([
      pass('ownerOf', [policy.tokenId]), pass('canPlay', [wallet]), pass('backingNFT'),
      pass('route'), pass('adapter'), adapter('pass'), adapter('backingNFT'),
      adapter('route'), adapter('suiPeer'),
      readRegistryRecord({registryAddress:policy.registry.address, nftId:policy.nftId, generation:policy.generation, blockNumber}),
    ]);
    if (!eq(owner, wallet) || canPlay !== true || !eq(nft, policy.nftId) ||
        !eq(route, policy.route) || !eq(adapterAddress, policy.adapter.address) ||
        !eq(boundPass, policy.pass.address) || !eq(adapterNft, policy.nftId) ||
        !eq(adapterRoute, policy.route) || !eq(peer, policy.suiPeer)) throw denied('entitlement-mismatch');
    // All registry fields must originate from a verified ON-CHAIN registry read.
    // It must prove the source NFT is uniquely and currently locked as backing.
    if (!registry || registry.status !== 'active-backed' || registry.sourceCustodyConfirmed !== true ||
        registry.redemptionPending !== false || registry.chainId !== BNB_CHAIN_ID ||
        registry.generation !== policy.generation || BigInt(registry.tokenId || 0) !== policy.tokenId ||
        !eq(registry.registryAddress, policy.registry.address) ||
        !eq(registry.passAddress, policy.pass.address) ||
        !eq(registry.route, policy.route) || !eq(registry.nftId, policy.nftId)) throw denied('backing-unverified');
    return Object.freeze({ eligible: true, wallet, chainId: 56, scope: BNB_IDENTITY_SCOPE,
      passAddress: getAddress(policy.pass.address), tokenId: policy.tokenId.toString(),
      generation: policy.generation, verifiedBlock: blockNumber.toString() });
  } catch (error) {
    if (error instanceof BnbAccessError) throw error;
    throw unavailable();
  }
}
