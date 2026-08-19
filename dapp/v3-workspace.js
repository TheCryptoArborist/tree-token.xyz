import { isTreeV3ExecutionHost } from './v3-transaction-core.js';

const V3_ENDPOINT = '/api/tree-v3-overview';
const V3_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
const V3_MANAGEMENT_ENABLED = isTreeV3ExecutionHost(location.hostname);

const state = {
  overview: null,
  owner: null,
  positionsLoadedFor: null,
  activeTab: 'pools',
  addOpen: false,
  range: 'medium',
  positionPrices: { suiUsd: null, treeUsd: null, btcUsd: null, rewardsUsd: {} },
};

function ensureStylesheet() {
  if (document.querySelector('link[data-tree-v3-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'v3-workspace.css';
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

function workspaceMarkup() {
  return `
    <div class="v3-compact-heading"><h2 id="v3-title">V3 Concentrated Liquidity</h2><p>Earn fees with concentrated SUI / TREE liquidity.</p></div>
    <div class="v3-workspace">
      <div class="v3-summary" aria-label="TREE V3 summary">
        <article class="v3-summary-card"><span>Verified Pools</span><strong id="v3PoolCount">1</strong></article>
        <article class="v3-summary-card"><span>TVL</span><strong id="v3SummaryTvl">Loading…</strong></article>
        <article class="v3-summary-card"><span>Your Positions</span><strong id="v3SummaryPositions">Connect wallet</strong></article>
      </div>
      <div class="v3-tabs" role="tablist" aria-label="V3 workspace" style="grid-template-columns:repeat(4,1fr)">
        <button class="v3-tab active" type="button" role="tab" aria-selected="true" data-v3-tab="pools">Pools</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="zap">Zap</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="positions">My Positions</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="swap">Swap</button>
      </div>
      <div class="v3-panel" data-v3-panel="pools">
        <article class="v3-pool-card">
          <div class="v3-pool-head">
            <div class="v3-pair"><div class="v3-token-stack" aria-hidden="true"><img src="../assets/sui-token.svg" alt=""><img src="../thick.png" alt=""></div><div><h3>SUI / TREE</h3><div class="v3-pair-meta"><span class="v3-chip">0.25% fee</span><span class="v3-chip verified">Verified pool</span><span class="v3-chip reward" id="v3RewardChip">Loading incentives</span></div></div></div>
            <button class="v3-add-button" id="v3AddLiquidity" type="button">+ Add</button>
          </div>
          <div class="v3-metrics">
            <div class="v3-metric"><span>TVL</span><strong id="v3PoolTvl">Loading…</strong></div>
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
        </article>
        <article class="v3-add-card" id="v3AddCard" hidden>
          <h3>Plan a SUI/TREE V3 position</h3>
          <p class="v3-status">This calculator is read-only. It does not construct, sign, or submit a transaction.</p>
          <div class="v3-form-grid">
            <div class="v3-field"><label for="v3SuiAmount">SUI amount</label><input id="v3SuiAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0"></div>
            <div class="v3-field"><label for="v3TreeAmount">Estimated TREE pair amount</label><input id="v3TreeAmount" type="text" readonly placeholder="0"></div>
            <div class="v3-field full"><label>Price range</label><div class="v3-range-options"><button class="v3-range-option" type="button" data-v3-range="tight">Tight ±5%</button><button class="v3-range-option active" type="button" data-v3-range="medium">Medium ±15%</button><button class="v3-range-option" type="button" data-v3-range="wide">Wide ±40%</button><button class="v3-range-option" type="button" data-v3-range="full">Full Range</button></div></div>
            <div class="v3-field"><label for="v3MinPrice">Minimum SUI per TREE</label><input id="v3MinPrice" type="text" inputmode="decimal"></div>
            <div class="v3-field"><label for="v3MaxPrice">Maximum SUI per TREE</label><input id="v3MaxPrice" type="text" inputmode="decimal"></div>
          </div>
          <div class="v3-estimate"><div><span>Current price</span><strong id="v3PlanCurrent">—</strong></div><div><span>Selected range</span><strong id="v3PlanRange">—</strong></div><div><span>Current status</span><strong id="v3PlanStatus">—</strong></div></div>
          <button class="v3-disabled-action" type="button" disabled>Position transaction builder in verification</button>
        </article>
      </div>
      <div class="v3-panel" data-v3-panel="zap" hidden>
        <article class="earn-route-row v3-zap-card">
          <div class="earn-route-title"><span class="token-logo-stack" aria-hidden="true"><img src="../assets/sui-token.svg" alt=""><img src="../thick.png" alt=""></span><div><h3>SUI / TREE V3 Zap</h3><small>One-token concentrated-liquidity position</small></div></div>
          <div class="earn-route-actions"><button class="button gold" id="earnV3ZapOpen" type="button" aria-expanded="true" aria-controls="earnV3ZapPanel">V3 Zap</button><button class="button secondary" type="button" data-v3-go-positions>Manage V3</button></div>
          <div class="earn-zap-panel" id="earnV3ZapPanel">
            <div class="earn-zap-heading"><div><strong>Native V3 Zap</strong><small>Runs inside the TREE V3 workspace</small></div><span class="data-state ok">Sui Mainnet</span></div>
            <label class="earn-zap-label" for="earnV3ZapToken">Deposit token</label><select id="earnV3ZapToken"><option value="SUI">SUI</option><option value="TREE">TREE</option></select>
            <label class="earn-zap-label" for="earnV3ZapAmount"><span>Amount</span><span id="earnV3ZapBalance">Balance —</span></label><div class="earn-zap-input"><input id="earnV3ZapAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0"><button id="earnV3ZapMax" type="button">MAX</button><span id="earnV3ZapSymbol">SUI</span></div>
            <label class="earn-zap-label" for="earnV3ZapRange">Price range</label><select id="earnV3ZapRange"><option value="5">±5% around current price</option><option value="20" selected>±20% around current price</option><option value="full">Full range</option></select>
            <div class="earn-zap-summary"><span>Current price</span><strong id="earnV3ZapCurrent">Loading…</strong><span>Selected range</span><strong id="earnV3ZapRangeText">—</strong><span>Swap portion</span><strong id="earnV3ZapSwap">—</strong><span>Minimum paired token</span><strong id="earnV3ZapMinimum">—</strong><span>Wallet approvals</span><strong>1 · Position + incentives</strong></div>
            <div class="earn-zap-slippage"><span>Slippage</span><div><button type="button" data-earn-v3-slippage="50">0.5%</button><button class="active" type="button" data-earn-v3-slippage="100">1%</button><button type="button" data-earn-v3-slippage="200">2%</button></div></div>
            <button class="button primary" id="earnV3ZapAction" type="button">Connect Wallet</button><p class="status" id="earnV3ZapStatus" role="status" aria-live="polite">Loading the verified SUI/TREE V3 pool…</p><div class="swap-success" id="earnV3ZapSuccess" hidden></div>
          </div>
          <details><summary>Route details</summary><p>Deposit SUI or TREE. TREE Command Center swaps the required portion in the verified SUI/TREE V3 pool and creates the selected concentrated-liquidity position after one explicit wallet approval. V3 incentives attach directly to the position.</p></details>
        </article>
      </div>
      <div class="v3-panel" data-v3-panel="positions" hidden>
        <div class="v3-position-list" id="v3PositionList"><article class="v3-empty"><strong>Connect your wallet</strong>Public SuiDex V3 positions will appear here after wallet connection.</article></div>
        <button class="button secondary v3-refresh" id="v3RefreshPositions" type="button">Refresh My Positions</button>
        <p class="v3-status" id="v3PositionStatus" role="status" aria-live="polite">No wallet connected.</p>
      </div>
      <div class="v3-panel v3-swap-link" data-v3-panel="swap" hidden>
        <div><h3>Use the native best-route TREE swap</h3><p>The Swap panel compares verified direct SuiDex V2, SuiDex V3, and Turbos routes and selects the highest protected output for the entered amount.</p><button class="button primary" id="v3OpenSwap" type="button">Open TREE Swap</button></div>
      </div>
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
  if (tab === 'positions') refreshWalletState(true);
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
  const tvl = analyticsVerified ? formatUsd(analytics.tvlUsd) : 'Not verified';
  document.getElementById('v3SummaryTvl').textContent = tvl;
  document.getElementById('v3PoolTvl').textContent = tvl;
  document.getElementById('v3PoolPrice').textContent = `${pool.priceSuiPerTree} SUI / TREE`;
  document.getElementById('v3SuiReserve').textContent = `${formatNumber(pool.reserveSui, 6)} SUI`;
  document.getElementById('v3TreeReserve').textContent = `${formatNumber(pool.reserveTree, 2)} TREE`;
  document.getElementById('v3CurrentTick').textContent = String(pool.currentTick);
  document.getElementById('v3LiquidityRaw').textContent = Number(pool.liquidityRaw).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  document.getElementById('v3PoolVolume').textContent = formatUsd(analytics.volume24hUsd);
  document.getElementById('v3PoolApr').textContent = analytics.aprPercent !== null && analytics.aprPercent !== undefined && analytics.aprPercent !== '' && Number.isFinite(Number(analytics.aprPercent)) ? `${Number(analytics.aprPercent).toFixed(1)}%` : 'Not verified';
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

function renderPositions(payload) {
  const list = document.getElementById('v3PositionList');
  const status = document.getElementById('v3PositionStatus');
  const summary = document.getElementById('v3SummaryPositions');
  if (!list || !status || !summary) return;
  if (payload.status !== 'ok') {
    list.innerHTML = '<article class="v3-empty"><strong>Verification incomplete</strong>Partial V3 position results are not displayed.</article>';
    status.textContent = payload.warnings?.[0] || 'The position scan did not reach its natural end.';
    status.className = 'v3-status error';
    summary.textContent = 'Verification incomplete';
    return;
  }
  rememberPositionPrices(payload);
  const positions = Array.isArray(payload.positions) ? payload.positions.map(restorePositionUsd) : [];
  summary.textContent = String(positions.length);
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
        <div class="v3-position-actions" aria-label="Position management actions"><button class="add" type="button" data-v3-increase-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Add</button><button type="button" data-v3-remove-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Remove</button><button class="claim" type="button" data-v3-claim-all-position="${position.objectId}" aria-expanded="false" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Claim All</button></div>
        <div class="v3-increase-panel" data-v3-increase-panel="${position.objectId}" hidden>
          <div class="v3-form-grid"><label class="v3-field"><span>Maximum SUI</span><input inputmode="decimal" placeholder="0.001" data-v3-increase-sui></label><label class="v3-field"><span>Maximum TREE</span><input inputmode="decimal" placeholder="35.5" data-v3-increase-tree></label></div>
          <div class="v3-slippage-row"><span>Increase slippage</span><div role="group" aria-label="Increase position slippage"><button class="active" type="button" data-v3-increase-slippage="50">0.5%</button><button type="button" data-v3-increase-slippage="100">1%</button><button type="button" data-v3-increase-slippage="200">2%</button></div></div>
          <button class="button primary" type="button" data-v3-increase-submit="${position.objectId}">Simulate Increase</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-increase-status>Nothing is signed until two Mainnet simulations pass and you confirm the exact deposit.</p>
        </div>
        <div class="v3-remove-panel" data-v3-remove-panel="${position.objectId}" data-v3-position-liquidity="${position.liquidityRaw}" hidden>
          <div class="v3-slippage-row"><span>Liquidity to remove</span><div role="group" aria-label="Percentage of position liquidity to remove"><button class="active" type="button" data-v3-remove-percent="10">10%</button><button type="button" data-v3-remove-percent="25">25%</button><button type="button" data-v3-remove-percent="50">50%</button><button type="button" data-v3-remove-percent="100">100%</button></div></div>
          <div class="v3-slippage-row"><span>Withdrawal slippage</span><div role="group" aria-label="Remove liquidity slippage"><button class="active" type="button" data-v3-remove-slippage="50">0.5%</button><button type="button" data-v3-remove-slippage="100">1%</button><button type="button" data-v3-remove-slippage="200">2%</button></div></div>
          <button class="button primary" type="button" data-v3-remove-submit="${position.objectId}">Simulate Removal</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-remove-status>Partial removal keeps the position open. Selecting 100% withdraws everything, claims fees and rewards, and closes it.</p>
        </div>
        <div class="v3-claim-panel" data-v3-claim-panel="${position.objectId}" hidden>
          <p>Collects all available SUI and TREE trading fees plus every positive verified VICTORY, TREE, and wBTC reward in one wallet transaction.</p>
          <button class="button primary" type="button" data-v3-claim-submit="${position.objectId}">Simulate Claim All</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-claim-status>Nothing is signed until two Mainnet simulations verify every claimable asset.</p>
        </div>
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
  if (list) list.innerHTML = '<article class="v3-empty"><strong>Scanning Sui Mainnet</strong>Checking verified SuiDex V3 position objects for this wallet.</article>';
  if (status) { status.textContent = `Wallet ${compactId(owner)} · scanning…`; status.className = 'v3-status'; }
  try {
    const response = await fetch(`${V3_ENDPOINT}?owner=${encodeURIComponent(owner)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || payload.error || `V3 endpoint returned ${response.status}`);
    state.positionsLoadedFor = owner;
    renderPositions(payload);
  } catch (error) {
    if (list) list.innerHTML = '<article class="v3-empty"><strong>Positions unavailable</strong>The public V3 scan could not be verified.</article>';
    if (status) { status.textContent = error instanceof Error ? error.message : String(error); status.className = 'v3-status error'; }
  }
}

function refreshWalletState(force = false) {
  const owner = resolveWalletAddress();
  if (owner === state.owner && !force) return;
  state.owner = owner;
  const summary = document.getElementById('v3SummaryPositions');
  const list = document.getElementById('v3PositionList');
  const status = document.getElementById('v3PositionStatus');
  if (!owner) {
    state.positionsLoadedFor = null;
    if (summary) summary.textContent = 'Connect wallet';
    if (list) list.innerHTML = '<article class="v3-empty"><strong>Connect your wallet</strong><button class="button secondary" type="button" id="v3ConnectWallet">Connect Wallet</button></article>';
    if (status) status.textContent = 'No wallet connected.';
    document.getElementById('v3ConnectWallet')?.addEventListener('click', () => document.getElementById('dappWallet')?.click());
    return;
  }
  if (summary) summary.textContent = 'Loading…';
  loadPositions(owner, force);
}

function bindWorkspace() {
  document.querySelectorAll('[data-v3-tab]').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.v3Tab)));
  document.getElementById('v3AddLiquidity')?.addEventListener('click', () => {
    state.addOpen = !state.addOpen;
    const card = document.getElementById('v3AddCard');
    if (card) card.hidden = !state.addOpen;
    document.getElementById('v3AddLiquidity').textContent = state.addOpen ? 'Close' : '+ Add';
    if (state.addOpen) updateRangeFields();
  });
  document.querySelectorAll('[data-v3-range]').forEach((button) => button.addEventListener('click', () => {
    state.range = button.dataset.v3Range;
    document.querySelectorAll('[data-v3-range]').forEach((item) => item.classList.toggle('active', item === button));
    updateRangeFields();
  }));
  ['v3SuiAmount', 'v3MinPrice', 'v3MaxPrice'].forEach((id) => document.getElementById(id)?.addEventListener('input', updatePositionPlan));
  document.getElementById('v3RefreshPool')?.addEventListener('click', loadPool);
  document.getElementById('v3RefreshPositions')?.addEventListener('click', () => refreshWalletState(true));
  document.getElementById('v3OpenSwap')?.addEventListener('click', () => { window.location.hash = 'swap'; });
  document.querySelector('[data-v3-go-positions]')?.addEventListener('click', () => setActiveTab('positions'));
  for (const eventName of ['tree:wallet-changed', 'tree-wallet-change', 'tree:wallet-change', 'wallet-change', 'wallet:change', 'sui-wallet-change', 'walletConnected', 'walletDisconnected']) {
    window.addEventListener(eventName, () => setTimeout(() => refreshWalletState(true), 0));
  }
  setInterval(() => refreshWalletState(false), 1500);
}

function initialize() {
  ensureStylesheet();
  const section = document.getElementById('v3');
  if (!section) return;
  section.className = 'section';
  section.innerHTML = workspaceMarkup();
  bindWorkspace();
  loadPool();
  refreshWalletState(true);
  document.dispatchEvent(new CustomEvent('tree:v3-workspace-ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();

export { rememberPositionPrices, restorePositionUsd };
