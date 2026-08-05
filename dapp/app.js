const DASHBOARD_CACHE_KEY = 'tree-dashboard-last-success-v1';
const dashboardUrl = '/api/tree-dashboard';
const leaderboardUrl = '/api/tree-leaderboard';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 });
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

function valueAt(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setGroupState(groupName, state, source, timestamp) {
  const group = document.querySelector(`[data-stats-group="${groupName}"]`);
  if (!group) return;
  const badge = group.querySelector('[data-group-state]');
  const meta = group.querySelector('[data-group-meta]');
  if (badge) {
    badge.textContent = state;
    badge.className = `data-state ${state.toLowerCase()}`;
  }
  if (meta) meta.textContent = `Source: ${source} · Timestamp: ${timestamp || 'unavailable'} · Status: ${state.toLowerCase()}`;
}

function formatMarket(field, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Not available';
  const number = Number(value);
  if (field === 'price') return money.format(number);
  if (field.includes('Change')) return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  if (field === 'holderCount') return quantity.format(number);
  return compactMoney.format(number);
}

function renderMarket(data, state, timestamp) {
  document.querySelectorAll('[data-market]').forEach((element) => {
    element.textContent = formatMarket(element.dataset.market, data?.[element.dataset.market]);
  });
  setGroupState('market', state, 'Noodles.fi', timestamp);
}

function renderSnapshot(snapshot) {
  document.querySelectorAll('[data-snapshot]').forEach((element) => {
    const path = element.dataset.snapshot;
    const value = valueAt(snapshot, path);
    if (!Number.isFinite(Number(value))) {
      element.textContent = 'Not available';
    } else if (path.includes('Usd')) {
      element.textContent = money.format(Number(value));
    } else if (path.includes('Apr') || path.includes('Percent')) {
      element.textContent = `${Number(value).toFixed(2)}%`;
    } else if (path === 'nftree.mintPriceSui') {
      element.textContent = `${quantity.format(Number(value))} SUI`;
    } else {
      element.textContent = quantity.format(Number(value));
    }
  });
  const removal = snapshot?.tree?.totalSupply ? snapshot.tree.zeroAddressBalance / snapshot.tree.totalSupply * 100 : null;
  document.querySelector('[data-derived="removalPercent"]').textContent = removal === null ? 'Not available' : `${removal.toFixed(2)}%`;
  ['supply', 'liquidity', 'nftree'].forEach((group) => setGroupState(group, 'Snapshot', 'TREE project records', 'Project snapshot — June 22, 2026'));
}

function showWarnings(warnings) {
  const box = document.getElementById('statsWarnings');
  const messages = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  box.hidden = messages.length === 0;
  box.textContent = messages.join(' ');
}

async function loadDashboard() {
  setGroupState('market', 'Loading', 'Noodles.fi', null);
  ['supply', 'liquidity', 'nftree'].forEach((group) => setGroupState(group, 'Loading', 'TREE project records', 'Project snapshot — June 22, 2026'));
  try {
    const response = await fetch(dashboardUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
    const payload = await response.json();
    renderSnapshot(payload.snapshot);
    if (payload.live?.status === 'ok' && payload.live.data) {
      renderMarket(payload.live.data, 'Live', payload.live.data.sourceUpdatedAt || payload.generatedAt);
      localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ generatedAt: payload.generatedAt, data: payload.live.data }));
    } else {
      const cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null');
      if (cached?.data) renderMarket(cached.data, 'Stale', cached.generatedAt);
      else renderMarket(null, payload.live?.status === 'not-configured' ? 'Empty' : 'Error', payload.generatedAt);
    }
    showWarnings(payload.warnings);
  } catch (error) {
    const cached = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null');
    if (cached?.data) renderMarket(cached.data, 'Stale', cached.generatedAt);
    else renderMarket(null, 'Error', null);
    showWarnings(['Dashboard refresh failed. Snapshot groups retain their visibly dated project values.']);
    try {
      const snapshotResponse = await fetch('../data/tree-project-snapshot.json');
      if (snapshotResponse.ok) renderSnapshot(await snapshotResponse.json());
    } catch {
      ['supply', 'liquidity', 'nftree'].forEach((group) => setGroupState(group, 'Error', 'TREE project records', 'Project snapshot — June 22, 2026'));
    }
    console.error(error);
  }
}

let leaderboardEntries = [];

function shortened(address) {
  return address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;
}

function updateYourRank() {
  const output = document.getElementById('yourRank');
  if (!window.playerAddress) {
    output.textContent = 'Connect a wallet to check.';
    return;
  }
  const row = leaderboardEntries.find((entry) => entry.wallet.toLowerCase() === window.playerAddress.toLowerCase());
  output.textContent = row ? `#${row.rank} · ${row.tier}` : 'Wallet is outside the displayed Top 50.';
}

function renderLeaderboard(payload) {
  const state = document.getElementById('leaderboardState');
  const rows = document.getElementById('leaderboardRows');
  leaderboardEntries = Array.isArray(payload.entries) ? payload.entries : [];
  state.textContent = payload.status === 'ok' ? 'Current' : payload.status === 'not-configured' ? 'Not configured' : 'Error';
  state.className = `data-state ${payload.status === 'error' ? 'error' : ''}`;
  document.getElementById('leaderboardUpdated').textContent = `Last updated: ${payload.generatedAt ? new Date(payload.generatedAt).toLocaleString() : 'unavailable'}`;
  if (!leaderboardEntries.length) {
    rows.innerHTML = `<tr><td colspan="5">${payload.status === 'not-configured' ? 'Leaderboard provider is not configured.' : payload.status === 'error' ? 'Leaderboard data is temporarily unavailable.' : 'No direct TREE holder rows were returned.'}</td></tr>`;
  } else {
    rows.replaceChildren(...leaderboardEntries.map((entry) => {
      const row = document.createElement('tr');
      [entry.rank, shortened(entry.wallet), quantity.format(Number(entry.directTree)), entry.supplyPercent === null ? '—' : `${Number(entry.supplyPercent).toFixed(4)}%`, entry.tier].forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        if (index > 2) cell.className = 'wide-column';
        if (index === 1) cell.title = entry.wallet;
        row.append(cell);
      });
      return row;
    }));
  }
  updateYourRank();
}

async function loadLeaderboard() {
  try {
    const response = await fetch(leaderboardUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);
    renderLeaderboard(await response.json());
  } catch (error) {
    renderLeaderboard({ status: 'error', generatedAt: new Date().toISOString(), entries: [] });
    console.error(error);
  }
}

async function connectForDapp() {
  const status = document.getElementById('swapStatus');
  if (window.playerAddress) {
    await window.disconnectWallet?.();
    syncWalletButtons();
    status.textContent = 'Wallet disconnected.';
    return;
  }
  try {
    if (typeof window.connectWallet !== 'function') throw new Error('Wallet module is still loading.');
    await window.connectWallet();
    status.textContent = 'Wallet connected.';
    status.className = 'status success';
    syncWalletButtons();
  } catch (error) {
    status.textContent = error?.message === 'NO_WALLET' ? 'No compatible Sui wallet was detected.' : error?.message || 'Wallet connection failed.';
    status.className = 'status error';
  }
}

function syncWalletButtons() {
  const label = window.playerAddress ? shortened(window.playerAddress) : 'Connect Wallet';
  document.getElementById('dappWallet').textContent = label;
  document.getElementById('rankWallet').textContent = label;
  updateYourRank();
}

async function buyTree() {
  const status = document.getElementById('swapStatus');
  const amount = document.getElementById('swapSui').value.trim();
  const expectedOut = document.getElementById('swapTree').value.trim();
  if (!window.playerAddress) await connectForDapp();
  if (!window.playerAddress) return;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || !Number.isFinite(Number(expectedOut)) || Number(expectedOut) <= 0) {
    status.textContent = 'Enter valid positive SUI and expected TREE amounts.';
    status.className = 'status error';
    return;
  }
  try {
    status.textContent = 'Submitting TREE purchase…';
    status.className = 'status';
    await window.TREESwap.swapSuiToTree({ amount, expectedOut, slippageBps: 100 });
    status.textContent = 'TREE Purchase Submitted';
    status.className = 'status success';
  } catch (error) {
    status.textContent = error?.message || 'TREE purchase submission failed.';
    status.className = 'status error';
  }
}

document.getElementById('refreshStats').addEventListener('click', loadDashboard);
document.getElementById('dappWallet').addEventListener('click', connectForDapp);
document.getElementById('rankWallet').addEventListener('click', connectForDapp);
document.getElementById('buyTree').addEventListener('click', buyTree);
window.addEventListener('load', async () => {
  try { await window.initializeWallet?.(); } catch { /* Optional session restoration. */ }
  syncWalletButtons();
});

loadDashboard();
loadLeaderboard();
