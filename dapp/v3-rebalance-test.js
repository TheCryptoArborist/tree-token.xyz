import {
  SUI_COIN_TYPE, TREE_COIN_TYPE, SUI_DECIMALS, TREE_DECIMALS, TREE_V3_REWARD_TOKENS, TREE_V3_TICK_SPACING, MIN_SUI_GAS_RESERVE_RAW,
  isTreeV3RebalanceTestHost, rawToDecimal, ticksFromDisplayedPrices, minimumAfterSlippage, validateVerifiedPool,
  buildWithdrawAllAndCloseTreeV3Position, buildNoSwapRebalanceTreeV3Position, buildLiquidSwapRebalanceTreeV3Position,
  extractRemoveLiquidityEvent, extractFeeCollectedEvent, extractRewardCollectedEvents,
  extractRebalanceAddLiquidityEvent, simulationSucceeded, positionDeleted,
} from './v3-transaction-core.js';
import { confirmTransaction } from './transaction-review.js';

const ENABLED = isTreeV3RebalanceTestHost(location.hostname);
const SDK_URL = 'https://esm.run/@mysten/sui@2.23.1/transactions';
const busy = new Set();
const slippageByPosition = new Map();
const WIDTH_BY_MODE = Object.freeze({
  'no-swap': Object.freeze({ aggressive: 1, moderate: 3, conservative: 8 }),
  swap: Object.freeze({ aggressive: 2, moderate: 8, conservative: 25 }),
});

function validAddress(value) { return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value : null; }
function addressFrom(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 2) return null;
  for (const key of ['address', 'accountAddress', 'currentAddress', 'walletAddress', 'selectedAddress']) { const found = validAddress(value[key]); if (found) return found; }
  for (const key of ['account', 'currentAccount', 'selectedAccount', 'state', 'walletState']) { const found = addressFrom(value[key], depth + 1); if (found) return found; }
  for (const account of Array.isArray(value.accounts) ? value.accounts : []) { const found = addressFrom(account, depth + 1); if (found) return found; }
  return null;
}
function walletGlobals() { return Object.entries(window).filter(([name, value]) => value && (/(?:tree|sui).*wallet|wallet.*(?:tree|sui)|sign.*execute/i.test(name))); }
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
      for (const methodName of ['signAndExecuteTransaction', 'signAndExecuteTransactionBlock']) {
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
  while (Date.now() < deadline) {
    try { const result = await client.core.getTransaction({ digest, include: { effects: true, balanceChanges: true, events: true } }); if (result) return result; } catch { }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('Transaction finality could not be confirmed within 60 seconds.');
}
async function overview(owner) {
  const response = await fetch(`/api/tree-v3-overview?owner=${encodeURIComponent(owner)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`V3 overview returned ${response.status}.`);
  const payload = await response.json(); validateVerifiedPool(payload?.pool); return payload;
}
async function v3SwapRoute({ tokenIn, tokenOut, amountIn, slippageBps }) {
  const query = new URLSearchParams({ tokenIn, tokenOut, amountIn: String(amountIn), slippageBps: String(slippageBps) });
  const response = await fetch(`/api/tree-swap-quote?${query}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  const route = Array.isArray(payload.routes) ? payload.routes.find((candidate) => candidate.executionKind === 'suidex-v3-direct') : null;
  if (!response.ok || payload.status !== 'ok' || !route) throw new Error(payload.message || 'A verified SuiDex V3 Liquid Swap quote is unavailable.');
  if (BigInt(route.amountIn) !== BigInt(amountIn) || BigInt(route.amountOut) <= 0n || BigInt(route.minAmountOut) <= 0n) throw new Error('The Liquid Swap quote did not match the reviewed amount.');
  return route;
}
function liquidSwapPlan({ suiRaw, treeRaw, priceSuiPerTree }) {
  const price = Number(priceSuiPerTree);
  if (!(price > 0)) throw new Error('The verified SUI/TREE price is unavailable.');
  const suiValueRaw = Number(suiRaw);
  const treeValueInSuiRaw = Number(treeRaw) * price * 1000;
  if (![suiValueRaw, treeValueInSuiRaw].every(Number.isFinite)) throw new Error('The removed position values are too large to quote safely.');
  if (suiValueRaw >= treeValueInSuiRaw) {
    const swapRaw = BigInt(Math.floor((suiValueRaw - treeValueInSuiRaw) / 2));
    if (swapRaw <= 0n) throw new Error('This position is already balanced closely enough for the centered range.');
    return { inputType: SUI_COIN_TYPE, outputType: TREE_COIN_TYPE, swapRaw };
  }
  const swapRaw = BigInt(Math.floor((treeValueInSuiRaw - suiValueRaw) / (2 * price * 1000)));
  if (swapRaw <= 0n) throw new Error('This position is already balanced closely enough for the centered range.');
  return { inputType: TREE_COIN_TYPE, outputType: SUI_COIN_TYPE, swapRaw };
}
function panelFor(positionId) { return [...document.querySelectorAll('[data-v3-rebalance-panel]')].find((panel) => panel.dataset.v3RebalancePanel === positionId) || null; }
function setStatus(panel, message, kind = '') {
  const target = panel?.querySelector('[data-v3-rebalance-status]'); if (!target) return;
  target.textContent = message; target.classList.remove('ok', 'error', 'warning'); if (kind) target.classList.add(kind);
}
function alignedTicks({ currentTick, currentPrice, widthPercent, suiRaw, treeRaw }) {
  const width = widthPercent / 100;
  const suiValue = Number(suiRaw);
  const treeValueInSuiRaw = Number(treeRaw) * currentPrice * 1000;
  const dominantSui = suiValue > Math.max(1, treeValueInSuiRaw) * 19;
  const dominantTree = treeValueInSuiRaw > Math.max(1, suiValue) * 19;
  const rawDelta = Math.abs(Math.log((1 + width) / (1 - width)) / Math.log(1.0001));
  const tickDelta = Math.max(TREE_V3_TICK_SPACING, Math.ceil(rawDelta / TREE_V3_TICK_SPACING) * TREE_V3_TICK_SPACING);
  if (dominantSui) {
    const lower = Math.ceil((currentTick + 1) / TREE_V3_TICK_SPACING) * TREE_V3_TICK_SPACING;
    return { lower, upper: lower + tickDelta };
  }
  if (dominantTree) {
    const upper = Math.floor(currentTick / TREE_V3_TICK_SPACING) * TREE_V3_TICK_SPACING;
    return { lower: upper - tickDelta, upper };
  }

  const targetRawTreePerSui = Number(treeRaw) / Math.max(Number(suiRaw), Number.MIN_VALUE);
  const segments = Math.max(2, Math.round(tickDelta / TREE_V3_TICK_SPACING));
  const currentSqrt = Math.pow(1.0001, currentTick / 2);
  const baseTick = Math.floor(currentTick / TREE_V3_TICK_SPACING) * TREE_V3_TICK_SPACING;
  let best = null;
  for (let leftSegments = 0; leftSegments <= segments; leftSegments += 1) {
    const lower = baseTick - leftSegments * TREE_V3_TICK_SPACING;
    const upper = lower + tickDelta;
    if (!(lower < currentTick && currentTick < upper)) continue;
    const lowerSqrt = Math.pow(1.0001, lower / 2);
    const upperSqrt = Math.pow(1.0001, upper / 2);
    const rawRatio = (currentSqrt - lowerSqrt) * currentSqrt * upperSqrt / (upperSqrt - currentSqrt);
    if (!(rawRatio > 0) || !Number.isFinite(rawRatio)) continue;
    const error = Math.abs(Math.log(rawRatio / targetRawTreePerSui));
    if (!best || error < best.error) best = { lower, upper, error };
  }
  if (!best) throw new Error('The held SUI/TREE ratio could not be mapped to a verified no-swap range.');
  return { lower: best.lower, upper: best.upper };
}
function confirmationText({ positionId, tickLower, tickUpper, removal, fees, deposit, rewards, slippage }) {
  const rewardLines = rewards.filter((reward) => reward.amountRaw > 0n).map((reward) => `${reward.symbol} claimed to wallet: ${rawToDecimal(reward.amountRaw, reward.decimals, reward.decimals)}`);
  return [
    'Run this TEST DApp no-swap V3 rebalance on Sui Mainnet?', '',
    `Old position: ${positionId}`, `New tick range: ${tickLower} to ${tickUpper}`,
    `SUI principal removed: ${rawToDecimal(removal.suiRaw, SUI_DECIMALS, 9)} SUI`,
    `TREE principal removed: ${rawToDecimal(removal.treeRaw, TREE_DECIMALS, 6)} TREE`,
    `SUI fees included: ${rawToDecimal(fees.suiRaw, SUI_DECIMALS, 9)} SUI`,
    `TREE fees included: ${rawToDecimal(fees.treeRaw, TREE_DECIMALS, 6)} TREE`,
    `SUI deposited into new range: ${rawToDecimal(deposit.suiRaw, SUI_DECIMALS, 9)} SUI`,
    `TREE deposited into new range: ${rawToDecimal(deposit.treeRaw, TREE_DECIMALS, 6)} TREE`,
    ...rewardLines, `Protection: ${(slippage / 100).toFixed(2)}%`, '',
    'This is one atomic transaction: withdraw, claim, close, open the new range, and redeposit. No token swap is performed.',
    'The exact transaction passed three Sui Mainnet simulations before this prompt.',
  ].join('\n');
}
async function runNoSwapRebalance(positionId, panel, button) {
  if (busy.has(positionId)) return;
  busy.add(positionId); button.disabled = true;
  try {
    if (!ENABLED) throw new Error('Rebalance execution is available only on the dedicated test DApp.');
    if (panel.dataset.v3RebalanceMode !== 'no-swap') throw new Error('Swap & Recenter is not enabled in this beta.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before rebalancing.');
    const client = await suiClient(); const data = await overview(owner);
    const position = Array.isArray(data.positions) ? data.positions.find((item) => item.objectId === positionId) : null;
    if (!position || validAddress(data.owner)?.toLowerCase() !== owner.toLowerCase()) throw new Error('This verified position is not owned by the connected wallet.');
    const liquidityRaw = BigInt(position.liquidityRaw);
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });
    const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for rebalance gas.');
    const widthPercent = WIDTH_BY_MODE['no-swap'][panel.dataset.v3RebalanceRange];
    if (!widthPercent) throw new Error('Select one of the verified preset ranges.');
    const selectedSlippage = slippageByPosition.get(positionId) ?? 50;
    const { Transaction } = await import(SDK_URL);

    setStatus(panel, 'Simulation 1 of 3: verifying the complete old-position exit and claim amounts…', 'warning');
    const exitTx = buildWithdrawAllAndCloseTreeV3Position({ Transaction, owner, positionId, liquidityRaw });
    const exitSimulation = await simulate(client, exitTx);
    const removal = extractRemoveLiquidityEvent(exitSimulation, positionId);
    const fees = extractFeeCollectedEvent(exitSimulation, positionId);
    const rewards = extractRewardCollectedEvents(exitSimulation, positionId);
    if (!simulationSucceeded(exitSimulation) || !removal || !fees || rewards.length !== TREE_V3_REWARD_TOKENS.length || !positionDeleted(exitSimulation, positionId)) throw new Error('The old-position exit did not fully verify in Mainnet simulation.');

    const suiAvailableRaw = removal.suiRaw + fees.suiRaw;
    const treeAvailableRaw = removal.treeRaw + fees.treeRaw;
    const { lower: tickLower, upper: tickUpper } = alignedTicks({
      currentTick: Number(data.pool.currentTick), currentPrice: Number(data.pool.priceSuiPerTree), widthPercent,
      suiRaw: suiAvailableRaw, treeRaw: treeAvailableRaw,
    });
    setStatus(panel, 'Simulation 2 of 3: verifying the new no-swap range and redeposit…', 'warning');
    const preliminaryTx = buildNoSwapRebalanceTreeV3Position({ Transaction, owner, positionId, liquidityRaw, tickLower, tickUpper });
    const preliminarySimulation = await simulate(client, preliminaryTx);
    const preliminaryDeposit = extractRebalanceAddLiquidityEvent(preliminarySimulation);
    if (!simulationSucceeded(preliminarySimulation) || !preliminaryDeposit || !positionDeleted(preliminarySimulation, positionId)) throw new Error('The proposed atomic no-swap rebalance did not create a funded replacement position in simulation.');

    const minWithdrawSuiRaw = minimumAfterSlippage(removal.suiRaw, selectedSlippage);
    const minWithdrawTreeRaw = minimumAfterSlippage(removal.treeRaw, selectedSlippage);
    const minDepositSuiRaw = minimumAfterSlippage(preliminaryDeposit.suiRaw, selectedSlippage);
    const minDepositTreeRaw = minimumAfterSlippage(preliminaryDeposit.treeRaw, selectedSlippage);
    const finalTx = buildNoSwapRebalanceTreeV3Position({
      Transaction, owner, positionId, liquidityRaw, tickLower, tickUpper,
      minWithdrawSuiRaw, minWithdrawTreeRaw, minDepositSuiRaw, minDepositTreeRaw,
    });
    setStatus(panel, 'Simulation 3 of 3: verifying the exact protected wallet transaction…', 'warning');
    const finalSimulation = await simulate(client, finalTx);
    const finalRemoval = extractRemoveLiquidityEvent(finalSimulation, positionId);
    const finalFees = extractFeeCollectedEvent(finalSimulation, positionId);
    const finalRewards = extractRewardCollectedEvents(finalSimulation, positionId);
    const finalDeposit = extractRebalanceAddLiquidityEvent(finalSimulation);
    if (!simulationSucceeded(finalSimulation) || !finalRemoval || !finalFees || !finalDeposit
      || finalRewards.length !== TREE_V3_REWARD_TOKENS.length || !positionDeleted(finalSimulation, positionId)) throw new Error('The protected rebalance failed its final Mainnet verification.');
    const approved = await confirmTransaction(confirmationText({
      positionId, tickLower, tickUpper, removal: finalRemoval, fees: finalFees, deposit: finalDeposit,
      rewards: finalRewards, slippage: selectedSlippage,
    }), { title: 'TEST DApp · Rebalance V3 Position' });
    if (!approved) { setStatus(panel, 'Rebalance cancelled before wallet approval.'); return; }
    setStatus(panel, 'Review the exact atomic no-swap rebalance in your wallet…', 'warning');
    const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setStatus(panel, 'Wallet approved. Waiting for Sui finality…', 'warning');
    const finalized = await waitForFinality(client, digest);
    const finalizedDeposit = extractRebalanceAddLiquidityEvent(finalized);
    if (!simulationSucceeded(finalized) || !finalizedDeposit || !positionDeleted(finalized, positionId)) throw new Error('The submitted rebalance did not finalize with the verified replacement position.');
    setStatus(panel, `Rebalance completed successfully. Digest: ${digest}`, 'ok');
    document.getElementById('v3RefreshPositions')?.click();
  } catch (error) {
    const message = String(error?.message || error || 'V3 rebalance failed.');
    setStatus(panel, message, /reject|cancel|denied/i.test(message) ? '' : 'error');
  } finally {
    busy.delete(positionId); button.disabled = !ENABLED;
  }
}

function liquidConfirmationText({ positionId, tickLower, tickUpper, removal, fees, deposit, rewards, slippage, plan, route }) {
  const inputDecimals = plan.inputType === SUI_COIN_TYPE ? SUI_DECIMALS : TREE_DECIMALS;
  const inputSymbol = plan.inputType === SUI_COIN_TYPE ? 'SUI' : 'TREE';
  const outputDecimals = plan.outputType === SUI_COIN_TYPE ? SUI_DECIMALS : TREE_DECIMALS;
  const outputSymbol = plan.outputType === SUI_COIN_TYPE ? 'SUI' : 'TREE';
  return [
    'Run this TEST DApp Liquid Swap V3 rebalance on Sui Mainnet?', '',
    `Old position: ${positionId}`, `New centered tick range: ${tickLower} to ${tickUpper}`,
    `SUI principal removed: ${rawToDecimal(removal.suiRaw, SUI_DECIMALS, 9)} SUI`,
    `TREE principal removed: ${rawToDecimal(removal.treeRaw, TREE_DECIMALS, 6)} TREE`,
    `Fees included: ${rawToDecimal(fees.suiRaw, SUI_DECIMALS, 9)} SUI + ${rawToDecimal(fees.treeRaw, TREE_DECIMALS, 6)} TREE`,
    `Swap: ${rawToDecimal(plan.swapRaw, inputDecimals, inputDecimals)} ${inputSymbol} → at least ${rawToDecimal(route.minAmountOut, outputDecimals, outputDecimals)} ${outputSymbol}`,
    `New deposit: ${rawToDecimal(deposit.suiRaw, SUI_DECIMALS, 9)} SUI + ${rawToDecimal(deposit.treeRaw, TREE_DECIMALS, 6)} TREE`,
    ...rewards.filter((reward) => reward.amountRaw > 0n).map((reward) => `${reward.symbol} claimed to wallet: ${rawToDecimal(reward.amountRaw, reward.decimals, reward.decimals)}`),
    `Max slippage: ${(slippage / 100).toFixed(2)}%`, '',
    'This is one atomic transaction: withdraw, claim, close, swap the required imbalance, open a centered range, and redeposit.',
    'The exact transaction passed three Sui Mainnet simulations before this prompt.',
  ].join('\n');
}

async function runLiquidSwapRebalance(positionId, panel, button) {
  if (busy.has(positionId)) return;
  busy.add(positionId); button.disabled = true;
  try {
    if (!ENABLED) throw new Error('Rebalance execution is available only on the dedicated test DApp.');
    const owner = await connectedAddress(); if (!owner) throw new Error('Connect a Sui wallet before rebalancing.');
    const client = await suiClient(); const data = await overview(owner);
    const position = Array.isArray(data.positions) ? data.positions.find((item) => item.objectId === positionId) : null;
    if (!position || validAddress(data.owner)?.toLowerCase() !== owner.toLowerCase()) throw new Error('This verified position is not owned by the connected wallet.');
    const liquidityRaw = BigInt(position.liquidityRaw);
    const balanceResult = await client.core.getBalance({ owner, coinType: SUI_COIN_TYPE });
    const suiBalance = BigInt(balanceResult?.balance?.balance ?? balanceResult?.balance ?? balanceResult?.totalBalance ?? 0);
    if (suiBalance < MIN_SUI_GAS_RESERVE_RAW) throw new Error('Keep at least 0.05 SUI available for rebalance gas.');
    const widthPercent = WIDTH_BY_MODE.swap[panel.dataset.v3RebalanceRange];
    if (!widthPercent) throw new Error('Select one of the verified Liquid Swap range presets.');
    const selectedSlippage = slippageByPosition.get(positionId) ?? 100;
    const { Transaction } = await import(SDK_URL);

    setStatus(panel, 'Simulation 1 of 3: measuring the complete exit, fees, and verified rewards…', 'warning');
    const exitTx = buildWithdrawAllAndCloseTreeV3Position({ Transaction, owner, positionId, liquidityRaw });
    const exitSimulation = await simulate(client, exitTx);
    const removal = extractRemoveLiquidityEvent(exitSimulation, positionId);
    const fees = extractFeeCollectedEvent(exitSimulation, positionId);
    const rewards = extractRewardCollectedEvents(exitSimulation, positionId);
    if (!simulationSucceeded(exitSimulation) || !removal || !fees || rewards.length !== TREE_V3_REWARD_TOKENS.length || !positionDeleted(exitSimulation, positionId)) throw new Error('The old-position exit did not fully verify in Mainnet simulation.');
    const suiAvailableRaw = removal.suiRaw + fees.suiRaw;
    const treeAvailableRaw = removal.treeRaw + fees.treeRaw;
    const plan = liquidSwapPlan({ suiRaw: suiAvailableRaw, treeRaw: treeAvailableRaw, priceSuiPerTree: data.pool.priceSuiPerTree });
    const route = await v3SwapRoute({ tokenIn: plan.inputType, tokenOut: plan.outputType, amountIn: plan.swapRaw, slippageBps: selectedSlippage });
    const { lower: tickLower, upper: tickUpper } = ticksFromDisplayedPrices({
      currentTick: Number(data.pool.currentTick), currentPrice: Number(data.pool.priceSuiPerTree),
      minPrice: Number(data.pool.priceSuiPerTree) * (1 - widthPercent / 100), maxPrice: Number(data.pool.priceSuiPerTree) * (1 + widthPercent / 100),
      tickSpacing: TREE_V3_TICK_SPACING, displayedPriceIncreasesWithTick: false,
    });
    const base = { Transaction, owner, positionId, liquidityRaw, tickLower, tickUpper, inputType: plan.inputType, swapRaw: plan.swapRaw, minSwapOutRaw: BigInt(route.minAmountOut) };
    setStatus(panel, 'Simulation 2 of 3: verifying the atomic Liquid Swap and centered replacement position…', 'warning');
    const preliminaryTx = buildLiquidSwapRebalanceTreeV3Position(base);
    const preliminarySimulation = await simulate(client, preliminaryTx);
    const preliminaryDeposit = extractRebalanceAddLiquidityEvent(preliminarySimulation);
    if (!simulationSucceeded(preliminarySimulation) || !preliminaryDeposit || !positionDeleted(preliminarySimulation, positionId)) throw new Error('The proposed Liquid Swap rebalance did not create a funded replacement position.');
    const finalTx = buildLiquidSwapRebalanceTreeV3Position({
      ...base,
      minWithdrawSuiRaw: minimumAfterSlippage(removal.suiRaw, selectedSlippage), minWithdrawTreeRaw: minimumAfterSlippage(removal.treeRaw, selectedSlippage),
      minDepositSuiRaw: minimumAfterSlippage(preliminaryDeposit.suiRaw, selectedSlippage), minDepositTreeRaw: minimumAfterSlippage(preliminaryDeposit.treeRaw, selectedSlippage),
    });
    setStatus(panel, 'Simulation 3 of 3: verifying the exact slippage-protected wallet transaction…', 'warning');
    const finalSimulation = await simulate(client, finalTx);
    const finalRemoval = extractRemoveLiquidityEvent(finalSimulation, positionId);
    const finalFees = extractFeeCollectedEvent(finalSimulation, positionId);
    const finalRewards = extractRewardCollectedEvents(finalSimulation, positionId);
    const finalDeposit = extractRebalanceAddLiquidityEvent(finalSimulation);
    if (!simulationSucceeded(finalSimulation) || !finalRemoval || !finalFees || !finalDeposit || finalRewards.length !== TREE_V3_REWARD_TOKENS.length || !positionDeleted(finalSimulation, positionId)) throw new Error('The protected Liquid Swap rebalance failed final verification.');
    const approved = await confirmTransaction(liquidConfirmationText({ positionId, tickLower, tickUpper, removal: finalRemoval, fees: finalFees, deposit: finalDeposit, rewards: finalRewards, slippage: selectedSlippage, plan, route }), { title: 'TEST DApp · Liquid Swap Rebalance' });
    if (!approved) { setStatus(panel, 'Liquid Swap rebalance cancelled before wallet approval.'); return; }
    setStatus(panel, 'Review the exact atomic Liquid Swap rebalance in your wallet…', 'warning');
    const signed = await signAndExecute(finalTx); const digest = digestFrom(signed);
    setStatus(panel, 'Wallet approved. Waiting for Sui finality…', 'warning');
    const finalized = await waitForFinality(client, digest);
    if (!simulationSucceeded(finalized) || !extractRebalanceAddLiquidityEvent(finalized) || !positionDeleted(finalized, positionId)) throw new Error('The submitted Liquid Swap rebalance did not finalize with the verified replacement position.');
    setStatus(panel, `Liquid Swap rebalance completed successfully. Digest: ${digest}`, 'ok');
    document.getElementById('v3RefreshPositions')?.click();
  } catch (error) {
    const message = String(error?.message || error || 'V3 Liquid Swap rebalance failed.');
    setStatus(panel, message, /reject|cancel|denied/i.test(message) ? '' : 'error');
  } finally { busy.delete(positionId); button.disabled = !ENABLED; }
}

if (ENABLED) {
  document.addEventListener('click', (event) => {
    const slippage = event.target.closest?.('[data-v3-rebalance-slippage]');
    if (slippage) {
      const panel = slippage.closest('[data-v3-rebalance-panel]'); const positionId = panel?.dataset.v3RebalancePanel; if (!positionId) return;
      slippageByPosition.set(positionId, Number(slippage.dataset.v3RebalanceSlippage));
      panel.querySelectorAll('[data-v3-rebalance-slippage]').forEach((item) => item.classList.toggle('active', item === slippage));
      return;
    }
    const submit = event.target.closest?.('[data-v3-rebalance-submit]');
    if (!submit) return;
    const positionId = submit.dataset.v3RebalanceSubmit; const panel = panelFor(positionId);
    if (panel) (panel.dataset.v3RebalanceMode === 'swap' ? runLiquidSwapRebalance : runNoSwapRebalance)(positionId, panel, submit);
  });
}
