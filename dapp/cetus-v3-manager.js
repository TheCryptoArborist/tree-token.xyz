import {
  CETUS_TREE_POOL_ID, CETUS_TREE_COIN_TYPE, CETUS_SUI_COIN_TYPE, CETUS_TREE_DECIMALS, CETUS_SUI_DECIMALS,
  CETUS_MIN_GAS_RESERVE_RAW, isCetusV3TestHost, parseCetusAmount, formatCetusAmount, cetusPriceFromTick,
  cetusRangeFromPreset, validateCetusTreePool, validateCetusOpenTransaction, cetusSimulationSucceeded,
  cetusFailureMessage, extractCetusOpenSimulation, validateCetusIncreaseTransaction, validateCetusCollectTransaction,
  validateCetusRemoveTransaction, validateCetusCloseTransaction, extractCetusIncreaseSimulation,
  extractCetusFeeSimulation, extractCetusRemoveSimulation, extractCetusCloseSimulation, minimumAfterCetusSlippage,
  normalizeAddress, normalizeCoinType, validateCetusBatchCollectTransaction, extractCetusBatchFeeSimulation,
  validateCetusCompoundTransaction, extractCetusCompoundSimulation,
} from './cetus-v3-core.js';
import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import { confirmTransaction } from './transaction-review.js';

const SDK_URL = 'https://esm.run/@cetusprotocol/sui-clmm-sdk@1.4.7';
const ENABLED = isCetusV3TestHost(location.hostname);
const state = { sdk: null, pool: null, calculation: null, submitting: false, venueBusy: false, quoteTimer: null, quoteSequence: 0, positions: new Map(), busyPositions: new Set() };

function elements() {
  return {
    panel: document.querySelector('[data-v3-native-manager-panel="cetus"]'),
    sui: document.getElementById('cetusV3SuiAmount'), tree: document.getElementById('cetusV3TreeAmount'),
    suiMax: document.getElementById('cetusV3SuiMax'), suiBalance: document.getElementById('cetusV3SuiBalance'),
    range: document.getElementById('cetusV3Range'), rangeText: document.getElementById('cetusV3RangeText'),
    action: document.getElementById('cetusV3AddAction'), status: document.getElementById('cetusV3AddStatus'),
    positions: document.getElementById('cetusV3Positions'), load: document.getElementById('cetusV3LoadPositions'),
    positionStatus: document.getElementById('cetusV3PositionStatus'),
    claimAll: document.getElementById('cetusV3ClaimAllFees'), compound: document.getElementById('cetusV3CompoundFees'),
  };
}

function connectedAddress() {
  const value = String(window.playerAddress || '').toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(value) ? value : null;
}

function setStatus(message, kind = '') {
  const target = elements().status;
  if (!target) return;
  target.textContent = message;
  target.className = `v3-status${kind ? ` ${kind}` : ''}`;
}

async function readSuiBalance(owner) {
  const result = await (await client()).core.getBalance({ owner, coinType: CETUS_SUI_COIN_TYPE });
  return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0);
}

async function refreshAddBalance() {
  const ui = elements();
  if (!ui.suiBalance) return;
  const owner = connectedAddress();
  if (!owner) { ui.suiBalance.textContent = 'Balance —'; return; }
  try {
    ui.suiBalance.textContent = `Balance ${formatCetusAmount(await readSuiBalance(owner), CETUS_SUI_DECIMALS, 4)} SUI`;
  } catch { ui.suiBalance.textContent = 'Balance unavailable'; }
}

async function fillMaxSui(input, report) {
  const owner = connectedAddress();
  if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; }
  const balanceRaw = await readSuiBalance(owner);
  const spendableRaw = balanceRaw > CETUS_MIN_GAS_RESERVE_RAW ? balanceRaw - CETUS_MIN_GAS_RESERVE_RAW : 0n;
  if (spendableRaw <= 0n) { report('At least 0.05 SUI must remain available for gas.', 'error'); return; }
  input.value = formatCetusAmount(spendableRaw, CETUS_SUI_DECIMALS, CETUS_SUI_DECIMALS);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  report(`MAX selected · ${formatCetusAmount(spendableRaw, CETUS_SUI_DECIMALS, 4)} SUI available after reserving 0.05 SUI for gas.`, 'ok');
}

async function client() {
  if (typeof window.initSuiClient !== 'function') throw new Error('The Sui Mainnet client is unavailable.');
  return window.initSuiClient();
}

async function sdkFor(owner) {
  const suiClient = await client();
  if (!state.sdk) {
    const { CetusClmmSDK } = await import(SDK_URL);
    state.sdk = CetusClmmSDK.createSDK({ env: 'mainnet', sui_client: suiClient });
  }
  state.sdk.setSenderAddress(owner);
  return state.sdk;
}

async function verifiedPool(sdk, refresh = true) {
  const pool = validateCetusTreePool(await sdk.Pool.getPool(CETUS_TREE_POOL_ID, refresh));
  state.pool = pool;
  return pool;
}

function quoteKey() {
  const ui = elements();
  return `${ui.sui?.value || ''}|${ui.range?.value || ''}|${connectedAddress() || ''}`;
}

async function calculateQuote() {
  const ui = elements();
  if (!ui.action || state.submitting) return;
  const sequence = ++state.quoteSequence;
  state.calculation = null;
  ui.tree.value = '';
  ui.rangeText.textContent = '—';
  const owner = connectedAddress();
  if (!owner) {
    ui.action.disabled = false;
    ui.action.textContent = 'Connect Wallet';
    setStatus('Connect a Sui wallet to build a verified Cetus position.');
    return;
  }
  let suiRaw;
  try { suiRaw = parseCetusAmount(ui.sui.value, CETUS_SUI_DECIMALS, 'SUI'); }
  catch {
    ui.action.disabled = true;
    ui.action.textContent = 'Enter a SUI amount';
    setStatus('Enter the exact SUI amount you want to deposit. TREE will be calculated automatically.');
    return;
  }
  ui.action.disabled = true;
  ui.action.textContent = 'Calculating…';
  setStatus('Reading the verified Cetus pool and calculating the paired TREE amount…', 'warning');
  try {
    const sdk = await sdkFor(owner);
    const pool = await verifiedPool(sdk, true);
    const range = cetusRangeFromPreset(cetusPriceFromTick(pool.current_tick_index), ui.range.value);
    const addMode = {
      is_full_range: false, min_price: String(range.minPrice), max_price: String(range.maxPrice),
      coin_decimals_a: CETUS_TREE_DECIMALS, coin_decimals_b: CETUS_SUI_DECIMALS, price_base_coin: 'coin_a',
    };
    const result = await sdk.Position.calculateAddLiquidityResultWithPrice({
      pool_id: CETUS_TREE_POOL_ID, coin_amount: suiRaw.toString(), fix_amount_a: false,
      slippage: 0.01, refresh_pool_price: true, add_mode_params: addMode,
    });
    if (sequence !== state.quoteSequence) return;
    if (BigInt(result.coin_amount_a) <= 0n || BigInt(result.coin_amount_b) !== suiRaw) throw new Error('Cetus could not calculate a usable two-token position for this range.');
    state.calculation = { owner, suiRaw, range, addMode, result, key: quoteKey() };
    ui.tree.value = formatCetusAmount(result.coin_amount_a, CETUS_TREE_DECIMALS, 6);
    ui.rangeText.textContent = `${range.minPrice.toPrecision(7)}–${range.maxPrice.toPrecision(7)} SUI / TREE`;
    ui.action.disabled = false;
    ui.action.textContent = 'Review Cetus Add Liquidity';
    setStatus(`Cetus requires about ${formatCetusAmount(result.coin_amount_a, CETUS_TREE_DECIMALS, 6)} TREE for this ${ui.range.options[ui.range.selectedIndex].text} range.`, 'ok');
  } catch (error) {
    if (sequence !== state.quoteSequence) return;
    ui.action.disabled = true;
    ui.action.textContent = 'Quote unavailable';
    setStatus(error?.message || String(error), 'error');
  }
}

function scheduleQuote() { clearTimeout(state.quoteTimer); state.quoteTimer = setTimeout(calculateQuote, 350); }

async function simulate(suiClient, transaction) {
  const bytes = await transaction.build({ client: suiClient });
  return suiClient.core.simulateTransaction({ transaction: bytes, include: { effects: true, events: true, balanceChanges: true } });
}

function digestFrom(result) { return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionBlockDigest || null; }
async function waitForFinality(suiClient, digest) {
  if (!digest) throw new Error('The wallet returned no transaction digest.');
  return suiClient.core.waitForTransaction({ digest, timeout: 60_000, include: { effects: true, events: true, balanceChanges: true } });
}

async function addLiquidity() {
  const ui = elements();
  if (!ENABLED || state.submitting) return;
  const owner = connectedAddress();
  if (!owner) {
    await window.openWalletManager?.({ mode: 'picker' });
    await calculateQuote();
    return;
  }
  if (!state.calculation || state.calculation.key !== quoteKey() || state.calculation.owner !== owner) {
    await calculateQuote();
    if (!state.calculation || state.calculation.key !== quoteKey()) return;
  }
  state.submitting = true;
  ui.action.disabled = true;
  try {
    const suiClient = await client();
    const sdk = await sdkFor(owner);
    await verifiedPool(sdk, true);
    const { suiRaw, result, addMode } = state.calculation;
    const maxTreeRaw = BigInt(result.coin_amount_limit_a);
    const [suiBalanceResult, treeBalanceResult] = await Promise.all([
      suiClient.core.getBalance({ owner, coinType: CETUS_SUI_COIN_TYPE }),
      suiClient.core.getBalance({ owner, coinType: CETUS_TREE_COIN_TYPE }),
    ]);
    const suiBalance = BigInt(suiBalanceResult?.balance?.balance ?? suiBalanceResult?.balance ?? 0);
    const treeBalance = BigInt(treeBalanceResult?.balance?.balance ?? treeBalanceResult?.balance ?? 0);
    if (suiBalance < suiRaw + CETUS_MIN_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI beyond the deposit amount for gas.');
    if (treeBalance < maxTreeRaw) throw new Error(`This range needs up to ${formatCetusAmount(maxTreeRaw, CETUS_TREE_DECIMALS, 6)} TREE.`);
    const build = async () => {
      const transaction = await sdk.Position.createAddLiquidityFixCoinWithPricePayload({ pool_id: CETUS_TREE_POOL_ID, calculate_result: result, add_mode_params: addMode });
      transaction.setSenderIfNotSet?.(owner);
      return validateCetusOpenTransaction(transaction, { owner, maxTreeRaw, exactSuiRaw: suiRaw });
    };
    setStatus('Simulation 1 of 2: verifying the pool, coin types, range, and maximum amounts…', 'warning');
    const firstTransaction = await build();
    extractCetusOpenSimulation(await simulate(suiClient, firstTransaction), { maxTreeRaw, exactSuiRaw: suiRaw });
    setStatus('Simulation 2 of 2: rebuilding and verifying the exact wallet transaction…', 'warning');
    const finalTransaction = await build();
    const verified = extractCetusOpenSimulation(await simulate(suiClient, finalTransaction), { maxTreeRaw, exactSuiRaw: suiRaw });
    const approved = await confirmTransaction([
      'Create this Cetus SUI / TREE V3 position?', '',
      `SUI deposited: ${formatCetusAmount(verified.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
      `TREE deposited: ${formatCetusAmount(verified.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
      `Maximum TREE authorized: ${formatCetusAmount(maxTreeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
      `Price range: ${ui.rangeText.textContent}`, 'Slippage protection: 1.00%',
      'Venue: Verified Cetus TREE / SUI 0.25% pool', '',
      'The exact transaction passed two Sui Mainnet simulations. No swap is included.',
    ].join('\n'), { title: 'TEST DApp · Add Cetus Liquidity' });
    if (!approved) { setStatus('Cetus Add Liquidity cancelled before wallet approval.'); return; }
    setStatus('Review the verified Cetus transaction in your wallet…', 'warning');
    if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
    const digest = digestFrom(await window.signAndExecuteTransactionBlock(finalTransaction));
    setStatus('Wallet approved. Waiting for Sui finality…', 'warning');
    const finalized = await waitForFinality(suiClient, digest);
    if (!cetusSimulationSucceeded(finalized)) throw new Error(cetusFailureMessage(finalized, 'Cetus Add Liquidity did not finalize successfully.'));
    setStatus(`Cetus position created successfully. Transaction ${digest.slice(0, 12)}…`, 'ok');
    state.calculation = null;
    ui.sui.value = '';
    ui.tree.value = '';
    await loadPositions();
  } catch (error) {
    const message = error?.message || String(error);
    setStatus(message, /reject|cancel|denied/i.test(message) ? '' : 'error');
  } finally {
    state.submitting = false;
    ui.action.disabled = !state.calculation;
    ui.action.textContent = state.calculation ? 'Review Cetus Add Liquidity' : 'Enter a SUI amount';
  }
}

function positionPrice(tick) { try { return cetusPriceFromTick(tick).toPrecision(7); } catch { return '—'; } }
function updatePositionSummary(count) {
  const summary = document.getElementById('v3SummaryPositions');
  if (!summary) return;
  summary.dataset.cetusPositions = String(count);
  if (connectedAddress()) summary.textContent = String(Number(summary.dataset.suidexPositions || 0) + count + Number(summary.dataset.turbosPositions || 0));
}
function renderPositions(positions, feesById = {}) {
  const ui = elements();
  state.positions = new Map(positions.map((position) => [position.pos_object_id, { ...position, fees: feesById[position.pos_object_id] || {} }]));
  const claimable = [...state.positions.values()].filter((position) => BigInt(position.fees.fee_owned_a ?? position.fees.feeOwedA ?? 0) > 0n || BigInt(position.fees.fee_owned_b ?? position.fees.feeOwedB ?? 0) > 0n);
  if (ui.claimAll) ui.claimAll.disabled = !claimable.length || state.venueBusy;
  if (ui.compound) ui.compound.disabled = !claimable.some((position) => BigInt(position.fees.fee_owned_a ?? position.fees.feeOwedA ?? 0) > 0n && BigInt(position.fees.fee_owned_b ?? position.fees.feeOwedB ?? 0) > 0n) || state.venueBusy;
  updatePositionSummary(positions.length);
  if (!positions.length) {
    ui.positions.innerHTML = '<article class="v3-cetus-position-empty"><strong>No Cetus positions found</strong><span>This wallet does not currently own a position in the verified TREE/SUI Cetus pool.</span></article>';
    return;
  }
  ui.positions.innerHTML = positions.map((position) => {
    const fees = feesById[position.pos_object_id] || {};
    const treeFee = fees.fee_owned_a ?? fees.feeOwedA ?? '0';
    const suiFee = fees.fee_owned_b ?? fees.feeOwedB ?? '0';
    const currentTick = Number(state.pool?.current_tick_index);
    const inRange = currentTick >= Number(position.tick_lower_index) && currentTick < Number(position.tick_upper_index);
    return `<article class="v3-cetus-position-card" data-cetus-position-card="${position.pos_object_id}"><div class="v3-cetus-position-head"><div><span>CETUS POSITION</span><strong>${position.pos_object_id.slice(0, 9)}…${position.pos_object_id.slice(-6)}</strong></div><b class="${inRange ? 'in-range' : 'out-range'}">${inRange ? 'In range' : 'Out of range'}</b></div><div class="v3-cetus-position-metrics"><div><span>Range</span><strong>${positionPrice(position.tick_lower_index)}–${positionPrice(position.tick_upper_index)}</strong></div><div><span>Liquidity units</span><strong>${Number(position.liquidity).toLocaleString('en-US')}</strong></div><div><span>Pending TREE fees</span><strong>${formatCetusAmount(treeFee, CETUS_TREE_DECIMALS, 6)}</strong></div><div><span>Pending SUI fees</span><strong>${formatCetusAmount(suiFee, CETUS_SUI_DECIMALS, 9)}</strong></div></div><div class="v3-cetus-position-actions"><button type="button" data-cetus-position-action="add" data-position-id="${position.pos_object_id}">Add</button><button type="button" data-cetus-position-action="claim" data-position-id="${position.pos_object_id}">Claim Fees</button><button type="button" data-cetus-position-action="remove" data-position-id="${position.pos_object_id}">Remove</button><button class="danger" type="button" data-cetus-position-action="close" data-position-id="${position.pos_object_id}">Close</button></div><div class="v3-cetus-action-panel" data-cetus-action-panel="${position.pos_object_id}" hidden></div></article>`;
  }).join('');
}

function actionPanel(positionId) {
  return [...document.querySelectorAll('[data-cetus-action-panel]')].find((panel) => panel.dataset.cetusActionPanel === positionId) || null;
}

function renderActionPanel(positionId, action) {
  const panel = actionPanel(positionId); if (!panel) return;
  const content = action === 'add'
    ? '<strong>Add to this position</strong><p>Enter an exact SUI amount. The paired TREE maximum is calculated from this position’s existing range.</p><div class="v3-form-grid"><label class="v3-field"><span>SUI amount</span><span class="v3-sui-amount-input"><input data-cetus-action-sui inputmode="decimal" autocomplete="off" placeholder="0.0"><button type="button" data-cetus-action-sui-max>MAX</button></span><small class="v3-gas-note">MAX keeps 0.05 SUI for gas.</small></label></div><button class="button primary" type="button" data-cetus-position-submit="add">Calculate &amp; Review Add</button>'
    : action === 'claim'
      ? '<strong>Claim trading fees</strong><p>Collect every currently available TREE and SUI trading fee from this position. This pool has no incentive tokens configured.</p><button class="button primary" type="button" data-cetus-position-submit="claim">Simulate &amp; Review Claim</button>'
      : action === 'remove'
        ? '<strong>Remove liquidity</strong><p>Withdraw part of the position while keeping the position NFT open. Current trading fees are collected in the same transaction.</p><label class="v3-field"><span>Amount to remove</span><select data-cetus-remove-percent><option value="25">25%</option><option value="50" selected>50%</option><option value="75">75%</option></select></label><button class="button primary" type="button" data-cetus-position-submit="remove">Simulate &amp; Review Removal</button>'
        : '<strong>Close this position</strong><p>This atomically withdraws all liquidity, claims all TREE and SUI fees, and deletes the empty Cetus position NFT.</p><button class="button danger" type="button" data-cetus-position-submit="close">Simulate &amp; Review Close</button>';
  panel.dataset.cetusAction = action;
  panel.innerHTML = `${content}<p class="v3-status" role="status" aria-live="polite" data-cetus-action-status>No wallet request occurs until two Mainnet simulations pass.</p>`;
  panel.hidden = false;
}

function setPositionStatus(positionId, message, kind = '') {
  const target = actionPanel(positionId)?.querySelector('[data-cetus-action-status]'); if (!target) return;
  target.textContent = message; target.className = `v3-status${kind ? ` ${kind}` : ''}`;
}

async function verifiedPosition(owner, positionId) {
  const sdk = await sdkFor(owner); const pool = await verifiedPool(sdk, true);
  const ownedPositions = await sdk.Position.getPositionList(owner, [CETUS_TREE_POOL_ID], false);
  const ownedPosition = ownedPositions.find((item) => normalizeAddress(item?.pos_object_id) === normalizeAddress(positionId));
  if (!ownedPosition) throw new Error(`Position ${positionId.slice(0, 9)}…${positionId.slice(-6)} is not directly owned by connected wallet ${owner.slice(0, 8)}…${owner.slice(-6)}.`);
  const position = await sdk.Position.getPositionById(positionId, false);
  const wrongPosition = normalizeAddress(position?.pos_object_id) !== normalizeAddress(positionId);
  const wrongPool = normalizeAddress(position?.pool) !== normalizeAddress(CETUS_TREE_POOL_ID);
  const wrongCoinA = position?.coin_type_a
    && normalizeCoinType(position.coin_type_a) !== normalizeCoinType(CETUS_TREE_COIN_TYPE);
  const wrongCoinB = position?.coin_type_b
    && normalizeCoinType(position.coin_type_b) !== normalizeCoinType(CETUS_SUI_COIN_TYPE);
  if (wrongPosition || wrongPool || wrongCoinA || wrongCoinB || BigInt(position?.liquidity || 0) < 0n) {
    throw new Error('This position no longer matches the verified Cetus TREE/SUI pool.');
  }
  return { sdk, pool, position };
}

async function requireGas(owner) {
  const result = await (await client()).core.getBalance({ owner, coinType: CETUS_SUI_COIN_TYPE });
  const balance = BigInt(result?.balance?.balance ?? result?.balance ?? 0);
  if (balance < CETUS_MIN_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for transaction gas.');
}

async function submitPositionTransaction(transaction, positionId, verifyFinal) {
  setPositionStatus(positionId, 'Review the verified Cetus transaction in your wallet…', 'warning');
  const digest = digestFrom(await window.signAndExecuteTransactionBlock(transaction));
  setPositionStatus(positionId, 'Wallet approved. Waiting for Sui finality…', 'warning');
  const final = await waitForFinality(await client(), digest); verifyFinal(final);
  state.sdk = null;
  setPositionStatus(positionId, `Confirmed on Sui Mainnet · ${digest.slice(0, 12)}…`, 'ok');
  await loadPositions();
}

function addLiquidityParams(position, result, suiRaw) {
  return {
    pool_id: CETUS_TREE_POOL_ID,
    coin_type_a: CETUS_TREE_COIN_TYPE,
    coin_type_b: CETUS_SUI_COIN_TYPE,
    tick_lower: Number(position.tick_lower_index),
    tick_upper: Number(position.tick_upper_index),
    fix_amount_a: false,
    amount_a: result.coin_amount_limit_a,
    amount_b: suiRaw.toString(),
    slippage: 0,
    is_open: false,
    pos_id: position.pos_object_id,
    collect_fee: false,
    rewarder_coin_types: [],
  };
}

async function runIncrease({ owner, positionId, sdk, position, panel }) {
  const input = panel?.querySelector('[data-cetus-action-sui]');
  const suiRaw = parseCetusAmount(input?.value, CETUS_SUI_DECIMALS, 'SUI');
  const [suiBalanceResult, treeBalanceResult] = await Promise.all([
    (await client()).core.getBalance({ owner, coinType: CETUS_SUI_COIN_TYPE }),
    (await client()).core.getBalance({ owner, coinType: CETUS_TREE_COIN_TYPE }),
  ]);
  setPositionStatus(positionId, 'Calculating the exact TREE pair for this position’s existing range…', 'warning');
  const addMode = {
    is_full_range: false,
    min_price: String(cetusPriceFromTick(position.tick_lower_index)),
    max_price: String(cetusPriceFromTick(position.tick_upper_index)),
    coin_decimals_a: CETUS_TREE_DECIMALS,
    coin_decimals_b: CETUS_SUI_DECIMALS,
    price_base_coin: 'coin_a',
  };
  const result = await sdk.Position.calculateAddLiquidityResultWithPrice({
    pool_id: CETUS_TREE_POOL_ID,
    coin_amount: suiRaw.toString(),
    fix_amount_a: false,
    slippage: 0.01,
    refresh_pool_price: true,
    add_mode_params: addMode,
  });
  const maxTreeRaw = BigInt(result.coin_amount_limit_a);
  const suiBalance = BigInt(suiBalanceResult?.balance?.balance ?? suiBalanceResult?.balance ?? 0);
  const treeBalance = BigInt(treeBalanceResult?.balance?.balance ?? treeBalanceResult?.balance ?? 0);
  if (suiBalance < suiRaw + CETUS_MIN_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI beyond the deposit amount for gas.');
  if (treeBalance < maxTreeRaw) throw new Error(`This position needs up to ${formatCetusAmount(maxTreeRaw, CETUS_TREE_DECIMALS, 6)} TREE.`);
  const build = async () => {
    const transaction = await sdk.Position.createAddLiquidityFixTokenPayload(addLiquidityParams(position, result, suiRaw));
    transaction.setSenderIfNotSet?.(owner);
    return validateCetusIncreaseTransaction(transaction, { owner, positionId, maxTreeRaw, exactSuiRaw: suiRaw });
  };
  setPositionStatus(positionId, 'Simulation 1 of 2: verifying this exact position increase…', 'warning');
  extractCetusIncreaseSimulation(await simulate(await client(), await build()), { positionId, maxTreeRaw, exactSuiRaw: suiRaw });
  setPositionStatus(positionId, 'Simulation 2 of 2: rebuilding the protected wallet transaction…', 'warning');
  const finalTransaction = await build();
  const verified = extractCetusIncreaseSimulation(await simulate(await client(), finalTransaction), { positionId, maxTreeRaw, exactSuiRaw: suiRaw });
  const approved = await confirmTransaction([
    'Add liquidity to this Cetus position?', '',
    `Position: ${positionId.slice(0, 12)}…${positionId.slice(-8)}`,
    `SUI deposited: ${formatCetusAmount(verified.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
    `TREE deposited: ${formatCetusAmount(verified.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `Maximum TREE authorized: ${formatCetusAmount(maxTreeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `Existing range: ${positionPrice(position.tick_lower_index)}–${positionPrice(position.tick_upper_index)} SUI / TREE`,
    'Slippage protection: 1.00%', '',
    'The exact transaction passed two Sui Mainnet simulations. No swap is included.',
  ].join('\n'), { title: 'TEST DApp · Add to Cetus Position' });
  if (!approved) { setPositionStatus(positionId, 'Cetus position increase cancelled before wallet approval.'); return; }
  await submitPositionTransaction(finalTransaction, positionId, (final) => extractCetusIncreaseSimulation(final, { positionId, maxTreeRaw, exactSuiRaw: suiRaw }));
}

async function runClaim({ owner, positionId, sdk }) {
  const build = async () => {
    const transaction = await sdk.Position.collectFeePayload({
      pool_id: CETUS_TREE_POOL_ID, pos_id: positionId,
      coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
    });
    transaction.setSenderIfNotSet?.(owner);
    return validateCetusCollectTransaction(transaction, { owner, positionId });
  };
  setPositionStatus(positionId, 'Simulation 1 of 2: reading current TREE and SUI fees…', 'warning');
  const first = extractCetusFeeSimulation(await simulate(await client(), await build()), positionId);
  if (first.treeRaw === 0n && first.suiRaw === 0n) {
    setPositionStatus(positionId, 'No TREE or SUI fees are currently available. No wallet request was opened.');
    return;
  }
  setPositionStatus(positionId, 'Simulation 2 of 2: rebuilding the exact fee claim…', 'warning');
  const finalTransaction = await build();
  const verified = extractCetusFeeSimulation(await simulate(await client(), finalTransaction), positionId);
  const approved = await confirmTransaction([
    'Claim all available Cetus trading fees?', '',
    `TREE fees: ${formatCetusAmount(verified.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `SUI fees: ${formatCetusAmount(verified.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
    `Position: ${positionId.slice(0, 12)}…${positionId.slice(-8)}`, '',
    'The position liquidity and range do not change.',
    'The exact transaction passed two Sui Mainnet simulations.',
  ].join('\n'), { title: 'TEST DApp · Claim Cetus Fees' });
  if (!approved) { setPositionStatus(positionId, 'Cetus fee claim cancelled before wallet approval.'); return; }
  await submitPositionTransaction(finalTransaction, positionId, (final) => extractCetusFeeSimulation(final, positionId));
}

function removeParams(positionId, liquidityRaw, minTreeRaw, minSuiRaw) {
  return {
    pool_id: CETUS_TREE_POOL_ID,
    pos_id: positionId,
    coin_type_a: CETUS_TREE_COIN_TYPE,
    coin_type_b: CETUS_SUI_COIN_TYPE,
    delta_liquidity: liquidityRaw.toString(),
    min_amount_a: minTreeRaw.toString(),
    min_amount_b: minSuiRaw.toString(),
    collect_fee: true,
    rewarder_coin_types: [],
  };
}

async function buildProtectedRemoval({ owner, positionId, sdk, liquidityRaw, close = false }) {
  const make = async (minTreeRaw, minSuiRaw) => {
    const params = removeParams(positionId, liquidityRaw, minTreeRaw, minSuiRaw);
    const transaction = close
      ? await sdk.Position.closePositionPayload(params)
      : await sdk.Position.removeLiquidityPayload(params);
    transaction.setSenderIfNotSet?.(owner);
    return close
      ? validateCetusCloseTransaction(transaction, { owner, positionId })
      : validateCetusRemoveTransaction(transaction, { owner, positionId });
  };
  const preliminary = await make(0n, 0n);
  const firstResult = await simulate(await client(), preliminary);
  const first = close
    ? extractCetusCloseSimulation(firstResult, { positionId, expectedLiquidityRaw: liquidityRaw })
    : extractCetusRemoveSimulation(firstResult, { positionId, expectedLiquidityRaw: liquidityRaw });
  const minTreeRaw = minimumAfterCetusSlippage(first.treeRaw);
  const minSuiRaw = minimumAfterCetusSlippage(first.suiRaw);
  const transaction = await make(minTreeRaw, minSuiRaw);
  const finalResult = await simulate(await client(), transaction);
  const removed = close
    ? extractCetusCloseSimulation(finalResult, { positionId, expectedLiquidityRaw: liquidityRaw, minTreeRaw, minSuiRaw })
    : extractCetusRemoveSimulation(finalResult, { positionId, expectedLiquidityRaw: liquidityRaw, minTreeRaw, minSuiRaw });
  const fees = extractCetusFeeSimulation(finalResult, positionId);
  return { transaction, removed, fees, minTreeRaw, minSuiRaw };
}

async function runRemove({ owner, positionId, sdk, position, panel }) {
  const percent = Number(panel?.querySelector('[data-cetus-remove-percent]')?.value);
  if (![25, 50, 75].includes(percent)) throw new Error('Select a supported removal percentage.');
  const liquidityRaw = BigInt(position.liquidity) * BigInt(percent) / 100n;
  if (liquidityRaw <= 0n) throw new Error('This position has no removable liquidity.');
  setPositionStatus(positionId, `Simulation 1 of 2: estimating a protected ${percent}% withdrawal…`, 'warning');
  const result = await buildProtectedRemoval({ owner, positionId, sdk, liquidityRaw });
  setPositionStatus(positionId, 'Simulation 2 of 2 passed. Review the protected withdrawal…', 'warning');
  const approved = await confirmTransaction([
    `Remove ${percent}% of this Cetus position?`, '',
    `Estimated TREE principal: ${formatCetusAmount(result.removed.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `Estimated SUI principal: ${formatCetusAmount(result.removed.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
    `TREE fees also claimed: ${formatCetusAmount(result.fees.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `SUI fees also claimed: ${formatCetusAmount(result.fees.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
    `Minimum TREE principal: ${formatCetusAmount(result.minTreeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `Minimum SUI principal: ${formatCetusAmount(result.minSuiRaw, CETUS_SUI_DECIMALS, 9)} SUI`, '',
    'The position NFT remains open with the remaining liquidity.',
    'The protected transaction passed two Sui Mainnet simulations.',
  ].join('\n'), { title: 'TEST DApp · Remove Cetus Liquidity' });
  if (!approved) { setPositionStatus(positionId, 'Cetus liquidity removal cancelled before wallet approval.'); return; }
  await submitPositionTransaction(result.transaction, positionId, (final) => {
    extractCetusRemoveSimulation(final, { positionId, expectedLiquidityRaw: liquidityRaw, minTreeRaw: result.minTreeRaw, minSuiRaw: result.minSuiRaw });
    extractCetusFeeSimulation(final, positionId);
  });
}

async function runClose({ owner, positionId, sdk, position }) {
  const liquidityRaw = BigInt(position.liquidity);
  if (liquidityRaw <= 0n) throw new Error('This position has no liquidity to close.');
  setPositionStatus(positionId, 'Simulation 1 of 2: estimating the complete withdrawal and close…', 'warning');
  const result = await buildProtectedRemoval({ owner, positionId, sdk, liquidityRaw, close: true });
  setPositionStatus(positionId, 'Simulation 2 of 2 passed. Review the complete close…', 'warning');
  const approved = await confirmTransaction([
    'Close this Cetus position completely?', '',
    `Estimated TREE principal: ${formatCetusAmount(result.removed.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `Estimated SUI principal: ${formatCetusAmount(result.removed.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
    `TREE fees also claimed: ${formatCetusAmount(result.fees.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `SUI fees also claimed: ${formatCetusAmount(result.fees.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
    `Minimum TREE principal: ${formatCetusAmount(result.minTreeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
    `Minimum SUI principal: ${formatCetusAmount(result.minSuiRaw, CETUS_SUI_DECIMALS, 9)} SUI`, '',
    'This withdraws all liquidity, claims all fees, and deletes the empty position NFT.',
    'The protected transaction passed two Sui Mainnet simulations.',
  ].join('\n'), { title: 'TEST DApp · Close Cetus Position' });
  if (!approved) { setPositionStatus(positionId, 'Cetus position close cancelled before wallet approval.'); return; }
  await submitPositionTransaction(result.transaction, positionId, (final) => {
    extractCetusCloseSimulation(final, { positionId, expectedLiquidityRaw: liquidityRaw, minTreeRaw: result.minTreeRaw, minSuiRaw: result.minSuiRaw });
    extractCetusFeeSimulation(final, positionId);
  });
}

async function runPositionAction(positionId, action) {
  if (state.busyPositions.has(positionId)) return;
  const owner = connectedAddress(); if (!owner) throw new Error('Connect the wallet that owns this Cetus position.');
  const panel = actionPanel(positionId); const button = panel?.querySelector('[data-cetus-position-submit]');
  state.busyPositions.add(positionId); if (button) button.disabled = true;
  try {
    if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
    await requireGas(owner);
    const { sdk, pool, position } = await verifiedPosition(owner, positionId);
    if (action === 'add') await runIncrease({ owner, positionId, sdk, pool, position, panel });
    else if (action === 'claim') await runClaim({ owner, positionId, sdk, pool, position });
    else if (action === 'remove') await runRemove({ owner, positionId, sdk, pool, position, panel });
    else if (action === 'close') await runClose({ owner, positionId, sdk, pool, position });
  } catch (error) {
    const message = error?.message || String(error); setPositionStatus(positionId, message, /reject|cancel|denied/i.test(message) ? '' : 'error');
  } finally { state.busyPositions.delete(positionId); if (button) button.disabled = false; }
}

function feeAmounts(position) {
  return {
    treeRaw: BigInt(position?.fees?.fee_owned_a ?? position?.fees?.feeOwedA ?? 0),
    suiRaw: BigInt(position?.fees?.fee_owned_b ?? position?.fees?.feeOwedB ?? 0),
  };
}

function setVenueBusy(busy) {
  state.venueBusy = busy;
  const ui = elements();
  if (ui.claimAll) ui.claimAll.disabled = busy || ![...state.positions.values()].some((position) => { const fees = feeAmounts(position); return fees.treeRaw > 0n || fees.suiRaw > 0n; });
  if (ui.compound) ui.compound.disabled = busy || ![...state.positions.values()].some((position) => { const fees = feeAmounts(position); return fees.treeRaw > 0n && fees.suiRaw > 0n; });
}

async function claimAllCetusFees() {
  if (state.venueBusy) return;
  const owner = connectedAddress();
  if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; }
  setVenueBusy(true);
  const ui = elements();
  try {
    await requireGas(owner);
    const sdk = await sdkFor(owner);
    await verifiedPool(sdk, true);
    const owned = await sdk.Position.getPositionList(owner, [CETUS_TREE_POOL_ID], false);
    const fees = owned.length ? await sdk.Position.batchFetchPositionFees(owned.map((position) => position.pos_object_id)) : {};
    const positionIds = owned.filter((position) => { const amounts = feeAmounts({ fees: fees[position.pos_object_id] }); return amounts.treeRaw > 0n || amounts.suiRaw > 0n; }).map((position) => position.pos_object_id);
    if (!positionIds.length) throw new Error('No Cetus TREE or SUI fees are currently claimable.');
    const build = async () => {
      const transaction = await sdk.Rewarder.batchCollectRewardsPayload(positionIds.map((positionId) => ({
        pool_id: CETUS_TREE_POOL_ID, pos_id: positionId,
        coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
        collect_fee: true, rewarder_coin_types: [],
      })));
      transaction.setSenderIfNotSet?.(owner);
      return validateCetusBatchCollectTransaction(transaction, { owner, positionIds });
    };
    ui.positionStatus.textContent = 'Simulation 1 of 2: verifying every claimable Cetus position…';
    const first = extractCetusBatchFeeSimulation(await simulate(await client(), await build()), positionIds);
    if (first.treeRaw === 0n && first.suiRaw === 0n) throw new Error('No Cetus TREE or SUI fees are currently claimable.');
    ui.positionStatus.textContent = 'Simulation 2 of 2: rebuilding one protected Claim All transaction…';
    const finalTransaction = await build();
    const verified = extractCetusBatchFeeSimulation(await simulate(await client(), finalTransaction), positionIds);
    const approved = await confirmTransaction([
      `Claim fees from ${positionIds.length} Cetus position${positionIds.length === 1 ? '' : 's'} in one transaction?`, '',
      `Total TREE fees: ${formatCetusAmount(verified.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
      `Total SUI fees: ${formatCetusAmount(verified.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`, '',
      'Liquidity and price ranges do not change.',
      'The exact Claim All transaction passed two Sui Mainnet simulations.',
    ].join('\n'), { title: 'TEST DApp · Claim All Cetus Fees' });
    if (!approved) { ui.positionStatus.textContent = 'Cetus Claim All cancelled before wallet approval.'; return; }
    ui.positionStatus.textContent = 'Review the verified Cetus Claim All transaction in your wallet…';
    const digest = digestFrom(await window.signAndExecuteTransactionBlock(finalTransaction));
    const final = await waitForFinality(await client(), digest);
    extractCetusBatchFeeSimulation(final, positionIds);
    ui.positionStatus.textContent = `All Cetus fees claimed · ${digest.slice(0, 12)}…`;
    ui.positionStatus.className = 'v3-status ok';
    state.sdk = null;
    await loadPositions();
  } catch (error) {
    ui.positionStatus.textContent = error?.message || String(error);
    ui.positionStatus.className = `v3-status${/reject|cancel|denied/i.test(String(error?.message || error)) ? '' : ' error'}`;
  } finally { setVenueBusy(false); }
}

async function prepareCetusCompound(sdk, position) {
  const { treeRaw, suiRaw } = feeAmounts(position);
  if (treeRaw <= 0n || suiRaw <= 0n) throw new Error('This position needs both TREE and SUI fees before it can compound without a swap.');
  const addMode = {
    is_full_range: false,
    min_price: String(cetusPriceFromTick(position.tick_lower_index)),
    max_price: String(cetusPriceFromTick(position.tick_upper_index)),
    coin_decimals_a: CETUS_TREE_DECIMALS,
    coin_decimals_b: CETUS_SUI_DECIMALS,
    price_base_coin: 'coin_a',
  };
  let result = await sdk.Position.calculateAddLiquidityResultWithPrice({
    pool_id: CETUS_TREE_POOL_ID, coin_amount: suiRaw.toString(), fix_amount_a: false,
    slippage: 0.01, refresh_pool_price: true, add_mode_params: addMode,
  });
  if (BigInt(result.coin_amount_limit_a) > treeRaw) {
    const protectedTreeRaw = treeRaw * 98n / 100n;
    result = await sdk.Position.calculateAddLiquidityResultWithPrice({
      pool_id: CETUS_TREE_POOL_ID, coin_amount: protectedTreeRaw.toString(), fix_amount_a: true,
      slippage: 0.01, refresh_pool_price: true, add_mode_params: addMode,
    });
  }
  if (BigInt(result.coin_amount_limit_a) > treeRaw || BigInt(result.coin_amount_limit_b) > suiRaw) throw new Error('The current fee ratio cannot form liquidity inside this position range without a swap.');
  const build = async () => {
    const transaction = new Transaction();
    transaction.setSender(ownerAddress(position));
    const returned = sdk.Position.createCollectFeeAndReturnCoinsPayload({
      pool_id: CETUS_TREE_POOL_ID, pos_id: position.pos_object_id,
      coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
    }, transaction);
    const treeCoin = transaction.moveCall({ target: '0x2::coin::from_balance', typeArguments: [CETUS_TREE_COIN_TYPE], arguments: [returned.fee_a] });
    const suiCoin = transaction.moveCall({ target: '0x2::coin::from_balance', typeArguments: [CETUS_SUI_COIN_TYPE], arguments: [returned.fee_b] });
    await sdk.Position.createAddLiquidityPayload({
      pool_id: CETUS_TREE_POOL_ID, pos_id: position.pos_object_id,
      coin_type_a: CETUS_TREE_COIN_TYPE, coin_type_b: CETUS_SUI_COIN_TYPE,
      tick_lower: result.tick_lower, tick_upper: result.tick_upper,
      delta_liquidity: result.liquidity,
      max_amount_a: result.coin_amount_limit_a, max_amount_b: result.coin_amount_limit_b,
      collect_fee: false, rewarder_coin_types: [],
    }, transaction, treeCoin, suiCoin);
    return validateCetusCompoundTransaction(transaction, { owner: ownerAddress(position), positionId: position.pos_object_id });
  };
  return { build, treeRaw, suiRaw, result };
}

function ownerAddress(position) { return position.__owner || connectedAddress(); }

async function compoundCetusFees() {
  if (state.venueBusy) return;
  const owner = connectedAddress();
  if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; }
  setVenueBusy(true);
  const ui = elements();
  try {
    await requireGas(owner);
    const sdk = await sdkFor(owner);
    const pool = await verifiedPool(sdk, true);
    const owned = await sdk.Position.getPositionList(owner, [CETUS_TREE_POOL_ID], false);
    const fees = owned.length ? await sdk.Position.batchFetchPositionFees(owned.map((position) => position.pos_object_id)) : {};
    const currentTick = Number(pool.current_tick_index);
    const candidates = owned.map((position) => ({ ...position, __owner: owner, fees: fees[position.pos_object_id] || {} }))
      .filter((position) => { const amounts = feeAmounts(position); return amounts.treeRaw > 0n && amounts.suiRaw > 0n; })
      .sort((a, b) => Number(currentTick >= Number(b.tick_lower_index) && currentTick < Number(b.tick_upper_index)) - Number(currentTick >= Number(a.tick_lower_index) && currentTick < Number(a.tick_upper_index)));
    if (!candidates.length) throw new Error('No Cetus position currently has both TREE and SUI fees available to compound without a swap.');
    let prepared = null; let target = null; let lastError = null;
    for (const candidate of candidates) {
      try { prepared = await prepareCetusCompound(sdk, candidate); target = candidate; break; } catch (error) { lastError = error; }
    }
    if (!prepared || !target) throw lastError || new Error('No Cetus position can currently compound its fees without a swap.');
    ui.positionStatus.textContent = 'Simulation 1 of 2: claiming and redepositing Cetus fees atomically…';
    extractCetusCompoundSimulation(await simulate(await client(), await prepared.build()), { positionId: target.pos_object_id, maxTreeRaw: prepared.treeRaw, maxSuiRaw: prepared.suiRaw });
    ui.positionStatus.textContent = 'Simulation 2 of 2: rebuilding the exact atomic compound transaction…';
    const finalTransaction = await prepared.build();
    const verified = extractCetusCompoundSimulation(await simulate(await client(), finalTransaction), { positionId: target.pos_object_id, maxTreeRaw: prepared.treeRaw, maxSuiRaw: prepared.suiRaw });
    const approved = await confirmTransaction([
      'Compound Cetus trading fees into this position?', '',
      `Position: ${target.pos_object_id.slice(0, 12)}…${target.pos_object_id.slice(-8)}`,
      `TREE fees claimed: ${formatCetusAmount(verified.fees.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
      `SUI fees claimed: ${formatCetusAmount(verified.fees.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`,
      `TREE redeposited: ${formatCetusAmount(verified.treeRaw, CETUS_TREE_DECIMALS, 6)} TREE`,
      `SUI redeposited: ${formatCetusAmount(verified.suiRaw, CETUS_SUI_DECIMALS, 9)} SUI`, '',
      'Any unused fee remainder returns to your wallet. No swap is included.',
      'Claim and reinvest occur atomically in one transaction after two Mainnet simulations.',
    ].join('\n'), { title: 'TEST DApp · Compound Cetus Fees' });
    if (!approved) { ui.positionStatus.textContent = 'Cetus compound cancelled before wallet approval.'; return; }
    ui.positionStatus.textContent = 'Review the verified Cetus compound transaction in your wallet…';
    const digest = digestFrom(await window.signAndExecuteTransactionBlock(finalTransaction));
    const final = await waitForFinality(await client(), digest);
    extractCetusCompoundSimulation(final, { positionId: target.pos_object_id, maxTreeRaw: prepared.treeRaw, maxSuiRaw: prepared.suiRaw });
    ui.positionStatus.textContent = `Cetus fees compounded · ${digest.slice(0, 12)}…`;
    ui.positionStatus.className = 'v3-status ok';
    state.sdk = null;
    await loadPositions();
  } catch (error) {
    ui.positionStatus.textContent = error?.message || String(error);
    ui.positionStatus.className = `v3-status${/reject|cancel|denied/i.test(String(error?.message || error)) ? '' : ' error'}`;
  } finally { setVenueBusy(false); }
}

async function loadPositions() {
  const ui = elements();
  if (!ui.positions) return;
  const owner = connectedAddress();
  if (!owner) {
    state.positions.clear();
    if (ui.claimAll) ui.claimAll.disabled = true;
    if (ui.compound) ui.compound.disabled = true;
    updatePositionSummary(0);
    ui.positions.innerHTML = '<article class="v3-cetus-position-empty"><strong>Connect your wallet</strong><span>Connect a Sui wallet to load Cetus positions for this verified pool.</span></article>';
    ui.positionStatus.textContent = 'No wallet connected.';
    return;
  }
  ui.load.disabled = true;
  ui.positionStatus.textContent = 'Scanning the verified Cetus TREE/SUI pool…';
  try {
    const sdk = await sdkFor(owner);
    await verifiedPool(sdk, true);
    const positions = await sdk.Position.getPositionList(owner, [CETUS_TREE_POOL_ID], false);
    const fees = positions.length ? await sdk.Position.batchFetchPositionFees(positions.map((position) => position.pos_object_id)) : {};
    renderPositions(positions, fees);
    ui.positionStatus.textContent = `${positions.length} verified Cetus position${positions.length === 1 ? '' : 's'} found for ${owner.slice(0, 8)}…${owner.slice(-6)}.`;
    ui.positionStatus.className = 'v3-status ok';
  } catch (error) {
    ui.positionStatus.textContent = error?.message || String(error);
    ui.positionStatus.className = 'v3-status error';
  } finally { ui.load.disabled = false; }
}

function bind() {
  const ui = elements();
  if (!ENABLED || !ui.panel || ui.panel.dataset.cetusBound === 'true') return;
  ui.panel.dataset.cetusBound = 'true';
  ui.sui.addEventListener('input', scheduleQuote);
  ui.suiMax?.addEventListener('click', () => fillMaxSui(ui.sui, setStatus).then(refreshAddBalance).catch((error) => setStatus(error?.message || String(error), 'error')));
  ui.range.addEventListener('change', scheduleQuote);
  ui.action.addEventListener('click', addLiquidity);
  ui.load.addEventListener('click', loadPositions);
  ui.claimAll?.addEventListener('click', claimAllCetusFees);
  ui.compound?.addEventListener('click', compoundCetusFees);
  ui.positions.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-cetus-position-action]');
    if (actionButton) {
      const positionId = actionButton.dataset.positionId;
      const panel = actionPanel(positionId);
      const sameAction = panel && !panel.hidden && panel.dataset.cetusAction === actionButton.dataset.cetusPositionAction;
      document.querySelectorAll('[data-cetus-action-panel]').forEach((item) => { item.hidden = true; });
      if (!sameAction) renderActionPanel(positionId, actionButton.dataset.cetusPositionAction);
      return;
    }
    const maxButton = event.target.closest('[data-cetus-action-sui-max]');
    if (maxButton) {
      const panel = maxButton.closest('[data-cetus-action-panel]');
      const positionId = panel?.dataset.cetusActionPanel;
      const input = panel?.querySelector('[data-cetus-action-sui]');
      if (positionId && input) fillMaxSui(input, (message, kind) => setPositionStatus(positionId, message, kind)).catch((error) => setPositionStatus(positionId, error?.message || String(error), 'error'));
      return;
    }
    const submit = event.target.closest('[data-cetus-position-submit]');
    if (submit) {
      const panel = submit.closest('[data-cetus-action-panel]');
      runPositionAction(panel?.dataset.cetusActionPanel, submit.dataset.cetusPositionSubmit).catch((error) => {
        setPositionStatus(panel?.dataset.cetusActionPanel, error?.message || String(error), 'error');
      });
    }
  });
  window.addEventListener('tree:wallet-changed', () => { refreshAddBalance(); calculateQuote(); loadPositions(); });
  refreshAddBalance();
  calculateQuote();
  loadPositions();
}

document.addEventListener('tree:v3-workspace-ready', bind);
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', bind, { once: true }) : queueMicrotask(bind);
