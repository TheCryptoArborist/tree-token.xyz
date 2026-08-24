const DAPP_SWAP_EXECUTION_ENABLED = false;
const DASHBOARD_CACHE_KEY = 'tree-dashboard-last-success-v1';
const CHART_CACHE_PREFIX = 'tree-chart-last-success-v1:';
const dashboardUrl = '/api/tree-dashboard';
const isDeployPreview = typeof location !== 'undefined' && /^deploy-preview-/.test(location.hostname);
const leaderboardUrl = isDeployPreview ? '/api/tree-exposure-preview' : '/api/tree-exposure';
const badgeUrl = isDeployPreview ? '/api/tree-badges-preview' : '/api/tree-badges';
let leaderboardMode = 'exposure';
const chartUrl = '/api/tree-chart';
const burnUrl = '/api/tree-burn-overview';
const pairUrl = 'https://api.dexscreener.com/latest/dex/pairs/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';

const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const burnQuantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
const compactBurnQuantity = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
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
const TREE_TOTAL_SUPPLY_RAW = 1_000_000_000n * TREE_BASE_UNITS;
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

function formatSuiPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return 'Not available';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(price);
}

async function loadSuiHeaderPrice() {
  const targets = document.querySelectorAll('[data-sui-price]');
  if (!targets.length) return;
  try {
    const response = await fetch('/api/tree-v3-overview', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`SUI price returned ${response.status}`);
    const payload = await response.json();
    const label = formatSuiPrice(payload?.market?.suiUsd);
    targets.forEach((target) => { target.textContent = label; });
  } catch {
    targets.forEach((target) => { target.textContent = 'Not available'; });
  }
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

function renderBurnProgress(value) {
  const percentage = Number(value);
  const progressLabel = document.getElementById('burnProgressLabel');
  const progressBar = document.getElementById('burnProgressBar');
  if (!Number.isFinite(percentage)) return;
  if (progressLabel) progressLabel.textContent = `${percentage.toFixed(2)}%`;
  if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, (percentage - 5) * 20))}%`;
}

function renderSnapshot(snapshot) {
  document.querySelectorAll('[data-snapshot]').forEach((element) => {
    const path = element.dataset.snapshot;
    const value = valueAt(snapshot, path);
    if (!Number.isFinite(Number(value))) element.textContent = 'Not available';
    else if (path.includes('Usd')) element.textContent = compactMoney.format(Number(value));
    else if (path.includes('Apr') || path.includes('Percent')) element.textContent = `${Number(value).toFixed(2)}%`;
    else if (path === 'nftree.mintPriceSui') element.textContent = `${quantity.format(Number(value))} SUI`;
    else if (element.dataset.burnFormat === 'compact') element.textContent = compactBurnQuantity.format(Number(value));
    else element.textContent = quantity.format(Number(value));
  });
  const removal = snapshot?.tree?.totalSupply ? snapshot.tree.zeroAddressBalance / snapshot.tree.totalSupply * 100 : null;
  document.querySelectorAll('[data-derived="removalPercent"]').forEach((element) => { element.textContent = removal === null ? 'Not available' : `${removal.toFixed(2)}%`; });
  const locked = snapshot?.tree?.totalSupply ? snapshot.tree.moonbagsLocked / snapshot.tree.totalSupply * 100 : null;
  document.querySelectorAll('[data-derived="lockedPercent"]').forEach((element) => { element.textContent = locked === null ? 'Not available' : `${locked.toFixed(2)}%`; });
  renderBurnProgress(removal);
  ['supply', 'liquidity', 'nftree'].forEach((group) => setGroupState(group, 'Snapshot', 'TREE project records', 'Project snapshot — June 22, 2026'));
}

function setBurnState(state, source, timestamp) {
  const badge = document.getElementById('burnState');
  if (badge) { badge.textContent = state; badge.className = `data-state ${state.toLowerCase()}`; }
  const meta = document.getElementById('burnMeta');
  if (meta) meta.textContent = `Source: ${source} · Timestamp: ${timestamp || 'unavailable'} · Status: ${state.toLowerCase()}`;
}

function renderBurnOverview(payload) {
  document.querySelectorAll('[data-burn]').forEach((element) => {
    const value = Number(payload?.[element.dataset.burn]);
    if (!Number.isFinite(value)) { element.textContent = 'Not available'; return; }
    element.textContent = element.dataset.burn === 'removalPercentage'
      ? `${value.toFixed(4)}%`
      : element.dataset.burnFormat === 'compact' ? compactBurnQuantity.format(value) : burnQuantity.format(value);
    if (element.dataset.burnFormat === 'compact') element.title = burnQuantity.format(value);
  });
  renderBurnProgress(payload?.removalPercentage);
  const totalTransactions = document.getElementById('burnTotalTransactions');
  if (totalTransactions) totalTransactions.textContent = Number.isSafeInteger(payload?.totalTransactions) ? quantity.format(payload.totalTransactions) : '—';
  const recentList = document.getElementById('burnRecentList');
  const recentBurns = Array.isArray(payload?.recentBurns) ? payload.recentBurns : [];
  if (recentList && recentBurns.length) {
    recentList.replaceChildren(...recentBurns.slice(0, 3).map((burn) => {
      const row = document.createElement('div');
      row.className = 'burn-recent-row';
      const link = document.createElement('a');
      link.href = `https://suivision.xyz/txblock/${encodeURIComponent(String(burn.digest || ''))}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = compact(String(burn.digest || ''));
      const amount = document.createElement('strong'); amount.textContent = `-${compactBurnQuantity.format(Number(burn.amount || 0))}`;
      const time = document.createElement('time'); time.textContent = burn.age || '—';
      row.append(link, amount, time); return row;
    }));
  }
  setBurnState('Live', payload.source || 'Sui Mainnet gRPC', payload.generatedAt);
}

async function loadBurnOverview() {
  setBurnState('Loading', 'Sui Mainnet gRPC', null);
  try {
    const response = await fetch(burnUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'ok') throw new Error('Live burn overview unavailable.');
    renderBurnOverview(payload);
  } catch {
    setBurnState('Snapshot', 'TREE project records fallback', 'Project snapshot — June 22, 2026');
  }
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

function setChartState(state, timestamp, message, source = 'Market data') {
  const badge = document.getElementById('chartState');
  badge.textContent = state;
  badge.className = `data-state ${state.toLowerCase().replace(' ', '-')}`;
  document.getElementById('chartMeta').textContent = `Source: ${source} · Timestamp: ${timestamp || 'unavailable'} · Status: ${state.toLowerCase()}`;
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
      setChartState('Current', payload.generatedAt, null, payload.source || 'Market data');
      writeChartCache(range, payload);
    } else {
      const cached = readChartCache(range);
      if (cached?.candles?.length) {
        drawMarketChart(cached.candles);
        setChartState('Stale', cached.generatedAt, 'Showing the last successful cached chart.', cached.source || 'Cached market data');
      } else {
        drawMarketChart([]);
        const label = payload.status === 'not-configured' ? 'Not configured' : payload.status === 'error' ? 'Error' : 'Empty';
        setChartState(label, payload.generatedAt, label === 'Empty' ? 'No candles were returned for this range.' : payload.warnings?.[0] || label, payload.source || 'Market data');
      }
    }
  } catch (error) {
    const cached = readChartCache(range);
    if (cached?.candles?.length) {
      drawMarketChart(cached.candles);
      setChartState('Stale', cached.generatedAt, 'Showing the last successful cached chart.', cached.source || 'Cached market data');
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

function displayNameForEntry(entry) {
  const name = typeof entry?.suinsName === 'string' ? entry.suinsName.trim() : '';
  return name || shortened(String(entry?.wallet || ''));
}

function entryIsExposure(entry) {
  return Boolean(entry
    && typeof entry.totalExposureRaw === 'string'
    && /^\d+$/.test(entry.totalExposureRaw)
    && typeof entry.liquidTreeRaw === 'string'
    && typeof entry.lpTreeRaw === 'string');
}

function normalizeLeaderboardEntry(entry) {
  if (!entryIsExposure(entry)) return entry;
  return {
    ...entry,
    directTreeRaw: entry.totalExposureRaw,
    directTree: entry.totalExposure,
    coinObjectCount: entry.liquidCoinObjectCount,
  };
}

function badgeDefinition(slug) {
  return {
    'lp-provider': { icon: '💧', label: 'LP Provider', description: 'Holds verified TREE principal in a recognized liquidity pool.' },
    'lp-maxi': { icon: '🌊', label: 'LP Maxi', description: 'More verified TREE is held in LP principal than liquid in the wallet.' },
    'diamond-hands': { icon: '💎', label: 'Diamond Hands', description: 'No classified TREE sells during the verified 30-day window.' },
    'paper-hands': { icon: '📄', label: 'Paper Hands', description: 'Classified TREE sold exceeded TREE bought during the verified 30-day window.' },
    accumulator: { icon: '🌱', label: 'Accumulator', description: 'Completed at least 10 qualifying TREE buys during the verified 30-day window.' },
    burned: { icon: '🔥', label: 'Burned', description: 'Burned at least 500,000 TREE.' },
  }[slug] || null;
}

function exposureBreakdownText(entry) {
  if (!entryIsExposure(entry)) return '';
  return `${entry.liquidTree} Liquid + ${entry.lpTree} LP`;
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

function formatSupplyPercentFromRaw(raw, maximumFractionDigits = 5) {
  if (raw === null || raw === undefined) return '—';
  const value = BigInt(raw);
  const precision = 10n ** BigInt(maximumFractionDigits);
  const scaled = value * 100n * precision / TREE_TOTAL_SUPPLY_RAW;
  const whole = scaled / precision;
  const fraction = (scaled % precision).toString().padStart(maximumFractionDigits, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}%`;
}

function tierThresholdLabel(tier) {
  if (tier.topRank) return `Top ${tier.topRank}`;
  if (tier.minimumRaw === 0n) return 'Under 10K TREE';
  return `${tier.qualification} TREE`;
}

function tierSupplyShareLabel(tier) {
  if (tier.topRank) {
    const cutoffEntry = rankCutoff(tier.topRank);
    const cutoffRaw = parseTreeRaw(cutoffEntry);
    return cutoffRaw === null
      ? 'Top 5 · cutoff updates with each verified snapshot'
      : `Current #${tier.topRank} cutoff: ${compactTree(cutoffEntry.directTree)} TREE · ${formatSupplyPercentFromRaw(cutoffRaw)} of supply`;
  }
  if (tier.minimumRaw === 0n) return 'Below 0.001% of the 1B supply';
  return `${formatSupplyPercentFromRaw(tier.minimumRaw)}+ of the 1B supply`;
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
    setText('rankExposureBreakdown', 'Liquid TREE and verified LP principal will appear here.');
    setText('rankNextTier', 'Seedling'); setText('rankNextRequirement', 'Connect a wallet to calculate progress.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  if (!['ok', 'stale'].includes(leaderboardStatus)) {
    setText('rankTierIcon', '⌛'); setText('rankTierName', 'Snapshot pending'); setText('rankPosition', '—');
    setText('rankDirectTree', connectedTreeBalanceRaw === null ? '—' : `${formatTreeRaw(connectedTreeBalanceRaw)} TREE liquid`);
    setText('rankSupplyPercent', 'Verified rank data is not currently available.');
    setText('rankExposureBreakdown', 'Partial scans never produce total-exposure rankings.');
    setText('rankNextTier', 'Verification required'); setText('rankNextRequirement', 'Wait for a complete verified snapshot.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  if (row) {
    const tier = tierForEntry(row);
    const currentRaw = parseTreeRaw(row);
    const nextTier = nextTierFor(tier);
    const exposure = entryIsExposure(row);
    setText('rankTierIcon', tier?.icon || '🌿');
    setText('rankTierName', tier?.name || row.tier || 'Ranked');
    setText('rankPosition', `#${row.rank}`);
    setText('rankDirectTree', `${exposure ? row.totalExposure : row.directTree} TREE`);
    setText('rankSupplyPercent', exposure
      ? `${row.supplyPercent ?? '—'}% of total supply · ${row.lpPositionCount ?? 0} verified LP position${row.lpPositionCount === 1 ? '' : 's'}`
      : `${row.supplyPercent ?? '—'}% of total supply · ${row.coinObjectCount ?? '—'} Coin<TREE> objects`);
    setText('rankExposureBreakdown', exposure
      ? exposureBreakdownText(row)
      : 'Direct address-owned TREE only.');
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
        ? (need > 0n ? `Need ${formatTreeRaw(need)} more verified TREE exposure to reach the current Champion Tree cutoff.` : 'Current exposure meets the Champion Tree cutoff.')
        : (need > 0n ? `Need ${formatTreeRaw(need)} more verified TREE exposure to reach the ${nextTier.qualification} TREE threshold.` : `Current exposure meets the ${nextTier.name} threshold.`);
      setText('rankNextRequirement', requirement);
      const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = `${percentageToward(currentRaw, targetRaw)}%`;
    }
    return;
  }

  const cutoff = rankCutoff(50);
  setText('rankTierIcon', '🌱'); setText('rankTierName', 'Outside Top 50'); setText('rankPosition', 'Unranked');
  setText('rankDirectTree', connectedTreeBalanceRaw === null ? 'Loading liquid balance…' : `${formatTreeRaw(connectedTreeBalanceRaw)} TREE liquid`);
  if (leaderboardMode === 'exposure') {
    setText('rankSupplyPercent', 'Liquid balance only. Total verified exposure also includes recognized LP principal.');
    setText('rankExposureBreakdown', 'LP exposure is resolved during the complete background snapshot, not estimated on demand.');
    setText('rankNextTier', 'Top 50 Entry');
    setText('rankNextRequirement', cutoff
      ? `Current #50 total-exposure cutoff: ${cutoff.totalExposure || cutoff.directTree} TREE. The next complete snapshot determines eligibility.`
      : 'The current Top 50 cutoff is unavailable.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = '0%';
    return;
  }

  const cutoffRaw = parseTreeRaw(cutoff);
  setText('rankSupplyPercent', 'Direct wallet-held TREE, compared with the current verified cutoff.');
  setText('rankExposureBreakdown', 'Direct address-owned TREE only.');
  setText('rankNextTier', 'Top 50 Entry');
  if (connectedTreeBalanceRaw !== null && cutoffRaw !== null) {
    const need = cutoffRaw >= connectedTreeBalanceRaw ? cutoffRaw - connectedTreeBalanceRaw + 1n : 0n;
    setText('rankNextRequirement', need > 0n ? `Need ${formatTreeRaw(need)} more TREE to enter the current Top 50.` : 'Balance meets the current cutoff; the next snapshot may update your rank.');
    const progress = elementById('rankProgressBar'); if (progress?.style) progress.style.width = `${percentageToward(connectedTreeBalanceRaw, cutoffRaw)}%`;
  } else {
    setText('rankNextRequirement', cutoff ? `Current cutoff: ${cutoff.directTree} TREE.` : 'The current Top 50 cutoff is unavailable.');
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
    const range = document.createElement('div'); range.className = 'tier-range'; range.textContent = tierSupplyShareLabel(tier);
    identity.append(name, range);
    const cutoff = document.createElement('div'); cutoff.className = 'tier-cutoff'; cutoff.textContent = tierThresholdLabel(tier);
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
    empty.textContent = leaderboardStatus === 'refreshing' ? 'A verified snapshot is being built. Partial ranks are never published.' : leaderboardStatus === 'not-ready' ? 'A complete verified TREE exposure snapshot is not available yet.' : 'No ranked owners are available.';
    container.replaceChildren(empty); return;
  }
  const connected = typeof window !== 'undefined' ? window.playerAddress?.toLowerCase() : null;
  const cards = leaderboardEntries.map((entry) => {
    const exposure = entryIsExposure(entry);
    const card = document.createElement('article');
    card.className = `leader-card${entry.rank <= 3 ? ` top-three rank-${entry.rank}` : ''}${connected === entry.wallet.toLowerCase() ? ' connected' : ''}${exposure ? ' exposure-card' : ''}`;
    const rank = document.createElement('span'); rank.className = 'leader-rank'; rank.textContent = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    const identity = document.createElement('div'); identity.className = 'leader-identity';
    const walletLine = document.createElement('div'); walletLine.className = 'leader-wallet';
    const wallet = document.createElement('span'); wallet.textContent = displayNameForEntry(entry); wallet.title = entry.suinsName || entry.wallet; walletLine.append(wallet);
    const addressLine = document.createElement('div'); addressLine.className = 'leader-address'; addressLine.textContent = shortened(entry.wallet); addressLine.title = entry.wallet;
    const tierDefinition = tierForEntry(entry);
    const tier = document.createElement('div'); tier.className = `leader-tier ${tierDefinition?.css || ''}`.trim(); tier.textContent = `${tierDefinition?.icon || '🌿'} ${tierDefinition?.name || entry.tier || 'Ranked'}`;
    identity.append(walletLine, ...(entry.suinsName ? [addressLine] : []), tier);

    const badges = document.createElement('div'); badges.className = 'leader-badges';
    for (const slug of Array.isArray(entry.badges) ? entry.badges : []) {
      const definition = badgeDefinition(slug);
      if (!definition) continue;
      const badge = document.createElement('span');
      badge.className = `leader-badge badge-${slug}`;
      badge.textContent = `${definition.icon} ${definition.label}`;
      badge.title = definition.description;
      badges.append(badge);
    }
    if (badges.children?.length || (Array.isArray(entry.badges) && entry.badges.length)) identity.append(badges);

    const balance = document.createElement('div'); balance.className = 'leader-balance';
    const amount = document.createElement('strong'); amount.textContent = `${exposure ? entry.totalExposure : entry.directTree} TREE`;
    const meta = document.createElement('span');
    meta.textContent = exposure
      ? `${entry.liquidTree} Liquid + ${entry.lpTree} LP`
      : `${entry.supplyPercent ?? '—'}% supply · ${entry.coinObjectCount ?? '—'} objects`;
    const supply = document.createElement('small');
    supply.textContent = exposure ? `${entry.supplyPercent ?? '—'}% of supply` : '';
    balance.append(amount, meta, ...(exposure ? [supply] : []));

    const actions = document.createElement('div'); actions.className = 'leader-actions';
    const copy = document.createElement('button'); copy.className = 'icon-button'; copy.type = 'button'; copy.title = 'Copy wallet address'; copy.textContent = '⧉';
    copy.addEventListener?.('click', async () => { try { await navigator.clipboard.writeText(entry.wallet); setText('rankShareStatus', 'Wallet address copied.'); } catch { setText('rankShareStatus', 'Copy was unavailable.'); } });
    const explorer = document.createElement('a'); explorer.className = 'icon-button'; explorer.title = 'Open wallet in SuiScan'; explorer.textContent = '↗'; explorer.href = `https://suiscan.xyz/mainnet/account/${entry.wallet}`; explorer.target = '_blank'; explorer.rel = 'noopener noreferrer';
    actions.append(copy, explorer);
    card.append(rank, identity, balance, actions);

    if (exposure) {
      const details = document.createElement('details'); details.className = 'leader-exposure-details';
      const summary = document.createElement('summary'); summary.textContent = entry.lpTreeRaw === '0' ? 'No verified LP principal' : 'View verified LP breakdown';
      const grid = document.createElement('div'); grid.className = 'lp-breakdown-grid';
      const items = [
        ['Liquid TREE', entry.liquidTree],
        ['SuiDex V2 LP', entry.lpBreakdown?.suiDexV2 || '0'],
        ['SuiDex V3 LP', entry.lpBreakdown?.suiDexV3 || '0'],
        ['Turbos LP', entry.lpBreakdown?.turbos || '0'],
        ['Total Exposure', entry.totalExposure],
      ];
      for (const [label, value] of items) {
        const labelNode = document.createElement('span'); labelNode.textContent = label;
        const valueNode = document.createElement('strong'); valueNode.textContent = `${value} TREE`;
        grid.append(labelNode, valueNode);
      }
      details.append(summary, grid); card.append(details);
    }
    return card;
  });
  container.replaceChildren(...cards);
}

function rankShareText() {
  const row = currentLeaderboardRow();
  if (!row) return 'I’m checking the verified TREE Canopy Leaderboard on the TREE Command Center. https://tree-token.xyz/dapp/#leaderboard';
  const tier = tierForEntry(row)?.name || row.tier || 'Ranked';
  if (entryIsExposure(row)) {
    const badges = (Array.isArray(row.badges) ? row.badges : []).map((slug) => badgeDefinition(slug)?.label).filter(Boolean);
    return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${displayNameForEntry(row)}, ${tier}, with ${row.totalExposure} TREE total verified exposure (${row.liquidTree} liquid + ${row.lpTree} LP)${badges.length ? ` · ${badges.join(' · ')}` : ''}. https://tree-token.xyz/dapp/#leaderboard`;
  }
  return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${displayNameForEntry(row)}, ${tier}, with ${row.directTree} direct TREE. https://tree-token.xyz/dapp/#leaderboard`;
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
  const exposure = entryIsExposure(row);
  const ctx = canvas.getContext('2d'); const size = canvas.width;
  const gradient = ctx.createLinearGradient(0, 0, size, size); gradient.addColorStop(0, '#03080d'); gradient.addColorStop(.55, '#071b18'); gradient.addColorStop(1, '#07111d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(53,200,255,.32)'; ctx.lineWidth = 8; ctx.strokeRect(42, 42, size - 84, size - 84);
  ctx.fillStyle = '#35f28c'; ctx.font = '900 54px ui-monospace, monospace'; ctx.fillText('TREE CANOPY LEADERBOARD', 90, 130);
  ctx.fillStyle = '#9aa9b8'; ctx.font = '700 30px ui-monospace, monospace'; ctx.fillText(exposure ? 'VERIFIED LIQUID + LP SNAPSHOT' : 'VERIFIED DIRECT TREE SNAPSHOT', 90, 182);
  ctx.fillStyle = '#ffe14f'; ctx.font = '900 210px ui-monospace, monospace'; ctx.fillText(`#${row.rank}`, 90, 455);
  ctx.fillStyle = '#f5fbff'; ctx.font = '900 58px ui-monospace, monospace'; ctx.fillText((tierForEntry(row)?.name || row.tier || 'Ranked').toUpperCase(), 90, 540);
  ctx.fillStyle = '#35c8ff'; ctx.font = '900 68px ui-monospace, monospace'; ctx.fillText(`${exposure ? row.totalExposure : row.directTree} TREE`, 90, 680);
  ctx.fillStyle = '#9aa9b8'; ctx.font = '600 32px ui-monospace, monospace';
  ctx.fillText(exposure ? `${row.liquidTree} LIQUID + ${row.lpTree} LP` : `${row.supplyPercent ?? '—'}% OF TOTAL SUPPLY`, 90, 735);
  if (exposure) ctx.fillText(`${row.supplyPercent ?? '—'}% OF TOTAL SUPPLY`, 90, 785);
  const badgeLine = exposure ? (row.badges || []).map((slug) => badgeDefinition(slug)?.label?.toUpperCase()).filter(Boolean).join(' · ') : '';
  if (badgeLine) { ctx.fillStyle = '#ffe14f'; ctx.font = '800 27px ui-monospace, monospace'; ctx.fillText(badgeLine, 90, 840); }
  ctx.fillStyle = '#f5fbff'; ctx.font = '700 34px ui-monospace, monospace'; ctx.fillText(displayNameForEntry(row), 90, 920);
  if (row.suinsName) { ctx.fillStyle = '#9aa9b8'; ctx.font = '600 27px ui-monospace, monospace'; ctx.fillText(shortened(row.wallet), 90, 965); }
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
  const exposurePayload = String(payload.methodologyVersion || '').startsWith('verified-tree-exposure-v')
    || payload.provider === 'tree-exposure-snapshot';
  leaderboardMode = exposurePayload ? 'exposure' : 'direct';
  const rawEntries = ['ok', 'stale'].includes(leaderboardStatus) && Array.isArray(payload.entries) ? payload.entries : [];
  leaderboardEntries = rawEntries.map(normalizeLeaderboardEntry);
  const stateLabels = exposurePayload ? {
    'not-ready': 'Exposure Snapshot Not Ready', refreshing: 'Building Exposure Snapshot', ok: 'Current Exposure Snapshot', stale: 'Last Exposure Snapshot', error: 'Exposure Board Unavailable',
  } : {
    'not-ready': 'Verified Snapshot Not Ready', refreshing: 'Building Verified Snapshot', ok: 'Current Verified Snapshot', stale: 'Last Verified Snapshot', error: 'Leaderboard Unavailable',
  };
  if (state) { state.textContent = stateLabels[leaderboardStatus]; state.className = `data-state ${leaderboardStatus}`; }
  const hasSnapshot = ['ok', 'stale'].includes(leaderboardStatus);
  const coverage = hasSnapshot ? (payload.coverage || {}) : (payload.refreshStatus || {});
  const snapshotTime = payload.snapshotGeneratedAt ? new Date(payload.snapshotGeneratedAt) : null;
  setText('leaderboardProvider', payload.provider || (exposurePayload ? 'tree-exposure-snapshot' : 'sui-graphql-snapshot'));
  setText('leaderboardSnapshotTime', snapshotTime ? snapshotTime.toLocaleString() : 'None');
  setText('leaderboardSnapshotCardTime', snapshotTime ? snapshotTime.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'None');
  setText('leaderboardSnapshotAge', formatSnapshotAge(payload.snapshotAgeMs));
  setText('leaderboardRefreshState', payload.refreshState || 'idle');

  if (exposurePayload) {
    const direct = payload.source?.direct || {};
    const summary = payload.summary || {};
    const venues = payload.source?.venues || {};
    setText('leaderboardPagesScanned', quantity.format(Number(direct.pagesScanned) || 0));
    setText('leaderboardObjectsScanned', quantity.format(Number(direct.objectsScanned) || 0));
    setText('verifiedAddressOwnerCount', direct.verifiedAddressOwners === null || direct.verifiedAddressOwners === undefined ? '—' : quantity.format(direct.verifiedAddressOwners));
    setText('eligibleRankedOwnerCount', payload.eligibleOwnerCount === null || payload.eligibleOwnerCount === undefined ? '—' : quantity.format(payload.eligibleOwnerCount));
    setText('displayedWalletCount', quantity.format(payload.displayedCount ?? leaderboardEntries.length));
    setText('excludedCoinObjectCount', quantity.format(summary.badgeCounts?.lpProvider ?? 0));
    setText('excludedUniqueOwnerCount', quantity.format(summary.badgeCounts?.lpMaxi ?? 0));
    setText('leaderboardReconciliation', coverage.totalExposureComplete === true ? 'All venue gates passed' : 'Not complete');
    setText('leaderboardAddressOwnedTree', summary.top50TotalRaw ? `${compactTree(formatTreeRaw(summary.top50TotalRaw))} TREE` : '—');
    setText('leaderboardUpdated', payload.message || 'Exposure snapshot status unavailable.');
    setText('leaderboardCoverageDetails', [
      `Refresh state: ${payload.refreshState || 'idle'}.`,
      `Direct scan: ${quantity.format(Number(direct.pagesScanned) || 0)} pages and ${quantity.format(Number(direct.objectsScanned) || 0)} Coin<TREE> objects.`,
      `SuiDex V2: ${venues.suiDexV2?.outcome || 'pending'}; ${venues.suiDexV2?.walletCount ?? 0} wallets.`,
      `SuiDex V3: ${venues.suiDexV3?.outcome || 'pending'}; ${venues.suiDexV3?.walletCount ?? 0} wallets.`,
      `Turbos: ${venues.turbos?.outcome || 'pending'}; ${venues.turbos?.walletCount ?? 0} wallets.`,
      `Total exposure complete: ${coverage.totalExposureComplete === true ? 'yes' : 'no'}.`,
      `SuiNS reverse names resolved: ${payload.source?.suins?.resolvedCount ?? 0} of ${payload.source?.suins?.requestedCount ?? 0}.`,
    ].join(' '));
  } else {
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
  }

  const warningBox = elementById('leaderboardWarnings');
  if (warningBox) { warningBox.textContent = Array.isArray(payload.warnings) ? payload.warnings.join(' ') : ''; warningBox.hidden = !warningBox.textContent; }
  if (rows) {
    if (!leaderboardEntries.length) {
      const emptyMessages = { 'not-ready': 'A complete verified TREE leaderboard snapshot is not available yet.', refreshing: 'The first verified TREE leaderboard snapshot is being built. No partial ranks are published.', error: 'The verified TREE leaderboard is temporarily unavailable.' };
      rows.innerHTML = `<tr><td colspan="6">${emptyMessages[leaderboardStatus] || 'No ranked wallets are available in the verified snapshot.'}</td></tr>`;
    } else if (rows.replaceChildren) {
      rows.replaceChildren(...leaderboardEntries.map((entry) => {
        const exposure = entryIsExposure(entry);
        const values = exposure
          ? [entry.rank, displayNameForEntry(entry), entry.totalExposure, entry.liquidTree, entry.lpTree, tierForEntry(entry)?.name || 'Ranked']
          : [entry.rank, displayNameForEntry(entry), entry.directTree, entry.directTree, '0', tierForEntry(entry)?.name || entry.tier || 'Ranked'];
        const row = document.createElement('tr');
        values.forEach((value, index) => {
          const cell = document.createElement('td'); cell.textContent = String(value); if (index >= 3) cell.className = 'wide-column'; if (index === 1) cell.title = entry.wallet; row.append(cell);
        });
        return row;
      }));
    }
  }
  renderTierLadder();
  renderLeaderboardCards();
  updateYourRank();
}


function mergeBehaviorBadgeSnapshot(exposurePayload, badgePayload) {
  if (!exposurePayload || !badgePayload
    || !['ok', 'stale'].includes(exposurePayload.status)
    || !['ok', 'stale'].includes(badgePayload.status)
    || badgePayload.provider !== 'tree-badge-snapshot'
    || badgePayload.exposureSnapshotGeneratedAt !== exposurePayload.snapshotGeneratedAt
    || !Array.isArray(exposurePayload.entries)
    || !Array.isArray(badgePayload.entries)
    || badgePayload.entries.length !== 50) return { payload: exposurePayload, merged: false };

  const byWallet = new Map(badgePayload.entries.map((entry) => [String(entry.wallet).toLowerCase(), entry]));
  const entries = exposurePayload.entries.map((entry) => {
    const behavior = byWallet.get(String(entry.wallet).toLowerCase());
    if (!behavior || behavior.rank !== entry.rank) return entry;
    return {
      ...entry,
      badges: [...new Set([...(Array.isArray(entry.badges) ? entry.badges : []), ...(Array.isArray(behavior.badges) ? behavior.badges : [])])],
      activity30d: behavior.activity30d,
      burn: behavior.burn,
    };
  });
  if (entries.some((entry, index) => !byWallet.has(String(entry.wallet).toLowerCase()) || byWallet.get(String(entry.wallet).toLowerCase())?.rank !== index + 1)) {
    return { payload: exposurePayload, merged: false };
  }
  return {
    merged: true,
    payload: {
      ...exposurePayload,
      entries,
      behaviorBadgeSnapshot: {
        status: badgePayload.status,
        snapshotGeneratedAt: badgePayload.snapshotGeneratedAt,
        summary: badgePayload.summary,
        source: badgePayload.source,
      },
      warnings: [
        ...(Array.isArray(exposurePayload.warnings) ? exposurePayload.warnings : []),
        ...(Array.isArray(badgePayload.warnings) ? badgePayload.warnings : []),
      ],
    },
  };
}

async function loadLeaderboard() {
  try {
    const [leaderboardResponse, badgeResponse] = await Promise.all([
      fetch(leaderboardUrl, { headers: { Accept: 'application/json' } }),
      badgeUrl ? fetch(badgeUrl, { headers: { Accept: 'application/json' } }).catch(() => null) : Promise.resolve(null),
    ]);
    if (!leaderboardResponse.ok) throw new Error(`Leaderboard returned ${leaderboardResponse.status}`);
    let payload = await leaderboardResponse.json();
    let badgePayload = null;
    if (badgeResponse?.ok) badgePayload = await badgeResponse.json();
    const merged = mergeBehaviorBadgeSnapshot(payload, badgePayload);
    payload = merged.payload;
    if (isDeployPreview && String(payload.methodologyVersion || '').startsWith('verified-tree-exposure-v')) {
      payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []),
        'Deploy Preview: ranks combine liquid TREE with current verified principal in SuiDex V2, SuiDex V3, and Turbos positions.',
        ...(merged.merged ? ['All four behavioral badges are from a complete snapshot aligned to this exposure ranking.'] : ['Behavioral badges are still building or do not yet match this exposure snapshot.']),
      ];
    }
    renderLeaderboard(payload);
  } catch (error) {
    renderLeaderboard({ status: 'error', generatedAt: new Date().toISOString(), entries: [], displayedCount: 0, excludedCount: 0, holderCount: null });
    console.error(error);
  }
}

async function connectForDapp() {
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

// Swap quote and execution are isolated in swap-router.js.

if (typeof document !== 'undefined') {
  document.getElementById('refreshStats').addEventListener('click', () => { loadDashboard().then(loadBurnOverview); loadChart(activeChartRange); });
  document.getElementById('dappWallet').addEventListener('click', connectForDapp);
  document.getElementById('rankWallet').addEventListener('click', connectForDapp);
  document.getElementById('shareRank')?.addEventListener('click', shareRank);
  document.getElementById('createRankImage')?.addEventListener('click', downloadRankCard);
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

  window.addEventListener('tree:wallet-changed', () => { syncWalletButtons(); });

  window.addEventListener('load', async () => {
    try { await window.initializeWallet?.(); } catch { /* Optional session restoration. */ }
    syncWalletButtons();
  });

  loadDashboard().then(loadBurnOverview);
  loadSuiHeaderPrice();
  loadChart();
  loadLeaderboard();
}


function initCommandNavigation() {
  const links = [...document.querySelectorAll('.app-nav a[href^="#"]')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const activate = (id) => links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
  links.forEach((link) => link.addEventListener('click', () => activate(link.getAttribute('href').slice(1))));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) activate(visible.target.id);
    }, { rootMargin: '-22% 0px -62% 0px', threshold: [0.05, 0.2, 0.45] });
    sections.forEach((section) => observer.observe(section));
  }
  const requested = location.hash.slice(1);
  activate(sections.some((section) => section.id === requested) ? requested : 'swap');
}

function initDocumentActions() {
  document.getElementById('copyDappCoin')?.addEventListener('click', async () => {
    const status = document.getElementById('swapStatus');
    try {
      await navigator.clipboard.writeText(TREE_COIN_TYPE);
      if (status) { status.textContent = 'Official TREE coin type copied.'; status.className = 'status success'; }
    } catch {
      if (status) { status.textContent = 'Coin type copy was unavailable.'; status.className = 'status error'; }
    }
  });
}

if (typeof document !== 'undefined') {
  initCommandNavigation();
  initDocumentActions();
}

export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, badgeDefinition, displayNameForEntry, entryIsExposure, formatSuiPrice, formatSupplyPercentFromRaw, formatTreePrice, mergeBehaviorBadgeSnapshot, normalizeLeaderboardEntry, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };
