export const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const SUI_COIN_TYPE = '0x2::sui::SUI';
export const SUIDEX_V3_PACKAGE = '0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56';
export const SUIDEX_V3_POOL = '0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf';
export const SUIDEX_V3_VERSION = '0x0999bbc9c063580eca62e888b8f0d8e6e9159cd9db1b8a8c88e448a2b5dd4d4d';
export const SUI_CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006';
export const SUI_DECIMALS = 9;
export const TREE_DECIMALS = 6;
export const TREE_V3_TICK_SPACING = 60;
export const DEFAULT_SLIPPAGE_BPS = 100;
export const MIN_SUI_GAS_RESERVE_RAW = 50_000_000n;

const U32_MODULUS = 0x1_0000_0000;
const MIN_TICK = -443_636;
const MAX_TICK = 443_636;

function normalizedAddress(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(compact)) return null;
  return `0x${compact.padStart(64, '0')}`;
}

function normalizedCoinType(value) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('::');
  if (parts.length !== 3) return null;
  const address = normalizedAddress(parts[0]);
  return address && parts[1] && parts[2] ? `${address}::${parts[1].toLowerCase()}::${parts[2].toLowerCase()}` : null;
}

export function normalizeDecimalInput(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  return text.startsWith('.') ? `0${text}` : text;
}

export function decimalToRaw(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimals.');
  const text = normalizeDecimalInput(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Enter a valid positive amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimal places.`);
  const amount = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+/, '') || '0');
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return amount;
}

export function rawToDecimal(value, decimals, maximumFractionDigits = decimals) {
  const raw = BigInt(value ?? 0);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, '0')
    .slice(0, maximumFractionDigits).replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

export function encodeSignedI32(value) {
  if (!Number.isInteger(value) || value < -0x8000_0000 || value > 0x7fff_ffff) throw new Error('Tick is outside the signed i32 range.');
  return value < 0 ? U32_MODULUS + value : value;
}

export function decodeSignedI32(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric >= U32_MODULUS) throw new Error('Invalid encoded i32 value.');
  return numeric >= 0x8000_0000 ? numeric - U32_MODULUS : numeric;
}

export function ticksFromDisplayedPrices({
  currentTick,
  currentPrice,
  minPrice,
  maxPrice,
  tickSpacing = TREE_V3_TICK_SPACING,
  displayedPriceIncreasesWithTick = false,
}) {
  for (const [label, value] of Object.entries({ currentTick, currentPrice, minPrice, maxPrice, tickSpacing })) {
    if (!Number.isFinite(value)) throw new Error(`${label} is invalid.`);
  }
  if (!Number.isInteger(currentTick) || !Number.isInteger(tickSpacing) || tickSpacing <= 0) throw new Error('Tick configuration is invalid.');
  if (!(currentPrice > 0) || !(minPrice > 0) || !(maxPrice > minPrice) || !(minPrice < currentPrice && currentPrice < maxPrice)) {
    throw new Error('The selected range must contain the current price.');
  }
  const direction = displayedPriceIncreasesWithTick ? 1 : -1;
  const tickFor = (price) => currentTick + direction * Math.log(price / currentPrice) / Math.log(1.0001);
  const unaligned = [tickFor(minPrice), tickFor(maxPrice)].sort((left, right) => left - right);
  const lower = Math.floor(unaligned[0] / tickSpacing) * tickSpacing;
  const upper = Math.ceil(unaligned[1] / tickSpacing) * tickSpacing;
  if (lower < MIN_TICK || upper > MAX_TICK || lower >= upper || currentTick < lower || currentTick >= upper) {
    throw new Error('The selected tick range is invalid.');
  }
  return { lower, upper };
}

export function minimumAfterSlippage(value, slippageBps) {
  const amount = BigInt(value);
  if (amount < 0n) throw new Error('Amount cannot be negative.');
  if (!Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 500) throw new Error('Slippage must be between 0.1% and 5%.');
  return amount * BigInt(10_000 - slippageBps) / 10_000n;
}

export function validateVerifiedPool(pool) {
  if (!pool || pool.verified !== true) throw new Error('The V3 pool is not verified.');
  if (normalizedAddress(pool.poolId) !== normalizedAddress(SUIDEX_V3_POOL)) throw new Error('Unexpected V3 pool ID.');
  if (normalizedCoinType(pool.tokenX) !== normalizedCoinType(SUI_COIN_TYPE)
    || normalizedCoinType(pool.tokenY) !== normalizedCoinType(TREE_COIN_TYPE)) throw new Error('Unexpected V3 token order.');
  if (Number(pool.tickSpacing) !== TREE_V3_TICK_SPACING) throw new Error('Unexpected V3 tick spacing.');
  if (!Number.isInteger(Number(pool.currentTick)) || !(Number(pool.priceSuiPerTree) > 0)) throw new Error('Invalid verified V3 pool state.');
  return true;
}

function coinBalance(coin) {
  return BigInt(coin?.balance?.balance ?? coin?.balance ?? coin?.totalBalance ?? 0);
}

function coinId(coin) {
  return coin?.objectId || coin?.coinObjectId || coin?.id || null;
}

async function selectTreeCoins(client, owner, requiredRaw) {
  const selected = [];
  let total = 0n;
  let cursor = null;
  for (let pageNumber = 0; pageNumber < 20 && total < requiredRaw; pageNumber += 1) {
    const page = await client.core.listCoins({ owner, coinType: TREE_COIN_TYPE, cursor, limit: 50 });
    const coins = page?.objects || page?.data || page?.coins || [];
    for (const coin of coins) {
      const objectId = coinId(coin);
      const balance = coinBalance(coin);
      if (!objectId || balance <= 0n) continue;
      selected.push({ objectId, balance });
      total += balance;
      if (total >= requiredRaw) break;
    }
    cursor = page?.cursor ?? page?.nextCursor ?? null;
    if (!cursor) break;
  }
  if (total < requiredRaw) throw new Error('The connected wallet does not have enough TREE for this position.');
  return selected;
}

export function assertAllowedV3Transaction(transaction) {
  const commands = transaction?.getData?.().commands || [];
  const calls = commands.flatMap((command) => command?.MoveCall ? [command.MoveCall] : command?.$kind === 'MoveCall' ? [command.MoveCall] : []);
  const expected = ['i32::from', 'i32::from', 'liquidity::open_position', 'liquidity::add_liquidity'];
  if (calls.length !== expected.length) throw new Error('Unexpected V3 Move-call count.');
  calls.forEach((call, index) => {
    const target = call.target || `${call.package}::${call.module}::${call.function}`;
    const parts = target.split('::');
    const packageId = normalizedAddress(parts[0]);
    const label = `${parts[1]}::${parts[2]}`;
    if (packageId !== normalizedAddress(SUIDEX_V3_PACKAGE) || label !== expected[index]) throw new Error(`Move call is not allowlisted: ${target}`);
    if (label.startsWith('liquidity::')) {
      const types = call.typeArguments || [];
      if (normalizedCoinType(types[0]) !== normalizedCoinType(SUI_COIN_TYPE)
        || normalizedCoinType(types[1]) !== normalizedCoinType(TREE_COIN_TYPE)) throw new Error('Unexpected V3 Move-call type arguments.');
    }
  });
  return true;
}

export function assertAllowedIncreaseV3Transaction(transaction) {
  const commands = transaction?.getData?.().commands || [];
  const calls = commands.flatMap((command) => command?.MoveCall ? [command.MoveCall] : command?.$kind === 'MoveCall' ? [command.MoveCall] : []);
  if (calls.length !== 1) throw new Error('Unexpected V3 increase Move-call count.');
  const call = calls[0];
  const target = call.target || `${call.package}::${call.module}::${call.function}`;
  const parts = target.split('::');
  if (normalizedAddress(parts[0]) !== normalizedAddress(SUIDEX_V3_PACKAGE)
    || `${parts[1]}::${parts[2]}` !== 'liquidity::add_liquidity') throw new Error(`Move call is not allowlisted: ${target}`);
  const types = call.typeArguments || [];
  if (normalizedCoinType(types[0]) !== normalizedCoinType(SUI_COIN_TYPE)
    || normalizedCoinType(types[1]) !== normalizedCoinType(TREE_COIN_TYPE)) throw new Error('Unexpected V3 increase type arguments.');
  return true;
}

export async function buildCreateTreeV3Position({
  Transaction,
  client,
  owner,
  treeRaw,
  suiRaw,
  tickLower,
  tickUpper,
  minTreeRaw = 0n,
  minSuiRaw = 0n,
}) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins) throw new Error('Sui transaction dependencies are unavailable.');
  if (!normalizedAddress(owner)) throw new Error('A valid Sui owner address is required.');
  treeRaw = BigInt(treeRaw); suiRaw = BigInt(suiRaw);
  minTreeRaw = BigInt(minTreeRaw); minSuiRaw = BigInt(minSuiRaw);
  if (treeRaw <= 0n || suiRaw <= 0n) throw new Error('Both SUI and TREE deposits must be greater than zero.');
  if (minTreeRaw < 0n || minSuiRaw < 0n || minTreeRaw > treeRaw || minSuiRaw > suiRaw) throw new Error('Invalid minimum deposit amounts.');
  if (!Number.isInteger(tickLower) || !Number.isInteger(tickUpper)
    || tickLower % TREE_V3_TICK_SPACING !== 0 || tickUpper % TREE_V3_TICK_SPACING !== 0
    || tickLower < MIN_TICK || tickUpper > MAX_TICK || tickLower >= tickUpper) throw new Error('Invalid SuiDex V3 tick range.');

  const treeCoins = await selectTreeCoins(client, owner, treeRaw);
  const transaction = new Transaction();
  transaction.setSender(owner);
  const lower = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::i32::from`,
    arguments: [transaction.pure.u32(encodeSignedI32(tickLower))],
  });
  const upper = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::i32::from`,
    arguments: [transaction.pure.u32(encodeSignedI32(tickUpper))],
  });
  const position = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::liquidity::open_position`,
    typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
    arguments: [transaction.object(SUIDEX_V3_POOL), lower, upper, transaction.object(SUIDEX_V3_VERSION)],
  });
  const [suiCoin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(suiRaw)]);
  const treeSource = transaction.object(treeCoins[0].objectId);
  if (treeCoins.length > 1) transaction.mergeCoins(treeSource, treeCoins.slice(1).map((coin) => transaction.object(coin.objectId)));
  const [treeCoin] = transaction.splitCoins(treeSource, [transaction.pure.u64(treeRaw)]);
  const [remainingSui, remainingTree] = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::liquidity::add_liquidity`,
    typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
    arguments: [
      transaction.object(SUIDEX_V3_POOL), position, suiCoin, treeCoin,
      transaction.pure.u64(minSuiRaw), transaction.pure.u64(minTreeRaw),
      transaction.object(SUI_CLOCK), transaction.object(SUIDEX_V3_VERSION),
    ],
  });
  const recipient = transaction.pure.address(owner);
  transaction.transferObjects([position], recipient);
  transaction.transferObjects([remainingSui], transaction.pure.address(owner));
  transaction.transferObjects([remainingTree], transaction.pure.address(owner));
  assertAllowedV3Transaction(transaction);
  return transaction;
}

export async function buildIncreaseTreeV3Position({
  Transaction,
  client,
  owner,
  positionId,
  treeRaw,
  suiRaw,
  minTreeRaw = 0n,
  minSuiRaw = 0n,
}) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins) throw new Error('Sui transaction dependencies are unavailable.');
  if (!normalizedAddress(owner)) throw new Error('A valid Sui owner address is required.');
  if (!normalizedAddress(positionId)) throw new Error('A valid SuiDex V3 position ID is required.');
  treeRaw = BigInt(treeRaw); suiRaw = BigInt(suiRaw);
  minTreeRaw = BigInt(minTreeRaw); minSuiRaw = BigInt(minSuiRaw);
  if (treeRaw <= 0n || suiRaw <= 0n) throw new Error('Both SUI and TREE maximums must be greater than zero.');
  if (minTreeRaw < 0n || minSuiRaw < 0n || minTreeRaw > treeRaw || minSuiRaw > suiRaw) throw new Error('Invalid minimum deposit amounts.');

  const treeCoins = await selectTreeCoins(client, owner, treeRaw);
  const transaction = new Transaction();
  transaction.setSender(owner);
  const [suiCoin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(suiRaw)]);
  const treeSource = transaction.object(treeCoins[0].objectId);
  if (treeCoins.length > 1) transaction.mergeCoins(treeSource, treeCoins.slice(1).map((coin) => transaction.object(coin.objectId)));
  const [treeCoin] = transaction.splitCoins(treeSource, [transaction.pure.u64(treeRaw)]);
  const [remainingSui, remainingTree] = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::liquidity::add_liquidity`,
    typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
    arguments: [
      transaction.object(SUIDEX_V3_POOL), transaction.object(positionId), suiCoin, treeCoin,
      transaction.pure.u64(minSuiRaw), transaction.pure.u64(minTreeRaw),
      transaction.object(SUI_CLOCK), transaction.object(SUIDEX_V3_VERSION),
    ],
  });
  transaction.transferObjects([remainingSui], transaction.pure.address(owner));
  transaction.transferObjects([remainingTree], transaction.pure.address(owner));
  assertAllowedIncreaseV3Transaction(transaction);
  return transaction;
}

function simulationTransaction(value) {
  return value?.Transaction || value?.transaction || value?.result?.Transaction || value;
}

export function simulationSucceeded(value) {
  const transaction = simulationTransaction(value);
  const status = transaction?.status || transaction?.effects?.status || value?.effects?.status;
  return status?.success === true || status?.status === 'success' || status === 'success';
}

export function extractAddLiquidityEvent(value, expectedPositionId = null) {
  const transaction = simulationTransaction(value);
  const events = transaction?.events || value?.events || [];
  const event = events.find((item) => String(item?.eventType || item?.type || '').endsWith('::liquidity::AddLiquidityEvent'));
  const json = event?.json || event?.parsedJson || event?.parsed_json;
  if (!json || normalizedAddress(json.pool_id) !== normalizedAddress(SUIDEX_V3_POOL)
    || (expectedPositionId && normalizedAddress(json.position_id) !== normalizedAddress(expectedPositionId))) return null;
  try {
    const suiRaw = BigInt(json.amount_x);
    const treeRaw = BigInt(json.amount_y);
    const liquidityRaw = BigInt(json.liquidity);
    return suiRaw > 0n && treeRaw > 0n && liquidityRaw > 0n ? { suiRaw, treeRaw, liquidityRaw } : null;
  } catch {
    return null;
  }
}
