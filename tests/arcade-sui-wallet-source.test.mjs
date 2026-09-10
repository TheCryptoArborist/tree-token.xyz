import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const arcade = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
const wrapper = readFileSync(new URL('../scripts/arcade-sui-wallet.js', import.meta.url), 'utf8');
const wallet = readFileSync(new URL('../scripts/wallet.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/tree-arcade-branding.css', import.meta.url), 'utf8');

assert.match(arcade, /data-arcade-sui-wallet/);
assert.match(arcade, /SUI MAINNET · CANONICAL NFTREE/);
assert.match(arcade, /scripts\/arcade-sui-wallet\.js/);
assert.match(arcade, /No signature · No transaction · No gas/);
assert.match(wrapper, /import '\.\/wallet\.js'/);
assert.match(wrapper, /window\.openWalletManager/);
assert.match(wrapper, /window\.initializeWallet/);
assert.match(wrapper, /tree:wallet-changed/);
assert.match(wrapper, /Sui Mainnet/);
assert.doesNotMatch(wrapper, /signTreePersonalMessage|signAndExecuteTransactionBlock|signPersonalMessage|signMessage|executeTransaction/);
assert.match(wallet, /location\.origin\}\$\{location\.pathname\}\$\{location\.search/);
assert.doesNotMatch(wallet, /slushBrowseUrl\(`\$\{location\.origin\}\/dapp\/`\)/);
assert.match(css, /\.sui-access-panel/);
assert.match(css, /data-sui-wallet-state="connected"/);

console.log('TREE Arcade Sui wallet source: PASS (mainnet connection-only panel, current-page Slush return, and no signing or transaction methods)');
