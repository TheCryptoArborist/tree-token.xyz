export const SUI_TYPE = '0x2::sui::SUI';
export const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const V2_PACKAGE = '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
export const V2_ROUTER = '0x9cdbbd092634efdc0e7033dc1c49d9ea5fc9bc5969ba708f55e05b6fcac12177';
export const V2_FACTORY = '0x81c286135713b4bf2e78c548f5643766b5913dcd27a8e76469f146ab811e922d';
export const V2_POOL = '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';
export const V2_FARM = '0xc9c6844deb5031e87f14a9869736874327e4f7b9e2aef51c47f4e004c5b1053c';
export const V2_REWARD_VAULT = '0x227929e900c085a1e55f7e455d3af66aa0f522cf26dc54ed3e111dc8797a3e00';
export const V2_EMISSION_CONFIG = '0xfbd4d5f644cc82e7486ceb048b8951a6efffe39254a6646d99f0ea6b81b5c5f4';
export const CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006';
export const V2_LP_TYPE = `${V2_PACKAGE}::pair::LPCoin<${SUI_TYPE},${TREE_TYPE}>`;
export const V2_LP_COIN_TYPE = `0x2::coin::Coin<${V2_LP_TYPE}>`;
export const V2_STAKING_POSITION_TYPE = `${V2_PACKAGE}::farm::StakingPosition<${V2_LP_TYPE}>`;
export const VICTORY_TYPE = `${V2_PACKAGE}::victory_token::VICTORY_TOKEN`;
export const VICTORY_DECIMALS = 6;

export function normalizeAddress(value) {
  const body = String(value || '').toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
  return `0x${body}`;
}

export function normalizeType(value) {
  const parts = String(value || '').split('::');
  if (parts.length < 3) return String(value || '').toLowerCase();
  const address = normalizeAddress(parts.shift());
  return `${address}::${parts.join('::')}`.toLowerCase();
}

export function parseAmount(value, decimals, symbol) {
  const text = String(value ?? '').trim();
  const normalized = text.startsWith('.') ? `0${text}` : text;
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('Enter a valid positive amount.');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) throw new Error(`${symbol} supports at most ${decimals} decimal places.`);
  const amount = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+/, '') || '0');
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return amount;
}

export function minimumAfterSlippage(amount, slippageBps) {
  const value = BigInt(amount);
  const bps = BigInt(slippageBps);
  if (value <= 0n || bps < 10n || bps > 500n) throw new Error('Invalid zap slippage protection.');
  return value - value * bps / 10_000n;
}

export function validateV2Quote(quote, { tokenIn, tokenOut, amountIn }) {
  if (!quote || quote.executionKind !== 'suidex-v2-direct') throw new Error('A verified SuiDex V2 quote is required.');
  if (String(quote.pairId).toLowerCase() !== V2_POOL) throw new Error('The quote does not use the verified SUI/TREE V2 pool.');
  if (normalizeType(quote.tokenIn) !== normalizeType(tokenIn) || normalizeType(quote.tokenOut) !== normalizeType(tokenOut)) throw new Error('The quote token direction is invalid.');
  if (BigInt(quote.amountIn) !== BigInt(amountIn) || BigInt(quote.amountOut) <= 0n || BigInt(quote.minAmountOut) <= 0n) throw new Error('The quote amounts are invalid.');
  return quote;
}

async function listCoins(client, owner, coinType) {
  const coins = [];
  let cursor = null;
  do {
    const page = await client.core.listCoins({ owner, coinType, cursor, limit: 50 });
    coins.push(...(page.objects || []));
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return coins.filter((coin) => BigInt(coin.balance || 0) > 0n);
}

async function coinForAmount(transaction, client, owner, coinType, amount) {
  if (normalizeType(coinType) === normalizeType(SUI_TYPE)) {
    const [coin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(amount)]);
    return coin;
  }
  const coins = (await listCoins(client, owner, coinType)).sort((a, b) => BigInt(b.balance || 0) > BigInt(a.balance || 0) ? 1 : -1);
  const selected = [];
  let total = 0n;
  for (const coin of coins) {
    selected.push(coin);
    total += BigInt(coin.balance || 0);
    if (total >= amount) break;
  }
  if (total < amount) throw new Error('Insufficient TREE balance.');
  if (selected.length > 500) throw new Error('Too many TREE coin objects are required. Merge coins or use a smaller amount.');
  const primary = transaction.object(selected[0].objectId);
  for (let index = 1; index < selected.length; index += 200) transaction.mergeCoins(primary, selected.slice(index, index + 200).map((coin) => transaction.object(coin.objectId)));
  const [coin] = transaction.splitCoins(primary, [transaction.pure.u64(amount)]);
  transaction.transferObjects([primary], owner);
  return coin;
}

function assertAllowlisted(transaction, allowedFunctions) {
  for (const command of transaction.getData().commands || []) {
    const call = command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null);
    if (!call) continue;
    const packageId = normalizeAddress(call.package);
    const target = `${packageId}::${call.module}::${call.function}`;
    if (packageId !== normalizeAddress(V2_PACKAGE) || !allowedFunctions.has(target)) throw new Error(`Unexpected Move call in Earn transaction: ${target}`);
  }
}

export async function buildV2ZapTransaction({ Transaction, client, owner, inputType, amountIn, quote, slippageBps = 100 }) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins || !/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Sui transaction dependencies are unavailable.');
  const isSui = normalizeType(inputType) === normalizeType(SUI_TYPE);
  if (!isSui && normalizeType(inputType) !== normalizeType(TREE_TYPE)) throw new Error('Zap input must be SUI or TREE.');
  const inputRaw = BigInt(amountIn);
  if (inputRaw < 2n) throw new Error('The zap amount is too small.');
  const swapRaw = inputRaw / 2n;
  const liquidityInputRaw = inputRaw - swapRaw;
  const outputType = isSui ? TREE_TYPE : SUI_TYPE;
  validateV2Quote(quote, { tokenIn: inputType, tokenOut: outputType, amountIn: swapRaw });
  const desiredOutputRaw = BigInt(quote.amountOut);
  const minOutputRaw = BigInt(quote.minAmountOut);
  const minInputRaw = minimumAfterSlippage(liquidityInputRaw, slippageBps);
  const transaction = new Transaction();
  transaction.setSender(owner);
  const fullInput = await coinForAmount(transaction, client, owner, inputType, inputRaw);
  const [swapCoin] = transaction.splitCoins(fullInput, [transaction.pure.u64(swapRaw)]);
  const swappedCoin = transaction.moveCall({
    target: `${V2_PACKAGE}::router::${isSui ? 'swap_exact_tokens0_for_tokens1_composable' : 'swap_exact_tokens1_for_tokens0_composable'}`,
    typeArguments: [SUI_TYPE, TREE_TYPE],
    arguments: [transaction.object(V2_ROUTER), transaction.object(V2_FACTORY), transaction.object(V2_POOL), swapCoin, transaction.pure.u256(minOutputRaw), transaction.object(CLOCK)],
  });
  const suiCoin = isSui ? fullInput : swappedCoin;
  const treeCoin = isSui ? swappedCoin : fullInput;
  const desiredSuiRaw = isSui ? liquidityInputRaw : desiredOutputRaw;
  const desiredTreeRaw = isSui ? desiredOutputRaw : liquidityInputRaw;
  const minSuiRaw = isSui ? minInputRaw : minOutputRaw;
  const minTreeRaw = isSui ? minOutputRaw : minInputRaw;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  transaction.moveCall({
    target: `${V2_PACKAGE}::router::add_liquidity`,
    typeArguments: [SUI_TYPE, TREE_TYPE],
    arguments: [
      transaction.object(V2_ROUTER), transaction.object(V2_FACTORY), transaction.object(V2_POOL), suiCoin, treeCoin,
      transaction.pure.u256(desiredSuiRaw), transaction.pure.u256(desiredTreeRaw), transaction.pure.u256(minSuiRaw), transaction.pure.u256(minTreeRaw),
      transaction.pure.string(''), transaction.pure.string(''), transaction.pure.u64(deadline), transaction.object(CLOCK),
    ],
  });
  assertAllowlisted(transaction, new Set([
    `${normalizeAddress(V2_PACKAGE)}::router::swap_exact_tokens0_for_tokens1_composable`,
    `${normalizeAddress(V2_PACKAGE)}::router::swap_exact_tokens1_for_tokens0_composable`,
    `${normalizeAddress(V2_PACKAGE)}::router::add_liquidity`,
  ]));
  return { transaction, swapRaw, liquidityInputRaw, desiredOutputRaw, minOutputRaw };
}

export async function getV2LpBalance(client, owner) {
  const coins = await listCoins(client, owner, V2_LP_TYPE);
  return coins.reduce((total, coin) => total + BigInt(coin.balance || 0), 0n);
}

export async function getV2FarmPosition(client, owner) {
  if (!client?.core?.listOwnedObjects) throw new Error('The Sui farm-position lookup is unavailable.');
  const positions = [];
  let cursor = null;
  do {
    const page = await client.core.listOwnedObjects({
      owner,
      type: V2_STAKING_POSITION_TYPE,
      include: { json: true },
      cursor,
      limit: 50,
    });
    positions.push(...(page.objects || []));
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  if (positions.length > 1) throw new Error('Multiple SUI/TREE V2 farm positions were found. No staking transaction was created.');
  if (!positions.length) return null;
  const position = positions[0];
  const vaultId = position?.json?.vault_id ?? position?.json?.vaultId;
  const amount = position?.json?.amount ?? position?.json?.staked_amount ?? position?.json?.stakedAmount;
  if (!/^0x[0-9a-f]{64}$/i.test(position.objectId || '') || !/^0x[0-9a-f]{64}$/i.test(vaultId || '')) {
    throw new Error('The existing SUI/TREE V2 farm position could not be verified.');
  }
  let stakedLpRaw;
  try { stakedLpRaw = BigInt(amount ?? 0); } catch { throw new Error('The staked SUI/TREE V2 LP amount could not be verified.'); }
  if (stakedLpRaw < 0n) throw new Error('The staked SUI/TREE V2 LP amount could not be verified.');
  return { positionId: position.objectId, vaultId, stakedLpRaw };
}

export function estimateV2PositionUnderlying(stakedLpRaw, poolJson) {
  const amount = BigInt(stakedLpRaw ?? 0);
  const reserveSuiRaw = BigInt(poolJson?.reserve0 ?? poolJson?.balance0 ?? 0);
  const reserveTreeRaw = BigInt(poolJson?.reserve1 ?? poolJson?.balance1 ?? 0);
  const totalSupplyRaw = BigInt(poolJson?.total_supply ?? poolJson?.lp_supply?.value ?? 0);
  if (amount < 0n || reserveSuiRaw < 0n || reserveTreeRaw < 0n || totalSupplyRaw <= 0n) {
    throw new Error('The verified SUI/TREE V2 pool reserves are unavailable.');
  }
  return {
    suiRaw: amount * reserveSuiRaw / totalSupplyRaw,
    treeRaw: amount * reserveTreeRaw / totalSupplyRaw,
    sharePpm: amount * 1_000_000n / totalSupplyRaw,
  };
}

export async function buildV2StakeTransaction({ Transaction, client, owner, amount }) {
  const stakeRaw = BigInt(amount);
  if (typeof Transaction !== 'function' || !client?.core?.listCoins || !client?.core?.listOwnedObjects || stakeRaw <= 0n) throw new Error('No new SUI/TREE LP is available to stake.');
  const existingPosition = await getV2FarmPosition(client, owner);
  const coins = (await listCoins(client, owner, V2_LP_TYPE)).sort((a, b) => BigInt(b.balance || 0) > BigInt(a.balance || 0) ? 1 : -1);
  const selected = [];
  let total = 0n;
  for (const coin of coins) {
    selected.push(coin);
    total += BigInt(coin.balance || 0);
    if (total >= stakeRaw) break;
  }
  if (total < stakeRaw) throw new Error('The newly created LP balance could not be verified.');
  const transaction = new Transaction();
  transaction.setSender(owner);
  const primary = transaction.object(selected[0].objectId);
  if (selected.length > 1) transaction.mergeCoins(primary, selected.slice(1).map((coin) => transaction.object(coin.objectId)));
  const [stakeCoin] = transaction.splitCoins(primary, [transaction.pure.u64(stakeRaw)]);
  transaction.transferObjects([primary], owner);
  const vector = transaction.makeMoveVec({ type: V2_LP_COIN_TYPE, elements: [stakeCoin] });
  if (existingPosition) {
    transaction.moveCall({
      target: `${V2_PACKAGE}::farm::add_to_position_lp`,
      typeArguments: [SUI_TYPE, TREE_TYPE],
      arguments: [
        transaction.object(V2_FARM), transaction.object(V2_REWARD_VAULT),
        transaction.object(existingPosition.positionId), transaction.object(existingPosition.vaultId),
        vector, transaction.pure.u256(stakeRaw), transaction.object(V2_EMISSION_CONFIG), transaction.object(CLOCK),
      ],
    });
  } else {
    transaction.moveCall({
      target: `${V2_PACKAGE}::farm::stake_lp`,
      typeArguments: [SUI_TYPE, TREE_TYPE],
      arguments: [transaction.object(V2_FARM), transaction.object(V2_REWARD_VAULT), vector, transaction.pure.u256(stakeRaw), transaction.object(V2_EMISSION_CONFIG), transaction.object(CLOCK)],
    });
  }
  assertAllowlisted(transaction, new Set([
    `${normalizeAddress(V2_PACKAGE)}::farm::stake_lp`,
    `${normalizeAddress(V2_PACKAGE)}::farm::add_to_position_lp`,
  ]));
  return transaction;
}

export async function buildV2ClaimRewardsTransaction({ Transaction, client, owner }) {
  if (typeof Transaction !== 'function' || !client?.core?.listOwnedObjects || !/^0x[0-9a-f]{64}$/i.test(owner || '')) {
    throw new Error('Sui V2 reward-claim dependencies are unavailable.');
  }
  const existingPosition = await getV2FarmPosition(client, owner);
  if (!existingPosition) throw new Error('No SUI/TREE V2 farm position was found for this wallet.');
  const transaction = new Transaction();
  transaction.setSender(owner);
  transaction.moveCall({
    target: `${V2_PACKAGE}::farm::claim_rewards_lp`,
    typeArguments: [SUI_TYPE, TREE_TYPE],
    arguments: [
      transaction.object(V2_FARM),
      transaction.object(V2_REWARD_VAULT),
      transaction.object(existingPosition.positionId),
      transaction.object(V2_EMISSION_CONFIG),
      transaction.object(CLOCK),
    ],
  });
  assertAllowlisted(transaction, new Set([
    `${normalizeAddress(V2_PACKAGE)}::farm::claim_rewards_lp`,
  ]));
  return { transaction, positionId: existingPosition.positionId };
}

function transactionResult(value) {
  if (value?.$kind === 'Transaction') return value.Transaction;
  return value?.Transaction || value?.transaction || value;
}

function balanceChangeOwner(change) {
  const candidate = change?.address
    ?? change?.owner?.address
    ?? change?.owner?.AddressOwner
    ?? change?.owner;
  return typeof candidate === 'string' ? normalizeAddress(candidate) : null;
}

export function extractPositiveV2VictoryReward(value, owner) {
  const result = transactionResult(value);
  const changes = result?.balanceChanges
    ?? result?.effects?.balanceChanges
    ?? value?.balanceChanges
    ?? value?.effects?.balanceChanges
    ?? [];
  const normalizedOwner = normalizeAddress(owner);
  return (Array.isArray(changes) ? changes : []).reduce((total, change) => {
    if (normalizeType(change?.coinType) !== normalizeType(VICTORY_TYPE)) return total;
    if (balanceChangeOwner(change) !== normalizedOwner) return total;
    try {
      const amount = BigInt(change?.amount ?? 0);
      return amount > 0n ? total + amount : total;
    } catch {
      return total;
    }
  }, 0n);
}
