import {
  CLOCK,
  SUI_TYPE,
  V2_FACTORY,
  V2_PACKAGE,
  V2_ROUTER,
  VICTORY_SUI_POOL,
  VICTORY_TYPE,
  coinForAmount,
  normalizeAddress,
  normalizeType,
} from './earn-transactions-core.js';
import {
  SUIDEX_V3_PACKAGE,
  SUIDEX_V3_POOL,
  SUIDEX_V3_VERSION,
  SUI_CLOCK,
  SUI_COIN_TYPE,
  TREE_COIN_TYPE,
  TREE_V3_TICK_SPACING,
  encodeSignedI32,
} from './v3-transaction-core.js';
import {
  VICTORY_EMISSION_CONFIG,
  VICTORY_LOCKED_VAULT,
  VICTORY_LOCKER,
  VICTORY_LOCK_TERMS,
} from './victory-transaction-core.js';

const MIN_TICK = -443_636;
const MAX_TICK = 443_636;

function normalizedTarget(call) {
  const target = call?.target || `${call?.package}::${call?.module}::${call?.function}`;
  const parts = String(target).split('::');
  return `${normalizeAddress(parts[0])}::${parts[1]}::${parts[2]}`;
}

function assertTypeArguments(call, expected) {
  const actual = call?.typeArguments || [];
  if (actual.length !== expected.length || actual.some((type, index) => normalizeType(type) !== normalizeType(expected[index]))) {
    throw new Error('Unexpected V3 reinvest type arguments.');
  }
}

export function assertAllowedVictoryV3ReinvestTransaction(transaction, { sustainable = false, newPosition = true } = {}) {
  const calls = (transaction?.getData?.().commands || []).flatMap((command) => command?.MoveCall
    ? [command.MoveCall]
    : command?.$kind === 'MoveCall' ? [command.MoveCall] : []);
  const expected = [
    ...(sustainable ? [[V2_PACKAGE, 'victory_token_locker::lock_tokens']] : []),
    [V2_PACKAGE, 'router::swap_exact_tokens1_for_tokens0_composable'],
    ['0x2', 'coin::into_balance'],
    [SUIDEX_V3_PACKAGE, 'trade::flash_swap'],
    ['0x2', 'balance::zero'],
    [SUIDEX_V3_PACKAGE, 'trade::repay_flash_swap'],
    ['0x2', 'balance::destroy_zero'],
    ['0x2', 'coin::from_balance'],
    ...(newPosition ? [
      [SUIDEX_V3_PACKAGE, 'i32::from'],
      [SUIDEX_V3_PACKAGE, 'i32::from'],
      [SUIDEX_V3_PACKAGE, 'liquidity::open_position'],
    ] : []),
    [SUIDEX_V3_PACKAGE, 'liquidity::add_liquidity'],
  ];
  if (calls.length !== expected.length) throw new Error('Unexpected V3 reinvest Move-call count.');
  calls.forEach((call, index) => {
    const [packageId, label] = expected[index];
    const target = normalizedTarget(call);
    if (target !== `${normalizeAddress(packageId)}::${label}`) throw new Error(`Move call is not allowlisted: ${target}`);
    if (label === 'router::swap_exact_tokens1_for_tokens0_composable') assertTypeArguments(call, [SUI_TYPE, VICTORY_TYPE]);
    if (['trade::flash_swap', 'trade::repay_flash_swap', 'liquidity::open_position', 'liquidity::add_liquidity'].includes(label)) {
      assertTypeArguments(call, [SUI_COIN_TYPE, TREE_COIN_TYPE]);
    }
  });
  return true;
}

function validateTicks(tickLower, tickUpper) {
  if (!Number.isInteger(tickLower) || !Number.isInteger(tickUpper)
    || tickLower % TREE_V3_TICK_SPACING !== 0 || tickUpper % TREE_V3_TICK_SPACING !== 0
    || tickLower < MIN_TICK || tickUpper > MAX_TICK || tickLower >= tickUpper) {
    throw new Error('Invalid SuiDex V3 tick range.');
  }
}

function validatePositionId(positionId) {
  return /^0x[0-9a-f]{64}$/i.test(String(positionId || ''));
}

export function validateVictoryV3Quote(quote, amountIn, slippageBps) {
  if (!quote || String(quote?.victoryToSui?.pairId).toLowerCase() !== VICTORY_SUI_POOL) {
    throw new Error('The VICTORY route does not use the verified VICTORY/SUI pool.');
  }
  if (BigInt(quote.amountIn ?? 0) !== BigInt(amountIn) || Number(quote.slippageBps) !== Number(slippageBps)) {
    throw new Error('The V3 reinvest quote no longer matches this request.');
  }
  if (BigInt(quote.victoryToSui?.amountIn ?? 0) !== BigInt(amountIn)
    || BigInt(quote.victoryToSui?.minAmountOut ?? 0) <= 0n
    || BigInt(quote.v3SwapRaw ?? 0) <= 0n
    || BigInt(quote.v3SwapRaw) >= BigInt(quote.victoryToSui.minAmountOut)
    || BigInt(quote.minSwapOutRaw ?? 0) <= 0n) throw new Error('The V3 reinvest quote amounts are invalid.');
  validateTicks(Number(quote.tickLower), Number(quote.tickUpper));
  if (quote.positionId && !validatePositionId(quote.positionId)) throw new Error('The selected V3 position is invalid.');
  return quote;
}

export async function buildVictoryV3ReinvestTransaction({
  Transaction,
  client,
  owner,
  totalAmount,
  reinvestAmount,
  lockAmount = 0n,
  lockDays = null,
  quote,
  slippageBps = 100,
  minSuiRaw = 0n,
  minTreeRaw = 0n,
}) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins || !/^0x[0-9a-f]{64}$/i.test(owner || '')) {
    throw new Error('VICTORY V3 reinvest dependencies are unavailable.');
  }
  const totalRaw = BigInt(totalAmount ?? 0);
  const reinvestRaw = BigInt(reinvestAmount ?? 0);
  const lockRaw = BigInt(lockAmount ?? 0);
  minSuiRaw = BigInt(minSuiRaw); minTreeRaw = BigInt(minTreeRaw);
  if (totalRaw <= 0n || reinvestRaw < 1_000n || reinvestRaw + lockRaw !== totalRaw) throw new Error('The VICTORY allocation is invalid.');
  if (lockRaw < 0n || minSuiRaw < 0n || minTreeRaw < 0n) throw new Error('A V3 reinvest amount is invalid.');
  const sustainable = lockRaw > 0n;
  const days = sustainable ? Number(lockDays) : null;
  if (sustainable && !VICTORY_LOCK_TERMS.includes(days)) throw new Error('Choose a verified VICTORY lock term.');
  validateVictoryV3Quote(quote, reinvestRaw, slippageBps);
  const newPosition = !quote.positionId;

  const transaction = new Transaction();
  transaction.setSender(owner);
  const fullVictory = await coinForAmount(transaction, client, owner, VICTORY_TYPE, totalRaw);
  let victoryForSwap = fullVictory;
  if (sustainable) {
    const [lockCoin] = transaction.splitCoins(fullVictory, [transaction.pure.u64(lockRaw)]);
    transaction.moveCall({
      target: `${V2_PACKAGE}::victory_token_locker::lock_tokens`,
      arguments: [
        transaction.object(VICTORY_LOCKER), transaction.object(VICTORY_LOCKED_VAULT), lockCoin,
        transaction.pure.u64(days), transaction.object(VICTORY_EMISSION_CONFIG), transaction.object(CLOCK),
      ],
    });
  }
  const suiCoin = transaction.moveCall({
    target: `${V2_PACKAGE}::router::swap_exact_tokens1_for_tokens0_composable`,
    typeArguments: [SUI_TYPE, VICTORY_TYPE],
    arguments: [
      transaction.object(V2_ROUTER), transaction.object(V2_FACTORY), transaction.object(VICTORY_SUI_POOL), victoryForSwap,
      transaction.pure.u256(quote.victoryToSui.minAmountOut), transaction.object(CLOCK),
    ],
  });
  const [suiSwapCoin] = transaction.splitCoins(suiCoin, [transaction.pure.u64(quote.v3SwapRaw)]);
  const suiBalance = transaction.moveCall({ target: '0x2::coin::into_balance', typeArguments: [SUI_COIN_TYPE], arguments: [suiSwapCoin] });
  const [balanceSui, balanceTree, receipt] = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::trade::flash_swap`,
    typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
    arguments: [
      transaction.object(SUIDEX_V3_POOL), transaction.pure.bool(true), transaction.pure.bool(true),
      transaction.pure.u64(quote.v3SwapRaw), transaction.pure.u128(4_295_048_017n), transaction.object(SUI_CLOCK), transaction.object(SUIDEX_V3_VERSION),
    ],
  });
  const zeroTree = transaction.moveCall({ target: '0x2::balance::zero', typeArguments: [TREE_COIN_TYPE], arguments: [] });
  transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::trade::repay_flash_swap`,
    typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
    arguments: [transaction.object(SUIDEX_V3_POOL), receipt, suiBalance, zeroTree, transaction.object(SUIDEX_V3_VERSION)],
  });
  transaction.moveCall({ target: '0x2::balance::destroy_zero', typeArguments: [SUI_COIN_TYPE], arguments: [balanceSui] });
  const treeCoin = transaction.moveCall({ target: '0x2::coin::from_balance', typeArguments: [TREE_COIN_TYPE], arguments: [balanceTree] });
  const [minimumCheck] = transaction.splitCoins(treeCoin, [transaction.pure.u64(quote.minSwapOutRaw)]);
  transaction.mergeCoins(treeCoin, [minimumCheck]);

  let position;
  if (newPosition) {
    const lower = transaction.moveCall({ target: `${SUIDEX_V3_PACKAGE}::i32::from`, arguments: [transaction.pure.u32(encodeSignedI32(Number(quote.tickLower)))] });
    const upper = transaction.moveCall({ target: `${SUIDEX_V3_PACKAGE}::i32::from`, arguments: [transaction.pure.u32(encodeSignedI32(Number(quote.tickUpper)))] });
    position = transaction.moveCall({
      target: `${SUIDEX_V3_PACKAGE}::liquidity::open_position`,
      typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
      arguments: [transaction.object(SUIDEX_V3_POOL), lower, upper, transaction.object(SUIDEX_V3_VERSION)],
    });
  } else {
    position = transaction.object(quote.positionId);
  }
  const [remainingSui, remainingTree] = transaction.moveCall({
    target: `${SUIDEX_V3_PACKAGE}::liquidity::add_liquidity`,
    typeArguments: [SUI_COIN_TYPE, TREE_COIN_TYPE],
    arguments: [
      transaction.object(SUIDEX_V3_POOL), position, suiCoin, treeCoin,
      transaction.pure.u64(minSuiRaw), transaction.pure.u64(minTreeRaw),
      transaction.object(SUI_CLOCK), transaction.object(SUIDEX_V3_VERSION),
    ],
  });
  const returned = [remainingSui, remainingTree];
  if (newPosition) returned.unshift(position);
  transaction.transferObjects(returned, transaction.pure.address(owner));
  assertAllowedVictoryV3ReinvestTransaction(transaction, { sustainable, newPosition });
  return { transaction, totalRaw, reinvestRaw, lockRaw, lockDays: days, newPosition, quote };
}
