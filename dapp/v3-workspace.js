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

function formatNumber(value, maximumFractionDigits = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(numeric);
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
    <div class="section-heading"><div><p class="eyebrow">Native SuiDex V3 workspace</p><h2 id="v3-title">V3 Concentrated Liquidity</h2><p>Review the verified SUI/TREE pool and your public V3 positions without leaving the TREE Command Center.</p></div><span class="data-state ok">Read-only Phase A</span></div>
    <div class="v3-workspace">
      <div class="v3-summary" aria-label="TREE V3 summary">
        <article class="v3-summary-card"><span>Verified Pools</span><strong id="v3PoolCount">1</strong></article>
        <article class="v3-summary-card"><span>Estimated TVL</span><strong id="v3SummaryTvl">Loading…</strong></article>
        <article class="v3-summary-card"><span>Your Positions</span><strong id="v3SummaryPositions">Connect wallet</strong></article>
      </div>
      <div class="v3-tabs" role="tablist" aria-label="V3 workspace">
        <button class="v3-tab active" type="button" role="tab" aria-selected="true" data-v3-tab="pools">Pools</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="positions">My Positions</button>
        <button class="v3-tab" type="button" role="tab" aria-selected="false" data-v3-tab="swap">Swap</button>
      </div>
      <div class="v3-panel" data-v3-panel="pools">
        <article class="v3-pool-card">
          <div class="v3-pool-head">
            <div class="v3-pair"><div class="v3-token-stack" aria-hidden="true"><span class="sui">S</span><span class="tree">T</span></div><div><h3>SUI / TREE</h3><div class="v3-pair-meta"><span class="v3-chip">0.25% fee</span><span class="v3-chip verified">Verified pool</span><span class="v3-chip reward" id="v3RewardChip">Loading incentives</span></div></div></div>
            <button class="v3-add-button" id="v3AddLiquidity" type="button">+ Add</button>
          </div>
          <div class="v3-metrics">
            <div class="v3-metric"><span>Estimated TVL</span><strong id="v3PoolTvl">Loading…</strong></div>
            <div class="v3-metric"><span>24H Volume</span><strong id="v3PoolVolume">Not verified</strong></div>
            <div class="v3-metric"><span>APR</span><strong id="v3PoolApr">Not verified</strong></div>
            <div class="v3-metric"><span>Current Price</span><strong class="good" id="v3PoolPrice">Loading…</strong></div>
            <div class="v3-metric"><span>SUI Reserve</span><strong id="v3SuiReserve">Loading…</strong></div>
            <div class="v3-metric"><span>TREE Reserve</span><strong id="v3TreeReserve">Loading…</strong></div>
            <div class="v3-metric"><span>Current Tick</span><strong id="v3CurrentTick">Loading…</strong></div>
            <div class="v3-metric"><span>Liquidity Units</span><strong id="v3LiquidityRaw">Loading…</strong></div>
          </div>
          <div class="v3-apr-breakdown" id="v3AprBreakdown" aria-label="APR breakdown">Loading verified fee and incentive APR…</div>
          <p class="v3-pool-id">Pool <code>${V3_POOL_ID}</code></p>
        </article>
        <p class="v3-notice" id="v3AnalyticsNotice">Loading verified on-chain pool and SuiDex analytics data.</p>
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
        <button class="button secondary v3-refresh" id="v3RefreshPool" type="button">Refresh Pool Data</button>
        <p class="v3-status" id="v3PoolStatus" role="status" aria-live="polite">Loading V3 pool…</p>
      </div>
      <div class="v3-panel" data-v3-panel="positions" hidden>
        <div class="v3-position-list" id="v3PositionList"><article class="v3-empty"><strong>Connect your wallet</strong>Public SuiDex V3 positions will appear here after wallet connection.</article></div>
        <button class="button secondary v3-refresh" id="v3RefreshPositions" type="button">Refresh My Positions</button>
        <p class="v3-status" id="v3PositionStatus" role="status" aria-live="polite">No wallet connected.</p>
      </div>
      <div class="v3-panel v3-swap-link" data-v3-panel="swap" hidden>
        <div><h3>Use the native best-route TREE swap</h3><p>The Swap panel compares the verified direct SuiDex V2 and V3 routes and selects the higher output for the entered amount.</p><button class="button primary" id="v3OpenSwap" type="button">Open TREE Swap</button></div>
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

function renderPool(payload) {
  state.overview = payload;
  const pool = payload.pool;
  const tvl = formatUsd(pool.tvlUsdEstimate);
  document.getElementById('v3SummaryTvl').textContent = tvl;
  document.getElementById('v3PoolTvl').textContent = tvl;
  document.getElementById('v3PoolPrice').textContent = `${pool.priceSuiPerTree} SUI / TREE`;
  document.getElementById('v3SuiReserve').textContent = `${formatNumber(pool.reserveSui, 6)} SUI`;
  document.getElementById('v3TreeReserve').textContent = `${formatNumber(pool.reserveTree, 2)} TREE`;
  document.getElementById('v3CurrentTick').textContent = String(pool.currentTick);
  document.getElementById('v3LiquidityRaw').textContent = Number(pool.liquidityRaw).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  const analytics = payload.analytics || {};
  const analyticsVerified = analytics.status === 'verified';
  document.getElementById('v3PoolVolume').textContent = formatUsd(analytics.volume24hUsd);
  document.getElementById('v3PoolApr').textContent = analytics.aprPercent !== null && analytics.aprPercent !== undefined && analytics.aprPercent !== '' && Number.isFinite(Number(analytics.aprPercent)) ? `${Number(analytics.aprPercent).toFixed(1)}%` : 'Not verified';
  const rewards = analyticsVerified && Array.isArray(analytics.rewards) ? analytics.rewards : [];
  const rewardChip = document.getElementById('v3RewardChip');
  rewardChip.textContent = analyticsVerified ? `${rewards.length} active reward${rewards.length === 1 ? '' : 's'}` : 'Incentives not verified';
  rewardChip.title = rewards.length ? rewards.map((reward) => reward.symbol).join(', ') : 'No active verified incentive schedule';
  const aprParts = analyticsVerified
    ? [`Fees ${Number(analytics.feeAprPercent || 0).toFixed(1)}%`, ...rewards.map((reward) => `${reward.symbol} ${Number(reward.aprPercent).toFixed(1)}%`), `Total ${Number(analytics.aprPercent || 0).toFixed(1)}%`]
    : ['APR breakdown not verified'];
  document.getElementById('v3AprBreakdown').textContent = aprParts.join(' · ');
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
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  summary.textContent = String(positions.length);
  if (!positions.length) {
    list.innerHTML = '<article class="v3-empty"><strong>No live SUI/TREE V3 position found</strong>This connected wallet has no verified address-owned position in the recognized pool.</article>';
  } else {
    list.innerHTML = positions.map((position) => `
      <article class="v3-position-card">
        <div class="v3-position-head"><div><h3>SUI / TREE Position</h3><code title="${position.objectId}">${compactId(position.objectId)}</code></div><span class="v3-position-state ${position.inRange ? '' : 'review'}">${position.inRange ? 'In range' : 'Out of range'}</span></div>
        <div class="v3-metrics"><div class="v3-metric"><span>Liquidity Units</span><strong>${Number(position.liquidityRaw).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}</strong></div><div class="v3-metric"><span>Lower Tick</span><strong>${position.tickLower}</strong></div><div class="v3-metric"><span>Upper Tick</span><strong>${position.tickUpper}</strong></div><div class="v3-metric"><span>Current Tick</span><strong>${position.currentTick}</strong></div></div>
        <div class="v3-position-actions" aria-label="Position management actions"><button type="button" data-v3-increase-position="${position.objectId}" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Increase</button><button type="button" data-v3-remove-position="${position.objectId}" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Remove</button><button type="button" data-v3-collect-fees-position="${position.objectId}" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Collect Fees</button><button type="button" data-v3-claim-rewards-position="${position.objectId}" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Claim Rewards</button><button type="button" data-v3-close-position="${position.objectId}" ${V3_MANAGEMENT_ENABLED ? '' : 'disabled'}>Close</button></div>
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
          <p class="v3-status" role="status" aria-live="polite" data-v3-remove-status>Nothing is signed until two Mainnet simulations pass and you confirm the exact withdrawal.</p>
        </div>
        <div class="v3-fee-panel" data-v3-fee-panel="${position.objectId}" hidden>
          <p>Collects all currently available SUI and TREE trading fees for this position. If the simulation finds zero fees, no wallet request is made.</p>
          <button class="button primary" type="button" data-v3-fee-submit="${position.objectId}">Simulate Fee Collection</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-fee-status>Nothing is signed until Mainnet simulations verify collectible fees and you confirm the exact action.</p>
        </div>
        <div class="v3-reward-panel" data-v3-reward-panel="${position.objectId}" hidden>
          <p>Checks the pool’s verified VICTORY, TREE, and wBTC rewards. Only reward types with a positive simulated balance are included in the wallet transaction.</p>
          <button class="button primary" type="button" data-v3-reward-submit="${position.objectId}">Simulate Reward Claim</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-reward-status>Nothing is signed until two Mainnet simulations verify claimable rewards and you confirm the exact claim.</p>
        </div>
        <div class="v3-close-panel" data-v3-close-panel="${position.objectId}" hidden>
          <p>Closing permanently deletes the empty position object. The safety check refuses to continue until liquidity, fees, and all verified rewards are zero.</p>
          <button class="button primary" type="button" data-v3-close-submit="${position.objectId}">Check Position and Simulate Close</button>
          <p class="v3-status" role="status" aria-live="polite" data-v3-close-status>No wallet request is made while anything remains in the position.</p>
        </div>
        <p class="v3-status">${V3_MANAGEMENT_ENABLED ? 'All position actions use guarded Mainnet simulations. Close only proceeds for a verified empty position.' : 'Position management is unavailable on this host.'}</p>
      </article>`).join('');
  }
  status.textContent = `Complete public scan · ${payload.coverage?.objectsScanned ?? 0} V3 objects checked · Updated ${new Date(payload.generatedAt).toLocaleTimeString()}`;
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
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
