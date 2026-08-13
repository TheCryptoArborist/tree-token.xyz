const TREE_V3_API = '/api/tree-v3';
const TREE_V3_POOL_ID = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
const TREE_V3_FALLBACK = `https://dex.suidex.org/pools/v3/${TREE_V3_POOL_ID}/add`;

const state = {
  data: null,
  loading: false,
  activeTab: 'pools',
  activePoolView: 'overview',
  range: 'medium',
  lastOwner: null,
  lastLoadedAt: 0,
};

function injectStyles() {
  if (document.getElementById('treeV3WorkspaceStyles')) return;
  const link = document.createElement('link');
  link.id = 'treeV3WorkspaceStyles';
  link.rel = 'stylesheet';
  link.href = new URL('./v3-workspace.css', import.meta.url).href;
  document.head.append(link);
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(number) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(number) >= 1000 ? 2 : 2,
  }).format(number);
}

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(digits)}%` : 'Unavailable';
}

function decimal(value, digits = 9) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(number);
}

function integer(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : 'Unavailable';
}

function shorten(value, start = 8, end = 6) {
  const text = String(value || '');
  return text.length > start + end + 3 ? `${text.slice(0, start)}…${text.slice(-end)}` : text;
}

function parseLeadingDecimal(value) {
  const raw = String(value || '').trim();
  const normalized = raw.startsWith('.') ? `0${raw}` : raw;
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setStatus(message, mode = '') {
  const status = document.getElementById('treeV3Status');
  if (!status) return;
  status.textContent = message;
  status.className = `v3-status${mode ? ` ${mode}` : ''}`;
}

function mountWorkspace() {
  const section = document.getElementById('v3');
  if (!section || section.dataset.nativeV3Mounted === 'true') return;
  section.dataset.nativeV3Mounted = 'true';
  section.classList.remove('utility-route-section');
  section.classList.add('v3-native-section');
  section.innerHTML = `
    <div class="v3-heading">
      <div>
        <p class="eyebrow">SuiDex V3 · Native TREE workspace</p>
        <h2 id="v3-title">V3 Concentrated Liquidity</h2>
        <p>Review the verified SUI/TREE pool and your public V3 positions without leaving the TREE Command Center.</p>
      </div>
      <button class="button secondary v3-refresh" id="treeV3Refresh" type="button">Refresh</button>
    </div>

    <div class="v3-summary" aria-label="TREE V3 pool summary">
      <article><span>Pools</span><strong>1</strong></article>
      <article><span>TVL</span><strong id="treeV3Tvl">Loading…</strong></article>
      <article><span>All Positions</span><strong id="treeV3PositionCount">Loading…</strong></article>
    </div>

    <div class="v3-tabs" role="tablist" aria-label="V3 workspace navigation">
      <button class="active" id="treeV3TabPools" type="button" role="tab" aria-selected="true" aria-controls="treeV3PoolsPanel" data-v3-tab="pools">Pools</button>
      <button id="treeV3TabPositions" type="button" role="tab" aria-selected="false" aria-controls="treeV3PositionsPanel" data-v3-tab="positions">My Positions</button>
      <button id="treeV3TabSwap" type="button" role="tab" aria-selected="false" aria-controls="treeV3SwapPanel" data-v3-tab="swap">Swap</button>
    </div>

    <div class="v3-panel active" id="treeV3PoolsPanel" role="tabpanel" aria-labelledby="treeV3TabPools" data-v3-panel="pools">
      <div id="treeV3PoolOverview">
        <article class="v3-pool-card">
          <div class="v3-pool-top">
            <div class="v3-pair">
              <span class="v3-token-pair" aria-hidden="true"><b class="sui">S</b><b class="tree">T</b></span>
              <div><h3>SUI / TREE</h3><div class="v3-badges"><span id="treeV3FeeBadge">0.25% fee</span><span class="reward" id="treeV3RewardBadge">Checking rewards…</span></div></div>
            </div>
            <button class="button primary" id="treeV3Add" type="button">+ Add</button>
          </div>
          <div class="v3-pool-metrics">
            <div><span>TVL</span><strong id="treeV3PoolTvl">—</strong></div>
            <div><span>24H Volume</span><strong id="treeV3Volume">—</strong></div>
            <div><span>APR</span><strong class="positive" id="treeV3Apr">—</strong></div>
            <div><span>24H Fees</span><strong id="treeV3Fees">—</strong></div>
            <div><span>Current Price</span><strong id="treeV3Price">—</strong></div>
            <div><span>Swaps</span><strong id="treeV3Swaps">—</strong></div>
          </div>
          <div class="v3-reward-list" id="treeV3Rewards" hidden></div>
          <div class="v3-pool-footer">
            <button type="button" id="treeV3CopyPool" title="Copy verified pool ID"><code>${shorten(TREE_V3_POOL_ID, 10, 8)}</code> <span>Copy</span></button>
            <span id="treeV3SourceTime">Loading verified pool data…</span>
          </div>
        </article>
        <button class="v3-create-position" id="treeV3CreatePosition" type="button">+ Create SUI/TREE Position</button>
      </div>

      <div class="v3-add-view" id="treeV3AddView" hidden>
        <div class="v3-view-header"><button class="v3-back" id="treeV3BackToPool" type="button">← Pool</button><div><h3>Create SUI/TREE V3 Position</h3><p>Configure a range and preview the pair value. No transaction can be submitted in this read-only phase.</p></div></div>
        <div class="v3-add-grid">
          <article class="v3-form-card">
            <label for="treeV3SuiAmount">SUI reference amount</label>
            <div class="v3-amount-field"><input id="treeV3SuiAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0"><span>SUI</span></div>
            <div class="v3-pair-estimate"><span>Reference TREE value</span><strong id="treeV3TreeEstimate">— TREE</strong></div>
            <p class="v3-fine-print">This is a price reference, not the final concentrated-liquidity deposit ratio. The exact ratio depends on the selected range and must be calculated by the verified transaction builder.</p>
          </article>
          <article class="v3-form-card">
            <span class="v3-label">Select range</span>
            <div class="v3-range-options" role="group" aria-label="V3 range presets">
              <button type="button" data-v3-range="tight">Tight <small>±5%</small></button>
              <button class="active" type="button" data-v3-range="medium">Medium <small>±20%</small></button>
              <button type="button" data-v3-range="wide">Wide <small>±50%</small></button>
              <button type="button" data-v3-range="full">Full <small>0 → ∞</small></button>
              <button type="button" data-v3-range="custom">Custom <small>Set prices</small></button>
            </div>
          </article>
        </div>
        <article class="v3-range-preview">
          <div><span>Minimum price</span><strong id="treeV3MinPrice">—</strong></div>
          <div><span>Current price</span><strong id="treeV3CurrentPrice">—</strong></div>
          <div><span>Maximum price</span><strong id="treeV3MaxPrice">—</strong></div>
          <p id="treeV3RangeState">Load the verified pool price to preview this range.</p>
        </article>
        <div class="v3-custom-range" id="treeV3CustomRange" hidden>
          <label>Minimum SUI per TREE<input id="treeV3CustomMin" type="text" inputmode="decimal" placeholder="0.000020"></label>
          <label>Maximum SUI per TREE<input id="treeV3CustomMax" type="text" inputmode="decimal" placeholder="0.000040"></label>
        </div>
        <button class="button primary v3-disabled-action" id="treeV3BuildPosition" type="button" disabled>Position transaction builder under verification</button>
        <p class="v3-transaction-note">Create, increase, remove, collect, claim, and close actions stay disabled until their exact SuiDex Move calls pass package allowlisting and Sui Mainnet simulation.</p>
      </div>
    </div>

    <div class="v3-panel" id="treeV3PositionsPanel" role="tabpanel" aria-labelledby="treeV3TabPositions" data-v3-panel="positions" hidden>
      <div class="v3-position-heading"><div><h3>My SUI/TREE V3 Positions</h3><p>Public on-chain positions owned by the connected Sui address.</p></div><button class="button secondary" id="treeV3Connect" type="button">Connect Wallet</button></div>
      <div class="v3-position-list" id="treeV3PositionList"><div class="v3-empty">Connect a Sui wallet to inspect its verified SUI/TREE V3 positions.</div></div>
      <p class="v3-position-coverage" id="treeV3PositionCoverage"></p>
    </div>

    <div class="v3-panel" id="treeV3SwapPanel" role="tabpanel" aria-labelledby="treeV3TabSwap" data-v3-panel="swap" hidden>
      <article class="v3-swap-card"><span class="card-icon">↕</span><h3>Native best-route TREE Swap</h3><p>The TREE swap already compares the allowlisted SuiDex V2 and V3 SUI/TREE routes for the exact amount entered. Open it without leaving this site.</p><button class="button primary" id="treeV3OpenSwap" type="button">Open Native Swap</button><small>V3 is selected only when it returns the higher verified output.</small></article>
    </div>

    <p class="v3-status" id="treeV3Status" role="status" aria-live="polite">Loading verified SUI/TREE V3 data…</p>
    <details class="v3-disclosure"><summary>Data sources and current transaction boundary</summary><p>Pool statistics come from SuiDex public pool and analytics pages, the reference price is cross-checked against the allowlisted V3 route, and position ownership is scanned from Sui Mainnet. This workspace is read-only. <a href="${TREE_V3_FALLBACK}" target="_blank" rel="noopener noreferrer">Open the official SuiDex pool only as a fallback ↗</a></p></details>`;

  bindWorkspace();
  loadV3Data(window.playerAddress || null);
}

function showTab(tab) {
  if (!['pools', 'positions', 'swap'].includes(tab)) return;
  state.activeTab = tab;
  document.querySelectorAll('[data-v3-tab]').forEach((button) => {
    const selected = button.dataset.v3Tab === tab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-v3-panel]').forEach((panel) => {
    const selected = panel.dataset.v3Panel === tab;
    panel.hidden = !selected;
    panel.classList.toggle('active', selected);
  });
  if (tab === 'positions') renderPositions();
}

function showPoolView(view) {
  state.activePoolView = view;
  const overview = document.getElementById('treeV3PoolOverview');
  const add = document.getElementById('treeV3AddView');
  if (overview) overview.hidden = view !== 'overview';
  if (add) add.hidden = view !== 'add';
  if (view === 'add') updateRangePreview();
}

function bindWorkspace() {
  document.querySelectorAll('[data-v3-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.v3Tab)));
  document.getElementById('treeV3Refresh')?.addEventListener('click', () => loadV3Data(window.playerAddress || null, true));
  document.getElementById('treeV3Add')?.addEventListener('click', () => showPoolView('add'));
  document.getElementById('treeV3CreatePosition')?.addEventListener('click', () => showPoolView('add'));
  document.getElementById('treeV3BackToPool')?.addEventListener('click', () => showPoolView('overview'));
  document.getElementById('treeV3OpenSwap')?.addEventListener('click', () => { location.hash = '#swap'; });
  document.getElementById('treeV3Connect')?.addEventListener('click', () => window.openWalletManager?.({ mode: window.playerAddress ? 'manage' : 'picker' }));
  document.getElementById('treeV3CopyPool')?.addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(TREE_V3_POOL_ID);
      event.currentTarget.querySelector('span').textContent = 'Copied';
      setTimeout(() => { event.currentTarget.querySelector('span').textContent = 'Copy'; }, 1600);
    } catch {
      setStatus('The browser could not copy the pool ID.', 'error');
    }
  });
  document.getElementById('treeV3SuiAmount')?.addEventListener('input', updatePairEstimate);
  document.querySelectorAll('[data-v3-range]').forEach((button) => button.addEventListener('click', () => {
    state.range = button.dataset.v3Range;
    document.querySelectorAll('[data-v3-range]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    const custom = document.getElementById('treeV3CustomRange');
    if (custom) custom.hidden = state.range !== 'custom';
    updateRangePreview();
  }));
  document.getElementById('treeV3CustomMin')?.addEventListener('input', updateRangePreview);
  document.getElementById('treeV3CustomMax')?.addEventListener('input', updateRangePreview);
}

async function loadV3Data(owner = null, force = false) {
  if (state.loading) return;
  const normalizedOwner = owner || null;
  if (!force && state.data && state.lastOwner === normalizedOwner && Date.now() - state.lastLoadedAt < 20_000) {
    renderAll();
    return;
  }
  state.loading = true;
  setStatus('Loading verified SUI/TREE V3 data…');
  document.getElementById('treeV3Refresh')?.setAttribute('disabled', '');
  try {
    const endpoint = new URL(TREE_V3_API, location.origin);
    if (normalizedOwner) endpoint.searchParams.set('owner', normalizedOwner);
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !['ok', 'partial'].includes(payload.status)) throw new Error(payload.message || 'TREE V3 data is unavailable.');
    state.data = payload;
    state.lastOwner = normalizedOwner;
    state.lastLoadedAt = Date.now();
    renderAll();
    const warningCount = Array.isArray(payload.warnings) ? payload.warnings.length : 0;
    setStatus(
      payload.status === 'ok'
        ? 'Verified SUI/TREE V3 pool and position data loaded.'
        : `V3 data loaded with ${warningCount || 'some'} source warning${warningCount === 1 ? '' : 's'}. Unavailable fields remain clearly labeled.`,
      payload.status === 'ok' ? 'success' : 'warning',
    );
  } catch (error) {
    setStatus(error?.message || 'TREE V3 data is temporarily unavailable.', 'error');
  } finally {
    state.loading = false;
    document.getElementById('treeV3Refresh')?.removeAttribute('disabled');
  }
}

function renderAll() {
  const data = state.data;
  if (!data?.pool) return;
  const pool = data.pool;
  const coverage = pool.positionCoverage;
  setText('#treeV3Tvl', money(pool.tvlUsd));
  setText('#treeV3PoolTvl', money(pool.tvlUsd));
  setText('#treeV3Volume', money(pool.volume24hUsd));
  setText('#treeV3Apr', percent(pool.aprPercent));
  setText('#treeV3Fees', money(pool.fees24hUsd));
  setText('#treeV3Price', Number.isFinite(Number(pool.currentPriceSuiPerTree)) ? `${decimal(pool.currentPriceSuiPerTree, 10)} SUI/TREE` : 'Unavailable');
  setText('#treeV3Swaps', integer(pool.swaps24h));
  setText('#treeV3FeeBadge', `${percent(pool.feePercent, 2)} fee`);
  const count = coverage?.matchedPoolPositions;
  setText('#treeV3PositionCount', Number.isFinite(Number(count)) ? `${coverage.reachedEnd ? '' : '≥'}${integer(count)}` : 'Unavailable');
  const rewardBadge = document.getElementById('treeV3RewardBadge');
  const rewards = Array.isArray(pool.rewards) ? pool.rewards : [];
  if (rewardBadge) rewardBadge.textContent = rewards.length ? 'Reward incentives' : 'Trading fees';
  const rewardList = document.getElementById('treeV3Rewards');
  if (rewardList) {
    rewardList.hidden = !rewards.length;
    rewardList.innerHTML = rewards.map((reward) => `<span><strong>${escapeHtml(reward.token)}</strong>${escapeHtml(reward.amountPerDay)}/day</span>`).join('');
  }
  setText('#treeV3SourceTime', `Updated ${new Date(data.generatedAt).toLocaleString()} · ${data.status === 'ok' ? 'complete public scan' : 'partial source coverage'}`);
  updatePairEstimate();
  updateRangePreview();
  renderPositions();
}

function updatePairEstimate() {
  const input = document.getElementById('treeV3SuiAmount');
  const output = document.getElementById('treeV3TreeEstimate');
  if (!input || !output) return;
  const amount = parseLeadingDecimal(input.value);
  const treePerSui = Number(state.data?.pool?.treePerSui);
  if (amount === null || amount <= 0 || !Number.isFinite(treePerSui) || treePerSui <= 0) {
    output.textContent = '— TREE';
    return;
  }
  output.textContent = `${decimal(amount * treePerSui, 6)} TREE`;
}

function updateRangePreview() {
  const price = Number(state.data?.pool?.currentPriceSuiPerTree);
  const minNode = document.getElementById('treeV3MinPrice');
  const currentNode = document.getElementById('treeV3CurrentPrice');
  const maxNode = document.getElementById('treeV3MaxPrice');
  const stateNode = document.getElementById('treeV3RangeState');
  if (!minNode || !currentNode || !maxNode || !stateNode) return;
  if (!Number.isFinite(price) || price <= 0) {
    minNode.textContent = currentNode.textContent = maxNode.textContent = 'Unavailable';
    stateNode.textContent = 'A verified current price is required before a range can be previewed.';
    return;
  }
  let minimum = 0;
  let maximum = Infinity;
  const widths = { tight: 0.05, medium: 0.20, wide: 0.50 };
  if (widths[state.range]) {
    minimum = price * (1 - widths[state.range]);
    maximum = price * (1 + widths[state.range]);
  } else if (state.range === 'custom') {
    minimum = parseLeadingDecimal(document.getElementById('treeV3CustomMin')?.value);
    maximum = parseLeadingDecimal(document.getElementById('treeV3CustomMax')?.value);
    if (minimum === null || maximum === null || minimum <= 0 || maximum <= minimum) {
      minNode.textContent = document.getElementById('treeV3CustomMin')?.value || 'Set minimum';
      currentNode.textContent = `${decimal(price, 10)} SUI/TREE`;
      maxNode.textContent = document.getElementById('treeV3CustomMax')?.value || 'Set maximum';
      stateNode.textContent = 'Enter a valid custom minimum and maximum price.';
      stateNode.className = 'invalid';
      return;
    }
  }
  minNode.textContent = minimum === 0 ? '0' : `${decimal(minimum, 10)} SUI/TREE`;
  currentNode.textContent = `${decimal(price, 10)} SUI/TREE`;
  maxNode.textContent = maximum === Infinity ? '∞' : `${decimal(maximum, 10)} SUI/TREE`;
  const inRange = price >= minimum && price <= maximum;
  stateNode.textContent = inRange ? 'Current reference price is inside the selected range.' : 'Current reference price is outside the selected range.';
  stateNode.className = inRange ? 'in-range' : 'out-of-range';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPositions() {
  const list = document.getElementById('treeV3PositionList');
  const connect = document.getElementById('treeV3Connect');
  const coverageNode = document.getElementById('treeV3PositionCoverage');
  if (!list || !connect || !coverageNode) return;
  const owner = window.playerAddress || state.data?.wallet?.address || null;
  connect.textContent = owner ? `Manage ${shorten(owner, 6, 4)}` : 'Connect Wallet';
  if (!owner) {
    list.innerHTML = '<div class="v3-empty">Connect Slush, Phantom, or another compatible Sui wallet to inspect its public SUI/TREE V3 positions.</div>';
    coverageNode.textContent = '';
    return;
  }
  if (state.lastOwner !== owner) {
    list.innerHTML = '<div class="v3-empty">Loading this wallet’s V3 positions…</div>';
    coverageNode.textContent = '';
    loadV3Data(owner, true);
    return;
  }
  const positions = Array.isArray(state.data?.wallet?.positions) ? state.data.wallet.positions : [];
  const coverage = state.data?.pool?.positionCoverage;
  if (!positions.length) {
    list.innerHTML = `<div class="v3-empty">No address-owned SUI/TREE V3 positions were found for <code>${escapeHtml(shorten(owner, 10, 8))}</code>${coverage?.reachedEnd ? '.' : ' in the completed portion of the scan.'}</div>`;
  } else {
    list.innerHTML = positions.map((position, index) => `
      <article class="v3-position-card">
        <div class="v3-position-top"><div><span>Position ${index + 1}</span><h4>${escapeHtml(shorten(position.objectId, 10, 8))}</h4></div><span class="v3-range-state ${position.inRange === true ? 'in' : position.inRange === false ? 'out' : 'unknown'}">${position.inRange === true ? 'In range' : position.inRange === false ? 'Out of range' : 'Range unknown'}</span></div>
        <div class="v3-position-metrics">
          <div><span>Liquidity units</span><strong>${escapeHtml(position.liquidityRaw)}</strong></div>
          <div><span>Tick range</span><strong>${escapeHtml(position.tickLower)} → ${escapeHtml(position.tickUpper)}</strong></div>
          <div><span>Current tick</span><strong>${escapeHtml(position.currentTick ?? 'Unavailable')}</strong></div>
          <div><span>Unclaimed TREE field</span><strong>${decimal(position.owedTree, 6)} TREE</strong></div>
          <div><span>Unclaimed SUI field</span><strong>${decimal(position.owedSui, 9)} SUI</strong></div>
        </div>
        <div class="v3-position-actions" aria-label="Position actions under verification">
          <button type="button" disabled>Increase</button><button type="button" disabled>Remove</button><button type="button" disabled>Collect Fees</button><button type="button" disabled>Claim Rewards</button><button type="button" disabled>Close</button>
        </div>
      </article>`).join('');
  }
  coverageNode.textContent = coverage
    ? `${coverage.reachedEnd ? 'Complete' : 'Incomplete'} public scan · ${integer(coverage.matchedPoolPositions)} SUI/TREE positions · ${integer(coverage.uniqueOwners)} unique address owners · ${integer(coverage.pagesScanned)} page${coverage.pagesScanned === 1 ? '' : 's'}`
    : 'Position coverage is temporarily unavailable.';
}

window.addEventListener('tree:wallet-changed', (event) => {
  const owner = event.detail?.status === 'connected' ? event.detail.address : null;
  state.lastOwner = null;
  loadV3Data(owner, true);
});

window.addEventListener('tree:panel-shown', (event) => {
  if (event.detail?.panelId === 'v3') loadV3Data(window.playerAddress || null);
});

injectStyles();
mountWorkspace();

window.TREE_V3_WORKSPACE = Object.freeze({
  poolId: TREE_V3_POOL_ID,
  showTab,
  refresh: () => loadV3Data(window.playerAddress || null, true),
  get activeTab() { return state.activeTab; },
  get transactionMode() { return 'read-only'; },
});
