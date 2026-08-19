export const TREE_LIMIT_SUI_TYPE = '0x2::sui::SUI';
export const TREE_LIMIT_TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const TREE_LIMIT_AFTERMATH_PACKAGE = '0xe57ee3613b7dece546f8a2d8a53145cbab41d32b86037b94f9ebfcbcfa66885a';
export const TREE_LIMIT_EXECUTION_GAS_RAW = 50_000_000n;
export const TREE_LIMIT_MIN_EXPIRY_MS = 3_600_000;
export const TREE_LIMIT_MAX_EXPIRY_MS = 2_592_000_000;

type JsonRecord = Record<string, unknown>;

export type TreeLimitDirection = 'buy-tree' | 'sell-tree';

export interface ValidatedTreeLimitCreate {
  walletAddress: string;
  direction: TreeLimitDirection;
  allocateCoinType: string;
  buyCoinType: string;
  allocateCoinAmount: bigint;
  targetPriceSuiPerTree: string;
  outputToInputExchangeRate: number;
  expiryDurationMs: number;
}

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

export function normalizeSuiAddress(value: unknown) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{1,64}$/.test(compact) ? `0x${compact.padStart(64, '0')}` : null;
}

export function normalizeCoinType(value: unknown) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('::');
  const address = normalizeSuiAddress(parts[0]);
  return parts.length === 3 && address && parts[1] && parts[2]
    ? `${address}::${parts[1].toLowerCase()}::${parts[2].toLowerCase()}`
    : null;
}

function decimalText(value: unknown) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(text)) throw new Error('Enter a valid target price without exponent notation.');
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 1e-12 || numeric > 1_000_000) throw new Error('Target price is outside the supported range.');
  return { text, numeric };
}

export function validateTreeLimitCreate(value: unknown): ValidatedTreeLimitCreate {
  const input = record(value);
  const walletAddress = normalizeSuiAddress(input.walletAddress);
  if (!walletAddress) throw new Error('A valid Sui wallet address is required.');
  const direction = input.direction;
  if (direction !== 'buy-tree' && direction !== 'sell-tree') throw new Error('Limit direction must buy or sell TREE.');
  if (typeof input.allocateCoinAmount !== 'string' || !/^\d+$/.test(input.allocateCoinAmount)) throw new Error('Allocated amount must be an integer string.');
  const allocateCoinAmount = BigInt(input.allocateCoinAmount);
  if (allocateCoinAmount <= 0n || allocateCoinAmount > 1_000_000_000_000_000n) throw new Error('Allocated amount is outside the supported range.');
  const expiryDurationMs = Number(input.expiryDurationMs);
  if (!Number.isSafeInteger(expiryDurationMs) || expiryDurationMs % TREE_LIMIT_MIN_EXPIRY_MS !== 0
    || expiryDurationMs < TREE_LIMIT_MIN_EXPIRY_MS || expiryDurationMs > TREE_LIMIT_MAX_EXPIRY_MS) {
    throw new Error('Expiration must be a whole number of hours between 1 hour and 30 days.');
  }
  const price = decimalText(input.targetPriceSuiPerTree);
  const allocateCoinType = direction === 'buy-tree' ? TREE_LIMIT_SUI_TYPE : TREE_LIMIT_TREE_TYPE;
  const buyCoinType = direction === 'buy-tree' ? TREE_LIMIT_TREE_TYPE : TREE_LIMIT_SUI_TYPE;
  const outputToInputExchangeRate = direction === 'buy-tree' ? price.numeric : 1 / price.numeric;
  if (!Number.isFinite(outputToInputExchangeRate) || outputToInputExchangeRate <= 0) throw new Error('Target exchange rate is invalid.');
  return {
    walletAddress,
    direction,
    allocateCoinType,
    buyCoinType,
    allocateCoinAmount,
    targetPriceSuiPerTree: price.text,
    outputToInputExchangeRate,
    expiryDurationMs,
  };
}

export function assertAllowedTreeLimitTransaction(transaction: { getData(): unknown }, expected: ValidatedTreeLimitCreate) {
  const data = record(transaction.getData());
  const commands = Array.isArray(data.commands) ? data.commands.map(record) : [];
  if (commands.length !== 3) throw new Error('Unexpected limit-order command count.');
  for (const command of commands.slice(0, 2)) {
    const split = record(command.SplitCoins);
    const coin = record(split.coin);
    if (command.$kind !== 'SplitCoins' || coin.$kind !== 'GasCoin' || !Array.isArray(split.amounts) || split.amounts.length !== 1) {
      throw new Error('Unexpected limit-order gas allocation command.');
    }
  }
  const moveCommand = commands[2];
  const move = record(moveCommand.MoveCall);
  const types = Array.isArray(move.typeArguments) ? move.typeArguments.map(normalizeCoinType) : [];
  if (moveCommand.$kind !== 'MoveCall'
    || normalizeSuiAddress(move.package) !== normalizeSuiAddress(TREE_LIMIT_AFTERMATH_PACKAGE)
    || move.module !== 'order'
    || move.function !== 'create_order_with_integrator_fee'
    || types.length !== 2
    || types[0] !== normalizeCoinType(expected.allocateCoinType)
    || types[1] !== normalizeCoinType(expected.buyCoinType)) {
    throw new Error('Limit-order Move call is not allowlisted.');
  }
  return true;
}

export function validateTreeLimitProof(value: unknown) {
  const input = record(value);
  const walletAddress = normalizeSuiAddress(input.walletAddress);
  const bytes = typeof input.bytes === 'string' && /^[A-Za-z0-9+/_=-]{1,2048}$/.test(input.bytes) ? input.bytes : null;
  const signature = typeof input.signature === 'string' && /^[A-Za-z0-9+/_=-]{1,2048}$/.test(input.signature) ? input.signature : null;
  if (!walletAddress || !bytes || !signature) throw new Error('Valid wallet authorization is required.');
  return { walletAddress, bytes, signature };
}

export function treeLimitProofMessage(bytes: string) {
  try {
    const decoded = Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0));
    return record(JSON.parse(new TextDecoder().decode(decoded)));
  } catch {
    throw new Error('Wallet authorization message is invalid.');
  }
}

export function assertTreeLimitAccountProof(bytes: string) {
  const message = treeLimitProofMessage(bytes);
  if (message.action !== 'CREATE_USER_ACCOUNT' || Object.keys(message).length !== 1) throw new Error('Wallet authorization action is invalid.');
  return true;
}

export function assertTreeLimitCancelProof(bytes: string, expectedOrderId: string) {
  const message = treeLimitProofMessage(bytes);
  const ids = Array.isArray(message.order_object_ids) ? message.order_object_ids.map(validateTreeLimitOrderId) : [];
  if (message.action !== 'CANCEL_LIMIT_ORDERS' || ids.length !== 1 || ids[0] !== expectedOrderId) throw new Error('Cancellation authorization does not match this order.');
  return true;
}

export function validateTreeLimitOrderId(value: unknown) {
  const orderId = normalizeSuiAddress(value);
  if (!orderId) throw new Error('A valid limit-order object ID is required.');
  return orderId;
}

export function isTreeLimitOrder(value: unknown) {
  const order = record(value);
  const allocated = normalizeCoinType(record(order.allocatedCoin).coin);
  const bought = normalizeCoinType(record(order.buyCoin).coin);
  const sui = normalizeCoinType(TREE_LIMIT_SUI_TYPE);
  const tree = normalizeCoinType(TREE_LIMIT_TREE_TYPE);
  return (allocated === sui && bought === tree) || (allocated === tree && bought === sui);
}

export function jsonSafeTreeLimitOrder(value: unknown) {
  if (!isTreeLimitOrder(value)) return null;
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
}
