import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
const client = readFileSync(new URL('../scripts/arcade-wallet-link.js', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../netlify/functions/arcade-wallet-link.ts', import.meta.url), 'utf8');

assert.match(html, /data-arcade-wallet-link/);
assert.match(html, /TREE ACCOUNT · SIGNED WALLET LINK/);
assert.match(html, /Message signatures only · No transaction · No payment · No approval/);
assert.match(html, /scripts\/arcade-wallet-link\.js/);
assert.match(client, /window\.signTreePersonalMessage/);
assert.match(client, /window\.signTreeEvmMessage/);
assert.match(client, /tree:nftree-verification/);
assert.match(client, /tree:evm-wallet-changed/);
assert.match(client, /tree:arcade:wallet-link:v1/);
assert.match(client, /\/api\/arcade-wallet-link/);
assert.match(endpoint, /verifyPersonalMessageSignature/);
assert.match(endpoint, /verifyMessage/);
assert.match(endpoint, /getCanonicalNftreeOwnership/);
assert.match(endpoint, /LINK_LIFETIME_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(endpoint, /path: '\/api\/arcade-wallet-link'/);

for (const forbidden of ['eth_sendTransaction', 'eth_sendRawTransaction', 'wallet_watchAsset', 'signAndExecuteTransactionBlock']) {
  assert.equal(`${client}\n${endpoint}`.includes(forbidden), false, `${forbidden} must not be used by wallet linking`);
}

console.log('TREE Arcade wallet-link source safeguards: PASS');
