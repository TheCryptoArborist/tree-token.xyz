import { Transaction } from 'https://esm.run/@mysten/sui@2.23.1/transactions';
import { SuiGrpcClient } from 'https://esm.run/@mysten/sui@2.23.1/grpc';

const SUI_TYPE = '0x2::sui::SUI';
const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const SUI_DECIMALS = 9;
const TREE_DECIMALS = 6;
const SUI_GAS_RESERVE_RAW = 100_000_000n;
const NFTREE_RESERVE_RAW = 25n * 1_000_000_000n;
const QUOTE_MAX_AGE_MS = 30_000;
const MAX_EXECUTABLE_PRICE_IMPACT = 5;
const QUOTE_URL = '/api/tree-swap-quote';
const RPC_URL = 'https://fullnode.mainnet.sui.io:443';
const V2_PACKAGE = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
const V2_FACTORY = '0x81c286135713b4bf2e78c548f5643766b5913dcd27a8e76469f146ab811e922d';
const V2_ROUTER = '0x9cdbbd092634efdc0e7033dc1c49d9ea5fc9bc5969ba708f55e05b6fcac12177';
const V2_POOL = '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';
const V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
const V3_GLOBAL_CONFIG = '0x0999bbc9c063580eca62e888b8f0d8e6e9159cd9db1b8a8c88e448a2b5dd4d4d';
const V3_POOL = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
const CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006';
const ALLOWED_MOVE_PACKAGES = new Set(['0x2', normalizeAddress(V2_PACKAGE), normalizeAddress(V3_PACKAGE)]);
const PREVIEW_EXECUTION_ENABLED = /^deploy-preview-\d+--tree-token\.netlify\.app$/i.test(location.hostname) || ['localhost', '127.0.0.1'].includes(location.hostname);
const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: RPC_URL });

const state = {
  direction: 'SUI_TO_TREE',
  amount: '',
  slippageBps: 100,
  quote: null,
  quoteLoading: false,
  quoteError: '',
  balances: { sui: 0n, tree: 0n },
  balanceAddress: null,
  executing: false,
  quoteTimer: null,
  refreshTimer: null,
  requestController: null,
};

const elements = {};

function normalizeAddress(value) {
  const body = String(value || '').toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${body}`;
}

function normalizeType(value) {
  const parts = String(value || '').split('::');
  if (parts.length < 3) return String(value || '').toLowerCase();
  const address = normalizeAddress(parts.shift());
  return `${address}::${parts.join('::')}`.toLowerCase();
}

function exactType(value) {
  const normalized = normalizeType(value);
  if (normalized === normalizeType(SUI_TYPE)) return SUI_TYPE;
  if (normalized === normalizeType(TREE_TYPE)) return TREE_TYPE;
  throw new Error('Unsupported coin type in route metadata.');
}

function decimalsFor(type) {
  return normalizeType(type) === normalizeType(SUI_TYPE) ? SUI_DECIMALS : TREE_DECIMALS;
}

function symbolFor(type) {
  return normalizeType(type) === normalizeType(SUI_TYPE) ? 'SUI' : 'TREE';
}

function parseBaseUnits(value, decimals) {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Enter a valid positive amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error(`${symbolFor(stateTokenIn())} supports at most ${decimals} decimal places.`);
  const raw = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+/, '') || '0';
  const amount = BigInt(raw);
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return amount;
}

function formatBaseUnits(value, decimals, maximumFractionDigits = decimals) {
  const raw = BigInt(value || '0');
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  let fraction = (raw % base).toString().padStart(decimals, '0').slice(0, maximumFractionDigits).replace(/0+$/, '');
  const wholeText = new Intl.NumberFormat('en-US').format(whole);
  return fraction ? `${wholeText}.${fraction}` : wholeText;
}

function stateTokenIn() {
  return state.direction === 'SUI_TO_TREE' ? SUI_TYPE : TREE_TYPE;
}

function stateTokenOut() {
  return state.direction === 'SUI_TO_TREE' ? TREE_TYPE : SUI_TYPE;
}

function setStatus(message, className = '') {
  elements.status.textContent = message;
  elements.status.className = `status${className ? ` ${className}` : ''}`;
}

function setTokenPresentation() {
  const inputSymbol = symbolFor(stateTokenIn());
  const outputSymbol = symbolFor(stateTokenOut());
  elements.inputSymbol.textContent = inputSymbol;
  elements.outputSymbol.textContent = outputSymbol;
  elements.inputIcon.textContent = inputSymbol === 'SUI' ? 'S' : 'T';
  elements.outputIcon.textContent = outputSymbol === 'SUI' ? 'S' : 'T';
  elements.inputIcon.className = `swap-token-icon ${inputSymbol.toLowerCase()}`;
  elements.outputIcon.className = `swap-token-icon ${outputSymbol.toLowerCase()}`;
  elements.amountInput.placeholder = inputSymbol === 'SUI' ? '0.0' : '0';
  elements.reserveRow.hidden = inputSymbol !== 'SUI';
  renderBalances();
}

function renderBalances() {
  const inputIsSui = state.direction === 'SUI_TO_TREE';
  const inputBalance = inputIsSui ? state.balances.sui : state.balances.tree;
  const outputBalance = inputIsSui ? state.balances.tree : state.balances.sui;
  elements.inputBalance.textContent = window.playerAddress ? `Balance ${formatBaseUnits(inputBalance, inputIsSui ? SUI_DECIMALS : TREE_DECIMALS, inputIsSui ? 4 : 2)}` : 'Balance —';
  elements.outputBalance.textContent = window.playerAddress ? `Balance ${formatBaseUnits(outputBalance, inputIsSui ? TREE_DECIMALS : SUI_DECIMALS, inputIsSui ? 2 : 4)}` : 'Balance —';
}

function quoteIsFresh() {
  if (!state.quote?.selectedRoute) return false;
  const expires = Date.parse(state.quote.expiresAt || '');
  return Number.isFinite(expires) && Date.now() < expires;
}

function routeLabel(route) {
  return route?.venueLabel || (route?.venue === 'v3' ? 'SuiDex V3' : route?.venue === 'suidex' ? 'SuiDex V2' : 'Unavailable');
}

function renderQuote() {
  const quote = state.quote;
  if (!quote?.selectedRoute) {
    elements.amountOutput.value = '';
    elements.routeLabel.textContent = state.quoteLoading ? 'Finding best route…' : 'Enter an amount';
    elements.routeRate.textContent = '—';
    elements.minReceived.textContent = '—';
    elements.priceImpact.textContent = '—';
    elements.gasEstimate.textContent = '—';
    elements.routeCandidates.replaceChildren();
    updateActionButton();
    return;
  }
  const route = quote.selectedRoute;
  const output = formatBaseUnits(route.amountOut, quote.decimalsOut, quote.decimalsOut);
  const minimum = formatBaseUnits(route.minAmountOut, quote.decimalsOut, quote.decimalsOut);
  elements.amountOutput.value = output;
  elements.routeLabel.textContent = `${routeLabel(route)} · Best output`;
  const inputHuman = Number(formatBaseUnits(route.amountIn, quote.decimalsIn, Math.min(quote.decimalsIn, 9)).replace(/,/g, ''));
  const outputHuman = Number(output.replace(/,/g, ''));
  elements.routeRate.textContent = inputHuman > 0 && Number.isFinite(outputHuman) ? `1 ${symbolFor(quote.tokenIn)} ≈ ${(outputHuman / inputHuman).toLocaleString('en-US', { maximumFractionDigits: quote.decimalsOut })} ${symbolFor(quote.tokenOut)}` : '—';
  elements.minReceived.textContent = `${minimum} ${symbolFor(quote.tokenOut)}`;
  elements.priceImpact.textContent = `${Number(route.priceImpactPercent).toFixed(2)}%`;
  elements.priceImpact.className = Number(route.priceImpactPercent) > MAX_EXECUTABLE_PRICE_IMPACT ? 'swap-danger' : Number(route.priceImpactPercent) > 1 ? 'swap-warning' : 'swap-positive';
  elements.gasEstimate.textContent = route.gasEstimate !== '0' ? `≈ ${formatBaseUnits(route.gasEstimate, SUI_DECIMALS, 4)} SUI` : 'Estimated in simulation';
  elements.routeCandidates.replaceChildren(...quote.routes.map((candidate, index) => {
    const row = document.createElement('div');
    row.className = `swap-route-candidate${index === 0 ? ' selected' : ''}`;
    row.innerHTML = `<span>${routeLabel(candidate)}${index === 0 ? ' · Best' : ''}</span><strong>${formatBaseUnits(candidate.amountOut, quote.decimalsOut, quote.decimalsOut)} ${symbolFor(quote.tokenOut)}</strong><small>${Number(candidate.priceImpactPercent).toFixed(2)}% impact · ${candidate.feePercent.toFixed(2)}% fee</small>`;
    return row;
  }));
  updateActionButton();
}

function inputRawOrNull() {
  try { return parseBaseUnits(state.amount, decimalsFor(stateTokenIn())); } catch { return null; }
}

function spendableInputBalance() {
  if (state.direction === 'TREE_TO_SUI') return state.balances.tree;
  const nftreeReserve = elements.reserveNftree.checked ? NFTREE_RESERVE_RAW : 0n;
  const reserve = SUI_GAS_RESERVE_RAW + nftreeReserve;
  return state.balances.sui > reserve ? state.balances.sui - reserve : 0n;
}

function updateActionButton() {
  const button = elements.action;
  if (state.executing) {
    button.disabled = true;
    button.textContent = 'Confirming on Sui…';
    return;
  }
  if (!window.playerAddress) {
    button.disabled = false;
    button.textContent = 'Connect Wallet';
    return;
  }
  const raw = inputRawOrNull();
  if (!raw) {
    button.disabled = true;
    button.textContent = 'Enter an amount';
    return;
  }
  if (raw > spendableInputBalance()) {
    button.disabled = true;
    button.textContent = `Insufficient ${symbolFor(stateTokenIn())}`;
    return;
  }
  if (state.quoteLoading) {
    button.disabled = true;
    button.textContent = 'Finding best route…';
    return;
  }
  if (!quoteIsFresh()) {
    button.disabled = true;
    button.textContent = state.quoteError ? 'Route unavailable' : 'Refreshing route…';
    return;
  }
  if (Number(state.quote.selectedRoute.priceImpactPercent) > MAX_EXECUTABLE_PRICE_IMPACT) {
    button.disabled = true;
    button.textContent = 'Reduce amount — impact above 5%';
    return;
  }
  if (!PREVIEW_EXECUTION_ENABLED) {
    button.disabled = true;
    button.textContent = 'Swap activation pending preview test';
    return;
  }
  button.disabled = false;
  button.textContent = `Review ${symbolFor(stateTokenIn())} → ${symbolFor(stateTokenOut())} Swap`;
}

async function loadBalances(force = false) {
  const address = window.playerAddress || null;
  if (!address) {
    state.balances = { sui: 0n, tree: 0n };
    state.balanceAddress = null;
    renderBalances();
    updateActionButton();
    return;
  }
  if (!force && state.balanceAddress === address) return;
  try {
    const [sui, tree] = await Promise.all([
    client.core.getBalance({ owner: address, coinType: SUI_TYPE }),
    client.core.getBalance({ owner: address, coinType: TREE_TYPE }),
  ]);
  state.balances = {
    sui: BigInt(sui.balance.balance || '0'),
    tree: BigInt(tree.balance.balance || '0'),
  };
    state.balanceAddress = address;
    renderBalances();
    updateActionButton();
  } catch (error) {
    console.error('TREE swap balance load failed', error);
    setStatus('Wallet balances could not be refreshed. No transaction was created.', 'error');
  }
}

async function requestQuote() {
  clearTimeout(state.quoteTimer);
  state.requestController?.abort();
  const raw = inputRawOrNull();
  if (!raw) {
    state.quote = null;
    state.quoteError = '';
    state.quoteLoading = false;
    renderQuote();
    return;
  }
  state.quoteLoading = true;
  state.quoteError = '';
  renderQuote();
  const controller = new AbortController();
  state.requestController = controller;
  const query = new URLSearchParams({
    tokenIn: stateTokenIn(),
    tokenOut: stateTokenOut(),
    amountIn: raw.toString(),
    slippageBps: String(state.slippageBps),
  });
  try {
    const response = await fetch(`${QUOTE_URL}?${query}`, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status !== 'ok' || !payload.selectedRoute) throw new Error(payload.message || `Quote returned ${response.status}.`);
    if (payload.amountIn !== raw.toString() || normalizeType(payload.tokenIn) !== normalizeType(stateTokenIn()) || normalizeType(payload.tokenOut) !== normalizeType(stateTokenOut())) throw new Error('Quote response did not match the requested swap.');
    state.quote = payload;
    state.quoteError = '';
    setStatus(`Best available direct TREE route: ${routeLabel(payload.selectedRoute)}. Quote refreshes every 15 seconds.`, 'success');
  } catch (error) {
    if (controller.signal.aborted) return;
    state.quote = null;
    state.quoteError = error instanceof Error ? error.message : 'Quote unavailable.';
    setStatus(`${state.quoteError} No transaction can be submitted without a fresh route.`, 'error');
  } finally {
    if (!controller.signal.aborted) {
      state.quoteLoading = false;
      renderQuote();
    }
  }
}

function scheduleQuote() {
  clearTimeout(state.quoteTimer);
  state.quoteTimer = setTimeout(requestQuote, 300);
}

async function getAllCoins(owner, coinType) {
  const coins = [];
  let cursor = null;
  do {
    const page = await client.core.listCoins({ owner, coinType, cursor, limit: 50 });
    coins.push(...(page.objects || []));
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return coins
    .filter((coin) => BigInt(coin.balance || '0') > 0n)
    .sort((left, right) => BigInt(right.balance || '0') > BigInt(left.balance || '0') ? 1 : -1);
}

async function ownedCoinForAmount(tx, owner, coinType, amount) {
  const coins = await getAllCoins(owner, coinType);
  const selected = [];
  let total = 0n;
  for (const coin of coins) {
    selected.push(coin);
    total += BigInt(coin.balance || '0');
    if (total >= amount) break;
  }
  if (total < amount) throw new Error(`Insufficient ${symbolFor(coinType)} balance.`);
  if (selected.length > 500) throw new Error('Too many TREE coin objects are required. Merge coin objects or use a smaller amount.');
  const primary = tx.object(selected[0].coinObjectId);
  const mergeObjects = selected.slice(1).map((coin) => tx.object(coin.coinObjectId));
  for (let index = 0; index < mergeObjects.length; index += 200) tx.mergeCoins(primary, mergeObjects.slice(index, index + 200));
  const [inputCoin] = tx.splitCoins(primary, [tx.pure.u64(amount)]);
  tx.transferObjects([primary], owner);
  return inputCoin;
}

async function inputCoin(tx, owner, coinType, amount) {
  if (normalizeType(coinType) === normalizeType(SUI_TYPE)) {
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    return coin;
  }
  return ownedCoinForAmount(tx, owner, TREE_TYPE, amount);
}

function validateRoute(route, amountIn) {
  if (!route || route.type !== 'direct') throw new Error('Only a direct TREE route can be executed in this release.');
  if (BigInt(route.amountIn) !== amountIn) throw new Error('The route amount no longer matches the form.');
  const input = normalizeType(route.tokenIn);
  const output = normalizeType(route.tokenOut);
  const sui = normalizeType(SUI_TYPE);
  const tree = normalizeType(TREE_TYPE);
  if (!((input === sui && output === tree) || (input === tree && output === sui))) throw new Error('The route token pair is not SUI/TREE.');
  if (route.executionKind === 'suidex-v2-direct' && route.pairId !== V2_POOL) throw new Error('Unexpected SuiDex V2 pool.');
  if (route.executionKind === 'suidex-v3-direct' && route.pairId !== V3_POOL) throw new Error('Unexpected SuiDex V3 pool.');
  if (!['suidex-v2-direct', 'suidex-v3-direct'].includes(route.executionKind)) throw new Error('Unsupported route venue.');
  if (BigInt(route.minAmountOut) <= 0n) throw new Error('The route does not contain a valid minimum output.');
}

async function buildV2Transaction(owner, route, amountIn) {
  const tx = new Transaction();
  tx.setSender(owner);
  const input = await inputCoin(tx, owner, route.tokenIn, amountIn);
  const token0ToToken1 = normalizeType(route.tokenIn) === normalizeType(SUI_TYPE);
  const target = `${V2_PACKAGE}::router::${token0ToToken1 ? 'swap_exact_tokens0_for_tokens1' : 'swap_exact_tokens1_for_tokens0'}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  tx.moveCall({
    target,
    typeArguments: [SUI_TYPE, TREE_TYPE],
    arguments: [
      tx.object(V2_ROUTER),
      tx.object(V2_FACTORY),
      tx.object(V2_POOL),
      input,
      tx.pure.u256(amountIn),
      tx.pure.u256(BigInt(route.minAmountOut)),
      tx.pure.u64(deadline),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

async function buildV3Transaction(owner, route, amountIn) {
  const tx = new Transaction();
  tx.setSender(owner);
  const coinAType = exactType(route.coinAType);
  const coinBType = exactType(route.coinBType);
  if (!route.coinAType || !route.coinBType || !((normalizeType(coinAType) === normalizeType(SUI_TYPE) && normalizeType(coinBType) === normalizeType(TREE_TYPE)) || (normalizeType(coinAType) === normalizeType(TREE_TYPE) && normalizeType(coinBType) === normalizeType(SUI_TYPE)))) throw new Error('V3 route coin metadata is invalid.');
  const aToB = normalizeType(route.tokenIn) === normalizeType(coinAType);
  const inputType = aToB ? coinAType : coinBType;
  const input = await inputCoin(tx, owner, route.tokenIn, amountIn);
  const inputBalance = tx.moveCall({ target: '0x2::coin::into_balance', typeArguments: [inputType], arguments: [input] });
  const sqrtLimit = aToB ? 4_295_048_016n + 1n : 0xfffec4b135bb7f32a81b33afn - 1n;
  const [balanceA, balanceB, receipt] = tx.moveCall({
    target: `${V3_PACKAGE}::trade::flash_swap`,
    typeArguments: [coinAType, coinBType],
    arguments: [tx.object(V3_POOL), tx.pure.bool(aToB), tx.pure.bool(true), tx.pure.u64(amountIn), tx.pure.u128(sqrtLimit), tx.object(CLOCK), tx.object(V3_GLOBAL_CONFIG)],
  });
  let output;
  if (aToB) {
    const zeroB = tx.moveCall({ target: '0x2::balance::zero', typeArguments: [coinBType], arguments: [] });
    tx.moveCall({ target: `${V3_PACKAGE}::trade::repay_flash_swap`, typeArguments: [coinAType, coinBType], arguments: [tx.object(V3_POOL), receipt, inputBalance, zeroB, tx.object(V3_GLOBAL_CONFIG)] });
    tx.moveCall({ target: '0x2::balance::destroy_zero', typeArguments: [coinAType], arguments: [balanceA] });
    output = tx.moveCall({ target: '0x2::coin::from_balance', typeArguments: [coinBType], arguments: [balanceB] });
  } else {
    const zeroA = tx.moveCall({ target: '0x2::balance::zero', typeArguments: [coinAType], arguments: [] });
    tx.moveCall({ target: `${V3_PACKAGE}::trade::repay_flash_swap`, typeArguments: [coinAType, coinBType], arguments: [tx.object(V3_POOL), receipt, zeroA, inputBalance, tx.object(V3_GLOBAL_CONFIG)] });
    tx.moveCall({ target: '0x2::balance::destroy_zero', typeArguments: [coinBType], arguments: [balanceB] });
    output = tx.moveCall({ target: '0x2::coin::from_balance', typeArguments: [coinAType], arguments: [balanceA] });
  }
  const [minimumCheck] = tx.splitCoins(output, [tx.pure.u64(BigInt(route.minAmountOut))]);
  tx.mergeCoins(output, [minimumCheck]);
  tx.transferObjects([output], owner);
  return tx;
}

function validateTransactionPackages(tx) {
  for (const command of tx.getData().commands || []) {
    const call = command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null);
    if (!call?.package) continue;
    const packageId = normalizeAddress(call.package);
    if (!ALLOWED_MOVE_PACKAGES.has(packageId)) throw new Error(`Transaction contains a non-allowlisted package: ${call.package}`);
  }
}

async function buildTransaction(owner, route, amountIn) {
  validateRoute(route, amountIn);
  const tx = route.executionKind === 'suidex-v2-direct'
    ? await buildV2Transaction(owner, route, amountIn)
    : await buildV3Transaction(owner, route, amountIn);
  validateTransactionPackages(tx);
  return tx;
}

function coreTransaction(result) {
  if (result?.$kind === 'Transaction') return result.Transaction;
  return result?.Transaction || null;
}

function coreFailureMessage(result, fallback = 'Sui transaction failed.') {
  const failedError = result?.FailedTransaction?.status?.error;
  if (typeof failedError === 'string') return failedError;
  if (failedError?.message) return failedError.message;
  const effectsError = coreTransaction(result)?.effects?.status?.error;
  if (typeof effectsError === 'string') return effectsError;
  if (effectsError?.message) return effectsError.message;
  return fallback;
}

function coreTransactionSucceeded(result) {
  return coreTransaction(result)?.effects?.status?.success === true;
}

function extractDigest(result) {
  return result?.digest || result?.Transaction?.digest || result?.effects?.transactionDigest || result?.transactionBlockDigest || null;
}

async function waitForFinality(digest) {
  return client.core.waitForTransaction({
    digest,
    timeout: 60_000,
    include: { effects: true, balanceChanges: true },
  });
}

function transactionSucceeded(result) {
  return coreTransactionSucceeded(result);
}

async function executeSwap() {
  if (!window.playerAddress) {
    try { await window.openWalletManager?.({ mode: 'picker' }); } catch { return; }
    await loadBalances(true);
    updateActionButton();
    return;
  }
  if (!PREVIEW_EXECUTION_ENABLED) return;
  if (!quoteIsFresh()) {
    await requestQuote();
    if (!quoteIsFresh()) return;
  }
  const amountIn = inputRawOrNull();
  if (!amountIn) return;
  const route = state.quote.selectedRoute;
  state.executing = true;
  updateActionButton();
  state.requestController?.abort();
  clearInterval(state.refreshTimer);
  try {
    setStatus(`Building the allowlisted ${routeLabel(route)} transaction…`);
    const tx = await buildTransaction(window.playerAddress, route, amountIn);
    setStatus('Simulating the exact transaction on Sui Mainnet. Your wallet has not been asked to sign yet.');
    const bytes = await tx.build({ client });
  const simulation = await client.core.simulateTransaction({
    transaction: bytes,
    include: { effects: true, balanceChanges: true },
  });
  if (!coreTransactionSucceeded(simulation)) {
    throw new Error(coreFailureMessage(simulation, 'Transaction simulation failed.'));
  }
    setStatus(`Simulation passed. Review ${formatBaseUnits(amountIn, decimalsFor(stateTokenIn()), decimalsFor(stateTokenIn()))} ${symbolFor(stateTokenIn())} → at least ${formatBaseUnits(route.minAmountOut, decimalsFor(stateTokenOut()), decimalsFor(stateTokenOut()))} ${symbolFor(stateTokenOut())} in your wallet.`, 'success');
    const result = await window.signAndExecuteTransactionBlock(tx);
    const digest = extractDigest(result);
    if (!digest) throw new Error('The wallet returned no transaction digest.');
    setStatus(`Transaction submitted. Waiting for Sui finality: ${digest.slice(0, 12)}…`);
    const final = await waitForFinality(digest);
    if (!transactionSucceeded(final)) throw new Error(coreFailureMessage(final, 'The transaction did not finalize successfully.'));
    elements.success.hidden = false;
    elements.success.innerHTML = `<strong>Swap confirmed on Sui Mainnet.</strong><a href="https://suiscan.xyz/mainnet/tx/${encodeURIComponent(digest)}" target="_blank" rel="noopener noreferrer">View transaction ${digest.slice(0, 12)}… ↗</a>`;
    setStatus(`Swap confirmed through ${routeLabel(route)}.`, 'success');
    state.amount = '';
    elements.amountInput.value = '';
    state.quote = null;
    await loadBalances(true);
    renderQuote();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Swap failed.';
    setStatus(/reject|cancel/i.test(message) ? 'Wallet approval was cancelled. No swap was executed.' : `${message} No success state was recorded.`, 'error');
  } finally {
    state.executing = false;
    state.refreshTimer = setInterval(() => { if (state.amount) requestQuote(); }, 15_000);
    updateActionButton();
  }
}

function useMax() {
  const spendable = spendableInputBalance();
  const decimals = decimalsFor(stateTokenIn());
  state.amount = formatBaseUnits(spendable, decimals, decimals).replace(/,/g, '');
  elements.amountInput.value = state.amount === '0' ? '' : state.amount;
  state.quote = null;
  scheduleQuote();
  updateActionButton();
}

function reverseDirection() {
  state.direction = state.direction === 'SUI_TO_TREE' ? 'TREE_TO_SUI' : 'SUI_TO_TREE';
  state.amount = '';
  state.quote = null;
  state.quoteError = '';
  elements.amountInput.value = '';
  elements.amountOutput.value = '';
  elements.success.hidden = true;
  setTokenPresentation();
  renderQuote();
  setStatus('Enter an amount to compare the current SuiDex V2 and V3 TREE routes.');
}

function initialize() {
  Object.assign(elements, {
    amountInput: document.getElementById('swapAmountIn'),
    amountOutput: document.getElementById('swapAmountOut'),
    inputSymbol: document.getElementById('swapInputSymbol'),
    outputSymbol: document.getElementById('swapOutputSymbol'),
    inputIcon: document.getElementById('swapInputIcon'),
    outputIcon: document.getElementById('swapOutputIcon'),
    inputBalance: document.getElementById('swapInputBalance'),
    outputBalance: document.getElementById('swapOutputBalance'),
    routeLabel: document.getElementById('swapRouteLabel'),
    routeRate: document.getElementById('swapRouteRate'),
    minReceived: document.getElementById('swapMinReceived'),
    priceImpact: document.getElementById('swapPriceImpact'),
    gasEstimate: document.getElementById('swapGasEstimate'),
    routeCandidates: document.getElementById('swapRouteCandidates'),
    action: document.getElementById('buyTree'),
    status: document.getElementById('swapStatus'),
    reserveNftree: document.getElementById('reserveNftree'),
    reserveRow: document.getElementById('swapReserveRow'),
    success: document.getElementById('swapSuccess'),
  });
  if (!elements.amountInput || !elements.action) return;
  setTokenPresentation();
  renderQuote();
  elements.amountInput.addEventListener('input', () => {
    state.amount = elements.amountInput.value;
    state.quote = null;
    state.quoteError = '';
    elements.success.hidden = true;
    scheduleQuote();
    updateActionButton();
  });
  document.getElementById('swapDirection')?.addEventListener('click', reverseDirection);
  document.getElementById('swapMax')?.addEventListener('click', useMax);
  elements.reserveNftree.addEventListener('change', () => { renderBalances(); updateActionButton(); });
  document.querySelectorAll('[data-swap-slippage]').forEach((button) => button.addEventListener('click', () => {
    state.slippageBps = Number(button.dataset.swapSlippage);
    document.querySelectorAll('[data-swap-slippage]').forEach((item) => item.classList.toggle('active', item === button));
    state.quote = null;
    scheduleQuote();
  }));
  elements.action.addEventListener('click', executeSwap);
  window.addEventListener('tree:wallet-changed', () => loadBalances(true));
  window.addEventListener('load', () => loadBalances(true));
  window.addEventListener('tree:panel-shown', (event) => {
    if (event.detail?.panelId === 'swap') {
      loadBalances(true);
      if (state.amount) requestQuote();
    }
  });
  state.refreshTimer = setInterval(() => { if (state.amount && !state.executing) requestQuote(); }, 15_000);
  setStatus(PREVIEW_EXECUTION_ENABLED
    ? 'Mainnet preview: enter an amount to compare SuiDex V2 and V3. A transaction is created only after simulation and explicit wallet approval.'
    : 'Best-route quotes are active. On-site execution remains disabled in production until the controlled preview swap passes.');
  loadBalances(true);
}

initialize();

export { PREVIEW_EXECUTION_ENABLED, buildTransaction, formatBaseUnits, normalizeType, parseBaseUnits, validateRoute };
