import assert from 'node:assert/strict';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { privateKeyToAccount } from 'viem/accounts';
import {
  default as walletLinkEndpoint,
  buildMessage,
  normalizeEvmAddress,
  validatedFields,
  verifyWalletLinkSignatures,
} from '../netlify/functions/arcade-wallet-link.ts';

const now = Date.now();
const suiKeypair = new Ed25519Keypair();
const evmAccount = privateKeyToAccount('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
const fields = {
  suiAddress: suiKeypair.getPublicKey().toSuiAddress(),
  evmAddress: evmAccount.address.toLowerCase(),
  issuedAt: new Date(now - 1_000).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(),
  nonce: 'ab'.repeat(32),
};
const domain = 'tree-arcade-multichain-preview.netlify.app';
const message = buildMessage(domain, fields);
const suiSigned = await suiKeypair.signPersonalMessage(new TextEncoder().encode(message));
const evmSigned = await evmAccount.signMessage({ message });

const challengeResponse = await walletLinkEndpoint(new Request(`https://${domain}/api/arcade-wallet-link`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'challenge', suiAddress: fields.suiAddress, evmAddress: fields.evmAddress }),
}));
const challenge = await challengeResponse.json();

assert.equal(normalizeEvmAddress(`0x${evmAccount.address.slice(2).toUpperCase()}`), fields.evmAddress);
assert.equal(challengeResponse.status, 200);
assert.equal(challenge.status, 'ok');
assert.equal(challenge.fields.suiAddress, fields.suiAddress);
assert.equal(challenge.fields.evmAddress, fields.evmAddress);
assert.equal(challenge.message, buildMessage(domain, challenge.fields));
assert.deepEqual(validatedFields(fields, now), fields);
assert.match(message, /^TREE Arcade Wallet Link\nVersion: 1\n/);
assert.match(message, /No transaction or token approval\.$/);
assert.equal(await verifyWalletLinkSignatures(fields, message, suiSigned.signature, evmSigned), true);
await assert.rejects(
  verifyWalletLinkSignatures(fields, `${message} altered`, suiSigned.signature, evmSigned),
);
assert.equal(validatedFields({ ...fields, expiresAt: new Date(now - 1).toISOString() }, now), null);
assert.equal(validatedFields({ ...fields, nonce: 'too-short' }, now), null);

console.log('TREE Arcade signed wallet-link cryptography: PASS');
