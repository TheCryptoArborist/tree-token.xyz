const DAPP_SWAP_EXECUTION_ENABLED = false;
const DASHBOARD_CACHE_KEY = 'tree-dashboard-last-success-v1';
const CHART_CACHE_PREFIX = 'tree-chart-last-success-v1:';
const dashboardUrl = '/api/tree-dashboard';
const leaderboardUrl = '/api/tree-leaderboard';
const chartUrl = '/api/tree-chart';
const pairUrl = 'https://api.dexscreener.com/latest/dex/pairs/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';

const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
let leaderboardEntries = [];
let treePerSui = null;
let activeChartRange = '24h';

function valueAt(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function readDashboardCache() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(DASHBOARD_CACHE_KEY); } catch { /* Storage can be unavailable. */ }
    return null;
  }
}

function writeDashboardCache(value) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readChartCache(range) {
  try {
    const raw = localStorage.getItem(`${CHART_CACHE_PREFIX}${range}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.candles)) {
      localStorage.removeItem(`${CHART_CACHE_PREFIX}${range}`);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(`${CHART_CACHE_PREFIX}${range}`); } catch { /* Storage can be unavailable. */ }
    return null;
  }
}

function writeChartCache(range, value) {
  try { localStorage.setItem(`${CHART_CACHE_PREFIX}${range}`, JSON.stringify(value)); } catch { /* Cache is optional. */ }
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
  if (meta) meta.textContent = `Source: ${source || 'Unavailable'} · Timestamp: ${timestamp || 'unavailable'} · Status: ${state.toLowerCase()}`;
}

function formatTreePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return 'Not available';
  let maximumFractionDigits = 4;
  if (price > 0 && price < 0.0001) maximumFractionDigits = 12;
  else if (price < 0.01) maximumFractionDigits = 8;
  else if (price < 1) maximumFractionDigits = 6;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits }).format(price);
}

function formatMarket(field, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Not available';
  const number = Number(value);
  if (field === 'price') return formatTreePrice(number);
  if (field.includes('Change')) return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  if (field === 'holderCount') return quantity.format(number);
  return compactMoney.format(number);
}

function renderMarket(data, state, timestamp, source) {
  document.querySelectorAll('[data-market]').forEach((element) => {
    element.textContent = formatMarket(element.dataset.market, data?.[element.dataset.market]);
  });
  setGroupState('market', state, source, timestamp);
}

function renderSnapshot(snapshot) {
  document.querySelectorAll('[data-snapshot]').forEach((element) => {
    const path = element.dataset.snapshot;
    const value = valueAt(snapshot, path);
    if (!Number.isFinite(Number(value))) element.textContent = 'Not available';
    else if (path.includes('Usd')) element.textContent = compactMoney.format(Number(value));
    else if (path.includes('Apr') || path.includes('Percent')) element.textContent = `${Number(value).toFixed(2)}%`;
    else if (path === 'nftree.mintPriceSui') element.textContent = `${quantity.format(Number(value))} SUI`;
    else element.textContent = quantity.format(Number(value));
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
    if ((payload.live?.status === 'ok' || payload.live?.status === 'fallback') && payload.live.data) {
      const source = payload.live.source || payload.sources?.displayed?.name || 'Noodles.fi';
      const state = payload.live.status === 'fallback' ? 'Fallback' : 'Live';
      renderMarket(payload.live.data, state, payload.live.data.sourceUpdatedAt || payload.generatedAt, source);
      writeDashboardCache({ generatedAt: payload.generatedAt, source, data: payload.live.data });
    } else {
      const cached = readDashboardCache();
      if (cached) renderMarket(cached.data, 'Stale', cached.generatedAt, cached.source || 'Cached market data');
      else renderMarket(null, payload.live?.status === 'not-configured' ? 'Empty' : 'Error', payload.generatedAt, payload.live?.source);
    }
    showWarnings(payload.warnings);
  } catch (error) {
    const cached = readDashboardCache();
    if (cached) renderMarket(cached.data, 'Stale', cached.generatedAt, cached.source || 'Cached market data');
    else renderMarket(null, 'Error', null, null);
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

function setChartState(state, timestamp, message) {
  const badge = document.getElementById('chartState');
  badge.textContent = state;
  badge.className = `data-state ${state.toLowerCase().replace(' ', '-')}`;
  document.getElementById('chartMeta').textContent = `Source: Noodles.fi · Timestamp: ${timestamp || 'unavailable'} · Status: ${state.toLowerCase()}`;
  const messageElement = document.getElementById('chartMessage');
  messageElement.hidden = !message;
  messageElement.textContent = message || '';
}

function drawMarketChart(candles) {
  const canvas = document.getElementById('marketChart');
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 24, right: 28, bottom: 64, left: 28 };
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#050714';
  context.fillRect(0, 0, width, height);
  if (!candles.length) return;
  const closes = candles.map((candle) => Number(candle.close)).filter(Number.isFinite);
  const volumes = candles.map((candle) => Number(candle.volume)).filter(Number.isFinite);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || Math.max(max * 0.02, 1e-12);
  const plotHeight = height - padding.top - padding.bottom;
  const plotWidth = width - padding.left - padding.right;
  const maxVolume = Math.max(...volumes, 1);
  context.strokeStyle = 'rgba(174,183,204,.12)';
  context.lineWidth = 1;
  for (let row = 0; row <= 4; row += 1) {
    const y = padding.top + plotHeight * row / 4;
    context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
  }
  const barWidth = Math.max(1, plotWidth / candles.length * 0.7);
  context.fillStyle = 'rgba(34,231,215,.22)';
  candles.forEach((candle, index) => {
    const x = padding.left + plotWidth * index / Math.max(1, candles.length - 1);
    const barHeight = Number(candle.volume) / maxVolume * 42;
    context.fillRect(x - barWidth / 2, height - padding.bottom + 48 - barHeight, barWidth, barHeight);
  });
  const gradient = context.createLinearGradient(padding.left, 0, width - padding.right, 0);
  gradient.addColorStop(0, '#33f78f'); gradient.addColorStop(1, '#22e7d7');
  context.strokeStyle = gradient; context.lineWidth = 4; context.lineJoin = 'round'; context.beginPath();
  candles.forEach((candle, index) => {
    const x = padding.left + plotWidth * index / Math.max(1, candles.length - 1);
    const y = padding.top + (max - Number(candle.close)) / spread * plotHeight;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.stroke();
  context.fillStyle = '#aeb7cc'; context.font = '24px system-ui';
  context.fillText(formatTreePrice(max), padding.left, 20);
  context.fillText(formatTreePrice(min), padding.left, height - 8);
}

async function loadChart(range = activeChartRange) {
  activeChartRange = range;
  document.querySelectorAll('[data-chart-range]').forEach((button) => button.classList.toggle('active', button.dataset.chartRange === range));
  setChartState('Loading', null, 'Loading chart…');
  try {
    const response = await fetch(`${chartUrl}?range=${encodeURIComponent(range)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Chart returned ${response.status}`);
    const payload = await response.json();
    if (payload.status === 'ok' && Array.isArray(payload.candles) && payload.candles.length) {
      drawMarketChart(payload.candles);
      setChartState('Current', payload.generatedAt, null);
      writeChartCache(range, payload);
    } else {
      const cached = readChartCache(range);
      if (cached?.candles?.length) {
        drawMarketChart(cached.candles);
        setChartState('Stale', cached.generatedAt, 'Showing the last successful cached chart.');
      } else {
        drawMarketChart([]);
        const label = payload.status === 'not-configured' ? 'Not configured' : payload.status === 'error' ? 'Error' : 'Empty';
        setChartState(label, payload.generatedAt, label === 'Empty' ? 'No candles were returned for this range.' : payload.warnings?.[0] || label);
      }
    }
  } catch (error) {
    const cached = readChartCache(range);
    if (cached?.candles?.length) {
      drawMarketChart(cached.candles);
      setChartState('Stale', cached.generatedAt, 'Showing the last successful cached chart.');
    } else {
      drawMarketChart([]);
      setChartState('Error', null, 'Chart data is temporarily unavailable.');
    }
    console.error(error);
  }
}

function shortened(address) {
  return address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;
}

function updateYourRank() {
  const output = document.getElementById('yourRank');
  if (!window.playerAddress) { output.textContent = 'Connect a wallet to check.'; return; }
  const row = leaderboardEntries.find((entry) => entry.wallet.toLowerCase() === window.playerAddress.toLowerCase());
  output.textContent = row ? `#${row.rank} · ${row.tier}` : 'Wallet is outside the displayed Top 50.';
}

function renderLeaderboard(payload) {
  const state = document.getElementById('leaderboardState');
  const rows = document.getElementById('leaderboardRows');
  leaderboardEntries = Array.isArray(payload.entries) ? payload.entries : [];
  state.textContent = payload.status === 'ok' ? 'Current' : payload.status === 'not-configured' ? 'Not configured' : 'Error';
  state.className = `data-state ${payload.status === 'error' ? 'error' : ''}`;
  document.getElementById('indexedHolderCount').textContent = payload.holderCount === null || payload.holderCount === undefined ? '—' : quantity.format(payload.holderCount);
  document.getElementById('displayedWalletCount').textContent = quantity.format(payload.displayedCount ?? leaderboardEntries.length);
  document.getElementById('excludedWalletCount').textContent = quantity.format(payload.sharedProtocolExcludedCount ?? payload.excludedCount ?? 0);
  document.getElementById('leaderboardUpdated').textContent = `Last updated: ${payload.generatedAt ? new Date(payload.generatedAt).toLocaleString() : 'unavailable'}`;
  if (!leaderboardEntries.length) {
    rows.innerHTML = `<tr><td colspan="5">${payload.status === 'not-configured' ? 'Leaderboard provider is not configured.' : payload.status === 'error' ? 'Leaderboard data is temporarily unavailable.' : 'No direct TREE holder rows were returned.'}</td></tr>`;
  } else {
    rows.replaceChildren(...leaderboardEntries.map((entry) => {
      const row = document.createElement('tr');
      [entry.rank, shortened(entry.wallet), quantity.format(Number(entry.directTree)), entry.supplyPercent === null ? '—' : `${Number(entry.supplyPercent).toFixed(4)}%`, entry.tier].forEach((value, index) => {
        const cell = document.createElement('td'); cell.textContent = String(value);
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
    renderLeaderboard({ status: 'error', generatedAt: new Date().toISOString(), entries: [], displayedCount: 0, excludedCount: 0, holderCount: null });
    console.error(error);
  }
}

async function connectForDapp() {
  const status = document.getElementById('swapStatus');
  if (window.playerAddress) {
    await window.disconnectWallet?.(); syncWalletButtons();
    status.textContent = 'Wallet disconnected.'; return;
  }
  try {
    if (typeof window.connectWallet !== 'function') throw new Error('Wallet module is still loading.');
    await window.connectWallet(); syncWalletButtons();
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

function updateDisplayedEstimate() {
  const amount = Number(document.getElementById('swapSui').value);
  const estimate = treePerSui && Number.isFinite(amount) && amount > 0 ? amount * treePerSui : null;
  document.getElementById('swapTree').value = estimate ? Math.floor(estimate).toLocaleString('en-US') : '';
  document.getElementById('estimatedTree').textContent = estimate ? `${Math.floor(estimate).toLocaleString('en-US')} TREE` : '—';
}

async function loadDisplayedRate() {
  try {
    const response = await fetch(pairUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Rate source unavailable');
    const payload = await response.json();
    const treePriceInSui = Number(payload.pair?.priceNative);
    if (!Number.isFinite(treePriceInSui) || treePriceInSui <= 0) throw new Error('Rate unavailable');
    treePerSui = 1 / treePriceInSui;
    document.getElementById('displayedRate').textContent = `1 SUI ≈ ${Math.round(treePerSui).toLocaleString('en-US')} TREE`;
    updateDisplayedEstimate();
  } catch {
    treePerSui = null;
    document.getElementById('displayedRate').textContent = 'Unavailable';
    updateDisplayedEstimate();
  }
}

function buyTree() {
  const status = document.getElementById('swapStatus');
  if (!DAPP_SWAP_EXECUTION_ENABLED) {
    status.textContent = 'On-site TREE purchases will be enabled after quote, simulation, gas-reserve, and finality verification in Phase 2.3.';
    return;
  }
}

if (typeof document !== 'undefined') {
  const buyButton = document.getElementById('buyTree');
  buyButton.disabled = !DAPP_SWAP_EXECUTION_ENABLED;
  buyButton.textContent = DAPP_SWAP_EXECUTION_ENABLED ? 'Submit TREE Purchase' : 'Swap verification in progress';
  document.getElementById('refreshStats').addEventListener('click', () => { loadDashboard(); loadChart(activeChartRange); });
  document.getElementById('dappWallet').addEventListener('click', connectForDapp);
  document.getElementById('rankWallet').addEventListener('click', connectForDapp);
  buyButton.addEventListener('click', buyTree);
  document.getElementById('swapSui').addEventListener('input', updateDisplayedEstimate);
  document.querySelectorAll('[data-chart-range]').forEach((button) => button.addEventListener('click', () => loadChart(button.dataset.chartRange)));
  window.addEventListener('load', async () => {
    try { await window.initializeWallet?.(); } catch { /* Optional session restoration. */ }
    syncWalletButtons();
  });

  loadDashboard();
  loadChart();
  loadLeaderboard();
  loadDisplayedRate();
}

export { DAPP_SWAP_EXECUTION_ENABLED, formatTreePrice, readDashboardCache, writeDashboardCache };
