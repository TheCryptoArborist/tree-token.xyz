import {
  SUI_COIN_TYPE, TREE_DECIMALS, SUI_DECIMALS, DEFAULT_SLIPPAGE_BPS, MIN_SUI_GAS_RESERVE_RAW, TREE_V3_REWARD_TOKENS,
  isTreeV3ExecutionHost,
  decimalToRaw, rawToDecimal, ticksFromDisplayedPrices, minimumAfterSlippage, validateVerifiedPool,
  buildCreateTreeV3Position, buildIncreaseTreeV3Position, buildRemoveTreeV3Position,
  buildClaimAllTreeV3Position, buildWithdrawAllAndCloseTreeV3Position,
  extractAddLiquidityEvent, extractRemoveLiquidityEvent, extractFeeCollectedEvent, extractRewardCollectedEvents, simulationSucceeded, positionDeleted,
} from './v3-transaction-core.js';

const EXECUTION_ENABLED = isTreeV3ExecutionHost(location.hostname);
const PRODUCTION_EXECUTION = ['tree-token.xyz', 'www.tree-token.xyz'].includes(location.hostname.toLowerCase());
const SDK_URL = 'https://esm.run/@mysten/sui@2.23.1/transactions';
let slippageBps = DEFAULT_SLIPPAGE_BPS;
let busy = false;
const increaseBusy = new Set();
const increaseSlippage = new Map();
const removeBusy = new Set();
const removePercentage = new Map();
const removeSlippage = new Map();
const claimAllBusy = new Set();

function validAddress(value) { return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value : null; }
function addressFrom(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 2) return null;
  for (const key of ['address','accountAddress','currentAddress','walletAddress','selectedAddress']) { const found = validAddress(value[key]); if (found) return found; }
  for (const key of ['account','currentAccount','selectedAccount','state','walletState']) { const found = addressFrom(value[key], depth + 1); if (found) return found; }
  for (const account of Array.isArray(value.accounts) ? value.accounts : []) { const found = addressFrom(account, depth + 1); if (found) return found; }
  return null;
}
function walletGlobals() {
  return Object.entries(window).filter(([name, value]) => value && (/(?:tree|sui).*wallet|wallet.*(?:tree|sui)|sign.*execute/i.test(name)));
}
async function connectedAddress() {
  const sharedAddress = validAddress(window.playerAddress); if (sharedAddress) return sharedAddress;
  for (const [name, value] of walletGlobals()) {
    const direct = addressFrom(value); if (direct) return direct;
    if (typeof value === 'function' && /(?:get|current|connected).*(?:address|account|wallet|state)/i.test(name)) {
      try { const result = await value(); const found = validAddress(result) || addressFrom(result); if (found) return found; } catch { }
    }
  }
  return validAddress(document.getElementById('dappWallet')?.dataset?.address);
}
async function suiClient() {
  if (typeof window.initSuiClient === 'function') return window.initSuiClient();
  for (const [name, value] of Object.entries(window)) {
    if (value?.core?.simulateTransaction) return value;
    if (typeof value === 'function' && /sui.*client|client.*sui/i.test(name)) { try { const client = await value(); if (client?.core?.simulateTransaction) return client; } catch { } }
  }
  throw new Error('The Sui Mainnet client is unavailable.');
}
async function signAndExecute(transaction) {
  for (const [name, value] of walletGlobals()) {
    if (typeof value === 'function' && /sign.*execute/i.test(name)) {
      try { return await value(transaction); } catch (first) {
        if (/reject|cancel|denied/i.test(String(first?.message || first))) throw first;
        try { return await value({ transaction }); } catch (second) { if (/reject|cancel|denied/i.test(String(second?.message || second))) throw second; }
      }
    }
    for (const object of [value, value?.wallet, value?.currentWallet, value?.selectedWallet, value?.state?.wallet].filter(Boolean)) {
      for (const methodName of ['signAndExecuteTransaction','signAndExecuteTransactionBlock']) {
        if (typeof object?.[methodName] !== 'function') continue;
        try { return await object[methodName]({ transaction }); } catch (first) {
          try { return await object[methodName](transaction); } catch (second) { if (/reject|cancel|denied/i.test(String(second?.message || second))) throw second; }
        }
      }
    }
  }
  throw new Error('The connected wallet does not expose a compatible signing method.');
}
async function simulate(client, transaction) {
  let lastError;
  for (const request of [
    { transaction, checksEnabled: true, include: { effects: true, events: true, balanceChanges: true, commandResults: true } },
    { transaction, include: { effects: true, events: true, balanceChanges: true, commandResults: true } },
    { transaction, checksEnabled: true },
  ]) { try { return await client.core.simulateTransaction(request); } catch (error) { lastError = error; } }
  throw lastError || new Error('Sui Mainnet simulation failed.');
}
function digestFrom(result) { return result?.digest || result?.transactionDigest || result?.effects?.transactionDigest || result?.result?.digest || null; }
async function waitForFinality(client, digest) {
  if (!digest) throw new Error('The wallet returned no transaction digest.');
  if (client?.core?.waitForTransaction) return client.core.waitForTransaction({ digest, timeout: 60000, include: { effects: true, balanceChanges: true, events: true } });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { try { const result = await client.core.getTransaction({ digest, include: { effects: true, balanceChanges: true, events: true } }); if (result) return result; } catch { } await new Promise((resolve) => setTimeout(resolve, 1500)); }
  throw new Error('Transaction finality could not be confirmed within 60 seconds.');
}
function node(...ids) { for (const id of ids) { const found = document.getElementById(id); if (found) return found; } return null; }
function setStatus(message, kind = '') { const target = node('v3CreateStatus','v3AddStatus','v3Status'); if (!target) return; target.textContent = message; target.classList.remove('ok','error','warning'); if (kind) target.classList.add(kind); }
async function overview(owner = null) { const query = owner ? `?owner=${encodeURIComponent(owner)}` : ''; const response = await fetch(`/api/tree-v3-overview${query}`, { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!response.ok) throw new Error(`V3 overview returned ${response.status}.`); const payload = await response.json(); validateVerifiedPool(payload?.pool); return payload; }
function createButton() { return node('v3CreatePosition') || document.querySelector('#v3 .v3-disabled-action') || [...document.querySelectorAll('#v3 button')].find((item) => /position transaction builder|create.*position/i.test(item.textContent || '')); }
function installControls(button) {
  if (!document.getElementById('v3TransactionControls')) {
    const wrapper = document.createElement('div'); wrapper.id = 'v3TransactionControls'; wrapper.className = 'v3-transaction-controls';
    wrapper.innerHTML = '<div class="v3-slippage-row"><span>Position slippage</span><div role="group" aria-label="V3 position slippage"><button type="button" data-v3-position-slippage="50">0.5%</button><button class="active" type="button" data-v3-position-slippage="100">1%</button><button type="button" data-v3-position-slippage="200">2%</button></div></div><p class="status" id="v3CreateStatus" role="status" aria-live="polite"></p>';
    button.parentNode?.insertBefore(wrapper, button);
    wrapper.querySelectorAll('[data-v3-position-slippage]').forEach((choice) => choice.addEventListener('click', () => { slippageBps = Number(choice.dataset.v3PositionSlippage); wrapper.querySelectorAll('[data-v3-position-slippage]').forEach((item) => item.classList.toggle('active', item === choice)); }));
  }
  button.id = 'v3CreatePosition'; button.dataset.v3TransactionsReady = 'true'; button.disabled = !EXECUTION_ENABLED;
  button.textContent = EXECUTION_ENABLED ? 'Create SUI/TREE V3 Position' : 'V3 position execution unavailable';
  if (EXECUTION_ENABLED) {
    const phaseBadge = document.querySelector('#v3 .section-heading .data-state');
    const plannerNote = document.querySelector('#v3 .v3-add-card .v3-status');
    if (phaseBadge) phaseBadge.textContent = PRODUCTION_EXECUTION ? 'Mainnet transactions live' : 'Preview transaction review';
    if (plannerNote) plannerNote.textContent = 'Transaction builder enabled. Nothing is signed or submitted until you approve the final wallet request.';
    button.classList.remove('v3-disabled-action', 'secondary'); button.classList.add('button', 'primary'); setStatus('Every position transaction is simulated twice before wallet approval.');
  }
  else setStatus('Native V3 position execution is unavailable on this host.');
}
function confirmText(data) {
  return ['Create this SUI/TREE V3 position?','',`Range ticks: ${data.tickLower} to ${data.tickUpper}`,`Maximum TREE supplied: ${rawToDecimal(data.treeRaw,TREE_DECIMALS,6)} TREE`,`Maximum SUI supplied: ${rawToDecimal(data.suiRaw,SUI_DECIMALS,9)} SUI`,`Simulated TREE deposit: ${rawToDecimal(data.preliminary.treeRaw,TREE_DECIMALS,6)} TREE`,`Simulated SUI deposit: ${rawToDecimal(data.preliminary.suiRaw,SUI_DECIMALS,9)} SUI`,`Minimum TREE deposit: ${rawToDecimal(data.minTreeRaw,TREE_DECIMALS,6)} TREE`,`Minimum SUI deposit: ${rawToDecimal(data.minSuiRaw,SUI_DECIMALS,9)} SUI`,`Slippage: ${(slippageBps/100).toFixed(2)}%`,'','The exact transaction was simulated again before this wallet request.'].join('\n');
}
function increasePanel(positionId) { return [...document.querySelectorAll('[data-v3-increase-panel]')].find((panel) => panel.dataset.v3IncreasePanel === positionId) || null; }
function setIncreaseStatus(panel, message, kind = '') { const target = panel?.querySelector('[data-v3-increase-status]'); if (!target) return; target.textContent = message; target.classList.remove('ok','error','warning'); if (kind) target.classList.add(kind); }
function increaseConfirmText(data) {
  return ['Increase this SUI/TREE V3 position?','',`Position: ${data.positionId}`,`Maximum TREE supplied: ${rawToDecimal(data.treeRaw,TREE_DECIMALS,6)} TREE`,`Maximum SUI supplied: ${rawToDecimal(data.suiRaw,SUI_DECIMALS,9)} SUI`,`Simulated TREE deposit: ${rawToDecimal(data.preliminary.treeRaw,TREE_DECIMALS,6)} TREE`,`Simulated SUI deposit: ${rawToDecimal(data.preliminary.suiRaw,SUI_DECIMALS,9)} SUI`,`Minimum TREE deposit: ${rawToDecimal(data.minTreeRaw,TREE_DECIMALS,6)} TREE`,`Minimum SUI deposit: ${rawToDecimal(data.minSuiRaw,SUI_DECIMALS,9)} SUI`,`Slippage: ${(data.slippage/100).toFixed(2)}%`,'','The exact increase transaction was simulated again before this wallet request.'].join('\n');
}
function removePanel(positionId) { return [...document.querySelectorAll('[data-v3-remove-panel]')].find((panel) => panel.dataset.v3RemovePanel === positionId) || null; }
function setRemoveStatus(panel, message, kind = '') { const target = panel?.querySelector('[data-v3-remove-status]'); if (!target) return; target.textContent = message; target.classList.remove('ok','error','warning'); if (kind) target.classList.add(kind); }
function removeConfirmText(data) {
  return ['Remove liquidity from this SUI/TREE V3 position?','',`Position: ${data.positionId}`,`Position share: ${data.percentage}%`,`Liquidity units removed: ${data.liquidityRaw}`,`Simulated SUI received: ${rawToDecimal(data.preliminary.suiRaw,SUI_DECIMALS,9)} SUI`,`Simulated TREE received: ${rawToDecimal(data.preliminary.treeRaw,TREE_DECIMALS,6)} TREE`,`Minimum SUI received: ${rawToDecimal(data.minSuiRaw,SUI_DECIMALS,9)} SUI`,`Minimum TREE received: ${rawToDecimal(data.minTreeRaw,TREE_DECIMALS,6)} TREE`,`Slippage: ${(data.slippage/100).toFixed(2)}%`,'','The exact withdrawal transaction was simulated again before this wallet request.'].join('\n');
}
function claimPanel(positionId) { return [...document.querySelectorAll('[data-v3-claim-panel]')].find((panel) => panel.dataset.v3ClaimPanel === positionId) || null; }
function setClaimStatus(panel, message, kind = '') { const target = panel?.querySelector('[data-v3-claim-status]'); if (!target) return; target.textContent = message; target.classList.remove('ok','error','warning'); if (kind) target.classList.add(kind); }
function rewardSummary(rewards) { return rewards.map((reward) => `${rawToDecimal(reward.amountRaw,reward.decimals,reward.decimals)} ${reward.symbol}`).join(', '); }
function claimAllConfirmText({ positionId, fees, rewards }) {
  const lines = ['Claim all fees and rewards from this SUI/TREE V3 position?','',`Position: ${positionId}`,`SUI fees: ${rawToDecimal(fees.suiRaw,SUI_DECIMALS,9)} SUI`,`TREE fees: ${rawToDecimal(fees.treeRaw,TREE_DECIMALS,6)} TREE`];
  if (rewards.length) lines.push(...rewards.map((reward) => `${reward.symbol}: ${rawToDecimal(reward.amountRaw,reward.decimals,reward.decimals)}`));
  return [...lines,'','Fees and every positive verified reward are combined in one wallet transaction.'].join('\n');
}
function exitConfirmText({ positionId, liquidityRaw, preliminary, fees, rewards, minSuiRaw, minTreeRaw, slippage }) {
  return ['Withdraw everything and permanently close this SUI/TREE V3 position?','',`Position: ${positionId}`,`Liquidity units removed: ${liquidityRaw}`,`Simulated SUI principal: ${rawToDecimal(preliminary.suiRaw,SUI_DECIMALS,9)} SUI`,`Simulated TREE principal: ${rawToDecimal(preliminary.treeRaw,TREE_DECIMALS,6)} TREE`,`Minimum SUI principal: ${rawToDecimal(minSuiRaw,SUI_DECIMALS,9)} SUI`,`Minimum TREE principal: ${rawToDecimal(minTreeRaw,TREE_DECIMALS,6)} TREE`,`SUI fees: ${rawToDecimal(fees.suiRaw,SUI_DECIMALS,9)} SUI`,`TREE fees: ${rawToDecimal(fees.treeRaw,TREE_DECIMALS,6)} TREE`,...rewards.filter((reward) => reward.amountRaw > 0n).map((reward) => `${reward.symbol}: ${rawToDecimal(reward.amountRaw,reward.decimals,reward.decimals)}`),`Slippage: ${(slippage/100).toFixed(2)}%`,'','This single atomic transaction withdraws all assets, claims fees and rewards, and deletes the position object.'].join('\n');
}
const POSITION_MANAGEMENT_PANEL_SELECTOR = '.v3-increase-panel,.v3-remove-panel,.v3-claim-panel';
const POSITION_MANAGEMENT_BUTTON_SELECTOR = '[data-v3-increase-position],[data-v3-remove-position],[data-v3-claim-all-position]';
function togglePositionManagementPanel(button, panel, onOpen) {
  const card = button.closest('.v3-position-card');
  const shouldOpen = panel.hidden;
  if (card) {
    card.querySelectorAll(POSITION_MANAGEMENT_PANEL_SELECTOR).forEach((item) => { item.hidden = true; });
    card.querySelectorAll(POSITION_MANAGEMENT_BUTTON_SELECTOR).forEach((item) => {
      item.setAttribute('aria-expanded', 'false');
      item.classList.remove('active');
    });
  }
  if (!shouldOpen) return;
  panel.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  button.classList.add('active');
  onOpen?.();
}
async function increasePosition(positionId, panel, button) {
  if (increaseBusy.has(positionId)) return;
  increaseBusy.add(positionId); button.disabled = true;
  try {
    if (!EXECUTION_ENABLED) throw new Error('V3 position management is unavailable on this host.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before increasing a position.');
    const client = await suiClient(); const data = await overview(owner);
    const position = Array.isArray(data.positions) ? data.positions.find((item) => item.objectId === positionId) : null;
    if (!position || validAddress(data.owner)?.toLowerCase() !== owner.toLowerCase()) throw new Error('This verified position is not owned by the connected wallet.');
    const suiRaw = decimalToRaw(panel.querySelector('[data-v3-increase-sui]')?.value, SUI_DECIMALS);
    const treeRaw = decimalToRaw(panel.querySelector('[data-v3-increase-tree]')?.value, TREE_DECIMALS);
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });
    const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the increase deposit.');
    const { Transaction } = await import(SDK_URL);
    setIncreaseStatus(panel,'Building and simulating the proposed liquidity increase…','warning');
    const preliminaryTx = await buildIncreaseTreeV3Position({ Transaction, client, owner, positionId, treeRaw, suiRaw });
    const preliminarySimulation = await simulate(client, preliminaryTx);
    if (!simulationSucceeded(preliminarySimulation)) throw new Error('The proposed liquidity increase failed Sui Mainnet simulation.');
    const preliminary = extractAddLiquidityEvent(preliminarySimulation, positionId);
    if (!preliminary) throw new Error('SuiDex did not return verified increase amounts during simulation.');
    const selectedSlippage = increaseSlippage.get(positionId) ?? 50;
    const minTreeRaw = minimumAfterSlippage(preliminary.treeRaw, selectedSlippage);
    const minSuiRaw = minimumAfterSlippage(preliminary.suiRaw, selectedSlippage);
    const finalTx = await buildIncreaseTreeV3Position({ Transaction, client, owner, positionId, treeRaw, suiRaw, minTreeRaw, minSuiRaw });
    const finalSimulation = await simulate(client, finalTx);
    if (!simulationSucceeded(finalSimulation) || !extractAddLiquidityEvent(finalSimulation, positionId)) throw new Error('The slippage-protected increase failed Sui Mainnet simulation.');
    if (!window.confirm(increaseConfirmText({ positionId, treeRaw, suiRaw, minTreeRaw, minSuiRaw, preliminary, slippage: selectedSlippage }))) { setIncreaseStatus(panel,'Liquidity increase cancelled before wallet approval.'); return; }
    setIncreaseStatus(panel,'Review the exact SUI/TREE increase in your wallet…','warning');
    const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setIncreaseStatus(panel,'Wallet approved. Waiting for Sui finality…','warning');
    const finalized = await waitForFinality(client, digest); if (!simulationSucceeded(finalized)) throw new Error('The submitted increase did not finalize successfully.');
    setIncreaseStatus(panel,`Liquidity increased successfully. Digest: ${digest}`,'ok');
    node('v3RefreshPositions')?.click();
  } catch (error) {
    const message = String(error?.message || error || 'V3 liquidity increase failed.');
    setIncreaseStatus(panel,message,/reject|cancel|denied/i.test(message)?'':'error');
  } finally { increaseBusy.delete(positionId); button.disabled = !EXECUTION_ENABLED; }
}
async function removePosition(positionId, panel, button) {
  if (removeBusy.has(positionId)) return;
  removeBusy.add(positionId); button.disabled = true;
  try {
    if (!EXECUTION_ENABLED) throw new Error('V3 position management is unavailable on this host.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before removing liquidity.');
    const client = await suiClient(); const data = await overview(owner);
    const position = Array.isArray(data.positions) ? data.positions.find((item) => item.objectId === positionId) : null;
    if (!position || validAddress(data.owner)?.toLowerCase() !== owner.toLowerCase()) throw new Error('This verified position is not owned by the connected wallet.');
    const availableLiquidity = BigInt(position.liquidityRaw);
    const percentage = removePercentage.get(positionId) ?? 10;
    const liquidityRaw = percentage === 100 ? availableLiquidity : availableLiquidity * BigInt(percentage) / 100n;
    if (liquidityRaw <= 0n || liquidityRaw > availableLiquidity) throw new Error('The selected removal amount is invalid.');
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });
    const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for the removal transaction gas.');
    const { Transaction } = await import(SDK_URL);
    const selectedSlippage = removeSlippage.get(positionId) ?? 50;
    const closesPosition = percentage === 100;
    setRemoveStatus(panel,closesPosition ? 'Simulating the complete withdrawal, claims, and position close…' : 'Building and simulating the proposed liquidity removal…','warning');
    const preliminaryTx = closesPosition
      ? buildWithdrawAllAndCloseTreeV3Position({ Transaction, owner, positionId, liquidityRaw })
      : buildRemoveTreeV3Position({ Transaction, owner, positionId, liquidityRaw });
    const preliminarySimulation = await simulate(client, preliminaryTx);
    if (!simulationSucceeded(preliminarySimulation)) throw new Error(closesPosition ? 'The complete withdrawal and close failed Sui Mainnet simulation.' : 'The proposed liquidity removal failed Sui Mainnet simulation.');
    const preliminary = extractRemoveLiquidityEvent(preliminarySimulation, positionId);
    if (!preliminary || preliminary.liquidityRaw !== liquidityRaw) throw new Error('SuiDex did not return the exact verified removal during simulation.');
    const minTreeRaw = minimumAfterSlippage(preliminary.treeRaw, selectedSlippage);
    const minSuiRaw = minimumAfterSlippage(preliminary.suiRaw, selectedSlippage);
    const preliminaryFees = closesPosition ? extractFeeCollectedEvent(preliminarySimulation, positionId) : null;
    const preliminaryRewards = closesPosition ? extractRewardCollectedEvents(preliminarySimulation, positionId) : [];
    if (closesPosition && (!preliminaryFees || preliminaryRewards.length !== TREE_V3_REWARD_TOKENS.length || !positionDeleted(preliminarySimulation, positionId))) throw new Error('The full-exit simulation did not verify every fee, reward, and position deletion.');
    const finalTx = closesPosition
      ? buildWithdrawAllAndCloseTreeV3Position({ Transaction, owner, positionId, liquidityRaw, minTreeRaw, minSuiRaw })
      : buildRemoveTreeV3Position({ Transaction, owner, positionId, liquidityRaw, minTreeRaw, minSuiRaw });
    const finalSimulation = await simulate(client, finalTx);
    const protectedRemoval = extractRemoveLiquidityEvent(finalSimulation, positionId);
    const verifiedFees = closesPosition ? extractFeeCollectedEvent(finalSimulation, positionId) : null;
    const verifiedRewards = closesPosition ? extractRewardCollectedEvents(finalSimulation, positionId) : [];
    if (!simulationSucceeded(finalSimulation) || !protectedRemoval || protectedRemoval.liquidityRaw !== liquidityRaw
      || (closesPosition && (!verifiedFees || verifiedRewards.length !== TREE_V3_REWARD_TOKENS.length || !positionDeleted(finalSimulation, positionId)))) throw new Error(closesPosition ? 'The protected full exit failed its second Mainnet simulation.' : 'The slippage-protected removal failed Sui Mainnet simulation.');
    const confirmation = closesPosition
      ? exitConfirmText({ positionId, liquidityRaw, preliminary: protectedRemoval, fees: verifiedFees, rewards: verifiedRewards, minSuiRaw, minTreeRaw, slippage: selectedSlippage })
      : removeConfirmText({ positionId, percentage, liquidityRaw, minTreeRaw, minSuiRaw, preliminary, slippage: selectedSlippage });
    if (!window.confirm(confirmation)) { setRemoveStatus(panel,closesPosition ? 'Full exit cancelled before wallet approval.' : 'Liquidity removal cancelled before wallet approval.'); return; }
    setRemoveStatus(panel,closesPosition ? 'Review the complete withdrawal and position deletion in your wallet…' : 'Review the exact SUI/TREE withdrawal in your wallet…','warning');
    const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setRemoveStatus(panel,'Wallet approved. Waiting for Sui finality…','warning');
    const finalized = await waitForFinality(client, digest); const finalizedRemoval = extractRemoveLiquidityEvent(finalized, positionId);
    if (!simulationSucceeded(finalized) || !finalizedRemoval || finalizedRemoval.liquidityRaw !== liquidityRaw
      || (closesPosition && !positionDeleted(finalized, positionId))) throw new Error(closesPosition ? 'The submitted full exit did not finalize with the verified position deletion.' : 'The submitted removal did not finalize with the expected result.');
    setRemoveStatus(panel,closesPosition ? `All assets claimed and withdrawn; position closed successfully. Digest: ${digest}` : `Liquidity removed successfully. Digest: ${digest}`,'ok');
    node('v3RefreshPositions')?.click();
  } catch (error) {
    const message = String(error?.message || error || 'V3 liquidity removal failed.');
    setRemoveStatus(panel,message,/reject|cancel|denied/i.test(message)?'':'error');
  } finally { removeBusy.delete(positionId); button.disabled = !EXECUTION_ENABLED; }
}
async function collectAll(positionId, panel, button) {
  if (claimAllBusy.has(positionId)) return;
  claimAllBusy.add(positionId); button.disabled = true;
  try {
    if (!EXECUTION_ENABLED) throw new Error('V3 position management is unavailable on this host.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before claiming fees and rewards.');
    const client = await suiClient(); const data = await overview(owner);
    const position = Array.isArray(data.positions) ? data.positions.find((item) => item.objectId === positionId) : null;
    if (!position || validAddress(data.owner)?.toLowerCase() !== owner.toLowerCase()) throw new Error('This verified position is not owned by the connected wallet.');
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });
    const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for claim-all gas.');
    const { Transaction } = await import(SDK_URL);
    setClaimStatus(panel,'Checking all SUI/TREE fees and verified rewards on Mainnet…','warning');
    const preliminaryTx = buildClaimAllTreeV3Position({ Transaction, owner, positionId });
    const preliminarySimulation = await simulate(client, preliminaryTx);
    const preliminaryFees = extractFeeCollectedEvent(preliminarySimulation, positionId);
    const preliminaryRewards = extractRewardCollectedEvents(preliminarySimulation, positionId);
    if (!simulationSucceeded(preliminarySimulation) || !preliminaryFees || preliminaryRewards.length !== TREE_V3_REWARD_TOKENS.length) throw new Error('The proposed claim-all transaction did not verify every fee and recognized reward.');
    const positiveRewards = preliminaryRewards.filter((reward) => reward.amountRaw > 0n);
    const hasFees = preliminaryFees.suiRaw > 0n || preliminaryFees.treeRaw > 0n;
    if (!hasFees && !positiveRewards.length) { setClaimStatus(panel,'No fees or verified rewards are claimable right now. No wallet request was made.','ok'); return; }
    const rewardCoinTypes = positiveRewards.map((reward) => reward.coinType);
    const finalTx = buildClaimAllTreeV3Position({ Transaction, owner, positionId, rewardCoinTypes });
    const finalSimulation = await simulate(client, finalTx);
    const verifiedFees = extractFeeCollectedEvent(finalSimulation, positionId);
    const verifiedRewards = extractRewardCollectedEvents(finalSimulation, positionId);
    if (!simulationSucceeded(finalSimulation) || !verifiedFees || verifiedRewards.length !== rewardCoinTypes.length
      || verifiedRewards.some((reward) => reward.amountRaw <= 0n || !rewardCoinTypes.includes(reward.coinType))) throw new Error('The optimized claim-all transaction failed its second Mainnet simulation.');
    if (!window.confirm(claimAllConfirmText({ positionId, fees: verifiedFees, rewards: verifiedRewards }))) { setClaimStatus(panel,'Claim All cancelled before wallet approval.'); return; }
    setClaimStatus(panel,'Review the combined fee and reward claim in your wallet…','warning');
    const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setClaimStatus(panel,'Wallet approved. Waiting for Sui finality…','warning');
    const finalized = await waitForFinality(client, digest); const claimedFees = extractFeeCollectedEvent(finalized, positionId); const claimedRewards = extractRewardCollectedEvents(finalized, positionId);
    if (!simulationSucceeded(finalized) || !claimedFees || claimedRewards.length !== rewardCoinTypes.length) throw new Error('The submitted Claim All transaction did not finalize with the expected events.');
    const claimedSummary = [`${rawToDecimal(claimedFees.suiRaw,SUI_DECIMALS,9)} SUI fees`,`${rawToDecimal(claimedFees.treeRaw,TREE_DECIMALS,6)} TREE fees`,rewardSummary(claimedRewards)].filter(Boolean).join(' · ');
    setClaimStatus(panel,`Claim All completed: ${claimedSummary}. Digest: ${digest}`,'ok');
    node('v3RefreshPositions')?.click();
  } catch (error) {
    const message = String(error?.message || error || 'V3 Claim All failed.');
    setClaimStatus(panel,message,/reject|cancel|denied/i.test(message)?'':'error');
  } finally { claimAllBusy.delete(positionId); button.disabled = !EXECUTION_ENABLED; }
}
function bindIncreaseActions() {
  document.addEventListener('click', (event) => {
    const openButton = event.target.closest?.('[data-v3-increase-position]');
    if (openButton) {
      const positionId = openButton.dataset.v3IncreasePosition; const panel = increasePanel(positionId); if (!panel) return;
      togglePositionManagementPanel(openButton, panel, () => setIncreaseStatus(panel,'Enter maximum token amounts. Two Mainnet simulations run before wallet approval.'));
      return;
    }
    const removeButton = event.target.closest?.('[data-v3-remove-position]');
    if (removeButton) {
      const positionId = removeButton.dataset.v3RemovePosition; const panel = removePanel(positionId); if (!panel) return;
      togglePositionManagementPanel(removeButton, panel, () => setRemoveStatus(panel,'Choose how much liquidity to remove. Two Mainnet simulations run before wallet approval.'));
      return;
    }
    const claimButton = event.target.closest?.('[data-v3-claim-all-position]');
    if (claimButton) {
      const positionId = claimButton.dataset.v3ClaimAllPosition; const panel = claimPanel(positionId); if (!panel) return;
      togglePositionManagementPanel(claimButton, panel, () => setClaimStatus(panel,'Claim all SUI/TREE fees and every positive verified reward in one transaction.'));
      return;
    }
    const slippageButton = event.target.closest?.('[data-v3-increase-slippage]');
    if (slippageButton) {
      const panel = slippageButton.closest('[data-v3-increase-panel]'); const positionId = panel?.dataset.v3IncreasePanel; if (!positionId) return;
      increaseSlippage.set(positionId, Number(slippageButton.dataset.v3IncreaseSlippage));
      panel.querySelectorAll('[data-v3-increase-slippage]').forEach((item) => item.classList.toggle('active', item === slippageButton));
      return;
    }
    const submitButton = event.target.closest?.('[data-v3-increase-submit]');
    if (submitButton) { const positionId = submitButton.dataset.v3IncreaseSubmit; const panel = increasePanel(positionId); if (panel) increasePosition(positionId, panel, submitButton); return; }
    const percentageButton = event.target.closest?.('[data-v3-remove-percent]');
    if (percentageButton) {
      const panel = percentageButton.closest('[data-v3-remove-panel]'); const positionId = panel?.dataset.v3RemovePanel; if (!positionId) return;
      const percentage = Number(percentageButton.dataset.v3RemovePercent);
      removePercentage.set(positionId, percentage);
      panel.querySelectorAll('[data-v3-remove-percent]').forEach((item) => item.classList.toggle('active', item === percentageButton));
      const submit = panel.querySelector('[data-v3-remove-submit]');
      if (submit) { submit.textContent = percentage === 100 ? 'Withdraw All & Close Position' : 'Simulate Removal'; submit.classList.toggle('danger', percentage === 100); }
      setRemoveStatus(panel, percentage === 100 ? 'This atomic exit withdraws all liquidity, claims fees and rewards, and closes the position.' : 'Choose how much liquidity to remove. Two Mainnet simulations run before wallet approval.');
      return;
    }
    const removeSlippageButton = event.target.closest?.('[data-v3-remove-slippage]');
    if (removeSlippageButton) {
      const panel = removeSlippageButton.closest('[data-v3-remove-panel]'); const positionId = panel?.dataset.v3RemovePanel; if (!positionId) return;
      removeSlippage.set(positionId, Number(removeSlippageButton.dataset.v3RemoveSlippage));
      panel.querySelectorAll('[data-v3-remove-slippage]').forEach((item) => item.classList.toggle('active', item === removeSlippageButton));
      return;
    }
    const removeSubmitButton = event.target.closest?.('[data-v3-remove-submit]');
    if (removeSubmitButton) { const positionId = removeSubmitButton.dataset.v3RemoveSubmit; const panel = removePanel(positionId); if (panel) removePosition(positionId, panel, removeSubmitButton); return; }
    const claimSubmitButton = event.target.closest?.('[data-v3-claim-submit]');
    if (claimSubmitButton) { const positionId = claimSubmitButton.dataset.v3ClaimSubmit; const panel = claimPanel(positionId); if (panel) collectAll(positionId, panel, claimSubmitButton); }
  });
}
async function createPosition(button) {
  if (busy) return; busy = true; button.disabled = true;
  try {
    if (!EXECUTION_ENABLED) throw new Error('Native V3 position execution is unavailable on this host.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before creating a position.');
    const client = await suiClient(); const data = await overview();
    const suiRaw = decimalToRaw(node('v3SuiAmount','v3AmountSui')?.value, SUI_DECIMALS); const treeRaw = decimalToRaw(node('v3TreeAmount','v3AmountTree')?.value, TREE_DECIMALS);
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE }); const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < suiRaw + MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for gas after the position deposit.');
    const minPrice = Number(node('v3MinPrice','v3MinimumPrice')?.value); const maxPrice = Number(node('v3MaxPrice','v3MaximumPrice')?.value);
    const { lower: tickLower, upper: tickUpper } = ticksFromDisplayedPrices({ currentTick: Number(data.pool.currentTick), currentPrice: Number(data.pool.priceSuiPerTree), minPrice, maxPrice, tickSpacing: Number(data.pool.tickSpacing), displayedPriceIncreasesWithTick: false });
    const { Transaction } = await import(SDK_URL);
    setStatus('Building and simulating the proposed SUI/TREE position…','warning');
    const preliminaryTx = await buildCreateTreeV3Position({ Transaction, client, owner, treeRaw, suiRaw, tickLower, tickUpper });
    const preliminarySimulation = await simulate(client, preliminaryTx); if (!simulationSucceeded(preliminarySimulation)) throw new Error('The proposed V3 position failed Sui Mainnet simulation.');
    const preliminary = extractAddLiquidityEvent(preliminarySimulation); if (!preliminary) throw new Error('SuiDex did not return verified add-liquidity amounts during simulation.');
    const minTreeRaw = minimumAfterSlippage(preliminary.treeRaw, slippageBps); const minSuiRaw = minimumAfterSlippage(preliminary.suiRaw, slippageBps);
    const finalTx = await buildCreateTreeV3Position({ Transaction, client, owner, treeRaw, suiRaw, tickLower, tickUpper, minTreeRaw, minSuiRaw });
    const finalSimulation = await simulate(client, finalTx); if (!simulationSucceeded(finalSimulation)) throw new Error('The slippage-protected V3 transaction failed Sui Mainnet simulation.');
    if (!window.confirm(confirmText({ tickLower, tickUpper, treeRaw, suiRaw, minTreeRaw, minSuiRaw, preliminary }))) { setStatus('Position creation cancelled before wallet approval.'); return; }
    setStatus('Review the exact SUI/TREE position transaction in your wallet…','warning'); const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setStatus('Wallet approved. Waiting for Sui finality…','warning'); const finalized = await waitForFinality(client, digest); if (!simulationSucceeded(finalized)) throw new Error('The submitted V3 transaction did not finalize successfully.');
    setStatus(`Position created successfully. Digest: ${digest}`,'ok'); document.querySelector('[data-v3-tab="positions"],[data-v3-panel-target="positions"]')?.click(); node('v3RefreshPositions')?.click();
  } catch (error) { const message = String(error?.message || error || 'V3 position creation failed.'); setStatus(message,/reject|cancel|denied/i.test(message)?'':'error'); }
  finally { busy = false; button.disabled = !EXECUTION_ENABLED; }
}
function initialize() {
  bindIncreaseActions();
  const activate = () => { const button = createButton(); if (!button || button.dataset.v3TransactionsReady === 'true') return false; installControls(button); button.addEventListener('click', () => createPosition(button)); return true; };
  if (activate()) return; const observer = new MutationObserver(() => { if (activate()) observer.disconnect(); }); observer.observe(document.documentElement,{childList:true,subtree:true}); setTimeout(() => observer.disconnect(),30000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true}); else initialize();
