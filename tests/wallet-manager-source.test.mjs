import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wallet = readFileSync(new URL('../scripts/wallet.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dapp/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dapp/wallet-manager.css', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/wallet-manager-core.js', import.meta.url), 'utf8');

assert.match(wallet, /@mysten\/slush-wallet@1\.1\.14/);
assert.match(wallet, /@mysten\/wallet-standard@0\.21\.14/);
assert.match(wallet, /WALLET_CONNECT_TIMEOUT_MS/);
assert.match(wallet, /SLUSH_CONNECT_TIMEOUT/);
assert.match(wallet, /@mysten\/sui@2\.23\.1\/grpc/);
assert.match(wallet, /walletSignAndExecuteTransaction/);
assert.match(wallet, /_getClient\(\)\.core\.getBalance/);
assert.doesNotMatch(wallet, /new SuiClient|@mysten\/sui@1\.43\.0\/client/);
assert.match(wallet, /registerSlushWallet\(APP_NAME, \{ network: NETWORK \}\)/);
assert.match(wallet, /window\.openWalletManager = openWalletManager/);
assert.match(wallet, /Disconnect &amp; forget/);
assert.match(wallet, /Switch wallet/);
assert.match(wallet, /standard:disconnect/);
assert.match(wallet, /standard:events/);
assert.match(wallet, /tree:wallet-changed/);
assert.doesNotMatch(wallet, /find\(\(w\) => \(w\.accounts \|\| \[\]\)\.length > 0\) \|\| suiWallets\[0\]/);

assert.match(app, /window\.openWalletManager\(\)/);
assert.match(app, /window\.addEventListener\('tree:wallet-changed'/);
assert.match(app, /Manage \$\{walletName \|\| 'Wallet'\}/);
assert.match(app, /DAPP_SWAP_EXECUTION_ENABLED = false/);
assert.doesNotMatch(app, /await window\.disconnectWallet\?\.\(\); syncWalletButtons\(\)/);

assert.match(core, /compatibleSuiWallets/);
assert.match(core, /isSlushWallet/);
assert.match(core, /my\.slush\.app/);
assert.match(css, /@media\(max-width:540px\)/);
assert.match(css, /tree-wallet-dialog/);

console.log('TREE wallet manager integration source: PASS (Slush registration, explicit picker, switch, disconnect-and-forget, account events, Command Center synchronization, and mobile styling)');
