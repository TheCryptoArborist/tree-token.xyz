from pathlib import Path
import re

app_path = Path('dapp/app.js')
app = app_path.read_text(encoding='utf-8')

pattern = re.compile(
    r"async function connectForDapp\(\) \{.*?\n\}\n\nfunction syncWalletButtons\(\) \{.*?\n\}\n\nfunction updateDisplayedEstimate",
    re.S,
)
replacement = r'''async function connectForDapp() {
  const status = document.getElementById('swapStatus');
  try {
    if (typeof window.openWalletManager !== 'function') throw new Error('Wallet manager is still loading.');
    const result = await window.openWalletManager();
    syncWalletButtons();
    if (result?.action === 'connected') {
      status.textContent = `Connected with ${window.currentWallet?.name || 'Sui wallet'}.`;
      status.className = 'status success';
    } else if (result?.action === 'disconnected') {
      status.textContent = 'Wallet disconnected and forgotten by this site.';
      status.className = 'status';
    }
  } catch (error) {
    if (error?.code === 'CANCELLED') return;
    status.textContent = error?.message === 'NO_WALLET'
      ? 'No compatible Sui wallet was detected.'
      : error?.message || 'Wallet connection failed.';
    status.className = 'status error';
  }
}

function syncWalletButtons() {
  const address = window.playerAddress || null;
  const walletName = window.currentWallet?.name || window.currentWalletName || '';
  const compactAddress = address ? shortened(address) : '';
  const headerLabel = address
    ? `${walletName || 'Wallet'} · ${compactAddress}`
    : 'Connect Wallet';
  const rankLabel = address
    ? `Manage ${walletName || 'Wallet'}`
    : 'Connect Wallet';

  const headerButton = document.getElementById('dappWallet');
  const rankButton = document.getElementById('rankWallet');
  headerButton.textContent = headerLabel;
  rankButton.textContent = rankLabel;
  const title = address
    ? `Manage ${walletName || 'Sui wallet'} connection for ${address}`
    : 'Choose a Sui wallet to connect';
  headerButton.title = title;
  rankButton.title = title;
  headerButton.setAttribute('aria-label', title);
  rankButton.setAttribute('aria-label', title);

  if (!address) {
    connectedTreeBalanceRaw = null;
    connectedBalanceAddress = null;
  }
  updateYourRank();
  loadConnectedTreeBalance();
}

function updateDisplayedEstimate'''
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit('Could not replace the Command Center wallet button flow.')

listener_needle = "  window.addEventListener('load', async () => {"
listener = r'''  window.addEventListener('tree:wallet-changed', (event) => {
    syncWalletButtons();
    const detail = event.detail || {};
    const status = document.getElementById('swapStatus');
    if (!status) return;
    if (detail.status === 'connected') {
      status.textContent = `Connected with ${detail.walletName || 'Sui wallet'}.`;
      status.className = 'status success';
    } else if (detail.status === 'disconnected') {
      status.textContent = detail.reason === 'switch-wallet'
        ? 'Current wallet disconnected. Choose another wallet.'
        : 'Wallet disconnected and forgotten by this site.';
      status.className = 'status';
    }
  });

'''
if listener_needle not in app:
    raise SystemExit('Could not locate the Command Center load listener.')
app = app.replace(listener_needle, listener + listener_needle, 1)
app_path.write_text(app, encoding='utf-8')

Path('tests/wallet-manager-source.test.mjs').write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wallet = readFileSync(new URL('../scripts/wallet.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../dapp/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dapp/wallet-manager.css', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/wallet-manager-core.js', import.meta.url), 'utf8');

assert.match(wallet, /@mysten\/slush-wallet@1\.1\.8/);
assert.match(wallet, /registerSlushWallet\(APP_NAME, \{ network: NETWORK \}\)/);
assert.match(wallet, /window\.openWalletManager = openWalletManager/);
assert.match(wallet, /Disconnect &amp; forget/);
assert.match(wallet, /Switch wallet/);
assert.match(wallet, /standard:disconnect/);
assert.match(wallet, /standard:events/);
assert.match(wallet, /tree:wallet-changed/);
assert.match(wallet, /my\.slush\.app/);
assert.doesNotMatch(wallet, /find\(\(w\) => \(w\.accounts \|\| \[\]\)\.length > 0\) \|\| suiWallets\[0\]/);

assert.match(app, /window\.openWalletManager\(\)/);
assert.match(app, /window\.addEventListener\('tree:wallet-changed'/);
assert.match(app, /Manage \$\{walletName \|\| 'Wallet'\}/);
assert.match(app, /DAPP_SWAP_EXECUTION_ENABLED = false/);
assert.doesNotMatch(app, /await window\.disconnectWallet\?\.\(\); syncWalletButtons\(\)/);

assert.match(core, /compatibleSuiWallets/);
assert.match(core, /isSlushWallet/);
assert.match(css, /@media\(max-width:540px\)/);
assert.match(css, /tree-wallet-dialog/);

console.log('TREE wallet manager integration source: PASS (Slush registration, explicit picker, switch, disconnect-and-forget, account events, Command Center synchronization, and mobile styling)');
''', encoding='utf-8')
