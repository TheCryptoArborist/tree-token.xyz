export const CETUS_TREE_POOL_ID = '0x2ebaff75b8745896404085babb9ef3a77ccbb6c7d3f4db31626cefff04f7f355';
export const CETUS_TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const CETUS_SUI_COIN_TYPE = '0x2::sui::SUI';
export const CETUS_TREE_TICK_SPACING = 60;
export const CETUS_GLOBAL_CONFIG_ID = '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f';
export const CETUS_INTEGRATE_PACKAGE = '0xae9c208cf58fd5ba36737c9ee5dcfa7f152d0fb5a5a99eebb7c881ebc2fe59e0';
export const CETUS_CLMM_PACKAGE = '0x25ebb9a7c50eb17b3fa9c5a30fb8b5ad8f97caaf4928943acbcff7153dfee5e3';
export const SUI_CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';
export const CETUS_TREE_DECIMALS = 6;
export const CETUS_SUI_DECIMALS = 9;
export const CETUS_MIN_GAS_RESERVE_RAW = 50_000_000n;

const TEST_HOSTS = new Set(['tree-token-test-dapp.netlify.app', 'test.tree-token.xyz']);
const TEST_DRAFT_HOST_PATTERN = /^(?:deploy-preview-\d+|[a-z0-9-]+)--tree-token-test-dapp\.netlify\.app$/;
const RANGE_WIDTHS = Object.freeze({ tight: 0.05, medium: 0.15, wide: 0.40 });

export function isCetusV3TestHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return TEST_HOSTS.has(host) || TEST_DRAFT_HOST_PATTERN.test(host) || ['localhost', '127.0.0.1'].includes(host);
}

export function normalizeAddress(value) {
  const text = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(text)) return text;
  return `0x${text.slice(2).replace(/^0+/, '') || '0'}`;
}

export function normalizeCoinType(value) {
  const parts = String(value || '').split('::');
  if (parts.length < 3) return String(value || '').toLowerCase();
  return [normalizeAddress(parts[0]), ...parts.slice(1).map((part) => part.toLowerCase())].join('::');
}

export function parseCetusAmount(value, decimals, symbol) {
  const text = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$|^\.\d+$/.test(text)) throw new Error(`Enter a valid ${symbol} amount.`);
  const [whole = '0', fraction = ''] = text.startsWith('.') ? ['0', text.slice(1)] : text.split('.');
  if (fraction.length > decimals) throw new Error(`${symbol} supports no more than ${decimals} decimal places.`);
  const raw = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (raw <= 0n) throw new Error(`Enter a ${symbol} amount greater than zero.`);
  return raw;
}

export function formatCetusAmount(raw, decimals, maximumFractionDigits = decimals) {
  const value = BigInt(raw || 0);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, '0').slice(0, maximumFractionDigits).replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''}`;
}

export function cetusPriceFromTick(tickIndex) {
  const tick = Number(tickIndex);
  if (!Number.isInteger(tick)) throw new Error('Cetus returned an invalid current tick.');
  return Math.pow(1.0001, tick) * (10 ** (CETUS_TREE_DECIMALS - CETUS_SUI_DECIMALS));
}

export function cetusRangeFromPreset(currentPrice, preset) {
  const price = Number(currentPrice);
  const width = RANGE_WIDTHS[preset];
  if (!Number.isFinite(price) || price <= 0 || !width) throw new Error('Select a valid Cetus price range.');
  return { preset, width, minPrice: price * (1 - width), maxPrice: price * (1 + width) };
}

export function validateCetusTreePool(pool) {
  if (normalizeAddress(pool?.id) !== normalizeAddress(CETUS_TREE_POOL_ID)) throw new Error('Cetus returned a different pool object.');
  if (normalizeCoinType(pool?.coin_type_a) !== normalizeCoinType(CETUS_TREE_COIN_TYPE)
    || normalizeCoinType(pool?.coin_type_b) !== normalizeCoinType(CETUS_SUI_COIN_TYPE)) throw new Error('Cetus returned unexpected TREE/SUI coin ordering.');
  if (Number(pool?.tick_spacing) !== CETUS_TREE_TICK_SPACING) throw new Error('Cetus returned an unexpected fee tier or tick spacing.');
  if (Array.isArray(pool?.rewarder_infos) && pool.rewarder_infos.length) throw new Error('Unexpected Cetus reward configuration detected.');
  return pool;
}

function moveCall(command) { return command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null); }
function intent(command) { return command?.$Intent || command?.Intent || (command?.$kind === '$Intent' ? command.$Intent : null); }
function unresolvedObjectId(input) { return input?.UnresolvedObject?.objectId || (input?.$kind === 'UnresolvedObject' ? input.UnresolvedObject?.objectId : null); }

export function validateCetusOpenTransaction(transaction, { owner, maxTreeRaw, exactSuiRaw }) {
  const data = transaction?.getData?.();
  if (!data) throw new Error('Cetus did not return an inspectable transaction.');
  if (normalizeAddress(data.sender) !== normalizeAddress(owner)) throw new Error('Cetus transaction sender does not match the connected wallet.');
  const calls = (data.commands || []).map(moveCall).filter(Boolean);
  if (calls.length !== 1) throw new Error('Cetus Add Liquidity must contain exactly one protocol call.');
  const call = calls[0];
  if (normalizeAddress(call.package) !== normalizeAddress(CETUS_INTEGRATE_PACKAGE)
    || call.module !== 'pool_script_v2' || call.function !== 'open_position_with_liquidity_by_fix_coin') throw new Error('Cetus Add Liquidity contains a non-allowlisted protocol call.');
  const types = (call.typeArguments || []).map(normalizeCoinType);
  if (types.length !== 2 || types[0] !== normalizeCoinType(CETUS_TREE_COIN_TYPE) || types[1] !== normalizeCoinType(CETUS_SUI_COIN_TYPE)) throw new Error('Cetus Add Liquidity contains unexpected coin types.');
  const objectIds = (data.inputs || []).map(unresolvedObjectId).filter(Boolean).map(normalizeAddress).sort();
  const requiredObjects = [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, SUI_CLOCK_ID].map(normalizeAddress).sort();
  if (objectIds.length !== requiredObjects.length || objectIds.some((id, index) => id !== requiredObjects[index])) throw new Error('Cetus Add Liquidity references an unexpected shared object.');
  const coinIntents = (data.commands || []).map(intent).filter((item) => item?.name === 'CoinWithBalance');
  if (coinIntents.length !== 2) throw new Error('Cetus Add Liquidity must fund exactly TREE and SUI.');
  const balances = new Map(coinIntents.map((item) => [normalizeCoinType(item.data?.type || item.data?.coinType), BigInt(item.data?.balance ?? -1)]));
  if (balances.get(normalizeCoinType(CETUS_TREE_COIN_TYPE)) !== BigInt(maxTreeRaw)
    || balances.get('gas') !== BigInt(exactSuiRaw)) throw new Error('Cetus Add Liquidity funding does not match the reviewed maximum amounts.');
  return transaction;
}

function callKey(call) {
  return `${normalizeAddress(call.package)}::${call.module}::${call.function}<${(call.typeArguments || []).map(normalizeCoinType).join(',')}>`;
}

function validatePositionTransaction(transaction, { owner, positionId, expectedObjects, expectedCalls, expectedBalances, transferCount = 0 }) {
  const data = transaction?.getData?.();
  if (!data) throw new Error('Cetus did not return an inspectable transaction.');
  if (normalizeAddress(data.sender) !== normalizeAddress(owner)) throw new Error('Cetus transaction sender does not match the connected wallet.');
  const objectIds = (data.inputs || []).map(unresolvedObjectId).filter(Boolean).map(normalizeAddress).sort();
  const required = expectedObjects.map(normalizeAddress).sort();
  if (objectIds.length !== required.length || objectIds.some((id, index) => id !== required[index])) throw new Error('Cetus position action references an unexpected object.');
  if (!objectIds.includes(normalizeAddress(positionId))) throw new Error('Cetus position action does not target the reviewed position.');
  const calls = (data.commands || []).map(moveCall).filter(Boolean).map(callKey);
  if (calls.length !== expectedCalls.length || calls.some((key, index) => key !== expectedCalls[index])) throw new Error('Cetus position action contains a non-allowlisted protocol call.');
  const transfers = (data.commands || []).filter((command) => command?.TransferObjects || command?.$kind === 'TransferObjects');
  if (transfers.length !== transferCount) throw new Error('Cetus position action contains an unexpected asset transfer.');
  const allowedKinds = new Set(['$Intent', 'MoveCall', ...(transferCount ? ['TransferObjects'] : [])]);
  for (const command of data.commands || []) if (!allowedKinds.has(command?.$kind)) throw new Error('Cetus position action contains an unexpected transaction command.');
  const coinIntents = (data.commands || []).map(intent).filter((item) => item?.name === 'CoinWithBalance');
  const balances = new Map(coinIntents.map((item) => [normalizeCoinType(item.data?.type || item.data?.coinType), BigInt(item.data?.balance ?? -1)]));
  if (balances.size !== expectedBalances.size) throw new Error('Cetus position action funds an unexpected number of coin types.');
  for (const [type, amount] of expectedBalances) if (balances.get(type) !== BigInt(amount)) throw new Error('Cetus position action funding does not match the reviewed amounts.');
  return transaction;
}

const PAIR_TYPES = `${normalizeCoinType(CETUS_TREE_COIN_TYPE)},${normalizeCoinType(CETUS_SUI_COIN_TYPE)}`;
const TREE_TYPE = normalizeCoinType(CETUS_TREE_COIN_TYPE);
const SUI_TYPE = normalizeCoinType(CETUS_SUI_COIN_TYPE);
const INTEGRATE = normalizeAddress(CETUS_INTEGRATE_PACKAGE);
const CLMM = normalizeAddress(CETUS_CLMM_PACKAGE);
const SUI_FRAMEWORK = normalizeAddress('0x2');

export function validateCetusIncreaseTransaction(transaction, { owner, positionId, maxTreeRaw, exactSuiRaw }) {
  return validatePositionTransaction(transaction, {
    owner, positionId, expectedObjects: [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, positionId, SUI_CLOCK_ID],
    expectedCalls: [`${INTEGRATE}::pool_script_v2::add_liquidity_by_fix_coin<${PAIR_TYPES}>`],
    expectedBalances: new Map([[TREE_TYPE, BigInt(maxTreeRaw)], ['gas', BigInt(exactSuiRaw)]]),
  });
}

export function validateCetusCollectTransaction(transaction, { owner, positionId }) {
  return validatePositionTransaction(transaction, {
    owner, positionId, expectedObjects: [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, positionId],
    expectedCalls: [`${INTEGRATE}::pool_script_v2::collect_fee<${PAIR_TYPES}>`],
    expectedBalances: new Map([[TREE_TYPE, 0n], [SUI_TYPE, 0n]]),
  });
}

export function validateCetusBatchCollectTransaction(transaction, { owner, positionIds }) {
  const ids = [...new Set((positionIds || []).map(normalizeAddress))];
  if (!ids.length) throw new Error('Select at least one Cetus position with claimable fees.');
  const expectedCalls = [
    `${SUI_FRAMEWORK}::coin::zero<${TREE_TYPE}>`,
    `${SUI_FRAMEWORK}::coin::zero<${SUI_TYPE}>`,
    ...ids.map(() => `${INTEGRATE}::pool_script_v3::collect_fee<${PAIR_TYPES}>`),
  ];
  const data = transaction?.getData?.();
  if (!data) throw new Error('Cetus did not return an inspectable Claim All transaction.');
  if (normalizeAddress(data.sender) !== normalizeAddress(owner)) throw new Error('Cetus Claim All sender does not match the connected wallet.');
  const objectIds = (data.inputs || []).map(unresolvedObjectId).filter(Boolean).map(normalizeAddress).sort();
  const required = [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, ...ids].map(normalizeAddress).sort();
  if (objectIds.length !== required.length || objectIds.some((id, index) => id !== required[index])) throw new Error('Cetus Claim All references an unexpected object.');
  const calls = (data.commands || []).map(moveCall).filter(Boolean).map(callKey);
  if (calls.length !== expectedCalls.length || calls.some((key, index) => key !== expectedCalls[index])) throw new Error('Cetus Claim All contains a non-allowlisted protocol call.');
  const transfers = (data.commands || []).filter((command) => command?.TransferObjects || command?.$kind === 'TransferObjects');
  if (transfers.length !== 2 || (data.commands || []).some((command) => !['MoveCall', 'TransferObjects'].includes(command?.$kind))) throw new Error('Cetus Claim All contains an unexpected command.');
  return transaction;
}

export function validateCetusCompoundTransaction(transaction, { owner, positionId }) {
  return validatePositionTransaction(transaction, {
    owner,
    positionId,
    expectedObjects: [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, positionId, SUI_CLOCK_ID],
    expectedCalls: [
      `${CLMM}::pool::collect_fee<${PAIR_TYPES}>`,
      `${SUI_FRAMEWORK}::coin::from_balance<${TREE_TYPE}>`,
      `${SUI_FRAMEWORK}::coin::from_balance<${SUI_TYPE}>`,
      `${INTEGRATE}::pool_script_v2::add_liquidity<${PAIR_TYPES}>`,
    ],
    expectedBalances: new Map(),
  });
}

export function validateCetusRemoveTransaction(transaction, { owner, positionId }) {
  return validatePositionTransaction(transaction, {
    owner, positionId, expectedObjects: [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, positionId, SUI_CLOCK_ID],
    expectedCalls: [
      `${INTEGRATE}::pool_script_v2::collect_fee<${PAIR_TYPES}>`,
      `${CLMM}::pool::remove_liquidity<${PAIR_TYPES}>`,
      `${SUI_FRAMEWORK}::coin::from_balance<${TREE_TYPE}>`, `${SUI_FRAMEWORK}::coin::from_balance<${SUI_TYPE}>`,
      `${INTEGRATE}::router::check_coin_threshold<${TREE_TYPE}>`, `${INTEGRATE}::router::check_coin_threshold<${SUI_TYPE}>`,
    ],
    expectedBalances: new Map([[TREE_TYPE, 0n], [SUI_TYPE, 0n]]), transferCount: 1,
  });
}

export function validateCetusCloseTransaction(transaction, { owner, positionId }) {
  return validatePositionTransaction(transaction, {
    owner, positionId, expectedObjects: [CETUS_GLOBAL_CONFIG_ID, CETUS_TREE_POOL_ID, positionId, SUI_CLOCK_ID],
    expectedCalls: [`${INTEGRATE}::pool_script_v2::collect_fee<${PAIR_TYPES}>`, `${INTEGRATE}::pool_script::close_position<${PAIR_TYPES}>`],
    expectedBalances: new Map([[TREE_TYPE, 0n], [SUI_TYPE, 0n]]),
  });
}

function coreTransaction(result) { return result?.$kind === 'Transaction' ? result.Transaction : (result?.Transaction || result); }
export function cetusSimulationSucceeded(result) { return coreTransaction(result)?.effects?.status?.success === true && !result?.FailedTransaction; }
export function cetusFailureMessage(result, fallback = 'Cetus Mainnet simulation failed.') {
  const error = result?.FailedTransaction?.status?.error || coreTransaction(result)?.effects?.status?.error;
  return typeof error === 'string' ? error : error?.message || fallback;
}

export function extractCetusOpenSimulation(result, { maxTreeRaw, exactSuiRaw }) {
  if (!cetusSimulationSucceeded(result)) throw new Error(cetusFailureMessage(result));
  const events = coreTransaction(result)?.events || [];
  const open = events.find((event) => /::pool::OpenPositionEvent$/.test(event?.eventType || event?.type || ''));
  const added = events.find((event) => /::pool::AddLiquidityV2Event$/.test(event?.eventType || event?.type || ''));
  const openJson = open?.json || open?.parsedJson;
  const addJson = added?.json || added?.parsedJson;
  if (!openJson || !addJson || normalizeAddress(openJson.pool) !== normalizeAddress(CETUS_TREE_POOL_ID)
    || normalizeAddress(addJson.pool) !== normalizeAddress(CETUS_TREE_POOL_ID)
    || normalizeAddress(openJson.position) !== normalizeAddress(addJson.position)) throw new Error('Cetus simulation did not create a position in the verified TREE/SUI pool.');
  const treeRaw = BigInt(addJson.amount_a ?? -1);
  const suiRaw = BigInt(addJson.amount_b ?? -1);
  if (treeRaw <= 0n || treeRaw > BigInt(maxTreeRaw) || suiRaw !== BigInt(exactSuiRaw)) throw new Error('Cetus simulation used amounts outside the reviewed limits.');
  return { positionId: openJson.position, treeRaw, suiRaw, liquidityRaw: BigInt(addJson.liquidity ?? 0) };
}

function eventJson(result, suffix, positionId) {
  const events = coreTransaction(result)?.events || [];
  const event = events.find((candidate) => {
    const type = candidate?.eventType || candidate?.type || '';
    const json = candidate?.json || candidate?.parsedJson;
    return type.endsWith(suffix) && normalizeAddress(json?.pool) === normalizeAddress(CETUS_TREE_POOL_ID)
      && normalizeAddress(json?.position) === normalizeAddress(positionId);
  });
  return event?.json || event?.parsedJson || null;
}

export function extractCetusIncreaseSimulation(result, { positionId, maxTreeRaw, exactSuiRaw }) {
  if (!cetusSimulationSucceeded(result)) throw new Error(cetusFailureMessage(result));
  const json = eventJson(result, '::pool::AddLiquidityV2Event', positionId);
  if (!json) throw new Error('Cetus simulation did not increase the reviewed position.');
  const treeRaw = BigInt(json.amount_a ?? -1); const suiRaw = BigInt(json.amount_b ?? -1);
  if (treeRaw <= 0n || treeRaw > BigInt(maxTreeRaw) || suiRaw !== BigInt(exactSuiRaw)) throw new Error('Cetus increase simulation used amounts outside the reviewed limits.');
  return { treeRaw, suiRaw, liquidityRaw: BigInt(json.liquidity ?? 0) };
}

export function extractCetusFeeSimulation(result, positionId) {
  if (!cetusSimulationSucceeded(result)) throw new Error(cetusFailureMessage(result));
  const json = eventJson(result, '::pool::CollectFeeEvent', positionId);
  if (!json) throw new Error('Cetus simulation did not return a fee-collection event for the reviewed position.');
  return { treeRaw: BigInt(json.amount_a ?? 0), suiRaw: BigInt(json.amount_b ?? 0) };
}

export function extractCetusBatchFeeSimulation(result, positionIds) {
  const claims = (positionIds || []).map((positionId) => ({ positionId, ...extractCetusFeeSimulation(result, positionId) }));
  return claims.reduce((total, claim) => ({
    treeRaw: total.treeRaw + claim.treeRaw,
    suiRaw: total.suiRaw + claim.suiRaw,
    claims,
  }), { treeRaw: 0n, suiRaw: 0n, claims: [] });
}

export function extractCetusCompoundSimulation(result, { positionId, maxTreeRaw, maxSuiRaw }) {
  const fees = extractCetusFeeSimulation(result, positionId);
  const added = eventJson(result, '::pool::AddLiquidityV2Event', positionId);
  if (!added) throw new Error('Cetus compound simulation did not redeposit fees into the reviewed position.');
  const treeRaw = BigInt(added.amount_a ?? -1);
  const suiRaw = BigInt(added.amount_b ?? -1);
  if (treeRaw <= 0n || suiRaw <= 0n || treeRaw > BigInt(maxTreeRaw) || suiRaw > BigInt(maxSuiRaw)) throw new Error('Cetus compound simulation used amounts outside the claimed-fee limits.');
  return { fees, treeRaw, suiRaw, liquidityRaw: BigInt(added.liquidity ?? 0) };
}

export function extractCetusRemoveSimulation(result, { positionId, expectedLiquidityRaw, minTreeRaw = 0n, minSuiRaw = 0n }) {
  if (!cetusSimulationSucceeded(result)) throw new Error(cetusFailureMessage(result));
  const json = eventJson(result, '::pool::RemoveLiquidityV2Event', positionId);
  if (!json || BigInt(json.liquidity ?? -1) !== BigInt(expectedLiquidityRaw)) throw new Error('Cetus simulation removed a different liquidity amount than reviewed.');
  const treeRaw = BigInt(json.amount_a ?? -1); const suiRaw = BigInt(json.amount_b ?? -1);
  if (treeRaw < BigInt(minTreeRaw) || suiRaw < BigInt(minSuiRaw)) throw new Error('Cetus removal simulation returned less than the protected minimum.');
  return { treeRaw, suiRaw, liquidityRaw: BigInt(json.liquidity), remainingLiquidityRaw: BigInt(json.after_liquidity ?? 0) };
}

export function extractCetusCloseSimulation(result, { positionId, expectedLiquidityRaw, minTreeRaw = 0n, minSuiRaw = 0n }) {
  const removal = extractCetusRemoveSimulation(result, { positionId, expectedLiquidityRaw, minTreeRaw, minSuiRaw });
  const closed = eventJson(result, '::pool::ClosePositionEvent', positionId);
  const changed = coreTransaction(result)?.effects?.changedObjects || [];
  const deleted = changed.some((object) => normalizeAddress(object?.objectId) === normalizeAddress(positionId) && object?.idOperation === 'Deleted');
  if (!closed || removal.remainingLiquidityRaw !== 0n || !deleted) throw new Error('Cetus simulation did not fully withdraw and close the reviewed position.');
  return removal;
}

export function minimumAfterCetusSlippage(value, basisPoints = 100) {
  const raw = BigInt(value); const bps = BigInt(basisPoints);
  if (raw < 0n || bps < 0n || bps >= 10_000n) throw new Error('Invalid Cetus slippage protection.');
  return raw * (10_000n - bps) / 10_000n;
}
