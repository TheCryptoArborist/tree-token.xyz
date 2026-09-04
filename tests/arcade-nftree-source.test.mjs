import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
const client = readFileSync(new URL('../scripts/arcade-sui-wallet.js', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../netlify/functions/nftree-wallet.ts', import.meta.url), 'utf8');

assert.match(html, /data-sui-nftree-result/);
assert.match(html, /wallet-owned Sui Kiosk/);
assert.match(html, /Games remain open while this access system is tested/);
assert.match(client, /\/api\/nftree-wallet\?address=/);
assert.match(client, /Holder verified/);
assert.match(client, /No NFTree detected/);
assert.match(client, /payload\?\.address !== address/);
assert.match(endpoint, /NFTREE_TYPE/);
assert.match(endpoint, /canonical-nftree-current-owner-v1/);
assert.match(endpoint, /resolveObjectOwners/);
assert.match(endpoint, /Promise\.all\(batches\.map/);
assert.match(endpoint, /ObjectOwner/);
assert.match(endpoint, /path: '\/api\/nftree-wallet'/);
assert.doesNotMatch(client, /signTreePersonalMessage|signAndExecuteTransactionBlock|signPersonalMessage|signMessage|executeTransaction/);

console.log('TREE Arcade NFTree source: PASS (exact canonical type, read-only wallet verification, Kiosk owner resolution, open testing access, and no signing or transactions)');
