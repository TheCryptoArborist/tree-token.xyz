import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const arcade = await readFile(new URL('../play/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../scripts/robinhood-wallet.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../scripts/robinhood-wallet-core.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles/tree-arcade-branding.css', import.meta.url), 'utf8');
const combined = `${source}\n${core}`;

assert.match(arcade, /data-robinhood-wallet/);
assert.match(arcade, /MULTICHAIN PREVIEW · TESTNET/);
assert.match(arcade, /BNB Smart Chain Testnet/);
assert.match(arcade, /data-wallet-switch="bnb"/);
assert.match(arcade, /No signature · No payment · No token approval/);
assert.match(arcade, /scripts\/robinhood-wallet\.js/);
assert.match(core, /chainId:\s*46630/);
assert.match(core, /chainIdHex:\s*'0xb626'/);
assert.match(core, /https:\/\/rpc\.testnet\.chain\.robinhood\.com/);
assert.match(core, /chainId:\s*97/);
assert.match(core, /chainIdHex:\s*'0x61'/);
assert.match(core, /https:\/\/bsc-testnet-dataseed\.bnbchain\.org/);
assert.match(source, /new Set\(SAFE_WALLET_METHODS\)/);
assert.match(source, /safeMethods\.has\(method\)/);
assert.match(core, /'personal_sign'/);
assert.match(source, /window\.signTreeEvmMessage/);
assert.match(source, /tree:evm-wallet-changed/);
assert.match(styles, /\.chain-access-panel/);
assert.match(styles, /\[data-wallet-state="ready"\]/);

for (const forbiddenMethod of ['eth_sendTransaction', 'eth_sendRawTransaction', 'eth_sign', 'wallet_watchAsset']) {
  assert.equal(combined.includes(forbiddenMethod), false, `${forbiddenMethod} must not be present in the read-only wallet milestone`);
}

console.log('Multichain wallet source safeguards passed.');
