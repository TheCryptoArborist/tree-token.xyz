import { createDAppKit, SuiGrpcClient } from './wallet-vendor.js';

const expected = '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6';
const element = id => document.getElementById(id);
const previewUrl = new URL('./', location.href);
// Use the page's actual origin: a branch preview is a separate wallet origin.
element('open-slush').href = 'https://my.slush.app/browse/' + previewUrl.href;
element('expected').textContent = expected;
element('copy-page').onclick = async () => {
  try {
    await navigator.clipboard.writeText(previewUrl.href);
    element('connection-help').textContent = 'Preview link copied. In Slush, open Apps and paste the link.';
  } catch {
    element('connection-help').textContent = 'In Slush → Apps, enter: ' + previewUrl.href;
  }
};

const kit = createDAppKit({
  networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false,
  slushWalletConfig: null,
  createClient: network => new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }),
});
let connecting = false;
const unsubscribers = [];
function listWallets() {
  const wallets = kit.stores.$wallets.get();
  const list = element('wallet-list');
  list.replaceChildren();
  element('wallet-discovery').textContent = wallets.length
    ? 'Choose your installed wallet to test the connection.'
    : 'No installed wallet detected. Use Brave with Slush installed, or open this preview in Slush → Apps.';
  for (const wallet of wallets) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Connect ' + wallet.name;
    button.disabled = connecting;
    button.onclick = async () => {
      if (connecting) return;
      connecting = true; listWallets();
      element('connection-error').textContent = '';
      element('connection-result').textContent = 'Waiting for wallet connection approval…';
      try {
        await kit.connectWallet({ wallet });
        element('connection-result').textContent = 'Connection test complete. No transaction was requested.';
      } catch {
        element('connection-error').textContent = 'Connection did not complete. If Slush shows a security warning, stop and report it; do not bypass it.';
        element('connection-result').textContent = '';
      } finally { connecting = false; listWallets(); }
    };
    list.append(button);
  }
}
unsubscribers.push(kit.stores.$wallets.subscribe(listWallets));
unsubscribers.push(kit.stores.$connection.subscribe(connection => {
  element('disconnect').hidden = !connection.account;
  element('wallet-status').textContent = connection.account
    ? (connection.account.address.toLowerCase() === expected.toLowerCase()
      ? 'Designated Sui pilot wallet connected.'
      : 'Connected wallet: ' + connection.account.address + ' · Use the designated account for the later pilot.')
    : 'No wallet connected. Connection is optional for reviewing the page.';
}));
element('disconnect').onclick = async () => {
  try { await kit.disconnectWallet(); element('connection-result').textContent = 'Wallet disconnected.'; }
  catch { element('connection-error').textContent = 'Disconnect did not complete. Check your wallet connection settings.'; }
};
window.addEventListener('pagehide', () => { for (const unsubscribe of unsubscribers) unsubscribe(); }, { once: true });
