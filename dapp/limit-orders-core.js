export const LIMIT_SUI_TYPE = '0x2::sui::SUI';
export const LIMIT_TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const LIMIT_AFTERMATH_PACKAGE = '0xe57ee3613b7dece546f8a2d8a53145cbab41d32b86037b94f9ebfcbcfa66885a';
export const LIMIT_SUI_DECIMALS = 9;
export const LIMIT_TREE_DECIMALS = 6;
export const LIMIT_EXECUTION_GAS_RAW = 50_000_000n;
export const LIMIT_MIN_WALLET_GAS_RAW = 100_000_000n;
export const LIMIT_MIN_EXPIRY_MS = 3_600_000;
export const LIMIT_MAX_EXPIRY_MS = 2_592_000_000;
export const LIMIT_EXPIRY_UNITS_MS = Object.freeze({ hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 });

function record(value) { return value && typeof value === 'object' ? value : {}; }

export function normalizeLimitAddress(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{1,64}$/.test(compact) ? `0x${compact.padStart(64, '0')}` : null;
}

export function normalizeLimitCoinType(value) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('::');
  const address = normalizeLimitAddress(parts[0]);
  return parts.length === 3 && address && parts[1] && parts[2] ? `${address}::${parts[1].toLowerCase()}::${parts[2].toLowerCase()}` : null;
}

export function limitDecimalToRaw(value, decimals) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  const normalized = text.startsWith('.') ? `0${text}` : text;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Enter a valid positive amount.');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimal places.`);
  const raw = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+/, '') || '0');
  if (raw <= 0n) throw new Error('Amount must be greater than zero.');
  return raw;
}

export function limitRawToDecimal(value, decimals, maximumFractionDigits = decimals) {
  const raw = BigInt(value ?? 0);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, '0').slice(0, maximumFractionDigits).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function limitDirection(direction) {
  if (direction === 'buy-tree') return { direction, inputType: LIMIT_SUI_TYPE, outputType: LIMIT_TREE_TYPE, inputSymbol: 'SUI', outputSymbol: 'TREE', inputDecimals: 9, outputDecimals: 6 };
  if (direction === 'sell-tree') return { direction, inputType: LIMIT_TREE_TYPE, outputType: LIMIT_SUI_TYPE, inputSymbol: 'TREE', outputSymbol: 'SUI', inputDecimals: 6, outputDecimals: 9 };
  throw new Error('Choose whether to buy or sell TREE.');
}

export function validateLimitTargetPrice(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(text)) throw new Error('Enter a valid target price in SUI per TREE.');
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 1e-12 || numeric > 1_000_000) throw new Error('Target price is outside the supported range.');
  return { text, numeric };
}

export function isFavorableLimitTarget(direction, target, current) {
  if (!(Number(target) > 0) || !(Number(current) > 0)) return false;
  return direction === 'buy-tree' ? Number(target) <= Number(current) : direction === 'sell-tree' && Number(target) >= Number(current);
}

export function limitExpiryDurationMs(value, unit) {
  const amount = Number(value);
  const unitMs = LIMIT_EXPIRY_UNITS_MS[String(unit || '').toLowerCase()];
  if (!Number.isInteger(amount) || amount <= 0 || !unitMs) throw new Error('Enter a valid whole-number expiration period.');
  const duration = amount * unitMs;
  if (!Number.isSafeInteger(duration) || duration < LIMIT_MIN_EXPIRY_MS || duration > LIMIT_MAX_EXPIRY_MS) throw new Error('Expiration must be between 1 hour and 30 days.');
  return duration;
}

export function estimateLimitOutput({ direction, amount, targetPrice }) {
  const input = Number(amount);
  const target = Number(targetPrice);
  if (!(input > 0) || !(target > 0)) return null;
  const output = direction === 'buy-tree' ? input / target : direction === 'sell-tree' ? input * target : NaN;
  return Number.isFinite(output) && output > 0 ? output : null;
}

export function minimumLimitInput({ minOrderSizeUsd, inputPriceUsd }) {
  const minimum = Number(minOrderSizeUsd);
  const price = Number(inputPriceUsd);
  if (!(minimum > 0) || !(price > 0)) return null;
  const amount = minimum / price;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function createLimitAccountMessage() { return { action: 'CREATE_USER_ACCOUNT' }; }
export function cancelLimitMessage(orderId) {
  const normalized = normalizeLimitAddress(orderId);
  if (!normalized) throw new Error('Invalid limit-order object ID.');
  return { action: 'CANCEL_LIMIT_ORDERS', order_object_ids: [normalized] };
}
export function encodeLimitMessage(message) { return new TextEncoder().encode(JSON.stringify(message)); }

export function assertAllowedLimitTransaction(transaction, expected) {
  const direction = limitDirection(expected.direction);
  const commands = Array.isArray(transaction?.getData?.().commands) ? transaction.getData().commands : [];
  if (commands.length !== 3) throw new Error('Unexpected limit-order command count.');
  for (const command of commands.slice(0, 2)) {
    if (command?.$kind !== 'SplitCoins' || command?.SplitCoins?.coin?.$kind !== 'GasCoin' || command?.SplitCoins?.amounts?.length !== 1) {
      throw new Error('Unexpected limit-order gas allocation command.');
    }
  }
  const call = commands[2]?.MoveCall;
  const types = Array.isArray(call?.typeArguments) ? call.typeArguments.map(normalizeLimitCoinType) : [];
  if (commands[2]?.$kind !== 'MoveCall'
    || normalizeLimitAddress(call?.package) !== normalizeLimitAddress(LIMIT_AFTERMATH_PACKAGE)
    || call?.module !== 'order' || call?.function !== 'create_order_with_integrator_fee'
    || types[0] !== normalizeLimitCoinType(direction.inputType) || types[1] !== normalizeLimitCoinType(direction.outputType)) {
    throw new Error('Limit-order transaction is not allowlisted.');
  }
  return true;
}

function decodeBase64Text(value) {
  try { return atob(String(value || '')); } catch { return ''; }
}

function simulationTransaction(value) { return value?.Transaction || value?.transaction || value; }
export function limitSimulationSucceeded(value) { return simulationTransaction(value)?.status?.success === true || simulationTransaction(value)?.effects?.status?.success === true; }

export function extractCreatedLimitOrder(value, expected) {
  const transaction = simulationTransaction(value);
  const direction = limitDirection(expected.direction);
  const owner = normalizeLimitAddress(expected.walletAddress);
  const event = (transaction?.events || []).find((item) => normalizeLimitAddress(item?.packageId) === normalizeLimitAddress(LIMIT_AFTERMATH_PACKAGE)
    && String(item?.eventType || '').endsWith('::events::Event<0xe57ee3613b7dece546f8a2d8a53145cbab41d32b86037b94f9ebfcbcfa66885a::events::CreatedOrderEventV1>'));
  const json = record(record(event?.json).pos0);
  try {
    const orderId = normalizeLimitAddress(json.order_id);
    if (!event || !owner || !orderId || normalizeLimitAddress(event.sender) !== owner || normalizeLimitAddress(json.user) !== owner
      || normalizeLimitAddress(json.recipient) !== owner || BigInt(json.input_amount ?? -1) !== BigInt(expected.allocateCoinAmount)
      || BigInt(json.gas_amount ?? -1) !== LIMIT_EXECUTION_GAS_RAW || Number(json.integrator_fee_bps) !== 0
      || normalizeLimitAddress(json.integrator_fee_recipient) !== normalizeLimitAddress('0x0')
      || normalizeLimitCoinType(decodeBase64Text(json.input_type)) !== normalizeLimitCoinType(direction.inputType)
      || normalizeLimitCoinType(decodeBase64Text(json.output_type)) !== normalizeLimitCoinType(direction.outputType)) return null;
    return { orderId };
  } catch { return null; }
}

export function validateLimitBalanceChanges(value, expected) {
  const transaction = simulationTransaction(value);
  const owner = normalizeLimitAddress(expected.walletAddress);
  const direction = limitDirection(expected.direction);
  let changes;
  try { changes = (transaction?.balanceChanges || []).filter((item) => normalizeLimitAddress(item?.address) === owner && BigInt(item?.amount ?? 0) < 0n); } catch { return false; }
  if (!changes.length || changes.some((item) => ![normalizeLimitCoinType(LIMIT_SUI_TYPE), normalizeLimitCoinType(LIMIT_TREE_TYPE)].includes(normalizeLimitCoinType(item.coinType)))) return false;
  const amountFor = (coinType) => changes.filter((item) => normalizeLimitCoinType(item.coinType) === normalizeLimitCoinType(coinType)).reduce((sum, item) => sum + BigInt(item.amount), 0n);
  const inputDebit = -amountFor(direction.inputType);
  const suiDebit = -amountFor(LIMIT_SUI_TYPE);
  const allocated = BigInt(expected.allocateCoinAmount);
  if (direction.direction === 'buy-tree') return inputDebit >= allocated + LIMIT_EXECUTION_GAS_RAW && inputDebit <= allocated + 200_000_000n;
  return inputDebit === allocated && suiDebit >= LIMIT_EXECUTION_GAS_RAW && suiDebit <= 200_000_000n;
}

export function treeLimitOrderDirection(order) {
  const input = normalizeLimitCoinType(order?.allocatedCoin?.coin);
  const output = normalizeLimitCoinType(order?.buyCoin?.coin);
  if (input === normalizeLimitCoinType(LIMIT_SUI_TYPE) && output === normalizeLimitCoinType(LIMIT_TREE_TYPE)) return 'buy-tree';
  if (input === normalizeLimitCoinType(LIMIT_TREE_TYPE) && output === normalizeLimitCoinType(LIMIT_SUI_TYPE)) return 'sell-tree';
  return null;
}
