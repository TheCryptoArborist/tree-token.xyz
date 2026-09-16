import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import { isTreeV3RebalanceTestHost } from './v3-transaction-core.js';
import { confirmTransaction } from './transaction-review.js';
import { buildTurbosLockedFeeClaim, buildTurbosClaimAllFees } from './turbos-locked-claim-core.js';
import {
  TURBOS_BURN_POSITION_NFT_TYPE,
  TURBOS_POSITION_NFT_TYPE,
  matchesTurbosPool,
  normalizeTurbosAddress as normalizeAddress,
  normalizeTurbosType as normalizeType,
  parseTurbosPositionObject,
} from './turbos-position-core.js';

const SDK_URL = 'https://esm.run/turbos-clmm-sdk@4.0.1';
const POOL_ID = '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee';
const PROTOCOL_PACKAGE = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';
const FEE_TYPE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::fee10000bps::FEE10000BPS';
const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const SUI_TYPE = '0x2::sui::SUI';
const TREE_DECIMALS = 6;
const SUI_DECIMALS = 9;
const MIN_GAS_RAW = 50_000_000n;
const SLIPPAGE_PERCENT = 1;
const enabled = isTreeV3RebalanceTestHost(location.hostname);
const state = { sdk: null, module: null, pool: null, contract: null, positions: new Map(), busy: new Set(), venueBusy: false, quoteTimer: null };

function address() { const value = String(window.playerAddress || '').toLowerCase(); return /^0x[0-9a-f]{64}$/.test(value) ? value : null; }
function compact(value) { return `${String(value).slice(0, 9)}…${String(value).slice(-6)}`; }
function tick(sdkValue, value) { try { return sdkValue.math.bitsToNumber(value?.bits ?? value); } catch { return Number(value?.bits ?? value ?? 0); } }
function formatAmount(raw, decimals, digits = 6) { const value = BigInt(raw || 0); const scale = 10n ** BigInt(decimals); const fraction = (value % scale).toString().padStart(decimals, '0').slice(0, digits).replace(/0+$/, ''); return `${(value / scale).toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`; }
function parseAmount(value, decimals, symbol) { const text = String(value ?? '').trim(); if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$|^\.\d+$/.test(text)) throw new Error(`Enter a valid ${symbol} amount.`); const [whole = '0', fraction = ''] = text.startsWith('.') ? ['0', text.slice(1)] : text.split('.'); if (fraction.length > decimals) throw new Error(`${symbol} supports no more than ${decimals} decimal places.`); const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals)); if (raw <= 0n) throw new Error(`Enter a ${symbol} amount greater than zero.`); return raw; }
function ui() { return { list: document.getElementById('turbosV3Positions'), load: document.getElementById('turbosV3LoadPositions'), status: document.getElementById('turbosV3PositionStatus'), claimAll: document.getElementById('turbosV3ClaimAllFees'), compound: document.getElementById('turbosV3CompoundFees'), addSui: document.getElementById('turbosV3SuiAmount'), addSuiMax: document.getElementById('turbosV3SuiMax'), addSuiBalance: document.getElementById('turbosV3SuiBalance'), addTree: document.getElementById('turbosV3TreeAmount'), addRange: document.getElementById('turbosV3Range'), addAction: document.getElementById('turbosV3AddAction'), addStatus: document.getElementById('turbosV3AddStatus') }; }
function setAddStatus(message, kind = '') { const target = ui().addStatus; if (!target) return; target.textContent = message; target.className = `v3-status${kind ? ` ${kind}` : ''}`; }

async function readSuiBalance(owner) { const result = await window.initSuiClient().core.getBalance({ owner, coinType: SUI_TYPE }); return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0); }
async function refreshAddBalance() { const controls = ui(); if (!controls.addSuiBalance) return; const owner = address(); if (!owner) { controls.addSuiBalance.textContent = 'Balance —'; return; } try { controls.addSuiBalance.textContent = `Balance ${formatAmount(await readSuiBalance(owner), SUI_DECIMALS, 4)} SUI`; } catch { controls.addSuiBalance.textContent = 'Balance unavailable'; } }
async function fillMaxSui(input, report) { const owner = address(); if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; } const balanceRaw = await readSuiBalance(owner); const spendableRaw = balanceRaw > MIN_GAS_RAW ? balanceRaw - MIN_GAS_RAW : 0n; if (spendableRaw <= 0n) { report('At least 0.05 SUI must remain available for gas.', 'error'); return; } input.value = formatAmount(spendableRaw, SUI_DECIMALS, SUI_DECIMALS); input.dispatchEvent(new Event('input', { bubbles: true })); report(`MAX selected · ${formatAmount(spendableRaw, SUI_DECIMALS, 4)} SUI available after reserving 0.05 SUI for gas.`, 'ok'); }

async function getSdk() {
  if (state.sdk) return state.sdk;
  if (typeof window.initSuiClient !== 'function') throw new Error('The Sui Mainnet client is unavailable.');
  state.module = await import(SDK_URL);
  state.sdk = new state.module.TurbosSdk(state.module.Network.mainnet, window.initSuiClient());
  return state.sdk;
}

async function verifiedProtocol(refresh = false) {
  const turbos = await getSdk();
  if (refresh || !state.pool) state.pool = await turbos.pool.getPool(POOL_ID);
  if (refresh || !state.contract) state.contract = await turbos.contract.getConfig();
  const types = state.pool?.types || [];
  if (normalizeAddress(state.pool?.objectId || state.pool?.id) !== normalizeAddress(POOL_ID)
    || normalizeType(types[0]) !== normalizeType(TREE_TYPE) || normalizeType(types[1]) !== normalizeType(SUI_TYPE)
    || normalizeType(types[2]) !== normalizeType(FEE_TYPE)) throw new Error('The verified Turbos TREE/SUI pool parameters changed. Transactions remain blocked.');
  if (normalizeAddress(state.contract?.PackageId) !== normalizeAddress(PROTOCOL_PACKAGE)) throw new Error('The Turbos protocol package changed. Transactions remain blocked.');
  return { turbos, pool: state.pool, contract: state.contract };
}

async function listOwnedType(client, owner, type) {
  const objects = []; let cursor = null;
  do { const page = await client.core.listOwnedObjects({ owner, type, include: { json: true }, cursor, limit: 50 }); objects.push(...(page.objects || [])); cursor = page.hasNextPage ? page.cursor : null; } while (cursor);
  return objects;
}

async function listNfts(client, owner) {
  const groups = await Promise.all([
    listOwnedType(client, owner, TURBOS_POSITION_NFT_TYPE),
    listOwnedType(client, owner, TURBOS_BURN_POSITION_NFT_TYPE),
  ]);
  return groups.flat().map(parseTurbosPositionObject).filter((position) => matchesTurbosPool(position, {
    poolId: POOL_ID,
    coinTypeA: TREE_TYPE,
    coinTypeB: SUI_TYPE,
    feeType: FEE_TYPE,
  }));
}

function updateSummary(count) { const summary = document.getElementById('v3SummaryPositions'); if (!summary) return; summary.dataset.turbosPositions = String(count); if (address()) summary.textContent = String(Number(summary.dataset.suidexPositions || 0) + Number(summary.dataset.cetusPositions || 0) + count); }

async function positionDetails(turbos, nft) {
  const nftId = nft.objectId; const fields = nft.kind === 'burn-proof'
    ? await turbos.position.getPositionFieldsByPositionId(nft.positionId)
    : await turbos.position.getPositionFields(nftId); const pool = state.pool;
  const lower = tick(turbos, fields.tick_lower_index); const upper = tick(turbos, fields.tick_upper_index);
  let quote = { fields: { feeOwedA: '0', feeOwedB: '0', collectRewards: ['0', '0', '0'] } };
  try { quote = await turbos.position.getUnclaimedFeesAndRewards({ poolId: POOL_ID, position: fields }); } catch {}
  return { nftId, positionId: nft.positionId, kind: nft.kind, lower, upper, liquidity: String(fields.liquidity || 0), fees: quote.fields || {}, fields };
}

function renderActionPanel(positionId, action) {
  const panel = document.querySelector(`[data-turbos-action-panel="${positionId}"]`); if (!panel) return;
  const content = action === 'add'
    ? '<strong>Add to this position</strong><p>Enter a SUI amount. The matching TREE amount is calculated from this position’s existing range.</p><div class="v3-form-grid"><label class="v3-field"><span>SUI amount</span><span class="v3-sui-amount-input"><input data-turbos-action-sui inputmode="decimal" autocomplete="off" placeholder="0.0"><button type="button" data-turbos-action-sui-max>MAX</button></span><small class="v3-gas-note">MAX keeps 0.05 SUI for gas.</small></label><label class="v3-field"><span>Calculated TREE</span><input data-turbos-action-tree readonly placeholder="—"></label></div><button class="button primary" type="button" data-turbos-position-submit="add">Calculate &amp; Review Add</button>'
    : action === 'claim'
      ? '<strong>Claim trading fees</strong><p>Collect all currently available TREE and SUI trading fees from this position.</p><button class="button primary" type="button" data-turbos-position-submit="claim">Simulate &amp; Review Claim</button>'
      : action === 'remove'
        ? '<strong>Remove liquidity</strong><p>Withdraw part of the position while keeping its NFT open.</p><label class="v3-field"><span>Amount to remove</span><select data-turbos-remove-percent><option value="25">25%</option><option value="50" selected>50%</option><option value="75">75%</option></select></label><button class="button primary" type="button" data-turbos-position-submit="remove">Simulate &amp; Review Removal</button>'
        : '<strong>Close this position</strong><p>Withdraw all liquidity, claim all fees and configured rewards, and delete the empty Turbos position NFT.</p><button class="button danger" type="button" data-turbos-position-submit="close">Simulate &amp; Review Close</button>';
  panel.dataset.turbosAction = action; panel.innerHTML = `${content}<p class="v3-status" data-turbos-action-status role="status" aria-live="polite">No wallet request occurs until two Sui Mainnet simulations pass.</p>`; panel.hidden = false;
  if (action === 'add') panel.querySelector('[data-turbos-action-sui]')?.addEventListener('input', () => quotePositionIncrease(positionId));
}

function render(positions) {
  const target = ui().list; state.positions = new Map(positions.map((position) => [position.nftId, position])); updateSummary(positions.length);
  const claimable = positions.filter((position) => BigInt(position.fees.feeOwedA || 0) > 0n || BigInt(position.fees.feeOwedB || 0) > 0n);
  const controls = ui();
  if (controls.claimAll) controls.claimAll.disabled = !claimable.length || state.venueBusy;
  if (controls.compound) controls.compound.disabled = !claimable.length || !claimable.some((position) => BigInt(position.fees.feeOwedA || 0) > 0n) || !claimable.some((position) => BigInt(position.fees.feeOwedB || 0) > 0n) || state.venueBusy;
  if (!positions.length) { target.innerHTML = '<article class="v3-cetus-position-empty"><strong>No Turbos positions found</strong><span>This wallet does not own a position in the verified TREE/SUI Turbos pool.</span></article>'; return; }
  target.innerHTML = positions.map((position) => {
    const locked = position.kind === 'burn-proof';
    const actions = locked
      ? `<div class="turbos-burn-proof-note"><strong>Locked full-range Turbos position</strong><span>This burn-proof position can claim trading fees. Turbos does not permit adding to, removing from, or closing this permanently locked wrapper.</span><div class="v3-cetus-position-actions turbos-locked-actions"><button type="button" data-turbos-locked-claim data-position-id="${position.nftId}">Claim Fees</button><button type="button" data-turbos-open-new-position>Open New Position</button></div><p class="v3-status" data-turbos-locked-status="${position.nftId}" role="status" aria-live="polite">Claiming fees does not change the locked principal.</p></div>`
      : `<div class="v3-cetus-position-actions"><button type="button" data-turbos-position-action="add" data-position-id="${position.nftId}">Add</button><button type="button" data-turbos-position-action="claim" data-position-id="${position.nftId}">Claim Fees</button><button type="button" data-turbos-position-action="remove" data-position-id="${position.nftId}">Remove</button><button class="danger" type="button" data-turbos-position-action="close" data-position-id="${position.nftId}">Close</button></div><div class="v3-cetus-action-panel" data-turbos-action-panel="${position.nftId}" hidden></div>`;
    return `<article class="v3-cetus-position-card" data-turbos-position-card="${position.nftId}"><div class="v3-cetus-position-head"><div><span>${locked ? 'TURBOS LOCKED POSITION' : 'TURBOS POSITION'}</span><strong>${compact(position.nftId)}</strong></div><b class="in-range">${locked ? 'Burn proof' : 'Verified'}</b></div><div class="v3-cetus-position-metrics"><div><span>Tick range</span><strong>${position.lower}–${position.upper}</strong></div><div><span>Liquidity units</span><strong>${BigInt(position.liquidity).toLocaleString('en-US')}</strong></div><div><span>Pending TREE fees</span><strong>${formatAmount(position.fees.feeOwedA, TREE_DECIMALS)}</strong></div><div><span>Pending SUI fees</span><strong>${formatAmount(position.fees.feeOwedB, SUI_DECIMALS)}</strong></div></div>${actions}</article>`;
  }).join('');
}

async function verifiedPosition(owner, nftId) {
  const { turbos, pool, contract } = await verifiedProtocol(true); const nfts = await listNfts(window.initSuiClient(), owner);
  const nft = nfts.find((item) => normalizeAddress(item.objectId) === normalizeAddress(nftId));
  if (!nft) throw new Error('This Turbos position is no longer directly owned by the connected wallet.');
  if (nft.kind === 'burn-proof') throw new Error('This locked Turbos burn-proof position cannot use standard NFT liquidity actions.');
  const position = await positionDetails(turbos, nft); if (BigInt(position.liquidity) < 0n) throw new Error('The Turbos position returned invalid liquidity.');
  return { turbos, pool, contract, position };
}

function moveCall(command) { return command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null); }
function unresolvedObjectId(input) { return input?.UnresolvedObject?.objectId || (input?.$kind === 'UnresolvedObject' ? input.UnresolvedObject?.objectId : null); }
function validateTransaction(transaction, { owner, contract, action, nftId = null }) {
  const data = transaction?.getData?.(); if (!data) throw new Error('Turbos did not return an inspectable transaction.');
  if (normalizeAddress(data.sender) !== normalizeAddress(owner)) throw new Error('Turbos transaction sender does not match the connected wallet.');
  const expectedByAction = { open: ['mint'], add: ['increase_liquidity'], claim: ['collect'], remove: ['decrease_liquidity'], close: ['decrease_liquidity', 'collect', 'collect_reward', 'burn'] };
  const allowed = new Set(expectedByAction[action] || []); const calls = (data.commands || []).map(moveCall).filter(Boolean);
  if (!calls.length) throw new Error('Turbos returned a transaction without a protocol call.');
  for (const call of calls) {
    if (normalizeAddress(call.package) !== normalizeAddress(contract.PackageId) || call.module !== 'position_manager' || !allowed.has(call.function)) throw new Error(`Turbos returned a non-allowlisted call: ${call.module}::${call.function}.`);
    const types = (call.typeArguments || []).slice(0, 3).map(normalizeType);
    if (types.join('|') !== [TREE_TYPE, SUI_TYPE, FEE_TYPE].map(normalizeType).join('|')) throw new Error('Turbos transaction coin or fee types changed.');
  }
  const objectIds = (data.inputs || []).map(unresolvedObjectId).filter(Boolean).map(normalizeAddress);
  for (const required of [POOL_ID, contract.Positions, contract.Versioned, ...(nftId ? [nftId] : [])]) if (!objectIds.includes(normalizeAddress(required))) throw new Error('Turbos transaction does not reference the verified pool and position objects.');
  return transaction;
}

function core(result) { return result?.$kind === 'Transaction' ? result.Transaction : (result?.Transaction || result); }
function success(result) { return core(result)?.effects?.status?.success === true && !result?.FailedTransaction; }
function failure(result, fallback) { const error = result?.FailedTransaction?.status?.error || core(result)?.effects?.status?.error; return typeof error === 'string' ? error : error?.message || fallback; }
async function simulate(transaction) { const client = window.initSuiClient(); const bytes = await transaction.build({ client }); return client.core.simulateTransaction({ transaction: bytes, include: { effects: true, events: true, balanceChanges: true } }); }
async function simulateChecked(build, label) { const firstTx = await build(); const first = await simulate(firstTx); if (!success(first)) throw new Error(failure(first, `${label} simulation 1 failed.`)); const finalTx = await build(); const final = await simulate(finalTx); if (!success(final)) throw new Error(failure(final, `${label} simulation 2 failed.`)); return { transaction: finalTx, simulation: final }; }
function digestFrom(result) { return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionBlockDigest || null; }
async function finalize(transaction) { if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.'); const digest = digestFrom(await window.signAndExecuteTransactionBlock(transaction)); if (!digest) throw new Error('The wallet returned no transaction digest.'); const final = await window.initSuiClient().core.waitForTransaction({ digest, timeout: 60_000, include: { effects: true, events: true, balanceChanges: true } }); if (!success(final)) throw new Error(failure(final, 'The Turbos transaction did not finalize successfully.')); return digest; }
async function requireBalances(owner, treeRaw = 0n, suiRaw = 0n) { const client = window.initSuiClient(); const [tree, sui] = await Promise.all([client.core.getBalance({ owner, coinType: TREE_TYPE }), client.core.getBalance({ owner, coinType: SUI_TYPE })]); const treeBalance = BigInt(tree?.balance?.balance ?? tree?.balance ?? 0); const suiBalance = BigInt(sui?.balance?.balance ?? sui?.balance ?? 0); if (treeBalance < treeRaw) throw new Error(`This action needs ${formatAmount(treeRaw, TREE_DECIMALS)} TREE.`); if (suiBalance < suiRaw + MIN_GAS_RAW) throw new Error('Keep at least 0.05 SUI beyond the liquidity amount for gas.'); }
function estimateAmounts(turbos, pool, lower, upper, liquidity) { const [treeRaw, suiRaw] = turbos.pool.getTokenAmountsFromLiquidity({ currentSqrtPrice: new state.module.BN(pool.sqrt_price), lowerSqrtPrice: turbos.math.tickIndexToSqrtPriceX64(lower), upperSqrtPrice: turbos.math.tickIndexToSqrtPriceX64(upper), liquidity: new state.module.BN(liquidity), ceil: false }); return { treeRaw: BigInt(treeRaw.toString()), suiRaw: BigInt(suiRaw.toString()) }; }
function minimum(raw) { return BigInt(raw) * 99n / 100n; }
function positionStatus(nftId, message, kind = '') { const target = document.querySelector(`[data-turbos-action-panel="${nftId}"] [data-turbos-action-status]`); if (!target) return; target.textContent = message; target.className = `v3-status${kind ? ` ${kind}` : ''}`; }
function lockedPositionStatus(nftId, message, kind = '') { const target = document.querySelector(`[data-turbos-locked-status="${nftId}"]`); if (!target) return; target.textContent = message; target.className = `v3-status${kind ? ` ${kind}` : ''}`; }

async function verifiedLockedPosition(owner, nftId) {
  const { turbos, contract } = await verifiedProtocol(true);
  const nfts = await listNfts(window.initSuiClient(), owner);
  const nft = nfts.find((item) => normalizeAddress(item.objectId) === normalizeAddress(nftId) && item.kind === 'burn-proof');
  if (!nft) throw new Error('This locked Turbos position is no longer directly owned by the connected wallet.');
  return { contract, position: await positionDetails(turbos, nft) };
}

async function claimLockedFees(nftId) {
  if (state.busy.has(nftId)) return;
  const owner = address();
  if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; }
  const button = document.querySelector(`[data-turbos-locked-claim][data-position-id="${nftId}"]`);
  state.busy.add(nftId); if (button) button.disabled = true;
  try {
    const { contract, position } = await verifiedLockedPosition(owner, nftId);
    const treeRaw = BigInt(position.fees.feeOwedA || 0);
    const suiRaw = BigInt(position.fees.feeOwedB || 0);
    if (treeRaw <= 0n && suiRaw <= 0n) throw new Error('No TREE or SUI trading fees are currently claimable.');
    await requireBalances(owner);
    const build = async () => buildTurbosLockedFeeClaim({
      Transaction,
      owner,
      packageId: contract.PackageId,
      poolId: POOL_ID,
      positionsId: contract.Positions,
      versionedId: contract.Versioned,
      burnNftId: nftId,
      coinTypeA: TREE_TYPE,
      coinTypeB: SUI_TYPE,
      feeType: FEE_TYPE,
      amountA: treeRaw,
      amountB: suiRaw,
    });
    lockedPositionStatus(nftId, 'Simulation 1 of 2: verifying the dedicated Turbos locked-fee claim…', 'warning');
    const checked = await simulateChecked(build, 'Turbos locked-fee claim');
    lockedPositionStatus(nftId, 'Both Mainnet simulations passed. Review the claim details.', 'ok');
    const approved = await confirmTransaction(`Claim fees from this locked Turbos position?\n\nTREE fees: ${formatAmount(treeRaw, TREE_DECIMALS)} TREE\nSUI fees: ${formatAmount(suiRaw, SUI_DECIMALS)} SUI\nLocked position: ${compact(nftId)}\n\nThe locked principal and full-range position do not change. The exact transaction passed two Sui Mainnet simulations.`, { title: 'TEST DApp · Claim Locked Turbos Fees' });
    if (!approved) { lockedPositionStatus(nftId, 'Locked fee claim cancelled before wallet approval.'); return; }
    lockedPositionStatus(nftId, 'Review the verified locked-fee claim in your wallet…', 'warning');
    const digest = await finalize(checked.transaction);
    lockedPositionStatus(nftId, `Fees claimed successfully · ${compact(digest)}`, 'ok');
    state.sdk = null; state.pool = null; state.contract = null;
    await load();
  } catch (error) {
    const message = error?.message || String(error);
    lockedPositionStatus(nftId, message, /reject|cancel|denied/i.test(message) ? '' : 'error');
  } finally { state.busy.delete(nftId); if (button) button.disabled = false; }
}

async function quotePositionIncrease(nftId) {
  const panel = document.querySelector(`[data-turbos-action-panel="${nftId}"]`); const tree = panel?.querySelector('[data-turbos-action-tree]');
  try { const owner = address(); if (!owner) throw new Error('Connect a wallet.'); const suiRaw = parseAmount(panel?.querySelector('[data-turbos-action-sui]')?.value, SUI_DECIMALS, 'SUI'); const { turbos, pool, position } = await verifiedPosition(owner, nftId); const [treeRaw] = turbos.pool.estimateAmountsFromOneAmount({ sqrtPrice: pool.sqrt_price, tickLower: position.lower, tickUpper: position.upper, amount: suiRaw.toString(), isAmountA: false }); tree.value = formatAmount(treeRaw, TREE_DECIMALS); positionStatus(nftId, 'Paired TREE calculated. Select Calculate & Review Add.', 'ok'); } catch { if (tree) tree.value = ''; }
}

async function runPositionAction(nftId, action) {
  if (state.busy.has(nftId)) return; const owner = address(); if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; }
  const panel = document.querySelector(`[data-turbos-action-panel="${nftId}"]`); const button = panel?.querySelector('[data-turbos-position-submit]'); state.busy.add(nftId); if (button) button.disabled = true;
  try {
    const { turbos, pool, contract, position } = await verifiedPosition(owner, nftId); let build; let review;
    if (action === 'add') {
      const suiRaw = parseAmount(panel?.querySelector('[data-turbos-action-sui]')?.value, SUI_DECIMALS, 'SUI'); const [treeAmount, suiAmount] = turbos.pool.estimateAmountsFromOneAmount({ sqrtPrice: pool.sqrt_price, tickLower: position.lower, tickUpper: position.upper, amount: suiRaw.toString(), isAmountA: false }); const treeRaw = BigInt(treeAmount); if (BigInt(suiAmount) !== suiRaw || treeRaw <= 0n) throw new Error('Turbos could not calculate a two-token increase for this range.'); await requireBalances(owner, treeRaw, suiRaw);
      build = async () => { const tx = await turbos.pool.increaseLiquidity({ pool: POOL_ID, address: owner, nft: nftId, amountA: treeRaw.toString(), amountB: suiRaw.toString(), slippage: SLIPPAGE_PERCENT }); tx.setSenderIfNotSet?.(owner); return validateTransaction(tx, { owner, contract, action, nftId }); };
      review = `Add liquidity to this Turbos position?\n\nPosition: ${compact(nftId)}\nTREE maximum: ${formatAmount(treeRaw, TREE_DECIMALS)} TREE\nSUI maximum: ${formatAmount(suiRaw, SUI_DECIMALS)} SUI\nExisting tick range: ${position.lower}–${position.upper}\nSlippage protection: 1.00%\n\nNo swap is included.`;
    } else if (action === 'claim') {
      const treeRaw = BigInt(position.fees.feeOwedA || 0); const suiRaw = BigInt(position.fees.feeOwedB || 0); if (!treeRaw && !suiRaw) throw new Error('No TREE or SUI fees are currently available.');
      build = async () => { const tx = await turbos.pool.collectFee({ pool: POOL_ID, address: owner, nft: nftId, collectAmountA: treeRaw.toString(), collectAmountB: suiRaw.toString() }); tx.setSenderIfNotSet?.(owner); return validateTransaction(tx, { owner, contract, action, nftId }); };
      review = `Claim all Turbos trading fees?\n\nTREE fees: ${formatAmount(treeRaw, TREE_DECIMALS)} TREE\nSUI fees: ${formatAmount(suiRaw, SUI_DECIMALS)} SUI\nPosition: ${compact(nftId)}\n\nLiquidity and range do not change.`;
    } else {
      const percent = action === 'close' ? 100 : Number(panel?.querySelector('[data-turbos-remove-percent]')?.value); if (![25, 50, 75, 100].includes(percent)) throw new Error('Select a supported removal percentage.'); const liquidityRaw = BigInt(position.liquidity) * BigInt(percent) / 100n; if (liquidityRaw <= 0n) throw new Error('This position has no removable liquidity.'); const estimate = estimateAmounts(turbos, pool, position.lower, position.upper, liquidityRaw); const base = { pool: POOL_ID, address: owner, nft: nftId, amountA: estimate.treeRaw.toString(), amountB: estimate.suiRaw.toString(), decreaseLiquidity: liquidityRaw.toString(), slippage: SLIPPAGE_PERCENT };
      if (action === 'close') { const feesA = position.fees.feeOwedA || '0'; const feesB = position.fees.feeOwedB || '0'; const rewards = position.fees.collectRewards || ['0', '0', '0']; build = async () => { const tx = await turbos.pool.removeLiquidity({ ...base, collectAmountA: feesA, collectAmountB: feesB, rewardAmounts: rewards }); tx.setSenderIfNotSet?.(owner); return validateTransaction(tx, { owner, contract, action, nftId }); }; review = `Close this Turbos position completely?\n\nEstimated TREE principal: ${formatAmount(estimate.treeRaw, TREE_DECIMALS)} TREE\nEstimated SUI principal: ${formatAmount(estimate.suiRaw, SUI_DECIMALS)} SUI\nMinimum TREE principal: ${formatAmount(minimum(estimate.treeRaw), TREE_DECIMALS)} TREE\nMinimum SUI principal: ${formatAmount(minimum(estimate.suiRaw), SUI_DECIMALS)} SUI\nFees and configured rewards: claimed\n\nThis deletes the empty position NFT.`; }
      else { build = async () => { const tx = await turbos.pool.decreaseLiquidity(base); tx.setSenderIfNotSet?.(owner); return validateTransaction(tx, { owner, contract, action, nftId }); }; review = `Remove ${percent}% of this Turbos position?\n\nEstimated TREE: ${formatAmount(estimate.treeRaw, TREE_DECIMALS)} TREE\nEstimated SUI: ${formatAmount(estimate.suiRaw, SUI_DECIMALS)} SUI\nMinimum TREE: ${formatAmount(minimum(estimate.treeRaw), TREE_DECIMALS)} TREE\nMinimum SUI: ${formatAmount(minimum(estimate.suiRaw), SUI_DECIMALS)} SUI\n\nThe position NFT remains open.`; }
    }
    positionStatus(nftId, 'Simulation 1 of 2: validating the exact Turbos action…', 'warning'); const checked = await simulateChecked(build, 'Turbos'); positionStatus(nftId, 'Both simulations passed. Review the transaction details.', 'ok'); const approved = await confirmTransaction(`${review}\n\nThe exact transaction passed two Sui Mainnet simulations.`, { title: `TEST DApp · ${action === 'add' ? 'Add Turbos Liquidity' : action === 'claim' ? 'Claim Turbos Fees' : action === 'remove' ? 'Remove Turbos Liquidity' : 'Close Turbos Position'}` }); if (!approved) { positionStatus(nftId, 'Turbos transaction cancelled before wallet approval.'); return; } positionStatus(nftId, 'Review the verified Turbos transaction in your wallet…', 'warning'); const digest = await finalize(checked.transaction); positionStatus(nftId, `Confirmed on Sui Mainnet · ${compact(digest)}`, 'ok'); state.sdk = null; state.pool = null; state.contract = null; await load();
  } catch (error) { const message = error?.message || String(error); positionStatus(nftId, message, /reject|cancel|denied/i.test(message) ? '' : 'error'); }
  finally { state.busy.delete(nftId); if (button) button.disabled = false; }
}

function rangeTicks(turbos, pool, preset) { const current = tick(turbos, pool.tick_current_index); const width = { tight: 0.05, medium: 0.15, wide: 0.40 }[preset] || 0.15; const spacing = Number(pool.tick_spacing); const delta = Math.max(spacing, Math.round(Math.log(1 + width) / Math.log(1.0001) / spacing) * spacing); return { lower: Math.floor((current - delta) / spacing) * spacing, upper: Math.ceil((current + delta) / spacing) * spacing }; }
async function quoteOpen() { clearTimeout(state.quoteTimer); state.quoteTimer = setTimeout(async () => { const controls = ui(); try { const owner = address(); if (!owner) throw new Error('Connect a Sui wallet to calculate this position.'); const suiRaw = parseAmount(controls.addSui?.value, SUI_DECIMALS, 'SUI'); const { turbos, pool } = await verifiedProtocol(true); const range = rangeTicks(turbos, pool, controls.addRange?.value); const [treeRaw] = turbos.pool.estimateAmountsFromOneAmount({ sqrtPrice: pool.sqrt_price, tickLower: range.lower, tickUpper: range.upper, amount: suiRaw.toString(), isAmountA: false }); if (BigInt(treeRaw) <= 0n) throw new Error('This range needs a positive TREE amount.'); controls.addTree.value = formatAmount(treeRaw, TREE_DECIMALS); controls.addAction.disabled = false; setAddStatus(`Calculated ${formatAmount(treeRaw, TREE_DECIMALS)} TREE for ticks ${range.lower}–${range.upper}.`, 'ok'); } catch (error) { if (controls.addTree) controls.addTree.value = ''; if (controls.addAction) controls.addAction.disabled = true; setAddStatus(error?.message || String(error)); } }, 300); }
async function openPosition() { const controls = ui(); const owner = address(); if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; } controls.addAction.disabled = true; try { const suiRaw = parseAmount(controls.addSui?.value, SUI_DECIMALS, 'SUI'); const { turbos, pool, contract } = await verifiedProtocol(true); const range = rangeTicks(turbos, pool, controls.addRange?.value); const [treeAmount, suiAmount] = turbos.pool.estimateAmountsFromOneAmount({ sqrtPrice: pool.sqrt_price, tickLower: range.lower, tickUpper: range.upper, amount: suiRaw.toString(), isAmountA: false }); const treeRaw = BigInt(treeAmount); if (BigInt(suiAmount) !== suiRaw || treeRaw <= 0n) throw new Error('Turbos could not calculate a usable two-token position.'); await requireBalances(owner, treeRaw, suiRaw); const build = async () => { const tx = await turbos.pool.addLiquidity({ pool: POOL_ID, address: owner, tickLower: range.lower, tickUpper: range.upper, amountA: treeRaw.toString(), amountB: suiRaw.toString(), slippage: SLIPPAGE_PERCENT }); tx.setSenderIfNotSet?.(owner); return validateTransaction(tx, { owner, contract, action: 'open' }); }; setAddStatus('Simulation 1 of 2: validating the verified Turbos pool and range…', 'warning'); const checked = await simulateChecked(build, 'Turbos Add Liquidity'); const approved = await confirmTransaction(`Create this Turbos SUI / TREE V3 position?\n\nTREE maximum: ${formatAmount(treeRaw, TREE_DECIMALS)} TREE\nSUI maximum: ${formatAmount(suiRaw, SUI_DECIMALS)} SUI\nTick range: ${range.lower}–${range.upper}\nSlippage protection: 1.00%\nVenue: verified Turbos TREE/SUI pool\n\nThe exact transaction passed two Sui Mainnet simulations. No swap is included.`, { title: 'TEST DApp · Add Turbos Liquidity' }); if (!approved) { setAddStatus('Turbos Add Liquidity cancelled before wallet approval.'); return; } setAddStatus('Review the verified Turbos transaction in your wallet…', 'warning'); const digest = await finalize(checked.transaction); setAddStatus(`Turbos position created · ${compact(digest)}`, 'ok'); controls.addSui.value = ''; controls.addTree.value = ''; state.sdk = null; state.pool = null; state.contract = null; await load(); } catch (error) { setAddStatus(error?.message || String(error), /reject|cancel|denied/i.test(String(error?.message || error)) ? '' : 'error'); } finally { controls.addAction.disabled = false; } }

function setVenueBusy(busy) {
  state.venueBusy = busy;
  const controls = ui();
  const positions = [...state.positions.values()];
  const hasTree = positions.some((position) => BigInt(position.fees.feeOwedA || 0) > 0n);
  const hasSui = positions.some((position) => BigInt(position.fees.feeOwedB || 0) > 0n);
  if (controls.claimAll) controls.claimAll.disabled = busy || (!hasTree && !hasSui);
  if (controls.compound) controls.compound.disabled = busy || !hasTree || !hasSui;
}

async function freshClaimablePositions(owner) {
  const { turbos, contract } = await verifiedProtocol(true);
  const nfts = await listNfts(window.initSuiClient(), owner);
  const positions = await Promise.all(nfts.map((nft) => positionDetails(turbos, nft)));
  return { contract, positions: positions.filter((position) => BigInt(position.fees.feeOwedA || 0) > 0n || BigInt(position.fees.feeOwedB || 0) > 0n) };
}

async function claimAllTurbosFees({ compound = false } = {}) {
  if (state.venueBusy) return;
  const owner = address();
  if (!owner) { await window.openWalletManager?.({ mode: 'picker' }); return; }
  const controls = ui();
  setVenueBusy(true);
  try {
    await requireBalances(owner);
    const { contract, positions } = await freshClaimablePositions(owner);
    if (!positions.length) throw new Error('No Turbos TREE or SUI fees are currently claimable.');
    const items = positions.map((position) => ({
      nftId: position.nftId, kind: position.kind,
      amountA: String(position.fees.feeOwedA || 0), amountB: String(position.fees.feeOwedB || 0),
    }));
    const treeRaw = items.reduce((sum, item) => sum + BigInt(item.amountA), 0n);
    const suiRaw = items.reduce((sum, item) => sum + BigInt(item.amountB), 0n);
    if (compound && (treeRaw <= 0n || suiRaw <= 0n)) throw new Error('Turbos needs both TREE and SUI fees to prepare a no-swap compound position.');
    const build = async () => buildTurbosClaimAllFees({
      Transaction, owner, packageId: contract.PackageId, poolId: POOL_ID,
      positionsId: contract.Positions, versionedId: contract.Versioned,
      coinTypeA: TREE_TYPE, coinTypeB: SUI_TYPE, feeType: FEE_TYPE, items,
    });
    controls.status.textContent = `Simulation 1 of 2: verifying fees across ${positions.length} Turbos position${positions.length === 1 ? '' : 's'}…`;
    const checked = await simulateChecked(build, 'Turbos Claim All');
    controls.status.textContent = 'Both Mainnet simulations passed. Review the transaction details.';
    const approved = await confirmTransaction([
      `${compound ? 'Start compounding' : 'Claim fees'} from ${positions.length} Turbos position${positions.length === 1 ? '' : 's'}?`, '',
      `Total TREE fees: ${formatAmount(treeRaw, TREE_DECIMALS)} TREE`,
      `Total SUI fees: ${formatAmount(suiRaw, SUI_DECIMALS)} SUI`, '',
      compound
        ? 'Step 1 claims every fee in one transaction. Step 2 prepares a new unlocked Turbos position because locked burn-proof positions cannot be increased.'
        : 'Liquidity and locked principal do not change.',
      'The exact Claim All transaction passed two Sui Mainnet simulations.',
    ].join('\n'), { title: compound ? 'TEST DApp · Compound Turbos Fees' : 'TEST DApp · Claim All Turbos Fees' });
    if (!approved) { controls.status.textContent = `${compound ? 'Turbos compound' : 'Turbos Claim All'} cancelled before wallet approval.`; return; }
    controls.status.textContent = 'Review the verified Turbos Claim All transaction in your wallet…';
    const digest = await finalize(checked.transaction);
    controls.status.textContent = `All Turbos fees claimed · ${compact(digest)}`;
    controls.status.className = 'v3-status ok';
    state.sdk = null; state.pool = null; state.contract = null;
    await load();
    if (compound) {
      document.querySelector('[data-v3-tab="pools"]')?.click();
      const manager = document.querySelector('[data-v3-native-manager="turbos"]');
      if (manager?.getAttribute('aria-expanded') !== 'true') manager?.click();
      controls.addSui.value = formatAmount(suiRaw, SUI_DECIMALS, SUI_DECIMALS);
      controls.addSui.dispatchEvent(new Event('input', { bubbles: true }));
      setAddStatus(`Step 2 of 2: review the new unlocked Turbos position using up to ${formatAmount(suiRaw, SUI_DECIMALS)} SUI and the matching claimed TREE fees. Choose a range, then approve Add Liquidity.`, 'warning');
      requestAnimationFrame(() => controls.addSui?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  } catch (error) {
    controls.status.textContent = error?.message || String(error);
    controls.status.className = `v3-status${/reject|cancel|denied/i.test(String(error?.message || error)) ? '' : ' error'}`;
  } finally { setVenueBusy(false); }
}

async function load() { const elements = ui(); if (!elements.list) return; const owner = address(); if (!owner) { state.positions.clear(); if (elements.claimAll) elements.claimAll.disabled = true; if (elements.compound) elements.compound.disabled = true; updateSummary(0); elements.status.textContent = 'No wallet connected.'; return; } elements.load.disabled = true; elements.status.textContent = `Scanning standard and locked Turbos positions for ${compact(owner)}…`; try { const client = window.initSuiClient(); const { turbos } = await verifiedProtocol(true); const nfts = await listNfts(client, owner); const positions = await Promise.all(nfts.map((nft) => positionDetails(turbos, nft))); render(positions); const locked = positions.filter((position) => position.kind === 'burn-proof').length; elements.status.textContent = `${positions.length} verified Turbos position${positions.length === 1 ? '' : 's'} found for ${compact(owner)}${locked ? ` · ${locked} locked full-range` : ''}.`; elements.status.className = 'v3-status ok'; } catch (error) { elements.status.textContent = error?.message || String(error); elements.status.className = 'v3-status error'; } finally { elements.load.disabled = false; } }

function bind() {
  const elements = ui(); if (!enabled || !elements.list || elements.list.dataset.bound) return; elements.list.dataset.bound = 'true'; elements.load.addEventListener('click', load); elements.claimAll?.addEventListener('click', () => claimAllTurbosFees()); elements.compound?.addEventListener('click', () => claimAllTurbosFees({ compound: true })); elements.addSui?.addEventListener('input', quoteOpen); elements.addSuiMax?.addEventListener('click', () => fillMaxSui(elements.addSui, setAddStatus).then(refreshAddBalance).catch((error) => setAddStatus(error?.message || String(error), 'error'))); elements.addRange?.addEventListener('change', quoteOpen); elements.addAction?.addEventListener('click', openPosition);
  elements.list.addEventListener('click', (event) => { const lockedClaim = event.target.closest('[data-turbos-locked-claim]'); if (lockedClaim) { claimLockedFees(lockedClaim.dataset.positionId); return; } const openNew = event.target.closest('[data-turbos-open-new-position]'); if (openNew) { document.querySelector('[data-v3-tab="pools"]')?.click(); requestAnimationFrame(() => { const manager = document.querySelector('[data-v3-native-manager="turbos"]'); if (manager?.getAttribute('aria-expanded') !== 'true') manager?.click(); manager?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); return; } const actionButton = event.target.closest('[data-turbos-position-action]'); if (actionButton) { renderActionPanel(actionButton.dataset.positionId, actionButton.dataset.turbosPositionAction); return; } const maxButton = event.target.closest('[data-turbos-action-sui-max]'); if (maxButton) { const panel = maxButton.closest('[data-turbos-action-panel]'); const positionId = panel?.dataset.turbosActionPanel; const input = panel?.querySelector('[data-turbos-action-sui]'); if (positionId && input) fillMaxSui(input, (message, kind) => positionStatus(positionId, message, kind)).catch((error) => positionStatus(positionId, error?.message || String(error), 'error')); return; } const submit = event.target.closest('[data-turbos-position-submit]'); if (submit) { const panel = submit.closest('[data-turbos-action-panel]'); runPositionAction(panel.dataset.turbosActionPanel, submit.dataset.turbosPositionSubmit); } });
  window.addEventListener('tree:wallet-changed', () => { refreshAddBalance(); load(); }); refreshAddBalance(); load();
}
document.addEventListener('tree:v3-workspace-ready', bind);
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', bind, { once: true }) : queueMicrotask(bind);
