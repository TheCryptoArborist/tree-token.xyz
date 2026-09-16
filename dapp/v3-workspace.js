import {
  MIN_SUI_GAS_RESERVE_RAW,
  SUI_COIN_TYPE,
  SUI_DECIMALS,
  isTreeV3ExecutionHost,
  isTreeV3RebalanceTestHost,
} from './v3-transaction-core.js';

const V3_ENDPOINT = '/api/tree-v3-overview';
const V3_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
const CETUS_POOL_ID = '0x2ebaff75b8745896404085babb9ef3a77ccbb6c7d3f4db31626cefff04f7f355';
const CETUS_POOL_URL = `https://app.cetus.zone/clmm?tab=deposit&poolAddress=${CETUS_POOL_ID}`;
const TURBOS_TREE_POOL_ID = '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';
const TURBOS_POOL_URL = `https://app.turbos.finance/#/pools/${TURBOS_TREE_POOL_ID}/add-liquidity`;
const V3_MANAGEMENT_ENABLED = isTreeV3ExecutionHost(location.hostname);
const V3_REBALANCE_PREVIEW_ENABLED = isTreeV3RebalanceTestHost(location.hostname);

const state = {
  overview: null,
  owner: null,
  positionsLoadedFor: null,
  positions: [],
  activeTab: 'pools',
  zapMode: 'new',
  addOpen: false,
  range: 'medium',
  suiDexTvlUsd: null,
  cetusTvlUsd: null,
  turbosTvlUsd: null,
  positionPrices: { suiUsd: null, treeUsd: null, btcUsd: null, rewardsUsd: {} },
};

function ensureStylesheet() {
  if (document.querySelector('link[data-tree-v3-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'v3-workspace.css?v=20260830-2';
  link.dataset.treeV3Style = 'true';
  document.head.append(link);
}

function compactId(value) {
  if (!value || value.length < 16) return value || '—';
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatUsd(value) {
  if (value === null || value === undefined || value === '') return 'Not verified';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'Not verified';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: numeric >= 100000 ? 'compact' : 'standard', maximumFractionDigits: numeric >= 1000 ? 1 : 2 }).format(numeric);
}

function formatPositionUsd(value) {
  if (value === null || value === undefined || value === '') return 'Not verified';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 'Not verified';
  if (numeric > 0 && numeric < 0.01) return '<$0.01';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
}

function formatNumber(value, maximumFractionDigits = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(numeric);
}

function verifiedPositive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function rememberPositionPrices(payload) {
  const market = payload?.market || {};
  state.positionPrices.suiUsd = verifiedPositive(market.suiUsd) ?? state.positionPrices.suiUsd;
  state.positionPrices.treeUsd = verifiedPositive(market.treeUsd) ?? state.positionPrices.treeUsd;
  state.positionPrices.btcUsd = verifiedPositive(market.btcUsd) ?? state.positionPrices.btcUsd;
  if (state.positionPrices.treeUsd) state.positionPrices.rewardsUsd.TREE = state.positionPrices.treeUsd;
  if (state.positionPrices.btcUsd) state.positionPrices.rewardsUsd.wBTC = state.positionPrices.btcUsd;
  const rewardRows = [
    ...(Array.isArray(payload?.analytics?.rewards) ? payload.analytics.rewards : []),
    ...(Array.isArray(payload?.positions) ? payload.positions.flatMap((position) => Array.isArray(position.rewards) ? position.rewards : []) : []),
  ];
  for (const reward of rewardRows) {
    if (!['VICTORY', 'TREE', 'wBTC'].includes(reward?.symbol)) continue;
    const price = verifiedPositive(reward.priceUsd);
    if (price) state.positionPrices.rewardsUsd[reward.symbol] = price;
  }
}

function usdFromVerifiedPrice(currentValue, amount, price) {
  const current = Number(currentValue);
  if (currentValue !== null && currentValue !== undefined && Number.isFinite(current) && current >= 0) return current;
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) && numericAmount >= 0 && price ? numericAmount * price : null;
}

function restorePositionUsd(position) {
  const principalSuiUsd = usdFromVerifiedPrice(position.principalSuiUsd, position.principalSui, state.positionPrices.suiUsd);
  const principalTreeUsd = usdFromVerifiedPrice(position.principalTreeUsd, position.principalTree, state.positionPrices.treeUsd);
  const currentPendingFeesUsd = Number(position.pendingFeesUsd);
  const pendingFeeSuiUsd = usdFromVerifiedPrice(null, position.pendingFeeSui, state.positionPrices.suiUsd);
  const pendingFeeTreeUsd = usdFromVerifiedPrice(null, position.pendingFeeTree, state.positionPrices.treeUsd);
  const pendingFeesUsd = position.pendingFeesUsd !== null && position.pendingFeesUsd !== undefined && Number.isFinite(currentPendingFeesUsd) && currentPendingFeesUsd >= 0
    ? currentPendingFeesUsd
    : pendingFeeSuiUsd !== null && pendingFeeTreeUsd !== null ? pendingFeeSuiUsd + pendingFeeTreeUsd : null;
  const rewards = Array.isArray(position.rewards) ? position.rewards.map((reward) => ({
    ...reward,
    priceUsd: verifiedPositive(reward.priceUsd) ?? state.positionPrices.rewardsUsd[reward.symbol] ?? null,
    valueUsd: usdFromVerifiedPrice(reward.valueUsd, reward.amount, verifiedPositive(reward.priceUsd) ?? state.positionPrices.rewardsUsd[reward.symbol] ?? null),
  })) : position.rewards;
  return {
    ...position,
    principalSuiUsd,
    principalTreeUsd,
    valueUsd: principalSuiUsd !== null && principalTreeUsd !== null ? principalSuiUsd + principalTreeUsd : position.valueUsd,
    pendingFeesUsd,
    rewards,
  };
}

function positionRangePercent(position) {
  const lower = Number(position.tickLower);
  const upper = Number(position.tickUpper);
  const current = Number(position.currentTick);
  if (![lower, upper, current].every(Number.isFinite) || upper <= lower) return 50;
  return Math.max(0, Math.min(100, (current - lower) / (upper - lower) * 100));
}

function formatRebalancePrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  if (numeric >= 1) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(numeric);
  if (numeric >= 0.001) return numeric.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return numeric.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

function rebalancePriceAtTick(currentPriceValue, currentTick, tick) {
  const price = Number(currentPriceValue);
  const current = Number(currentTick);
  const target = Number(tick);
  if (![price, current, target].every(Number.isFinite) || price <= 0) return null;
  const value = price * Math.pow(1.0001, current - target);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function rebalanceAssetShape(position, currentPriceValue) {
  const suiValue = Number(position.principalSui) + Number(position.pendingFeeSui || 0);
  const treeValueInSui = (Number(position.principalTree) + Number(position.pendingFeeTree || 0)) * Number(currentPriceValue);
  if (![suiValue, treeValueInSui].every(Number.isFinite)) return 'mixed';
  if (suiValue > Math.max(0.000001, treeValueInSui) * 19) return 'sui-heavy';
  if (treeValueInSui > Math.max(0.000001, suiValue) * 19) return 'tree-heavy';
  return 'mixed';
}

function kelpieBindTicks(position, currentPriceValue, currentTickValue, widthPercent, tickSpacing = 60) {
  const price = Number(currentPriceValue);
  const currentTick = Number(currentTickValue);
  const spacing = Number(tickSpacing);
  const width = Number(widthPercent) / 100;
  const suiAmount = Number(position.principalSui) + Number(position.pendingFeeSui || 0);
  const treeAmount = Number(position.principalTree) + Number(position.pendingFeeTree || 0);
  if (![price, currentTick, spacing, width, suiAmount, treeAmount].every(Number.isFinite)
    || price <= 0 || spacing <= 0 || width <= 0 || suiAmount < 0 || treeAmount < 0 || suiAmount + treeAmount <= 0) return null;

  const rawDelta = Math.abs(Math.log((1 + width) / (1 - width)) / Math.log(1.0001));
  const segments = Math.max(2, Math.ceil(rawDelta / spacing));
  const totalTickWidth = segments * spacing;
  const shape = rebalanceAssetShape({ ...position, principalSui: suiAmount, principalTree: treeAmount, pendingFeeSui: 0, pendingFeeTree: 0 }, price);
  if (shape === 'sui-heavy') {
    const lower = Math.ceil((currentTick + 1) / spacing) * spacing;
    return { lower, upper: lower + totalTickWidth, shape: 'one-sided-low', assetPosition: 100 };
  }
  if (shape === 'tree-heavy') {
    const upper = Math.floor(currentTick / spacing) * spacing;
    return { lower: upper - totalTickWidth, upper, shape: 'one-sided-high', assetPosition: 0 };
  }

  const targetRawTreePerSui = treeAmount / Math.max(suiAmount, Number.MIN_VALUE) / 1000;
  const currentSqrt = Math.pow(1.0001, currentTick / 2);
  const baseTick = Math.floor(currentTick / spacing) * spacing;
  let best = null;
  for (let leftSegments = 0; leftSegments <= segments; leftSegments += 1) {
    const lower = baseTick - leftSegments * spacing;
    const upper = lower + totalTickWidth;
    if (!(lower < currentTick && currentTick < upper)) continue;
    const lowerSqrt = Math.pow(1.0001, lower / 2);
    const upperSqrt = Math.pow(1.0001, upper / 2);
    const rawRatio = (currentSqrt - lowerSqrt) * currentSqrt * upperSqrt / (upperSqrt - currentSqrt);
    if (!(rawRatio > 0) || !Number.isFinite(rawRatio)) continue;
    const error = Math.abs(Math.log(rawRatio / targetRawTreePerSui));
    if (!best || error < best.error) best = { lower, upper, error };
  }
  if (!best) return null;
  const prices = [
    rebalancePriceAtTick(price, currentTick, best.lower),
    rebalancePriceAtTick(price, currentTick, best.upper),
  ].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  const assetPosition = prices.length === 2 ? Math.max(0, Math.min(100, (price - prices[0]) / (prices[1] - prices[0]) * 100)) : 50;
  return { lower: best.lower, upper: best.upper, shape: 'asset-shaped', assetPosition };
}

function rebalanceHistogramHtml() {
  const heights = [12, 16, 21, 28, 36, 46, 58, 70, 82, 92, 100, 94, 86, 76, 66, 56, 47, 39, 32, 26, 21, 17, 14];
  return heights.map((height) => `<i style="--bar-height:${height}%"></i>`).join('');
}

function renderRebalanceChart(position, pool) {
  const price = Number(pool?.priceSuiPerTree);
  return `<div class="v3-rebalance-chart" aria-label="Current and proposed SUI per TREE price ranges"
    data-v3-rebalance-current-price="${Number.isFinite(price) ? price : ''}"
    data-v3-rebalance-current-tick="${position.currentTick}"
    data-v3-rebalance-old-lower="${position.tickLower}"
    data-v3-rebalance-old-upper="${position.tickUpper}"
    data-v3-rebalance-principal-sui="${position.principalSui}"
    data-v3-rebalance-principal-tree="${position.principalTree}"
    data-v3-rebalance-fee-sui="${position.pendingFeeSui || 0}"
    data-v3-rebalance-fee-tree="${position.pendingFeeTree || 0}"
    data-v3-rebalance-tick-spacing="${pool?.tickSpacing || 60}">
    <div class="v3-rebalance-chart-heading"><div><strong>Price-range preview</strong><small>SUI per TREE</small></div><span data-v3-rebalance-chart-kind>No-swap estimate</span></div>
    <div class="v3-rebalance-chart-legend"><span class="current">Current price</span><span class="existing">Existing range</span><span class="proposed" data-v3-rebalance-proposed-legend>Redeployed no-swap range</span></div>
    <div class="v3-rebalance-plot" role="img" aria-label="Liquidity range histogram">
      <div class="v3-rebalance-histogram">${rebalanceHistogramHtml()}</div>
      <div class="v3-rebalance-existing-band" data-v3-rebalance-existing-band></div>
      <div class="v3-rebalance-proposed-band" data-v3-rebalance-proposed-band></div>
      <div class="v3-rebalance-current-marker" data-v3-rebalance-current-marker><span>Current</span></div>
    </div>
    <div class="v3-rebalance-axis"><span data-v3-rebalance-axis-min>—</span><strong data-v3-rebalance-axis-current>—</strong><span data-v3-rebalance-axis-max>—</span></div>
    <div class="v3-rebalance-chart-values">
      <div><span>Existing</span><strong data-v3-rebalance-existing-values>—</strong></div>
      <div><span>Proposed</span><strong data-v3-rebalance-proposed-values>—</strong></div>
      <div><span>Entry</span><strong data-v3-rebalance-entry>—</strong></div>
    </div>
    <small class="v3-rebalance-chart-note" data-v3-rebalance-chart-note>Kelpie-Bind redeploys the SUI and TREE already held by this position. Final ticks and amounts are confirmed by Mainnet simulation.</small>
  </div>`;
}

function updateRebalancePreview(panel) {
  const chart = panel?.querySelector('.v3-rebalance-chart');
  if (!chart) return;
  const price = Number(chart.dataset.v3RebalanceCurrentPrice);
  const currentTickValue = Number(chart.dataset.v3RebalanceCurrentTick);
  const oldLowerTick = Number(chart.dataset.v3RebalanceOldLower);
  const oldUpperTick = Number(chart.dataset.v3RebalanceOldUpper);
  const activeRange = panel.querySelector('[data-v3-rebalance-range-option].active');
  const widthPercent = Number(activeRange?.dataset.v3RebalanceWidth);
  if (![price, currentTickValue, oldLowerTick, oldUpperTick, widthPercent].every(Number.isFinite) || price <= 0 || widthPercent <= 0) return;

  const oldPrices = [
    rebalancePriceAtTick(price, currentTickValue, oldLowerTick),
    rebalancePriceAtTick(price, currentTickValue, oldUpperTick),
  ].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (oldPrices.length !== 2) return;

  const swapMode = panel.dataset.v3RebalanceMode === 'swap';
  const position = {
    principalSui: chart.dataset.v3RebalancePrincipalSui,
    principalTree: chart.dataset.v3RebalancePrincipalTree,
    pendingFeeSui: chart.dataset.v3RebalanceFeeSui,
    pendingFeeTree: chart.dataset.v3RebalanceFeeTree,
  };
  const assetShape = rebalanceAssetShape(position, price);
  const width = widthPercent / 100;
  let proposedMin = price * (1 - width);
  let proposedMax = price * (1 + width);
  let shape = 'centered';
  let proposedTicks = null;
  let assetPosition = 50;
  if (!swapMode) {
    proposedTicks = kelpieBindTicks({
      principalSui: chart.dataset.v3RebalancePrincipalSui,
      principalTree: chart.dataset.v3RebalancePrincipalTree,
      pendingFeeSui: chart.dataset.v3RebalanceFeeSui,
      pendingFeeTree: chart.dataset.v3RebalanceFeeTree,
    }, price, currentTickValue, widthPercent, Number(chart.dataset.v3RebalanceTickSpacing));
    if (!proposedTicks) return;
    const proposedPrices = [
      rebalancePriceAtTick(price, currentTickValue, proposedTicks.lower),
      rebalancePriceAtTick(price, currentTickValue, proposedTicks.upper),
    ].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
    if (proposedPrices.length !== 2) return;
    [proposedMin, proposedMax] = proposedPrices;
    shape = proposedTicks.shape;
    assetPosition = proposedTicks.assetPosition;
  }
  const domainMinRaw = Math.min(oldPrices[0], proposedMin, price);
  const domainMaxRaw = Math.max(oldPrices[1], proposedMax, price);
  const padding = Math.max((domainMaxRaw - domainMinRaw) * 0.09, price * 0.006);
  const domainMin = Math.max(Number.MIN_VALUE, domainMinRaw - padding);
  const domainMax = domainMaxRaw + padding;
  const domainSpan = domainMax - domainMin;
  const percent = (value) => Math.max(0, Math.min(100, (value - domainMin) / domainSpan * 100));
  const oldLeft = percent(oldPrices[0]);
  const oldRight = percent(oldPrices[1]);
  const proposedLeft = percent(proposedMin);
  const proposedRight = percent(proposedMax);
  const currentLeft = percent(price);

  panel.dataset.v3RebalanceShape = shape;
  chart.style.setProperty('--existing-left', `${oldLeft}%`);
  chart.style.setProperty('--existing-width', `${Math.max(1.5, oldRight - oldLeft)}%`);
  chart.style.setProperty('--proposed-left', `${proposedLeft}%`);
  chart.style.setProperty('--proposed-width', `${Math.max(1.5, proposedRight - proposedLeft)}%`);
  chart.style.setProperty('--current-left', `${currentLeft}%`);
  chart.querySelector('[data-v3-rebalance-axis-min]').textContent = formatRebalancePrice(domainMin);
  chart.querySelector('[data-v3-rebalance-axis-current]').textContent = formatRebalancePrice(price);
  chart.querySelector('[data-v3-rebalance-axis-max]').textContent = formatRebalancePrice(domainMax);
  chart.querySelector('[data-v3-rebalance-existing-values]').textContent = `${formatRebalancePrice(oldPrices[0])} – ${formatRebalancePrice(oldPrices[1])}`;
  chart.querySelector('[data-v3-rebalance-proposed-values]').textContent = `${formatRebalancePrice(proposedMin)} – ${formatRebalancePrice(proposedMax)}${proposedTicks ? ` · ticks ${proposedTicks.lower.toLocaleString('en-US')}–${proposedTicks.upper.toLocaleString('en-US')}` : ''}`;
  chart.querySelector('[data-v3-rebalance-chart-kind]').textContent = swapMode ? 'Liquid Swap estimate' : 'Kelpie-Bind · no swap';
  chart.querySelector('[data-v3-rebalance-proposed-legend]').textContent = swapMode ? 'Centered swap range' : 'Redeployed no-swap range';
  const entry = chart.querySelector('[data-v3-rebalance-entry]');
  const activeAtCurrent = shape === 'centered' || shape === 'asset-shaped';
  entry.textContent = activeAtCurrent ? `Current price is ${assetPosition.toFixed(1)}% through new range` : shape === 'one-sided-low' ? `Price enters below ${formatRebalancePrice(price)}` : `Price enters above ${formatRebalancePrice(price)}`;
  entry.classList.toggle('waiting', !activeAtCurrent);
  const rangeLabel = panel.querySelector('[data-v3-rebalance-range-label]');
  if (rangeLabel) rangeLabel.textContent = swapMode ? `±${widthPercent}% around current price` : `Ticks ${proposedTicks.lower.toLocaleString('en-US')}–${proposedTicks.upper.toLocaleString('en-US')} · assets set the price location`;
  const after = panel.querySelector('[data-v3-rebalance-after]');
  if (after) after.textContent = activeAtCurrent ? `Current price at ${assetPosition.toFixed(1)}%` : 'One-sided · waits for entry';
  const assets = panel.querySelector('[data-v3-rebalance-assets]');
  if (assets) assets.textContent = swapMode ? 'Balanced SUI / TREE after swap' : shape === 'asset-shaped' ? 'Existing SUI + TREE, no swap' : `Existing ${assetShape === 'sui-heavy' ? 'SUI' : 'TREE'}, no swap`;
  const flowTitle = panel.querySelector('[data-v3-rebalance-flow-range-title]');
  const flowCopy = panel.querySelector('[data-v3-rebalance-flow-range-copy]');
  if (flowTitle) flowTitle.textContent = swapMode ? 'Centered range' : shape === 'asset-shaped' ? 'Asset-shaped range' : 'One-sided range';
  if (flowCopy) flowCopy.textContent = swapMode ? 'Expected to earn on both sides immediately' : activeAtCurrent ? `Current price lands ${assetPosition.toFixed(1)}% through the range` : 'Price must enter before both sides earn fees';
  const note = chart.querySelector('[data-v3-rebalance-chart-note]');
  if (note) note.textContent = swapMode
    ? 'Liquid Swap trades the imbalance before opening a centered range. Final ticks and amounts are confirmed by Mainnet simulation.'
    : 'Kelpie-Bind redeploys the SUI and TREE already held by this position. No swap is modeled. Final ticks and amounts are confirmed by Mainnet simulation.';
}

function annualizedFeeApr(volume24hUsd, tvlUsd, feePercent) {
  const volume = Number(volume24hUsd);
  const tvl = Number(tvlUsd);
  const fee = Number(feePercent);
  if (![volume, tvl, fee].every(Number.isFinite) || volume < 0 || tvl <= 0 || fee <= 0) return null;
  return volume * (fee / 100) * 365 / tvl * 100;
}

function formatPoolApr(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 'Not verified';
  return `${numeric < 0.1 ? numeric.toFixed(2) : numeric.toFixed(1)}%`;
}

function formatPoolPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toPrecision(8)} SUI / TREE` : 'Not verified';
}

const V3_REWARD_LOGOS = Object.freeze({
  VICTORY: '../assets/victory-token.png',
  TREE: '../assets/tree-token.png',
  wBTC: '../assets/wbtc-token.png',
});

function renderRewardLogo(symbol) {
  const source = V3_REWARD_LOGOS[symbol];
  return source ? `<img class="v3-reward-logo" src="${source}" alt="" aria-hidden="true">` : '';
}

function renderPositionRewards(position) {
  if (!Array.isArray(position.rewards)) return '<div class="v3-earned-row unavailable"><span>Claimable rewards</span><strong>Not verified</strong></div>';
  if (!position.rewards.length) return '<div class="v3-earned-row"><span>Claimable rewards</span><strong>None configured</strong></div>';
  return position.rewards.map((reward) => `<div class="v3-earned-row"><span>${renderRewardLogo(reward.symbol)}${reward.symbol} rewards${reward.active ? '' : ' · ended'}</span><strong>${formatNumber(reward.amount, reward.decimals > 6 ? 8 : 4)} ${reward.symbol} <small>(${formatPositionUsd(reward.valueUsd)})</small></strong></div>`).join('');
}

function normalizeDecimalInput(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
}

function safeAddress(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(compact) ? compact : null;
}

function addressFromCandidate(candidate) {
  if (!candidate) return null;
  if (typeof candidate === 'string') return safeAddress(candidate);
  const methods = ['getAddress', 'getActiveAddress', 'getCurrentAddress'];
  for (const method of methods) {
    try {
      const result = typeof candidate[method] === 'function' ? candidate[method]() : null;
      const address = safeAddress(result);
      if (address) return address;
    } catch {}
  }
  const directKeys = ['address', 'walletAddress', 'currentAddress'];
  for (const key of directKeys) {
    const address = safeAddress(candidate[key]);
    if (address) return address;
  }
  const nestedKeys = ['account', 'currentAccount', 'selectedAccount', 'activeAccount', 'state', 'walletState'];
  for (const key of nestedKeys) {
    const nested = candidate[key];
    if (!nested || nested === candidate) continue;
    const address = addressFromCandidate(nested);
    if (address) return address;
  }
  return null;
}

function resolveWalletAddress() {
  const direct = safeAddress(window.playerAddress) || addressFromCandidate(window.currentAccount);
  if (direct) return direct;
  const preferred = ['treeWallet', 'treeWalletManager', 'TREEWallet', 'walletManager', 'suiWalletManager'];
  for (const key of preferred) {
    const address = addressFromCandidate(window[key]);
    if (address) return address;
  }
  for (const key of Object.keys(window)) {
    if (!/tree.*wallet|wallet.*tree/i.test(key)) continue;
    const address = addressFromCandidate(window[key]);
    if (address) return address;
  }
  return null;
}
window.resolveTreeV3WalletAddress = resolveWalletAddress;

function formatSuiRaw(raw) {
  const value = BigInt(raw || 0);
  const scale = 10n ** BigInt(SUI_DECIMALS);
  const fraction = (value % scale).toString().padStart(SUI_DECIMALS, '0').replace(/0+$/, '');
  return `${value / scale}${fraction ? `.${fraction}` : ''}`;
}

async function fillSuiDexMax() {
  const owner = resolveWalletAddress();
  if (!owner) {
    await window.openWalletManager?.({ mode: 'picker' });
    return;
  }
  const input = document.getElementById('v3SuiAmount');
  const balanceLabel = document.getElementById('v3SuiBalance');
  if (!input || typeof window.initSuiClient !== 'function') return;
  try {
    const result = await window.initSuiClient().core.getBalance({ owner, coinType: SUI_COIN_TYPE });
    const balanceRaw = BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0);
    const spendableRaw = balanceRaw > MIN_SUI_GAS_RESERVE_RAW ? balanceRaw - MIN_SUI_GAS_RESERVE_RAW : 0n;
    if (balanceLabel) balanceLabel.textContent = `Balance ${formatNumber(Number(balanceRaw) / 10 ** SUI_DECIMALS, 4)} SUI`;
    input.value = formatSuiRaw(spendableRaw);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } catch {
    if (balanceLabel) balanceLabel.textContent = 'Balance unavailable';
  }
}

function workspaceMarkup() {
  return `
    <div class="v3-compact-heading"><h2 id="v3-title">V3 Concentrated Liquidity</h2><p>Earn more fees with tighter SUI / TREE price ranges.</p></div>
    <div class="v3-workspace">
      <div class="v3-summary" aria-label="TREE V3 summary">
        <article class="v3-summary-card"><span>Pools</span><strong id="v3PoolCount">3</strong></article>
        <article class="v3-summary-card"><span>Total TVL</span><strong id="v3SummaryTvl">Loading…</strong></article>
        <article class="v3-summary-card" title="All verified address-owned positions in the featured SuiDex SUI/TREE V3 pool"><span>All Positions</span><strong id="v3SummaryAllPositions">Loading…</strong></article>
      </div>
      <div class="v3-tabs" role="tablist" aria-label="V3 workspace" style="grid-template-columns:repeat(4,1fr)">
        <button class="v3-tab active" type="button" role="tab" aria-selected="true" data-v3-tab="pools">Pools</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="zap">Zap</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="positions">Positions</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="swap">Swap</button>
      </div>
      <div class="v3-panel v3-pools-grid v3-suidex-focus" data-v3-panel="pools">
        <article class="v3-pool-card v3-featured-pool-card">
          <div class="v3-pool-head">
            <div class="v3-venue-identity"><img class="v3-dex-logo" src="https://dex.suidex.org/apple-touch-icon.png" alt="SuiDex logo" referrerpolicy="no-referrer"><div class="v3-venue-copy"><span class="v3-venue-name">SuiDex</span><div class="v3-pair-line"><div class="v3-token-stack" aria-hidden="true"><img src="../assets/sui-token.svg" alt=""><img src="../thick.png" alt=""></div><h3>SUI / TREE</h3></div><p class="v3-venue-subtitle"><span>0.25% fee</span><span>Verified pool</span><span id="v3RewardChip">Loading incentives</span></p></div></div>
            <button class="v3-add-button" id="v3AddLiquidity" type="button" aria-controls="v3ZapPanel">Zap into V3</button>
          </div>
          <aside class="v3-kelpie-option" aria-label="Managed V3 option">
            <div><span>Managed V3 Option — Kelpie</span><strong>Automated SUI / TREE range management</strong><p>Kelpie manages the concentrated-liquidity range and compounds fees for this verified SuiDex V3 pool. Use TREE's native V3 tools when you prefer manual control.</p></div>
            <a class="v3-kelpie-link" href="https://kelpie.network/earn/0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf?protocol=suidex" target="_blank" rel="noopener noreferrer" aria-label="Open TREE vault on Kelpie (opens in a new tab)">Open TREE Vault ↗</a>
          </aside>
          <div class="v3-metrics">
            <div class="v3-metric"><span>Combined TVL</span><strong id="v3PoolTvl">Loading…</strong></div>
            <div class="v3-metric"><span>24H Volume</span><strong id="v3PoolVolume">Not verified</strong></div>
            <div class="v3-metric"><span>APR</span><strong id="v3PoolApr">Not verified</strong></div>
            <div class="v3-metric"><span>Current Price</span><strong class="good" id="v3PoolPrice">Loading…</strong></div>
          </div>
          <div class="v3-apr-breakdown" id="v3AprBreakdown" aria-label="APR breakdown">Loading verified fee and incentive APR…</div>
          <details class="v3-pool-details"><summary>Pool details</summary>
            <div class="v3-technical-metrics">
              <div class="v3-metric"><span>SUI Reserve</span><strong id="v3SuiReserve">Loading…</strong></div>
              <div class="v3-metric"><span>TREE Reserve</span><strong id="v3TreeReserve">Loading…</strong></div>
              <div class="v3-metric"><span>Current Tick</span><strong id="v3CurrentTick">Loading…</strong></div>
              <div class="v3-metric"><span>Liquidity Units</span><strong id="v3LiquidityRaw">Loading…</strong></div>
            </div>
            <p class="v3-pool-id">Pool <code>${V3_POOL_ID}</code></p>
            <p class="v3-notice" id="v3AnalyticsNotice">Loading verified on-chain pool and SuiDex analytics data.</p>
            <button class="button secondary v3-refresh" id="v3RefreshPool" type="button">Refresh Pool Data</button>
            <p class="v3-status" id="v3PoolStatus" role="status" aria-live="polite">Loading V3 pool…</p>
          </details>
          <div class="v3-add-card v3-suidex-manager" id="v3AddCard" hidden>
            <div class="earn-zap-heading"><div><strong>SuiDex V3 Zap</strong><small>Create a concentrated SUI / TREE position from one token</small></div><span class="data-state ok">Sui Mainnet</span></div>
            <div class="v3-increase-wallet-balances v3-zap-wallet-balances" aria-label="Available connected-wallet balances"><div class="sui"><span><b class="token-dot sui-dot" aria-hidden="true"></b>Available SUI</span><strong id="earnV3ZapSuiBalance">Connect wallet</strong><small>Your connected-wallet balance · MAX keeps 0.05 SUI for gas</small></div><div class="tree"><span><b class="token-dot tree-dot" aria-hidden="true"></b>Available TREE</span><strong id="earnV3ZapTreeBalance">Connect wallet</strong><small>Your connected-wallet balance · available for a TREE zap</small></div></div>
            <label class="earn-zap-label" for="earnV3ZapToken">Deposit token</label><select id="earnV3ZapToken"><option value="SUI">SUI</option><option value="TREE">TREE</option></select>
            <label class="earn-zap-label" for="earnV3ZapAmount"><span>Amount</span><span id="earnV3ZapBalance">Balance —</span></label><div class="earn-zap-input"><input id="earnV3ZapAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0"><button id="earnV3ZapMax" type="button">MAX</button><span id="earnV3ZapSymbol">SUI</span></div>
            <label class="earn-zap-label" for="earnV3ZapRange">Price range</label><select id="earnV3ZapRange"><option value="5">±5% around current price</option><option value="20" selected>±20% around current price</option><option value="full">Full range</option></select>
            <div class="earn-zap-summary"><span>Current price</span><strong id="earnV3ZapCurrent">Loading…</strong><span>Selected range</span><strong id="earnV3ZapRangeText">—</strong><span>Swap portion</span><strong id="earnV3ZapSwap">—</strong><span>Minimum paired token</span><strong id="earnV3ZapMinimum">—</strong><span>Wallet approvals</span><strong>1 · Position + incentives</strong></div>
            <div class="earn-zap-slippage"><span>Slippage</span><div><button type="button" data-earn-v3-slippage="50">0.5%</button><button class="active" type="button" data-earn-v3-slippage="100">1%</button><button type="button" data-earn-v3-slippage="200">2%</button></div></div>
            <button class="button primary" id="earnV3ZapAction" type="button">Connect Wallet</button><p class="status" id="earnV3ZapStatus" role="status" aria-live="polite">Loading the verified SUI/TREE V3 pool…</p><div class="swap-success" id="earnV3ZapSuccess" hidden></div>
          </div>
        </article>
        <p class="v3-aggregate-note"><strong>Combined TVL across 3 verified venues</strong><span>SuiDex + Cetus + Turbos</span><small>Liquidity actions and new positions use SuiDex.</small></p><template class="v3-liquidity-breakdown-grid">
        <article class="v3-pool-card v3-cetus-pool-card">
          <div class="v3-pool-head">
            <div class="v3-venue-identity"><img class="v3-dex-logo" src="https://app.cetus.zone/favicon.ico?t=202608241740" alt="Cetus logo" referrerpolicy="no-referrer"><div class="v3-venue-copy"><span class="v3-venue-name">Cetus</span><div class="v3-pair-line"><div class="v3-token-stack" aria-hidden="true"><img src="../assets/sui-token.svg" alt=""><img src="../thick.png" alt=""></div><h3>SUI / TREE</h3></div><p class="v3-venue-subtitle"><span>0.25% fee</span><span>Verified Mainnet pool</span><span>Fees only</span></p></div></div>
            ${V3_REBALANCE_PREVIEW_ENABLED ? '<button class="v3-add-button v3-manage-link" type="button" data-v3-native-manager="cetus" aria-expanded="false">Manage Liquidity</button>' : `<a class="v3-add-button v3-manage-link" href="${CETUS_POOL_URL}" target="_blank" rel="noopener noreferrer">Manage Liquidity ↗</a>`}
          </div>
          <div class="v3-metrics">
            <div class="v3-metric"><span>TVL</span><strong id="v3CetusTvl">Loading…</strong></div>
            <div class="v3-metric"><span>24H Volume</span><strong id="v3CetusVolume">Loading…</strong></div>
            <div class="v3-metric"><span>APR (fees only)</span><strong id="v3CetusApr">Loading…</strong></div>
            <div class="v3-metric"><span>Current Price</span><strong class="good" id="v3CetusPrice">Loading…</strong></div>
          </div>
          <details class="v3-pool-details"><summary>Pool details</summary><p class="v3-pool-id">Pool <code>${CETUS_POOL_ID}</code></p><p class="v3-notice" id="v3CetusNotice">Loading verified Cetus liquidity and volume from Sui Mainnet.</p></details>
          ${V3_REBALANCE_PREVIEW_ENABLED ? `<div class="v3-native-manager" data-v3-native-manager-panel="cetus" hidden>
            <div class="v3-native-manager-heading"><div><span>Native TREE manager</span><strong>Cetus SUI / TREE</strong></div><b>Test DApp</b></div>
            <div class="v3-native-manager-tabs"><button class="active" type="button" data-v3-native-manager-view="add">Add Liquidity</button><button type="button" data-v3-go-cetus-positions>My Positions</button></div>
            <div data-v3-native-manager-content="add"><div class="v3-form-grid"><label class="v3-field"><span class="v3-field-heading"><span>SUI amount</span><small id="cetusV3SuiBalance">Balance —</small></span><span class="v3-sui-amount-input"><input id="cetusV3SuiAmount" inputmode="decimal" autocomplete="off" placeholder="0.0"><button id="cetusV3SuiMax" type="button">MAX</button></span><small class="v3-gas-note">MAX keeps 0.05 SUI for gas.</small></label><label class="v3-field"><span>Estimated TREE pair</span><input id="cetusV3TreeAmount" inputmode="decimal" readonly placeholder="Calculated automatically"></label><label class="v3-field full"><span>Price range</span><select id="cetusV3Range"><option value="tight">Tight ±5%</option><option value="medium" selected>Medium ±15%</option><option value="wide">Wide ±40%</option></select></label></div><div class="v3-cetus-quote"><span>Calculated range</span><strong id="cetusV3RangeText">—</strong></div><button class="button primary v3-cetus-add-action" id="cetusV3AddAction" type="button">Connect Wallet</button><p class="v3-status" id="cetusV3AddStatus" role="status" aria-live="polite">Connect a Sui wallet to build a verified Cetus position.</p></div>
          </div>` : ''}
        </article>
        <article class="v3-pool-card v3-turbos-pool-card">
          <div class="v3-pool-head">
            <div class="v3-venue-identity"><img class="v3-dex-logo" src="https://app.turbos.finance/favicon.ico?v=11" alt="Turbos logo" referrerpolicy="no-referrer"><div class="v3-venue-copy"><span class="v3-venue-name">Turbos</span><div class="v3-pair-line"><div class="v3-token-stack" aria-hidden="true"><img src="../assets/sui-token.svg" alt=""><img src="../thick.png" alt=""></div><h3>SUI / TREE</h3></div><p class="v3-venue-subtitle"><span>1.00% fee</span><span>Verified Mainnet pool</span><span>Fees only</span></p></div></div>
            ${V3_REBALANCE_PREVIEW_ENABLED ? '<button class="v3-add-button v3-manage-link" type="button" data-v3-native-manager="turbos" aria-expanded="false">Manage Liquidity</button>' : `<a class="v3-add-button v3-manage-link" href="${TURBOS_POOL_URL}" target="_blank" rel="noopener noreferrer">Manage Liquidity ↗</a>`}
          </div>
          <div class="v3-metrics">
            <div class="v3-metric"><span>TVL</span><strong id="v3TurbosTvl">Loading…</strong></div>
            <div class="v3-metric"><span>24H Volume</span><strong id="v3TurbosVolume">Loading…</strong></div>
            <div class="v3-metric"><span>APR (fees only)</span><strong id="v3TurbosApr">Loading…</strong></div>
            <div class="v3-metric"><span>Current Price</span><strong class="good" id="v3TurbosPrice">Loading…</strong></div>
          </div>
          <details class="v3-pool-details"><summary>Pool details</summary><p class="v3-pool-id">Pool <code>${TURBOS_TREE_POOL_ID}</code></p><p class="v3-notice" id="v3TurbosNotice">Loading this verified Turbos SUI/TREE pool from Sui Mainnet.</p></details>
          ${V3_REBALANCE_PREVIEW_ENABLED ? `<div class="v3-native-manager" data-v3-native-manager-panel="turbos" hidden>
            <div class="v3-native-manager-heading"><div><span>Native TREE manager</span><strong>Turbos SUI / TREE</strong></div><b>Test DApp</b></div>
            <div class="v3-native-manager-tabs"><button class="active" type="button" data-v3-native-manager-view="add">Add Liquidity</button><button type="button" data-v3-go-turbos-positions>My Positions</button></div>
            <div data-v3-native-manager-content="add"><div class="v3-form-grid"><label class="v3-field"><span class="v3-field-heading"><span>SUI amount</span><small id="turbosV3SuiBalance">Balance —</small></span><span class="v3-sui-amount-input"><input id="turbosV3SuiAmount" inputmode="decimal" autocomplete="off" placeholder="0.0"><button id="turbosV3SuiMax" type="button">MAX</button></span><small class="v3-gas-note">MAX keeps 0.05 SUI for gas.</small></label><label class="v3-field"><span>Calculated TREE</span><input id="turbosV3TreeAmount" readonly placeholder="—"></label><label class="v3-field full"><span>Price range</span><select id="turbosV3Range"><option value="tight">Tight ±5%</option><option value="medium" selected>Medium ±15%</option><option value="wide">Wide ±40%</option></select></label></div><button class="button primary" id="turbosV3AddAction" type="button" disabled>Calculate &amp; Review Add</button><p class="v3-status" id="turbosV3AddStatus" role="status" aria-live="polite">Enter a SUI amount. TREE will be calculated from the selected range.</p></div>
          </div>` : ''}
        </article>
        </template>
      </div>
      <div class="v3-panel v3-zap-panel" id="v3ZapPanel" data-v3-panel="zap" hidden>
        <div class="v3-zap-intro"><div><span>Choose a destination</span><h3>Zap &amp; Add SuiDex V3 Liquidity</h3><p>Create a new position from one token, or add liquidity to a verified position already owned by this wallet.</p></div><button class="button secondary" type="button" data-v3-back-to-pools>View Pool</button></div>
        <div class="v3-zap-mode-switch" role="tablist" aria-label="V3 liquidity destination">
          <button class="active" type="button" role="tab" aria-selected="true" data-v3-zap-mode="new"><span>New Position</span><small>One-token zap</small></button>
          <button type="button" role="tab" aria-selected="false" data-v3-zap-mode="existing"><span>Existing Position</span><small>Zap SUI into its current range</small></button>
        </div>
        <div data-v3-zap-view="new"><div id="v3ZapHost"></div></div>
        <div class="v3-zap-existing-view" data-v3-zap-view="existing" hidden>
          <div class="v3-zap-existing-heading"><div><span>Your verified positions</span><h3>Choose where to zap SUI</h3><p>Select a position, enter your total SUI budget, and review the swap and deposit before signing.</p></div><button class="button secondary" type="button" id="v3ZapRefreshPositions">Refresh</button></div>
          <div class="v3-zap-existing-list" id="v3ZapExistingList"><article class="v3-empty"><strong>Connect your wallet</strong>Your verified SuiDex V3 positions will appear here.</article></div>
          <p class="v3-status" id="v3ZapExistingStatus" role="status" aria-live="polite">No wallet connected.</p>
        </div>
      </div>
      <div class="v3-panel" data-v3-panel="positions" hidden>
        <section class="v3-venue-position-section"><div class="v3-venue-position-heading"><div><img src="https://dex.suidex.org/apple-touch-icon.png" alt="SuiDex logo" referrerpolicy="no-referrer"><span>SuiDex</span><strong>SUI / TREE positions</strong></div></div><div class="v3-position-list" id="v3PositionList"><article class="v3-empty"><strong>Connect your wallet</strong>Public SuiDex V3 positions will appear here after wallet connection.</article></div><button class="button secondary v3-refresh" id="v3RefreshPositions" type="button">Refresh SuiDex Positions</button><p class="v3-status" id="v3PositionStatus" role="status" aria-live="polite">No wallet connected.</p></section>
      </div>
      <div class="v3-panel v3-embedded-swap" data-v3-panel="swap" hidden>
        <div class="v3-swap-intro"><div><span>Native best route</span><h3>Swap SUI and TREE here</h3><p>The same verified swap engine compares SuiDex V2, SuiDex V3, Turbos, and Cetus for the highest protected executable output.</p></div></div>
        <div id="v3EmbeddedSwapHost"></div>
      </div>
      <article class="v3-victory-reinvest-card">
        <div class="v3-victory-reinvest-copy"><img src="../assets/victory-token.png" alt="VICTORY token"><div><span>VICTORY → V3</span><h3>Reinvest VICTORY into SUI / TREE V3</h3><p>Choose Complete Reinvest, or lock one portion as xVICTORY with Sustainable Reinvest.</p></div></div>
        <button class="button gold" id="v3OpenVictoryReinvest" type="button">Reinvest VICTORY</button>
      </article>
    </div>`;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('[data-v3-tab]').forEach((button) => {
    const active = button.dataset.v3Tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-v3-panel]').forEach((panel) => { panel.hidden = panel.dataset.v3Panel !== tab; });
  const zapCard = document.getElementById('v3AddCard');
  if (zapCard) zapCard.hidden = tab !== 'zap' || state.zapMode !== 'new';
  mountSharedSwap(tab === 'swap' ? 'v3' : 'primary');
  if (tab === 'zap') {
    window.dispatchEvent(new CustomEvent('tree:v3-zap-shown'));
    if (state.zapMode === 'existing') refreshWalletState(true);
  }
  if (tab === 'positions') refreshWalletState(true);
}

function setZapMode(mode) {
  state.zapMode = mode === 'existing' ? 'existing' : 'new';
  document.querySelectorAll('[data-v3-zap-mode]').forEach((button) => {
    const active = button.dataset.v3ZapMode === state.zapMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-v3-zap-view]').forEach((view) => { view.hidden = view.dataset.v3ZapView !== state.zapMode; });
  const zapCard = document.getElementById('v3AddCard');
  if (zapCard) zapCard.hidden = state.zapMode !== 'new';
  if (state.zapMode === 'existing') refreshWalletState(true);
  else window.dispatchEvent(new CustomEvent('tree:v3-zap-shown'));
}

function mountSharedSwap(destination = 'primary') {
  const workspace = document.getElementById('treeSwapWorkspace');
  const host = document.getElementById(destination === 'v3' ? 'v3EmbeddedSwapHost' : 'treeSwapPrimaryHost');
  if (workspace && host && workspace.parentElement !== host) host.appendChild(workspace);
}

function currentPrice() {
  const value = Number(state.overview?.pool?.priceSuiPerTree);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function updateRangeFields() {
  const price = currentPrice();
  const min = document.getElementById('v3MinPrice');
  const max = document.getElementById('v3MaxPrice');
  if (!min || !max || !price) return;
  const spreads = { tight: 0.05, medium: 0.15, wide: 0.40 };
  if (state.range === 'full') {
    min.value = 'Protocol minimum';
    max.value = 'Protocol maximum';
    min.readOnly = true;
    max.readOnly = true;
  } else {
    const spread = spreads[state.range] ?? 0.15;
    min.readOnly = false;
    max.readOnly = false;
    min.value = (price * (1 - spread)).toPrecision(8);
    max.value = (price * (1 + spread)).toPrecision(8);
  }
  updatePositionPlan();
}

function updatePositionPlan() {
  const price = currentPrice();
  const amountInput = document.getElementById('v3SuiAmount');
  const treeOutput = document.getElementById('v3TreeAmount');
  const current = document.getElementById('v3PlanCurrent');
  const range = document.getElementById('v3PlanRange');
  const status = document.getElementById('v3PlanStatus');
  if (!amountInput || !treeOutput || !current || !range || !status) return;
  const normalized = normalizeDecimalInput(amountInput.value);
  const amount = Number(normalized);
  treeOutput.value = price && Number.isFinite(amount) && amount > 0 ? formatNumber(amount / price, 6) : '';
  current.textContent = price ? `${price.toPrecision(8)} SUI / TREE` : 'Unavailable';
  if (state.range === 'full') {
    range.textContent = 'Full protocol range';
    status.textContent = 'In range by design';
    return;
  }
  const minValue = Number(normalizeDecimalInput(document.getElementById('v3MinPrice')?.value));
  const maxValue = Number(normalizeDecimalInput(document.getElementById('v3MaxPrice')?.value));
  range.textContent = Number.isFinite(minValue) && Number.isFinite(maxValue) ? `${minValue.toPrecision(6)} – ${maxValue.toPrecision(6)}` : 'Enter a valid range';
  status.textContent = price && Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue < price && price < maxValue ? 'Current price is in range' : 'Current price is outside range';
}

function renderAprBreakdown(analytics, rewards, verified) {
  const breakdown = document.getElementById('v3AprBreakdown');
  if (!breakdown) return;
  const parts = verified
    ? [
      { label: 'Fees', value: analytics.feeAprPercent, className: 'fees' },
      ...rewards.map((reward) => ({ label: reward.symbol, value: reward.aprPercent, className: 'reward' })),
    ]
    : [];
  if (!parts.length) {
    breakdown.textContent = 'APR breakdown not verified';
    return;
  }
  breakdown.replaceChildren(...parts.map((part) => {
    const component = document.createElement('span');
    component.className = `v3-apr-component ${part.className}`;
    component.textContent = `${part.label}: ${Number(part.value || 0).toFixed(1)}%`;
    return component;
  }));
}

function renderPool(payload) {
  state.overview = payload;
  rememberPositionPrices(payload);
  const pool = payload.pool;
  const analytics = payload.analytics || {};
  const analyticsVerified = analytics.status === 'verified';
  state.suiDexTvlUsd = analyticsVerified ? verifiedPositive(analytics.tvlUsd) : null;
  updateCombinedV3Tvl();
  document.getElementById('v3PoolPrice').textContent = `${pool.priceSuiPerTree} SUI / TREE`;
  document.getElementById('v3SuiReserve').textContent = `${formatNumber(pool.reserveSui, 6)} SUI`;
  document.getElementById('v3TreeReserve').textContent = `${formatNumber(pool.reserveTree, 2)} TREE`;
  document.getElementById('v3CurrentTick').textContent = String(pool.currentTick);
  document.getElementById('v3LiquidityRaw').textContent = Number(pool.liquidityRaw).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  document.getElementById('v3PoolVolume').textContent = formatUsd(analytics.volume24hUsd);
  document.getElementById('v3PoolApr').textContent = analytics.aprPercent !== null && analytics.aprPercent !== undefined && analytics.aprPercent !== '' && Number.isFinite(Number(analytics.aprPercent)) ? `${Number(analytics.aprPercent).toFixed(1)}%` : 'Not verified';
  const allPositions = document.getElementById('v3SummaryAllPositions');
  const allPositionCount = payload.allPositionCount === null || payload.allPositionCount === undefined ? null : Number(payload.allPositionCount);
  if (allPositions) allPositions.textContent = Number.isSafeInteger(allPositionCount) && allPositionCount >= 0 ? String(allPositionCount) : 'Not verified';
  const rewards = analyticsVerified && Array.isArray(analytics.rewards) ? analytics.rewards : [];
  const rewardChip = document.getElementById('v3RewardChip');
  const rewardSymbols = rewards.map((reward) => String(reward.symbol || '').trim()).filter(Boolean);
  rewardChip.textContent = analyticsVerified
    ? rewardSymbols.length ? `Rewards: ${rewardSymbols.join(' + ')}` : 'No active rewards'
    : 'Incentives not verified';
  rewardChip.title = rewardSymbols.length ? `Active rewards: ${rewardSymbols.join(', ')}` : 'No active verified incentive schedule';
  renderAprBreakdown(analytics, rewards, analyticsVerified);
  const poolWarning = payload.warnings?.[0];
  document.getElementById('v3AnalyticsNotice').textContent = analyticsVerified
    ? `SuiDex verified analytics: ${formatUsd(analytics.volume24hUsd)} volume and ${formatUsd(analytics.fees24hUsd)} fees in the last 24 hours. APR is annualized from current fees and active incentive emissions; it is not guaranteed.`
    : `${poolWarning || 'Pool reserves are verified on chain.'} Volume, fees, and APR remain unpublished when the SuiDex analytics cross-check fails.`;
  document.getElementById('v3PoolStatus').textContent = `Verified from Sui Mainnet · Updated ${new Date(payload.generatedAt).toLocaleTimeString()}`;
  document.getElementById('v3PoolStatus').className = 'v3-status ok';
  updateRangeFields();
}

function updateCombinedV3Tvl() {
  const expectedValues = [state.suiDexTvlUsd, state.cetusTvlUsd, state.turbosTvlUsd];
  const values = expectedValues.filter((value) => Number.isFinite(value));
  const summary = document.getElementById('v3SummaryTvl');
  const combined = values.length === expectedValues.length ? formatUsd(values.reduce((total, value) => total + value, 0)) : 'Not verified';
  if (summary) summary.textContent = combined;
  const poolTvl = document.getElementById('v3PoolTvl');
  if (poolTvl) poolTvl.textContent = combined;
}

async function loadExternalPoolMetrics() {
  const tvl = document.getElementById('v3CetusTvl');
  const volume = document.getElementById('v3CetusVolume');
  const cetusApr = document.getElementById('v3CetusApr');
  const cetusPrice = document.getElementById('v3CetusPrice');
  const notice = document.getElementById('v3CetusNotice');
  const turbosTvl = document.getElementById('v3TurbosTvl');
  const turbosVolume = document.getElementById('v3TurbosVolume');
  const turbosApr = document.getElementById('v3TurbosApr');
  const turbosPrice = document.getElementById('v3TurbosPrice');
  const turbosNotice = document.getElementById('v3TurbosNotice');
  try {
    const [liquidityResponse, volumeResponse] = await Promise.all([
      fetch('/api/tree-liquidity', { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch('/api/tree-volume', { headers: { Accept: 'application/json' }, cache: 'no-store' }),
    ]);
    const [liquidityPayload, volumePayload] = await Promise.all([liquidityResponse.json(), volumeResponse.json()]);
    if (!liquidityResponse.ok || liquidityPayload.status !== 'ok' || !volumeResponse.ok || volumePayload.status !== 'ok') throw new Error('External V3 venue metrics could not be completely verified.');
    const cetusPool = liquidityPayload.liquidity?.cetusPool;
    const cetusVolume24h = Number(volumePayload.pools?.[CETUS_POOL_ID]?.volume24hUsd);
    state.cetusTvlUsd = verifiedPositive(cetusPool?.tvlUsd);
    const cetusFeeApr = annualizedFeeApr(cetusVolume24h, state.cetusTvlUsd, cetusPool?.feePercent);
    if (!state.cetusTvlUsd || cetusPool?.poolId !== CETUS_POOL_ID || cetusPool?.active !== true || !Number.isFinite(cetusVolume24h)
      || !verifiedPositive(cetusPool?.priceSuiPerTree) || cetusFeeApr === null) throw new Error('Cetus metrics were incomplete.');
    if (tvl) tvl.textContent = formatUsd(state.cetusTvlUsd);
    if (volume) volume.textContent = formatUsd(cetusVolume24h);
    if (cetusApr) cetusApr.textContent = formatPoolApr(cetusFeeApr);
    if (cetusPrice) cetusPrice.textContent = formatPoolPrice(cetusPool.priceSuiPerTree);
    if (notice) notice.textContent = `Verified Sui Mainnet spot price · APR annualizes trailing 24H LP fees and excludes incentives · Updated ${new Date(liquidityPayload.generatedAt).toLocaleTimeString()}`;
    state.turbosTvlUsd = verifiedPositive(liquidityPayload.liquidity?.turbosTvlUsd);
    const turbosPool = Array.isArray(liquidityPayload.liquidity?.turbosPools)
      ? liquidityPayload.liquidity.turbosPools.find((pool) => pool?.poolId === TURBOS_TREE_POOL_ID)
      : null;
    const turbosPoolVolume = volumePayload.pools?.[TURBOS_TREE_POOL_ID];
    state.turbosTvlUsd = verifiedPositive(turbosPool?.tvlUsd);
    const turbosFeeApr = annualizedFeeApr(turbosPoolVolume?.volume24hUsd, state.turbosTvlUsd, turbosPool?.feePercent);
    if (!state.turbosTvlUsd || turbosPool?.active !== true || !Number.isFinite(Number(turbosPoolVolume?.volume24hUsd))
      || !verifiedPositive(turbosPool?.priceSuiPerTree) || turbosFeeApr === null) throw new Error('Turbos SUI/TREE pool metrics were incomplete.');
    if (turbosTvl) turbosTvl.textContent = formatUsd(state.turbosTvlUsd);
    if (turbosVolume) turbosVolume.textContent = formatUsd(turbosPoolVolume.volume24hUsd);
    if (turbosApr) turbosApr.textContent = formatPoolApr(turbosFeeApr);
    if (turbosPrice) turbosPrice.textContent = formatPoolPrice(turbosPool.priceSuiPerTree);
    if (turbosNotice) turbosNotice.textContent = `Verified Sui Mainnet spot price · APR annualizes trailing 24H LP fees and excludes incentives · Updated ${new Date(liquidityPayload.generatedAt).toLocaleTimeString()}`;
    updateCombinedV3Tvl();
  } catch {
    state.cetusTvlUsd = null;
    state.turbosTvlUsd = null;
    if (tvl) tvl.textContent = 'Not verified';
    if (volume) volume.textContent = 'Not verified';
    if (cetusApr) cetusApr.textContent = 'Not verified';
    if (cetusPrice) cetusPrice.textContent = 'Not verified';
    if (notice) notice.textContent = 'Cetus data is temporarily unavailable. Partial values are not published.';
    if (turbosTvl) turbosTvl.textContent = 'Not verified';
    if (turbosVolume) turbosVolume.textContent = 'Not verified';
    if (turbosApr) turbosApr.textContent = 'Not verified';
    if (turbosPrice) turbosPrice.textContent = 'Not verified';
    if (turbosNotice) turbosNotice.textContent = 'Turbos data is temporarily unavailable. Partial values are not published.';
    updateCombinedV3Tvl();
  }
}

async function loadPool() {
  const status = document.getElementById('v3PoolStatus');
  if (status) { status.textContent = 'Loading verified V3 pool…'; status.className = 'v3-status'; }
  try {
    const response = await fetch(V3_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'ok' || payload.pool?.poolId !== V3_POOL_ID) throw new Error(payload.message || payload.error || `V3 endpoint returned ${response.status}`);
    renderPool(payload);
  } catch (error) {
    if (status) { status.textContent = `V3 pool unavailable: ${error instanceof Error ? error.message : error}`; status.className = 'v3-status error'; }
  }
}

function renderIncreasePanelHtml(position, pool = state.overview?.pool) {
  const positionId = position.objectId;
  return `<div class="v3-increase-panel" data-v3-increase-panel="${positionId}" data-v3-tick-lower="${position.tickLower}" data-v3-tick-upper="${position.tickUpper}" data-v3-sqrt-price-raw="${pool?.sqrtPriceRaw || ''}" hidden>
    <div class="v3-increase-wallet-balances" aria-label="Available connected-wallet balances"><div class="sui"><span><b class="token-dot sui-dot" aria-hidden="true"></b>Available SUI</span><strong data-v3-increase-sui-balance>Connect wallet</strong><small>Your connected-wallet balance · MAX keeps 0.05 SUI for gas</small></div><div class="tree"><span><b class="token-dot tree-dot" aria-hidden="true"></b>Available TREE</span><strong data-v3-increase-tree-balance>Connect wallet</strong><small>Your connected-wallet balance · available to add</small></div></div>
    <div class="v3-form-grid"><label class="v3-field"><span>SUI to add</span><span class="v3-increase-input"><input inputmode="decimal" placeholder="0.0" data-v3-increase-sui><button type="button" data-v3-increase-max="sui">MAX</button></span></label><label class="v3-field"><span>TREE to add</span><span class="v3-increase-input"><input inputmode="decimal" placeholder="0" data-v3-increase-tree><button type="button" data-v3-increase-max="tree">MAX</button></span></label></div>
    <p class="v3-pair-estimate" data-v3-increase-estimate>Enter either token amount. The paired amount updates automatically for this position’s current range.</p>
    <div class="v3-slippage-row"><span>Increase slippage</span><div role="group" aria-label="Increase position slippage"><button class="active" type="button" data-v3-increase-slippage="50">0.5%</button><button type="button" data-v3-increase-slippage="100">1%</button><button type="button" data-v3-increase-slippage="200">2%</button></div></div>
    <button class="button primary" type="button" data-v3-increase-submit="${positionId}">Simulate Increase</button>
    <p class="v3-status" role="status" aria-live="polite" data-v3-increase-status>Nothing is signed until two Mainnet simulations pass and you confirm the exact deposit.</p>
  </div>`;
}

function renderZapExistingPositions(positions = state.positions) {
  const list = document.getElementById('v3ZapExistingList');
  const status = document.getElementById('v3ZapExistingStatus');
  if (!list || !status) return;
  if (!state.owner) {
    list.innerHTML = '<article class="v3-empty"><strong>Connect your wallet</strong><button class="button secondary" type="button" data-v3-zap-connect>Connect Wallet</button></article>';
    status.textContent = 'A wallet connection is required to find positions you own.';
    return;
  }
  if (!positions.length) {
    list.innerHTML = '<article class="v3-empty"><strong>No existing SuiDex V3 position found</strong>Use New Position to create one, then it will appear here.</article>';
    status.textContent = `Wallet ${compactId(state.owner)} · no verified position in this pool.`;
    return;
  }
  list.innerHTML = positions.map((position, index) => `
    <article class="v3-position-card v3-zap-existing-card">
      <div class="v3-zap-position-summary">
        <div><span>Position ${index + 1}</span><strong>SUI / TREE · ${position.inRange ? 'In range' : 'Out of range'}</strong><code title="${position.objectId}">${compactId(position.objectId)}</code></div>
        <div class="v3-zap-position-facts"><span><small>Value</small>${formatPositionUsd(position.valueUsd)}</span><span><small>Range</small>${position.tickLower} – ${position.tickUpper}</span><span><small>Liquidity</small>${Number(position.liquidityRaw).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}</span></div>
      </div>
      <button class="v3-zap-existing-action" type="button" data-v3-increase-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Zap SUI into this position</button>
      ${renderExistingSuiZapPanel(position)}
    </article>`).join('');
  status.textContent = `${positions.length} verified position${positions.length === 1 ? '' : 's'} available · choose one to continue.`;
  status.className = 'v3-status ok';
}
function renderExistingSuiZapPanel(position) {
  return `<div class="v3-increase-panel" data-v3-increase-panel="${position.objectId}" data-v3-sui-zap="true" hidden>
    <div class="v3-increase-wallet-balances"><div class="sui"><span>Available SUI</span><strong data-v3-increase-sui-balance>Connect wallet</strong><small>MAX keeps 0.05 SUI for gas</small></div><div class="tree"><span>Wallet TREE</span><strong data-v3-increase-tree-balance>Connect wallet</strong><small>No wallet TREE required for this SUI zap</small></div></div>
    <label class="v3-field"><span>Total SUI to zap</span><span class="v3-increase-input"><input inputmode="decimal" placeholder="0.0" data-v3-increase-sui><button type="button" data-v3-increase-max="sui">MAX</button></span></label>
    <p class="v3-pair-estimate">Part of this SUI swaps to TREE. The remaining SUI and purchased TREE enter your existing range. Gas is additional; unused tokens return to your wallet.</p>
    <div class="v3-slippage-row"><span>Zap slippage</span><div role="group" aria-label="Zap slippage"><button class="active" type="button" data-v3-increase-slippage="50">0.5%</button><button type="button" data-v3-increase-slippage="100">1%</button><button type="button" data-v3-increase-slippage="200">2%</button></div></div>
    <button class="button primary" type="button" data-v3-increase-submit="${position.objectId}">Simulate SUI Zap</button>
    <p class="v3-status" role="status" aria-live="polite" data-v3-increase-status>Review the split and simulated deposit before one wallet approval.</p>
  </div>`;
}

function renderPositions(payload) {
  const list = document.getElementById('v3PositionList');
  const status = document.getElementById('v3PositionStatus');
  if (!list || !status) return;
  if (payload.status !== 'ok') {
    state.positions = [];
    list.innerHTML = '<article class="v3-empty"><strong>Verification incomplete</strong>Partial V3 position results are not displayed.</article>';
    status.textContent = payload.warnings?.[0] || 'The position scan did not reach its natural end.';
    status.className = 'v3-status error';
    renderZapExistingPositions([]);
    return;
  }
  rememberPositionPrices(payload);
  const positions = Array.isArray(payload.positions) ? payload.positions.map(restorePositionUsd) : [];
  state.positions = positions;
  renderZapExistingPositions(positions);
  if (!positions.length) {
    list.innerHTML = '<article class="v3-empty"><strong>No live SUI/TREE V3 position found</strong>This connected wallet has no verified address-owned position in the recognized pool.</article>';
  } else {
    list.innerHTML = positions.map((position) => `
      <article class="v3-position-card">
        <div class="v3-position-head"><div><div class="v3-position-title"><h3>SUI / TREE</h3><span class="v3-chip">0.25% fee</span><span class="v3-position-state ${position.inRange ? '' : 'review'}">${position.inRange ? 'In range' : 'Out of range'}</span></div><code title="${position.objectId}">${compactId(position.objectId)}</code></div><strong class="v3-position-value">${formatPositionUsd(position.valueUsd)}</strong></div>
        <div class="v3-token-balances"><span><b class="token-dot sui-dot" aria-label="SUI"></b>${formatNumber(position.principalSui, 6)} SUI <small>${formatPositionUsd(position.principalSuiUsd)}</small></span><span><b class="token-dot tree-dot" aria-label="TREE"></b>${formatNumber(position.principalTree, 4)} TREE <small>${formatPositionUsd(position.principalTreeUsd)}</small></span></div>
        <div class="v3-range-visual" aria-label="Position range"><div class="v3-range-track"><span style="left:${positionRangePercent(position)}%"></span></div><div class="v3-range-labels"><span>Min: ${position.tickLower}</span><strong>Current: ${position.currentTick}</strong><span>Max: ${position.tickUpper}</span></div></div>
        <div class="v3-earned-row fees"><span>Pending fees<small>${position.pendingFeeSui === null ? 'Accounting unavailable' : `${formatNumber(position.pendingFeeSui, 6)} SUI + ${formatNumber(position.pendingFeeTree, 4)} TREE`}</small></span><strong>${formatPositionUsd(position.pendingFeesUsd)}</strong></div>
        <div class="v3-position-rewards">${renderPositionRewards(position)}</div>
        <p class="v3-position-technical">Liquidity: ${Number(position.liquidityRaw).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })} units</p>
        <div class="v3-position-actions ${V3_REBALANCE_PREVIEW_ENABLED ? 'has-rebalance' : ''}" aria-label="Position management actions"><button class="add" type="button" data-v3-increase-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Add</button><button type="button" data-v3-remove-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Remove</button><button class="claim" type="button" data-v3-claim-all-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Claim Yield</button>${V3_REBALANCE_PREVIEW_ENABLED ? `<button class="rebalance" type="button" data-v3-rebalance-position="${position.objectId}" aria-expanded="false">Rebalance</button>` : ''}</div>
        ${renderIncreasePanelHtml(position, payload.pool || state.overview?.pool)}
        <div class="v3-remove-panel" data-v3-remove-panel="${position.objectId}" data-v3-position-liquidity="${position.liquidityRaw}" hidden>
          <div class="v3-slippage-row"><span>Liquidity to remove</span><div role="group" aria-label="Percentage of position liquidity to remove"><button class="active" type="button" data-v3-remove-percent="10">10%</button><button type="button" data-v3-remove-percent="25">25%</button><button type="button" data-v3-remove-percent="50">50%</button><button type="button" data-v3-remove-percent="100">100%</button></div></div>
          <div class="v3-slippage-row"><span>Withdrawal slippage</span><div role="group" aria-label="Remove liquidity slippage"><button class="active" type="button" data-v3-remove-slippage="50">0.5%</button><button type="button" data-v3-remove-slippage="100">1%</button><button type="button" data-v3-remove-slippage="200">2%</button></div></div>
          <button class="button primary" type="button" data-v3-remove-submit="${position.objectId}">Simulate Removal</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-remove-status>Partial removal keeps the position open. Selecting 100% withdraws everything, claims fees and rewards, and closes it.</p>
        </div>
        <div class="v3-claim-panel" data-v3-claim-panel="${position.objectId}" hidden>
          <div class="v3-yield-heading"><div><span>POSITION YIELD</span><strong>Claim or put your VICTORY back to work</strong></div><b>Verified flow</b></div>
          <p>Claim Yield collects all available SUI and TREE trading fees plus every positive verified VICTORY, TREE, and wBTC reward in one wallet transaction.</p>
          <div class="v3-yield-primary-actions">
            <button class="button primary" type="button" data-v3-claim-submit="${position.objectId}">Claim Yield</button>
            <button class="button v3-compound-action" type="button" data-v3-compound-position="${position.objectId}" data-v3-compound-mode="complete">Compound</button>
          </div>
          <small class="v3-yield-helper">Compound opens the verified VICTORY reinvest flow already targeted to this position. Claim pending yield first when you want to include newly earned VICTORY.</small>
          <details class="v3-sustainable-compound">
            <summary><span><b>♧</b><strong>Sustainable Compound</strong></span><small>Reinvest 60% · lock 40% as xVICTORY</small></summary>
            <p>Choose how long to lock the sustainable portion. The remaining 60% is prepared for this exact SUI / TREE V3 position.</p>
            <div class="v3-sustainable-terms" role="group" aria-label="Sustainable Compound lock term">
              <button type="button" data-v3-sustainable-term="7">1 Week</button>
              <button class="active" type="button" data-v3-sustainable-term="90">3 Months</button>
              <button type="button" data-v3-sustainable-term="365">1 Year</button>
              <button type="button" data-v3-sustainable-term="1095">3 Years</button>
            </div>
            <button class="button v3-sustainable-action" type="button" data-v3-compound-position="${position.objectId}" data-v3-compound-mode="sustainable" data-v3-lock-days="90">Sustainable Compound</button>
          </details>
          <p class="v3-status" role="status" aria-live="polite" data-v3-claim-status>Nothing is signed until the required Sui Mainnet simulations verify the selected action.</p>
        </div>
        ${V3_REBALANCE_PREVIEW_ENABLED ? `<div class="v3-rebalance-panel" data-v3-rebalance-panel="${position.objectId}" data-v3-rebalance-mode="no-swap" data-v3-rebalance-range="moderate" data-v3-position-liquidity="${position.liquidityRaw}" hidden>
          <div class="v3-rebalance-heading"><span class="v3-rebalance-icon" aria-hidden="true">↻</span><div><strong>Rebalance your position</strong><small>${position.inRange ? 'Adjust this active range around the current market price.' : 'This position is out of range and no longer earning active-range fees.'}</small></div></div>
          <div class="v3-rebalance-methods" role="group" aria-label="Rebalance method">
            <button class="active" type="button" data-v3-rebalance-mode-option="no-swap"><strong>Kelpie-Bind</strong><small>No swap. Redeploy the assets already held by the position.</small></button>
            <button type="button" data-v3-rebalance-mode-option="swap"><strong>Liquid Swap</strong><small>Swap the imbalance and open a centered two-sided range.</small></button>
          </div>
          <p class="v3-rebalance-description" data-v3-rebalance-description>No swap or swap slippage. Assets are redeployed as-is into the selected range; a one-sided range may wait for price to enter before earning on both sides.</p>
          <div class="v3-rebalance-explainer" aria-live="polite">
            <div class="v3-rebalance-flow v3-rebalance-flow-no-swap">
              <div class="v3-flow-step"><div class="v3-flow-token-single"><img src="../thick.png" alt="TREE"></div><strong>Current assets</strong><small>Keep the tokens already in the position</small></div>
              <span class="v3-flow-arrow" aria-hidden="true">→</span>
              <div class="v3-flow-step"><span class="v3-flow-operation">No swap</span><strong>Redeploy as-is</strong><small>No token trade or swap slippage</small></div>
              <span class="v3-flow-arrow" aria-hidden="true">→</span>
              <div class="v3-flow-step"><div class="v3-flow-range edge"><i></i><span></span></div><strong data-v3-rebalance-flow-range-title>New range</strong><small data-v3-rebalance-flow-range-copy>Range shape follows the assets already held</small></div>
            </div>
            <div class="v3-rebalance-flow v3-rebalance-flow-swap">
              <div class="v3-flow-step"><div class="v3-flow-token-single"><img src="../thick.png" alt="TREE"></div><strong>Current assets</strong><small>Remove liquidity and collect earnings</small></div>
              <span class="v3-flow-arrow" aria-hidden="true">→</span>
              <div class="v3-flow-step"><span class="v3-flow-operation swap">⇄</span><strong>Swap a portion</strong><small>Create the required SUI / TREE mix</small></div>
              <span class="v3-flow-arrow" aria-hidden="true">→</span>
              <div class="v3-flow-step"><div class="v3-flow-token-pair"><img src="../assets/sui-token.svg" alt="SUI"><img src="../thick.png" alt="TREE"></div><strong>Centered range</strong><small>Expected to return in range at execution</small></div>
            </div>
          </div>
          <div class="v3-rebalance-range-heading"><span>New range width</span><small>Moderate is recommended for most users.</small></div>
          <div class="v3-rebalance-ranges" role="group" aria-label="New position range width">
            <button type="button" data-v3-rebalance-range-option="aggressive" data-v3-rebalance-width="1"><strong>Aggressive</strong><small>±1%</small></button>
            <button class="active" type="button" data-v3-rebalance-range-option="moderate" data-v3-rebalance-width="3"><strong>Moderate</strong><small>±3%</small></button>
            <button type="button" data-v3-rebalance-range-option="conservative" data-v3-rebalance-width="8"><strong>Conservative</strong><small>±8%</small></button>
            <button type="button" data-v3-rebalance-range-option="custom" data-v3-rebalance-width="custom" disabled aria-disabled="true" title="Custom range entry is not enabled in this beta"><strong>Custom</strong><small>Coming next</small></button>
          </div>
          <div class="v3-rebalance-range-heading v3-rebalance-selected-range"><span>Selected preview</span><strong data-v3-rebalance-range-label>±3% around current price</strong></div>
          ${renderRebalanceChart(position, payload.pool || state.overview?.pool)}
          <div class="v3-rebalance-summary">
            <div><span>Before</span><strong>${position.inRange ? 'In range' : 'Out of range'}</strong></div>
            <div><span>After</span><strong class="good" data-v3-rebalance-after>Expected in range</strong></div>
            <div><span>Assets</span><strong data-v3-rebalance-assets>Existing assets, no swap</strong></div>
            <div><span>Claims</span><strong>Fees + rewards included</strong></div>
          </div>
          <div class="v3-slippage-row"><span>Max slippage</span><div role="group" aria-label="Rebalance slippage"><button class="active" type="button" data-v3-rebalance-slippage="50">0.5%</button><button type="button" data-v3-rebalance-slippage="100">1%</button><button type="button" data-v3-rebalance-slippage="300">3%</button></div></div>
          <button class="v3-rebalance-review" type="button" data-v3-rebalance-submit="${position.objectId}">Rebalance with Kelpie-Bind</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-rebalance-status>Test DApp only. Three Sui Mainnet simulations must pass before the wallet request.</p>
        </div>` : ''}
        <p class="v3-status">${V3_MANAGEMENT_ENABLED ? 'Every action uses two guarded Mainnet simulations before wallet approval.' : 'Position management is unavailable on this host.'}</p>
      </article>`).join('');
  }
  status.textContent = `Complete wallet scan · ${payload.coverage?.objectsScanned ?? 0} V3 objects checked · Updated ${new Date(payload.generatedAt).toLocaleTimeString()}`;
  status.className = 'v3-status ok';
}

async function loadPositions(owner, force = false) {
  if (!owner) return;
  if (!force && state.positionsLoadedFor === owner) return;
  const list = document.getElementById('v3PositionList');
  const status = document.getElementById('v3PositionStatus');
  const zapList = document.getElementById('v3ZapExistingList');
  const zapStatus = document.getElementById('v3ZapExistingStatus');
  if (list) list.innerHTML = '<article class="v3-empty"><strong>Scanning Sui Mainnet</strong>Checking verified SuiDex V3 position objects for this wallet.</article>';
  if (status) { status.textContent = `Wallet ${compactId(owner)} · scanning…`; status.className = 'v3-status'; }
  if (zapList) zapList.innerHTML = '<article class="v3-empty"><strong>Scanning Sui Mainnet</strong>Checking this wallet for verified positions in the SUI/TREE pool.</article>';
  if (zapStatus) { zapStatus.textContent = `Wallet ${compactId(owner)} · scanning…`; zapStatus.className = 'v3-status'; }
  try {
    const response = await fetch(`${V3_ENDPOINT}?owner=${encodeURIComponent(owner)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || payload.error || `V3 endpoint returned ${response.status}`);
    state.positionsLoadedFor = owner;
    renderPositions(payload);
  } catch (error) {
    state.positions = [];
    if (list) list.innerHTML = '<article class="v3-empty"><strong>Positions unavailable</strong>The public V3 scan could not be verified.</article>';
    if (status) { status.textContent = error instanceof Error ? error.message : String(error); status.className = 'v3-status error'; }
    if (zapList) zapList.innerHTML = '<article class="v3-empty"><strong>Positions unavailable</strong>The wallet scan could not be verified. Try Refresh.</article>';
    if (zapStatus) { zapStatus.textContent = error instanceof Error ? error.message : String(error); zapStatus.className = 'v3-status error'; }
  }
}

function refreshWalletState(force = false) {
  const owner = resolveWalletAddress();
  if (owner === state.owner && !force) return;
  state.owner = owner;
  const list = document.getElementById('v3PositionList');
  const status = document.getElementById('v3PositionStatus');
  if (!owner) {
    state.positionsLoadedFor = null;
    state.positions = [];
    if (list) list.innerHTML = '<article class="v3-empty"><strong>Connect your wallet</strong><button class="button secondary" type="button" id="v3ConnectWallet">Connect Wallet</button></article>';
    if (status) status.textContent = 'No wallet connected.';
    renderZapExistingPositions([]);
    document.getElementById('v3ConnectWallet')?.addEventListener('click', () => document.getElementById('dappWallet')?.click());
    return;
  }
  loadPositions(owner, force);
}

async function openPositionCompound(positionId, mode = 'complete', lockDays = 90) {
  history.pushState({ panelId: 'victory' }, '', '#victory');
  window.TREE_PANEL_ROUTER?.showPanel?.('victory');
  const opener = window.TREE_OPEN_V3_COMPOUND;
  if (typeof opener !== 'function') throw new Error('The verified V3 compound center is still loading. Try again in a moment.');
  await opener({ positionId, mode, lockDays, reinvestPercent: 60 });
}

function bindWorkspace() {
  const section = document.getElementById('v3');
  section?.addEventListener('click', (event) => {
    const zapModeButton = event.target.closest?.('[data-v3-zap-mode]');
    if (zapModeButton) { setZapMode(zapModeButton.dataset.v3ZapMode); return; }
    const zapConnect = event.target.closest?.('[data-v3-zap-connect]');
    if (zapConnect) { document.getElementById('dappWallet')?.click(); return; }
    const managerToggle = event.target.closest?.('[data-v3-native-manager]');
    if (managerToggle) {
      const venue = managerToggle.dataset.v3NativeManager;
      const panel = section.querySelector(`[data-v3-native-manager-panel="${venue}"]`);
      if (!panel) return;
      const opening = panel.hidden;
      section.querySelectorAll('[data-v3-native-manager-panel]').forEach((item) => { item.hidden = true; });
      section.querySelectorAll('[data-v3-native-manager]').forEach((item) => item.setAttribute('aria-expanded', 'false'));
      const suiDexPanel = document.getElementById('v3AddCard');
      const suiDexToggle = document.getElementById('v3AddLiquidity');
      if (suiDexPanel) suiDexPanel.hidden = true;
      if (suiDexToggle) {
        suiDexToggle.textContent = 'Zap into V3';
        suiDexToggle.setAttribute('aria-expanded', 'false');
      }
      state.addOpen = false;
      panel.hidden = !opening;
      managerToggle.setAttribute('aria-expanded', String(opening));
      if (opening) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const managerView = event.target.closest?.('[data-v3-native-manager-view]');
    if (managerView) {
      const manager = managerView.closest('[data-v3-native-manager-panel]');
      if (!manager) return;
      const view = managerView.dataset.v3NativeManagerView;
      manager.querySelectorAll('[data-v3-native-manager-view]').forEach((item) => item.classList.toggle('active', item === managerView));
      manager.querySelectorAll('[data-v3-native-manager-content]').forEach((item) => { item.hidden = item.dataset.v3NativeManagerContent !== view; });
      return;
    }
    const toggle = event.target.closest?.('[data-v3-rebalance-position]');
    if (toggle) {
      const positionId = toggle.dataset.v3RebalancePosition;
      const panel = [...document.querySelectorAll('[data-v3-rebalance-panel]')].find((item) => item.dataset.v3RebalancePanel === positionId);
      if (!panel) return;
      const opening = panel.hidden;
      document.querySelectorAll('[data-v3-rebalance-panel]').forEach((item) => { item.hidden = true; });
      document.querySelectorAll('[data-v3-rebalance-position]').forEach((item) => item.setAttribute('aria-expanded', 'false'));
      panel.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      if (opening) {
        updateRebalancePreview(panel);
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }
    const mode = event.target.closest?.('[data-v3-rebalance-mode-option]');
    if (mode) {
      const panel = mode.closest('[data-v3-rebalance-panel]');
      const swapMode = mode.dataset.v3RebalanceModeOption === 'swap';
      const widths = swapMode ? { aggressive: 2, moderate: 8, conservative: 25 } : { aggressive: 1, moderate: 3, conservative: 8 };
      panel.dataset.v3RebalanceMode = swapMode ? 'swap' : 'no-swap';
      panel.dataset.v3RebalanceRange = 'moderate';
      panel.querySelectorAll('[data-v3-rebalance-mode-option]').forEach((item) => item.classList.toggle('active', item === mode));
      panel.querySelectorAll('[data-v3-rebalance-range-option]').forEach((item) => {
        const key = item.dataset.v3RebalanceRangeOption;
        if (!widths[key]) return;
        item.dataset.v3RebalanceWidth = String(widths[key]);
        item.querySelector('small').textContent = `±${widths[key]}%`;
        item.classList.toggle('active', key === 'moderate');
      });
      const selectedWidth = widths.moderate;
      panel.style.setProperty('--rebalance-band-width', `${Math.max(24, Math.min(82, selectedWidth * 8 + 18))}%`);
      panel.querySelector('[data-v3-rebalance-assets]').textContent = swapMode ? 'Balanced SUI / TREE after swap' : 'Existing assets, no swap';
      panel.querySelector('[data-v3-rebalance-description]').textContent = swapMode
        ? 'Swaps only the calculated imbalance, then opens a balanced range centered on the current price. This introduces swap slippage and impermanent-loss exposure.'
        : 'No swap or swap slippage. Assets are redeployed as-is into the selected range; a one-sided range may wait for price to enter before earning on both sides.';
      const submit = panel.querySelector('[data-v3-rebalance-submit]');
      if (submit) submit.textContent = swapMode ? 'Review Liquid Swap Rebalance' : 'Rebalance with Kelpie-Bind';
      panel.querySelectorAll('[data-v3-rebalance-slippage]').forEach((item) => item.classList.toggle('active', Number(item.dataset.v3RebalanceSlippage) === (swapMode ? 100 : 50)));
      updateRebalancePreview(panel);
      return;
    }
    const sustainableTerm = event.target.closest?.('[data-v3-sustainable-term]');
    if (sustainableTerm) {
      const details = sustainableTerm.closest('.v3-sustainable-compound');
      details?.querySelectorAll('[data-v3-sustainable-term]').forEach((item) => item.classList.toggle('active', item === sustainableTerm));
      const action = details?.querySelector('[data-v3-compound-mode="sustainable"]');
      if (action) action.dataset.v3LockDays = sustainableTerm.dataset.v3SustainableTerm;
      return;
    }
    const compound = event.target.closest?.('[data-v3-compound-position]');
    if (compound) {
      compound.disabled = true;
      openPositionCompound(compound.dataset.v3CompoundPosition, compound.dataset.v3CompoundMode, Number(compound.dataset.v3LockDays || 90))
        .catch((error) => {
          const panel = compound.closest('[data-v3-claim-panel]');
          const status = panel?.querySelector('[data-v3-claim-status]');
          if (status) { status.textContent = String(error?.message || error); status.className = 'v3-status error'; }
        })
        .finally(() => { compound.disabled = false; });
      return;
    }
    const range = event.target.closest?.('[data-v3-rebalance-range-option]');
    if (range) {
      const panel = range.closest('[data-v3-rebalance-panel]');
      const width = range.dataset.v3RebalanceWidth;
      panel.dataset.v3RebalanceRange = range.dataset.v3RebalanceRangeOption;
      panel.querySelectorAll('[data-v3-rebalance-range-option]').forEach((item) => item.classList.toggle('active', item === range));
      panel.style.setProperty('--rebalance-band-width', width === 'custom' ? '72%' : `${Math.max(24, Math.min(82, Number(width) * 8 + 18))}%`);
      updateRebalancePreview(panel);
    }
  });
  document.querySelectorAll('[data-v3-tab]').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.v3Tab)));
  document.getElementById('v3SuiMax')?.addEventListener('click', fillSuiDexMax);
  document.getElementById('v3AddLiquidity')?.addEventListener('click', () => setActiveTab('zap'));
  document.getElementById('v3ZapRefreshPositions')?.addEventListener('click', () => refreshWalletState(true));
  document.querySelector('[data-v3-back-to-pools]')?.addEventListener('click', () => setActiveTab('pools'));
  document.querySelectorAll('[data-v3-range]').forEach((button) => button.addEventListener('click', () => {
    state.range = button.dataset.v3Range;
    document.querySelectorAll('[data-v3-range]').forEach((item) => item.classList.toggle('active', item === button));
    updateRangeFields();
  }));
  ['v3SuiAmount', 'v3MinPrice', 'v3MaxPrice'].forEach((id) => document.getElementById(id)?.addEventListener('input', updatePositionPlan));
  document.getElementById('v3RefreshPool')?.addEventListener('click', loadPool);
  document.getElementById('v3RefreshPositions')?.addEventListener('click', () => refreshWalletState(true));
  document.getElementById('v3OpenVictoryReinvest')?.addEventListener('click', () => {
    history.pushState({ panelId: 'victory' }, '', '#victory');
    window.TREE_PANEL_ROUTER?.showPanel?.('victory');
    document.getElementById('victoryReinvestTab')?.click();
    const destination = document.getElementById('victoryReinvestDestination');
    if (destination) { destination.value = 'v3'; destination.dispatchEvent(new Event('change', { bubbles: true })); }
    requestAnimationFrame(() => document.getElementById('victoryReinvestView')?.scrollIntoView({ block: 'start' }));
  });
  document.querySelector('[data-v3-go-positions]')?.addEventListener('click', () => setActiveTab('positions'));
  document.querySelector('[data-v3-go-cetus-positions]')?.addEventListener('click', () => {
    setActiveTab('positions');
    requestAnimationFrame(() => document.getElementById('cetusV3PositionSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });
  document.querySelector('[data-v3-go-turbos-positions]')?.addEventListener('click', () => {
    setActiveTab('positions');
    requestAnimationFrame(() => document.getElementById('turbosV3PositionSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });
  for (const eventName of ['tree:wallet-changed', 'tree-wallet-change', 'tree:wallet-change', 'wallet-change', 'wallet:change', 'sui-wallet-change', 'walletConnected', 'walletDisconnected']) {
    window.addEventListener(eventName, () => setTimeout(() => refreshWalletState(true), 0));
  }
  window.addEventListener('tree:panel-shown', (event) => {
    if (event.detail?.panelId === 'v3' && state.activeTab === 'swap') mountSharedSwap('v3');
    else if (event.detail?.panelId !== 'v3') mountSharedSwap('primary');
  });
  setInterval(() => refreshWalletState(false), 1500);
}

function initialize() {
  ensureStylesheet();
  const section = document.getElementById('v3');
  if (!section) return;
  section.classList.add('section');
  section.classList.toggle('v3-public-workspace', !V3_REBALANCE_PREVIEW_ENABLED);
  section.innerHTML = workspaceMarkup();
  window.resolveTreeWalletAddress = resolveWalletAddress;
  const zapCard = document.getElementById('v3AddCard');
  const zapHost = document.getElementById('v3ZapHost');
  if (zapCard && zapHost) zapHost.appendChild(zapCard);
  bindWorkspace();
  loadPool();
  loadExternalPoolMetrics();
  refreshWalletState(true);
  document.dispatchEvent(new CustomEvent('tree:v3-workspace-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();

export { rememberPositionPrices, restorePositionUsd };
