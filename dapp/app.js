const DAPP_SWAP_EXECUTION_ENABLED = false;
const DASHBOARD_CACHE_KEY = 'tree-dashboard-last-success-v1';
const CHART_CACHE_PREFIX = 'tree-chart-last-success-v1:';
const dashboardUrl = '/api/tree-dashboard';
const isDeployPreview = typeof location !== 'undefined' && /^deploy-preview-/.test(location.hostname);
const leaderboardUrl = isDeployPreview ? '/api/tree-leaderboard-preview' : '/api/tree-leaderboard';
const chartUrl = '/api/tree-chart';
const pairUrl = 'https://api.dexscreener.com/latest/dex/pairs/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';

const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
let leaderboardEntries = [];
let leaderboardStatus = 'loading';
let treePerSui = null;
let activeChartRange = '24h';
let lastLeaderboardPayload = null;
let connectedTreeBalanceRaw = null;
let connectedBalanceAddress = null;
const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const TREE_DECIMALS = 6;
const TREE_BASE_UNITS = 10n ** BigInt(TREE_DECIMALS);
const TIER_DEFINITIONS = [
  { name: 'Champion Tree', icon: '🏆', css: 'tier-champion', topRank: 5, minimumRaw: null, qualification: 'Top 5' },
  { name: 'Ancient Grove', icon: '🏛️', css: 'tier-ancient', minimumRaw: 50_000_000n * TREE_BASE_UNITS, qualification: '50M+' },
  { name: 'Redwood Royalty', icon: '👑', css: 'tier-redwood', minimumRaw: 25_000_000n * TREE_BASE_UNITS, qualification: '25M+' },
  { name: 'Giant Sequoia', icon: '🌲', css: 'tier-sequoia', minimumRaw: 10_000_000n * TREE_BASE_UNITS, qualification: '10M+' },
  { name: 'Forest Titan', icon: '💪', css: 'tier-titan', minimumRaw: 5_000_000n * TREE_BASE_UNITS, qualification: '5M+' },
  { name: 'Canopy Guardian', icon: '🛡️', css: 'tier-guardian', minimumRaw: 2_500_000n * TREE_BASE_UNITS, qualification: '2.5M+' },
  { name: 'Heritage Oak', icon: '🌳', css: 'tier-heritage', minimumRaw: 1_000_000n * TREE_BASE_UNITS, qualification: '1M+' },
  { name: 'Forest Keeper', icon: '🍃', css: 'tier-keeper', minimumRaw: 500_000n * TREE_BASE_UNITS, qualification: '500K+' },
  { name: 'TREE-mendous', icon: '⚡', css: 'tier-tremendous', minimumRaw: 250_000n * TREE_BASE_UNITS, qualification: '250K+' },
  { name: 'Branch Manager', icon: '💼', css: 'tier-branch', minimumRaw: 100_000n * TREE_BASE_UNITS, qualification: '100K+' },
  { name: 'Deep Roots', icon: '🪵', css: 'tier-roots', minimumRaw: 50_000n * TREE_BASE_UNITS, qualification: '50K+' },
  { name: 'Sapling', icon: '🌱', css: 'tier-sapling', minimumRaw: 10_000n * TREE_BASE_UNITS, qualification: '10K+' },
  { name: 'Seedling', icon: '🌰', css: 'tier-seedling', minimumRaw: 0n, qualification: '0+' },
];

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
  document.querySelectorAll('[data-chart-range]').forEach((button) => {
    const isActive = button.dataset.chartRange === range;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
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


function elementById(id) {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

function setText(id, value) {
  const target = elementById(id);
  if (target) target.textContent = value;
}

function parseTreeRaw(entry) {
  if (!entry) return null;
  if (typeof entry.directTreeRaw === 'string' && /^\d+$/.test(entry.directTreeRaw)) {
    try { return BigInt(entry.directTreeRaw); } catch { return null; }
  }
  const human = String(entry.directTree ?? '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$/.test(human)) return null;
  const [whole, fraction = ''] = human.split('.');
  try { return BigInt(`${whole}${(fraction + '0'.repeat(TREE_DECIMALS)).slice(0, TREE_DECIMALS)}`); } catch { return null; }
}

function formatTreeRaw(raw, maximumFractionDigits = TREE_DECIMALS) {
  if (raw === null || raw === undefined) return '—';
  const value = BigInt(raw);
  const base = 10n ** BigInt(TREE_DECIMALS);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(TREE_DECIMALS, '0').slice(0, maximumFractionDigits).replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}${fraction ? `.${fraction}` : ''}`;
}

function compactTree(value) {
  const numeric = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(numeric);
}

function tierForRaw(raw) {
  if (raw === null || raw === undefined) return null;
  const value = BigInt(raw);
  return TIER_DEFINITIONS.slice(1).find((tier) => value >= tier.minimumRaw) || TIER_DEFINITIONS.at(-1);
}

function tierForEntry(entry) {
  const rank = Number(entry?.rank);
  const champion = TIER_DEFINITIONS[0];
  if (Number.isInteger(rank) && rank >= 1 && rank <= champion.topRank) return champion;
  return tierForRaw(parseTreeRaw(entry));
}

function membersForTier(tier) {
  return leaderboardEntries.filter((entry) => tierForEntry(entry)?.name === tier.name);
}

function nextTierFor(tier) {
  const index = TIER_DEFINITIONS.indexOf(tier);
  return index > 0 ? TIER_DEFINITIONS[index - 1] : null;
}

function currentLeaderboardRow() {
  if (typeof window === 'undefined' || !window.playerAddress) return null;
  return leaderboardEntries.find((entry) => entry.wallet.toLowerCase() === window.playerAddress.toLowerCase()) || null;
}

function rankCutoff(rank) {
  return leaderboardEntries.find((entry) => Number(entry.rank) === rank) || null;
}

function percentageToward(currentRaw, targetRaw) {
  if (currentRaw === null || targetRaw === null || targetRaw <= 0n) return 0;
  const scaled = currentRaw * 10000n / targetRaw;
  return Math.max(0, Math.min(100, Number(scaled) / 100));
}

function renderRankDetail(row) {
  const hasWallet = typeof window !== 'undefined' && Boolean(window.playerAddress);
  if (!hasWallet) {
    setText('rankTierIcon', '🌱'); setText('rankTierName', 'Connect Wallet'); setText('rankPosition', '—');
    setText('rankDirectTree', '—'); setText('rankSupplyPercent', 'Connect a wallet to compare with the verified Top 50.');
    setText('rankNextTier', 'Seedling'); setText('rankNextRequirement', 'Connect a wallet to calculate progress.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  if (!['ok', 'stale'].includes(leaderboardStatus)) {
    setText('rankTierIcon', '⌛'); setText('rankTierName', 'Snapshot pending'); setText('rankPosition', '—');
    setText('rankDirectTree', connectedTreeBalanceRaw === null ? '—' : `${formatTreeRaw(connectedTreeBalanceRaw)} TREE`);
    setText('rankSupplyPercent', 'Verified rank data is not currently available.');
    setText('rankNextTier', 'Verification required'); setText('rankNextRequirement', 'Partial scans never produce rankings.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  if (row) {
  const tier = tierForEntry(row);
  const currentRaw = parseTreeRaw(row);
  const nextTier = nextTierFor(tier);
  setText('rankTierIcon', tier?.icon || '🌿'); setText('rankTierName', tier?.name || row.tier || 'Ranked'); setText('rankPosition', `#${row.rank}`);
  setText('rankDirectTree', `${row.directTree} TREE`); setText('rankSupplyPercent', `${row.supplyPercent ?? '—'}% of total supply · ${row.coinObjectCount ?? '—'} Coin<TREE> objects`);
  if (!nextTier) {
    setText('rankNextTier', 'Champion Tree'); setText('rankNextRequirement', 'Highest TREE leaderboard tier reached.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '100%';
  } else {
    const targetEntry = nextTier.topRank ? rankCutoff(nextTier.topRank) : null;
    const targetRaw = nextTier.topRank ? parseTreeRaw(targetEntry) : nextTier.minimumRaw;
    let need = 0n;
    if (currentRaw !== null && targetRaw !== null) {
      need = nextTier.topRank
        ? (targetRaw >= currentRaw ? targetRaw - currentRaw + 1n : 0n)
        : (targetRaw > currentRaw ? targetRaw - currentRaw : 0n);
    }
    setText('rankNextTier', nextTier.name);
    const requirement = nextTier.topRank
      ? (need > 0n ? `Need ${formatTreeRaw(need)} more TREE to reach the current Champion Tree cutoff.` : 'Current balance meets the Champion Tree cutoff.')
      : (need > 0n ? `Need ${formatTreeRaw(need)} more TREE to reach the ${nextTier.qualification} TREE threshold.` : `Current balance meets the ${nextTier.name} threshold.`);
    setText('rankNextRequirement', requirement);
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = `${percentageToward(currentRaw, targetRaw)}%`;
  }
  return;
}

const cutoff = rankCutoff(50);
  const cutoffRaw = parseTreeRaw(cutoff);
  setText('rankTierIcon', '🌱'); setText('rankTierName', 'Outside Top 50'); setText('rankPosition', 'Unranked');
  setText('rankDirectTree', connectedTreeBalanceRaw === null ? 'Loading balance…' : `${formatTreeRaw(connectedTreeBalanceRaw)} TREE`);
  setText('rankSupplyPercent', 'Direct wallet-held TREE, compared with the current verified cutoff.');
  setText('rankNextTier', 'Top 50 Entry');
  if (connectedTreeBalanceRaw !== null && cutoffRaw !== null) {
    const need = cutoffRaw >= connectedTreeBalanceRaw ? cutoffRaw - connectedTreeBalanceRaw + 1n : 0n;
    setText('rankNextRequirement', need > 0n ? `Need ${formatTreeRaw(need)} more TREE to enter the current Top 50.` : 'Balance meets the current cutoff; the next snapshot may update your rank.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = `${percentageToward(connectedTreeBalanceRaw, cutoffRaw)}%`;
  } else {
    setText('rankNextRequirement', cutoff ? `Current Forest Keeper cutoff: ${cutoff.directTree} TREE.` : 'The current Top 50 cutoff is unavailable.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
  }
}

async function loadConnectedTreeBalance() {
  if (typeof window === 'undefined' || !window.playerAddress || typeof window.initSuiClient !== 'function') {
    connectedTreeBalanceRaw = null; connectedBalanceAddress = null; return;
  }
  if (connectedBalanceAddress === window.playerAddress && connectedTreeBalanceRaw !== null) return;
  connectedBalanceAddress = window.playerAddress;
  try {
    const client = window.initSuiClient();
    const balance = await client.getBalance({ owner: window.playerAddress, coinType: TREE_COIN_TYPE });
    connectedTreeBalanceRaw = BigInt(balance?.totalBalance || '0');
  } catch {
    connectedTreeBalanceRaw = null;
  }
  updateYourRank();
}

function renderTierLadder() {
  const container = elementById('tierLadder');
  if (!container?.replaceChildren) return;
  const currentTier = tierForEntry(currentLeaderboardRow());
  if (!leaderboardEntries.length) {
    const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Tier counts appear after a complete verified snapshot.'; container.replaceChildren(empty); return;
  }
  const rows = TIER_DEFINITIONS.map((tier) => {
    const members = membersForTier(tier);
    const row = document.createElement('div'); row.className = `tier-row ${tier.css}${currentTier?.name === tier.name ? ' current' : ''}`;
    const icon = document.createElement('span'); icon.className = 'tier-icon'; icon.textContent = tier.icon;
    const identity = document.createElement('div');
    const name = document.createElement('div'); name.className = 'tier-name'; name.textContent = tier.name;
    const range = document.createElement('div'); range.className = 'tier-range'; range.textContent = tier.topRank ? 'Highest verified tier' : 'Direct TREE threshold';
    identity.append(name, range);
    const cutoff = document.createElement('div'); cutoff.className = 'tier-cutoff'; cutoff.textContent = tier.topRank ? `Top ${tier.topRank}` : `${tier.qualification} TREE`;
    const count = document.createElement('div'); count.className = 'tier-count'; count.textContent = String(members.length); count.title = `${members.length} displayed owner${members.length === 1 ? '' : 's'} in this tier`;
    row.append(icon, identity, cutoff, count); return row;
  });
  container.replaceChildren(...rows);
}

function renderLeaderboardCards() {
  const container = elementById('leaderboardCards');
  if (!container?.replaceChildren) return;
  if (!leaderboardEntries.length) {
    const empty = document.createElement('p'); empty.className = 'leaderboard-empty';
    empty.textContent = leaderboardStatus === 'refreshing' ? 'A verified snapshot is being built. Partial ranks are never published.' : leaderboardStatus === 'not-ready' ? 'A complete verified TREE leaderboard snapshot is not available yet.' : 'No ranked owners are available.';
    container.replaceChildren(empty); return;
  }
  const connected = typeof window !== 'undefined' ? window.playerAddress?.toLowerCase() : null;
  const cards = leaderboardEntries.map((entry) => {
    const card = document.createElement('article');
    card.className = `leader-card${entry.rank <= 3 ? ` top-three rank-${entry.rank}` : ''}${connected === entry.wallet.toLowerCase() ? ' connected' : ''}`;
    const rank = document.createElement('span'); rank.className = 'leader-rank'; rank.textContent = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    const identity = document.createElement('div'); identity.className = 'leader-identity';
    const walletLine = document.createElement('div'); walletLine.className = 'leader-wallet';
    const wallet = document.createElement('span'); wallet.textContent = shortened(entry.wallet); wallet.title = entry.wallet; walletLine.append(wallet);
    const tierDefinition = tierForEntry(entry);
    const tier = document.createElement('div'); tier.className = `leader-tier ${tierDefinition?.css || ''}`.trim(); tier.textContent = `${tierDefinition?.icon || '🌿'} ${tierDefinition?.name || entry.tier || 'Ranked'}`;
    identity.append(walletLine, tier);
    const balance = document.createElement('div'); balance.className = 'leader-balance';
    const amount = document.createElement('strong'); amount.textContent = `${entry.directTree} TREE`;
    const meta = document.createElement('span'); meta.textContent = `${entry.supplyPercent ?? '—'}% supply · ${entry.coinObjectCount ?? '—'} objects`; balance.append(amount, meta);
    const actions = document.createElement('div'); actions.className = 'leader-actions';
    const copy = document.createElement('button'); copy.className = 'icon-button'; copy.type = 'button'; copy.title = 'Copy wallet address'; copy.textContent = '⧉';
    copy.addEventListener?.('click', async () => { try { await navigator.clipboard.writeText(entry.wallet); setText('rankShareStatus', 'Wallet address copied.'); } catch { setText('rankShareStatus', 'Copy was unavailable.'); } });
    actions.append(copy); card.append(rank, identity, balance, actions); return card;
  });
  container.replaceChildren(...cards);
}

function rankShareText() {
  const row = currentLeaderboardRow();
  if (!row) return 'I’m checking the verified TREE Canopy Leaderboard on the TREE Command Center. https://tree-token.xyz/dapp/#leaderboard';
  const tier = tierForEntry(row)?.name || row.tier || 'Ranked';
  return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${tier} with ${row.directTree} direct TREE. https://tree-token.xyz/dapp/#leaderboard`;
}

async function shareRank() {
  const text = rankShareText();
  try {
    if (navigator.share) await navigator.share({ title: 'TREE Canopy Rank', text, url: 'https://tree-token.xyz/dapp/#leaderboard' });
    else { await navigator.clipboard.writeText(text); setText('rankShareStatus', 'Rank text copied to clipboard.'); }
  } catch (error) {
    if (error?.name !== 'AbortError') setText('rankShareStatus', 'Sharing was unavailable.');
  }
}

function downloadRankCard() {
  const canvas = elementById('rankShareCanvas');
  const row = currentLeaderboardRow();
  if (!canvas?.getContext || !row) { setText('rankShareStatus', 'Connect a ranked wallet to create a rank card.'); return; }
  const ctx = canvas.getContext('2d'); const size = canvas.width;
  const gradient = ctx.createLinearGradient(0, 0, size, size); gradient.addColorStop(0, '#03080d'); gradient.addColorStop(.55, '#071b18'); gradient.addColorStop(1, '#07111d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(53,200,255,.32)'; ctx.lineWidth = 8; ctx.strokeRect(42, 42, size - 84, size - 84);
  ctx.fillStyle = '#35f28c'; ctx.font = '900 54px ui-monospace, monospace'; ctx.fillText('TREE CANOPY LEADERBOARD', 90, 130);
  ctx.fillStyle = '#9aa9b8'; ctx.font = '700 30px ui-monospace, monospace'; ctx.fillText('VERIFIED DIRECT TREE SNAPSHOT', 90, 182);
  ctx.fillStyle = '#ffe14f'; ctx.font = '900 210px ui-monospace, monospace'; ctx.fillText(`#${row.rank}`, 90, 455);
  ctx.fillStyle = '#f5fbff'; ctx.font = '900 58px ui-monospace, monospace'; ctx.fillText((tierForEntry(row)?.name || row.tier || 'Ranked').toUpperCase(), 90, 540);
  ctx.fillStyle = '#35c8ff'; ctx.font = '900 68px ui-monospace, monospace'; ctx.fillText(`${row.directTree} TREE`, 90, 680);
  ctx.fillStyle = '#9aa9b8'; ctx.font = '600 32px ui-monospace, monospace'; ctx.fillText(`${row.supplyPercent ?? '—'}% OF TOTAL SUPPLY`, 90, 735);
  ctx.fillStyle = '#f5fbff'; ctx.font = '700 34px ui-monospace, monospace'; ctx.fillText(shortened(row.wallet), 90, 890);
  ctx.fillStyle = '#35f28c'; ctx.font = '800 34px ui-monospace, monospace'; ctx.fillText('tree-token.xyz/dapp', 90, 1050);
  canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `tree-canopy-rank-${row.rank}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setText('rankShareStatus', 'Rank card downloaded.'); }, 'image/png');
}

function updateYourRank() {
  const output = elementById('yourRank');
  if (!output) return;
  if (typeof window === 'undefined' || !window.playerAddress) { output.textContent = 'Connect a wallet to check.'; renderRankDetail(null); return; }
  if (leaderboardStatus === 'loading') { output.textContent = 'Checking leaderboard…'; renderRankDetail(null); return; }
  if (leaderboardStatus === 'not-ready') { output.textContent = 'A verified leaderboard snapshot is not available yet.'; renderRankDetail(null); return; }
  if (leaderboardStatus === 'refreshing') { output.textContent = 'The first verified leaderboard snapshot is being built.'; renderRankDetail(null); return; }
  if (leaderboardStatus === 'error') { output.textContent = 'Your rank is temporarily unavailable.'; renderRankDetail(null); return; }
  const row = currentLeaderboardRow();
  if (!row) { output.textContent = 'Wallet is outside the displayed Top 50.'; renderRankDetail(null); return; }
  const tier = tierForEntry(row)?.name || row.tier || 'Ranked';
  output.textContent = leaderboardStatus === 'stale'
    ? `#${row.rank} · ${tier} · Last verified snapshot`
    : `#${row.rank} · ${tier}`;
  renderRankDetail(row);
}

function formatSnapshotAge(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  if (milliseconds < 60_000) return `${Math.floor(milliseconds / 1000)}s`;
  if (milliseconds < 3_600_000) return `${Math.floor(milliseconds / 60_000)}m`;
  return `${Math.floor(milliseconds / 3_600_000)}h ${Math.floor((milliseconds % 3_600_000) / 60_000)}m`;
}

function renderLeaderboard(payload) {
  lastLeaderboardPayload = payload;
  const state = elementById('leaderboardState');
  const rows = elementById('leaderboardRows');
  const allowedStatus = ['not-ready', 'refreshing', 'ok', 'stale', 'error'];
  leaderboardStatus = allowedStatus.includes(payload.status) ? payload.status : 'error';
  leaderboardEntries = ['ok', 'stale'].includes(leaderboardStatus) && Array.isArray(payload.entries) ? payload.entries : [];
  const stateLabels = {
    'not-ready': 'Verified Snapshot Not Ready', refreshing: 'Building Verified Snapshot', ok: 'Current Verified Snapshot', stale: 'Last Verified Snapshot', error: 'Leaderboard Unavailable',
  };
  if (state) { state.textContent = stateLabels[leaderboardStatus]; state.className = `data-state ${leaderboardStatus}`; }
  const hasSnapshot = ['ok', 'stale'].includes(leaderboardStatus);
  const coverage = hasSnapshot ? (payload.coverage || {}) : (payload.refreshStatus || {});
  const snapshotTime = payload.snapshotGeneratedAt ? new Date(payload.snapshotGeneratedAt) : null;
  setText('leaderboardProvider', payload.provider || 'sui-graphql-snapshot');
  setText('leaderboardSnapshotTime', snapshotTime ? snapshotTime.toLocaleString() : 'None');
  setText('leaderboardSnapshotCardTime', snapshotTime ? snapshotTime.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'None');
  setText('leaderboardSnapshotAge', formatSnapshotAge(payload.snapshotAgeMs));
  setText('leaderboardRefreshState', payload.refreshState || 'idle');
  setText('leaderboardPagesScanned', quantity.format(Number(coverage.pagesScanned) || 0));
  setText('leaderboardObjectsScanned', quantity.format(Number(coverage.objectsScanned) || 0));
  const verifiedOwnerCount = hasSnapshot ? (payload.verifiedAddressOwners ?? payload.holderCount) : coverage.uniqueAddressOwners;
  const eligibleOwnerCount = hasSnapshot ? payload.eligibleRankedOwners : Number.isFinite(Number(coverage.uniqueAddressOwners)) ? Math.max(0, Number(coverage.uniqueAddressOwners) - (Number(coverage.excludedUniqueOwners) || 0)) : null;
  setText('verifiedAddressOwnerCount', verifiedOwnerCount === null || verifiedOwnerCount === undefined ? '—' : quantity.format(verifiedOwnerCount));
  setText('eligibleRankedOwnerCount', eligibleOwnerCount === null || eligibleOwnerCount === undefined ? '—' : quantity.format(eligibleOwnerCount));
  setText('displayedWalletCount', quantity.format(payload.displayedCount ?? leaderboardEntries.length));
  setText('excludedCoinObjectCount', quantity.format(payload.excludedCoinObjects ?? payload.excludedCount ?? coverage.excludedCoinObjects ?? coverage.excludedAddresses ?? 0));
  setText('excludedUniqueOwnerCount', quantity.format(payload.excludedUniqueOwners ?? coverage.excludedUniqueOwners ?? 0));
  const reconciliation = payload.reconciliation || {};
  setText('leaderboardReconciliation', reconciliation.valid === true ? 'Valid' : 'Not available');
  setText('leaderboardAddressOwnedTree', reconciliation.addressOwnedTree ? `${compactTree(reconciliation.addressOwnedTree)} TREE` : '—');
  setText('leaderboardUpdated', payload.message || 'Snapshot status unavailable.');
  setText('leaderboardCoverageDetails', [
    `Refresh state: ${payload.refreshState || 'idle'}.`, `Natural end reached: ${coverage.reachedEnd === true ? 'yes' : 'no'}.`,
    `Complete snapshot available: ${hasSnapshot ? 'yes' : 'no'}.`, `TREE metadata verified: ${coverage.coinMetadataVerified === true ? 'yes' : 'no'}.`,
    hasSnapshot ? `TREE decimals: ${payload.coinDecimals ?? coverage.coinDecimals ?? 'unavailable'}.` : null,
    `Reconciliation: ${reconciliation.valid === true ? 'valid' : 'not available'}.`,
    hasSnapshot ? `Address-owned TREE: ${reconciliation.addressOwnedTree ?? 'unavailable'}.` : 'Refresh progress contains aggregate counts only.',
  ].filter(Boolean).join(' '));
  const warningBox = elementById('leaderboardWarnings');
  if (warningBox) { warningBox.textContent = Array.isArray(payload.warnings) ? payload.warnings.join(' ') : ''; warningBox.hidden = !warningBox.textContent; }

  if (rows) {
    if (!leaderboardEntries.length) {
      const emptyMessages = { 'not-ready': 'A complete verified TREE leaderboard snapshot is not available yet.', refreshing: 'The first verified TREE leaderboard snapshot is being built. No partial ranks are published.', error: 'The verified TREE leaderboard is temporarily unavailable.' };
      rows.innerHTML = `<tr><td colspan="5">${emptyMessages[leaderboardStatus] || 'No ranked wallets are available in the verified snapshot.'}</td></tr>`;
    } else if (rows.replaceChildren) {
      rows.replaceChildren(...leaderboardEntries.map((entry) => {
        const row = document.createElement('tr');
        [entry.rank, shortened(entry.wallet), entry.directTree, entry.supplyPercent === null || entry.supplyPercent === undefined ? '—' : `${entry.supplyPercent}%`, tierForEntry(entry)?.name || entry.tier || 'Ranked'].forEach((value, index) => {
          const cell = document.createElement('td'); cell.textContent = String(value); if (index > 2) cell.className = 'wide-column'; if (index === 1) cell.title = entry.wallet; row.append(cell);
        });
        return row;
      }));
    }
  }
  renderTierLadder();
  renderLeaderboardCards();
  updateYourRank();
}

async function loadLeaderboard() {
  try {
    const response = await fetch(leaderboardUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);
    const payload = await response.json();
    if (isDeployPreview) {
      payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []), 'This visual preview uses the current complete production leaderboard snapshot.'];
      payload.message = 'Visual preview using the current complete production leaderboard snapshot.';
    }
    renderLeaderboard(payload);
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
  if (!window.playerAddress) { connectedTreeBalanceRaw = null; connectedBalanceAddress = null; }
  updateYourRank();
  loadConnectedTreeBalance();
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
  document.getElementById('shareRank')?.addEventListener('click', shareRank);
  document.getElementById('createRankImage')?.addEventListener('click', downloadRankCard);
  buyButton.addEventListener('click', buyTree);
  document.getElementById('swapSui').addEventListener('input', updateDisplayedEstimate);
  document.querySelectorAll('[data-chart-range]').forEach((button) => button.addEventListener('click', () => loadChart(button.dataset.chartRange)));
  const navLinks = [...document.querySelectorAll('.app-nav a[href^="#"]')];
  navLinks.forEach((link) => link.addEventListener('click', () => {
    navLinks.forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  }));
    if (typeof IntersectionObserver !== 'undefined') {
      const sectionLinks = new Map(navLinks.map((link) => [link.getAttribute('href')?.slice(1), link]));
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const link = visible ? sectionLinks.get(visible.target.id) : null;
        if (link) {
          navLinks.forEach((item) => item.classList.remove('active'));
          link.classList.add('active');
        }
      }, { rootMargin: '-28% 0px -58% 0px', threshold: [0.05, 0.2, 0.5] });
      document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));
    }

  window.addEventListener('load', async () => {
    try { await window.initializeWallet?.(); } catch { /* Optional session restoration. */ }
    syncWalletButtons();
  });

  loadDashboard();
  loadChart();
  loadLeaderboard();
  loadDisplayedRate();
}

export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, formatTreePrice, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };
