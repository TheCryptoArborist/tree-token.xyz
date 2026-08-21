import {
  SUI_TYPE, TREE_TYPE, V2_FACTORY, V2_PACKAGE, V2_POOL, V2_ROUTER, VICTORY_SUI_POOL, VICTORY_TYPE,
  normalizeAddress, normalizeType, validateVictoryReinvestQuote,
} from './earn-transactions-core.js';

export const VICTORY_LOCKER = '0xb604843d501173f9ea0762fbaa7cadaea3454c942deb527cb8905861ce39798b';
export const VICTORY_LOCKED_VAULT = '0x3632b8acce355fc8237998d44f1a68e58baac95f199714cdef5736d580dc6bf1';
export const VICTORY_REWARD_VAULT = '0xb70212065c2af0107a799517517e9170fcd38211aaa66f0ebc5a764d0506e2cc';
export const VICTORY_SUI_REWARD_VAULT = '0xd781268befec0270299d5089f182d8c1f1caed15f8b7db3fa1a267b73e89ce9f';
export const VICTORY_EMISSION_CONFIG = '0xfbd4d5f644cc82e7486ceb048b8951a6efffe39254a6646d99f0ea6b81b5c5f4';
export const CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006';
export const VICTORY_LOCK_TERMS = Object.freeze([7, 90, 365, 1095]);
export const SECONDS_PER_YEAR = 31_536_000n;

function requireUnsigned(value, label) {
  try {
    const parsed = BigInt(value ?? 0);
    if (parsed < 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} is unavailable.`);
  }
}

async function listVictoryCoins(client, owner) {
  const coins = [];
  let cursor = null;
  do {
    const page = await client.core.listCoins({ owner, coinType: VICTORY_TYPE, cursor, limit: 50 });
    coins.push(...(page.objects || []));
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return coins.filter((coin) => BigInt(coin.balance || 0) > 0n);
}

function assertLockOnly(transaction) {
  const allowed = `${normalizeAddress(V2_PACKAGE)}::victory_token_locker::lock_tokens`;
  for (const command of transaction.getData().commands || []) {
    const call = command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null);
    if (!call) continue;
    const target = `${normalizeAddress(call.package)}::${call.module}::${call.function}`;
    if (target !== allowed) throw new Error(`Unexpected Move call in VICTORY lock transaction: ${target}`);
  }
}

function assertVictoryCalls(transaction, allowedFunctions) {
  for (const command of transaction.getData().commands || []) {
    const call = command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null);
    if (!call) continue;
    const target = `${normalizeAddress(call.package)}::${call.module}::${call.function}`;
    if (!allowedFunctions.has(target)) throw new Error(`Unexpected Move call in VICTORY transaction: ${target}`);
  }
}

export async function buildVictoryLockTransaction({ Transaction, client, owner, amount, lockDays }) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins || !/^0x[0-9a-f]{64}$/i.test(owner || '')) {
    throw new Error('Sui VICTORY lock dependencies are unavailable.');
  }
  const amountRaw = BigInt(amount ?? 0);
  const days = Number(lockDays);
  if (amountRaw <= 0n) throw new Error('Enter a VICTORY amount greater than zero.');
  if (!VICTORY_LOCK_TERMS.includes(days)) throw new Error('Choose a verified VICTORY lock term.');

  const coins = (await listVictoryCoins(client, owner))
    .sort((a, b) => BigInt(a.balance || 0) > BigInt(b.balance || 0) ? -1 : 1);
  const selected = [];
  let total = 0n;
  for (const coin of coins) {
    selected.push(coin);
    total += BigInt(coin.balance || 0);
    if (total >= amountRaw) break;
  }
  if (total < amountRaw) throw new Error('Insufficient VICTORY balance.');
  if (selected.length > 500) throw new Error('Too many VICTORY coin objects are required. Merge coins or use a smaller amount.');

  const transaction = new Transaction();
  transaction.setSender(owner);
  const primary = transaction.object(selected[0].objectId);
  for (let index = 1; index < selected.length; index += 200) {
    transaction.mergeCoins(primary, selected.slice(index, index + 200).map((coin) => transaction.object(coin.objectId)));
  }
  const [lockCoin] = transaction.splitCoins(primary, [transaction.pure.u64(amountRaw)]);
  transaction.transferObjects([primary], owner);
  transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::lock_tokens`,
    arguments: [
      transaction.object(VICTORY_LOCKER),
      transaction.object(VICTORY_LOCKED_VAULT),
      lockCoin,
      transaction.pure.u64(days),
      transaction.object(VICTORY_EMISSION_CONFIG),
      transaction.object(CLOCK),
    ],
  });
  assertLockOnly(transaction);
  return { transaction, amountRaw, lockDays: days };
}

export async function buildVictoryV2SustainableReinvestTransaction({ Transaction, client, owner, totalAmount, reinvestBps, lockDays, quote, slippageBps = 100 }) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins || !/^0x[0-9a-f]{64}$/i.test(owner || '')) {
    throw new Error('Sustainable reinvest dependencies are unavailable.');
  }
  const totalRaw = BigInt(totalAmount ?? 0); const splitBps = Number(reinvestBps); const days = Number(lockDays);
  if (totalRaw <= 0n) throw new Error('Enter a VICTORY amount greater than zero.');
  if (!Number.isInteger(splitBps) || splitBps < 100 || splitBps > 9_900) throw new Error('Choose a reinvest split between 1% and 99%.');
  if (!VICTORY_LOCK_TERMS.includes(days)) throw new Error('Choose a verified VICTORY lock term.');
  const reinvestRaw = totalRaw * BigInt(splitBps) / 10_000n; const lockRaw = totalRaw - reinvestRaw;
  if (reinvestRaw < 1_000n || lockRaw <= 0n) throw new Error('The selected split is too small for the verified sustainable route.');
  validateVictoryReinvestQuote(quote, reinvestRaw, slippageBps);

  const coins = (await listVictoryCoins(client, owner)).sort((a, b) => BigInt(a.balance || 0) > BigInt(b.balance || 0) ? -1 : 1);
  const selected = []; let selectedTotal = 0n;
  for (const coin of coins) { selected.push(coin); selectedTotal += BigInt(coin.balance || 0); if (selectedTotal >= totalRaw) break; }
  if (selectedTotal < totalRaw) throw new Error('Insufficient VICTORY balance.');
  if (selected.length > 500) throw new Error('Too many VICTORY coin objects are required. Merge coins or use a smaller amount.');

  const transaction = new Transaction(); transaction.setSender(owner);
  const primary = transaction.object(selected[0].objectId);
  for (let index = 1; index < selected.length; index += 200) transaction.mergeCoins(primary, selected.slice(index, index + 200).map((coin) => transaction.object(coin.objectId)));
  const [sustainableCoin] = transaction.splitCoins(primary, [transaction.pure.u64(totalRaw)]); transaction.transferObjects([primary], owner);
  const [lockCoin] = transaction.splitCoins(sustainableCoin, [transaction.pure.u64(lockRaw)]);
  transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::lock_tokens`,
    arguments: [transaction.object(VICTORY_LOCKER), transaction.object(VICTORY_LOCKED_VAULT), lockCoin, transaction.pure.u64(days), transaction.object(VICTORY_EMISSION_CONFIG), transaction.object(CLOCK)],
  });
  const suiCoin = transaction.moveCall({
    target: `${V2_PACKAGE}::router::swap_exact_tokens1_for_tokens0_composable`, typeArguments: [SUI_TYPE, VICTORY_TYPE],
    arguments: [transaction.object(V2_ROUTER), transaction.object(V2_FACTORY), transaction.object(VICTORY_SUI_POOL), sustainableCoin, transaction.pure.u256(quote.victoryToSui.minAmountOut), transaction.object(CLOCK)],
  });
  const [suiSwapCoin] = transaction.splitCoins(suiCoin, [transaction.pure.u64(quote.suiSwapRaw)]);
  const treeCoin = transaction.moveCall({
    target: `${V2_PACKAGE}::router::swap_exact_tokens0_for_tokens1_composable`, typeArguments: [SUI_TYPE, TREE_TYPE],
    arguments: [transaction.object(V2_ROUTER), transaction.object(V2_FACTORY), transaction.object(V2_POOL), suiSwapCoin, transaction.pure.u256(quote.suiToTree.minAmountOut), transaction.object(CLOCK)],
  });
  const deadline = BigInt(Math.floor(Date.now() / 1_000) + 300);
  transaction.moveCall({
    target: `${V2_PACKAGE}::router::add_liquidity`, typeArguments: [SUI_TYPE, TREE_TYPE],
    arguments: [
      transaction.object(V2_ROUTER), transaction.object(V2_FACTORY), transaction.object(V2_POOL), suiCoin, treeCoin,
      transaction.pure.u256(quote.liquiditySuiRaw), transaction.pure.u256(quote.suiToTree.amountOut),
      transaction.pure.u256(quote.minLiquiditySuiRaw), transaction.pure.u256(quote.suiToTree.minAmountOut),
      transaction.pure.string(''), transaction.pure.string(''), transaction.pure.u64(deadline), transaction.object(CLOCK),
    ],
  });
  assertVictoryCalls(transaction, new Set([
    `${normalizeAddress(V2_PACKAGE)}::victory_token_locker::lock_tokens`,
    `${normalizeAddress(V2_PACKAGE)}::router::swap_exact_tokens1_for_tokens0_composable`,
    `${normalizeAddress(V2_PACKAGE)}::router::swap_exact_tokens0_for_tokens1_composable`,
    `${normalizeAddress(V2_PACKAGE)}::router::add_liquidity`,
  ]));
  return { transaction, totalRaw, reinvestRaw, lockRaw, reinvestBps: splitBps, lockDays: days, quote };
}

function transactionResult(value) {
  if (value?.$kind === 'Transaction') return value.Transaction;
  return value?.Transaction || value?.transaction || value;
}

function balanceChangeOwner(change) {
  const candidate = change?.address ?? change?.owner?.address ?? change?.owner?.AddressOwner ?? change?.owner;
  return typeof candidate === 'string' ? normalizeAddress(candidate) : null;
}

export function extractVictoryLocked(value, owner) {
  const result = transactionResult(value);
  const changes = result?.balanceChanges
    ?? result?.effects?.balanceChanges
    ?? value?.balanceChanges
    ?? value?.effects?.balanceChanges
    ?? [];
  const normalizedOwner = normalizeAddress(owner);
  return (Array.isArray(changes) ? changes : []).reduce((total, change) => {
    if (normalizeType(change?.coinType) !== normalizeType(VICTORY_TYPE) || balanceChangeOwner(change) !== normalizedOwner) return total;
    try {
      const amount = BigInt(change?.amount ?? 0);
      return amount < 0n ? total - amount : total;
    } catch {
      return total;
    }
  }, 0n);
}

export function extractVictoryClaimed(value, owner) {
  const result = transactionResult(value);
  const changes = result?.balanceChanges
    ?? result?.effects?.balanceChanges
    ?? value?.balanceChanges
    ?? value?.effects?.balanceChanges
    ?? [];
  const normalizedOwner = normalizeAddress(owner);
  return (Array.isArray(changes) ? changes : []).reduce((total, change) => {
    if (normalizeType(change?.coinType) !== normalizeType(VICTORY_TYPE) || balanceChangeOwner(change) !== normalizedOwner) return total;
    try {
      const amount = BigInt(change?.amount ?? 0);
      return amount > 0n ? total + amount : total;
    } catch {
      return total;
    }
  }, 0n);
}

function resultEvents(value) {
  const result = transactionResult(value);
  return result?.events ?? result?.effects?.events ?? value?.events ?? value?.effects?.events ?? [];
}

export function extractVictoryClaimEvents(value, owner) {
  const normalizedOwner = normalizeAddress(owner);
  const claims = new Map();
  for (const event of resultEvents(value)) {
    if (!String(event?.eventType || '').endsWith('::victory_token_locker::VictoryRewardsClaimed')) continue;
    const json = event?.json || {};
    if (normalizeAddress(json.user || '0x0') !== normalizedOwner) continue;
    try { claims.set(BigInt(json.lock_id).toString(), BigInt(json.amount || 0)); } catch { /* Ignore malformed events. */ }
  }
  return claims;
}

export function extractVictoryLockEvent(value, owner, expected = {}) {
  const normalizedOwner = normalizeAddress(owner); const amount = expected.amountRaw === undefined ? null : BigInt(expected.amountRaw); const days = expected.lockDays === undefined ? null : Number(expected.lockDays);
  for (const event of resultEvents(value)) {
    if (!String(event?.eventType || '').endsWith('::victory_token_locker::TokensLocked')) continue;
    const json = event?.json || {};
    if (normalizeAddress(json.user || '0x0') !== normalizedOwner) continue;
    try {
      const parsed = { lockId: BigInt(json.lock_id), amountRaw: BigInt(json.amount), lockDays: Number(json.lock_period), lockEnd: BigInt(json.lock_end) };
      if ((amount !== null && parsed.amountRaw !== amount) || (days !== null && parsed.lockDays !== days)) continue;
      return parsed;
    } catch { /* Ignore malformed events. */ }
  }
  return null;
}

export function extractVictoryUnlockEvent(value, owner, lockId) {
  const normalizedOwner = normalizeAddress(owner);
  const expectedLockId = BigInt(lockId).toString();
  const matches = [];
  for (const event of resultEvents(value)) {
    if (!String(event?.eventType || '').endsWith('::victory_token_locker::TokensUnlocked')) continue;
    const json = event?.json || {};
    if (normalizeAddress(json.user || '0x0') !== normalizedOwner) continue;
    try {
      if (BigInt(json.lock_id).toString() !== expectedLockId) continue;
      matches.push({
        lockId: BigInt(json.lock_id),
        amountRaw: BigInt(json.amount || 0),
        victoryRewardsRaw: BigInt(json.victory_rewards || 0),
        suiRewardsRaw: BigInt(json.sui_rewards || 0),
        timestamp: BigInt(json.timestamp || 0),
      });
    } catch { /* Ignore malformed events. */ }
  }
  if (matches.length > 1) throw new Error('The VICTORY unlock returned duplicate completion events.');
  return matches[0] || null;
}

export function extractSuiClaimedFromEvents(value, owner) {
  const normalizedOwner = normalizeAddress(owner);
  return resultEvents(value).reduce((total, event) => {
    if (!String(event?.eventType || '').endsWith('::victory_token_locker::BatchEpochsClaimedForLock')) return total;
    const json = event?.json || {};
    if (normalizeAddress(json.user || '0x0') !== normalizedOwner) return total;
    try { return total + BigInt(json.total_sui_claimed || 0); } catch { return total; }
  }, 0n);
}

function lockBcsType(bcs) {
  return bcs.struct('VictoryLockerLock', {
    id: bcs.u64(), amount: bcs.u64(), lock_period: bcs.u64(), lock_end: bcs.u64(),
    stake_timestamp: bcs.u64(), last_victory_claim_timestamp: bcs.u64(), total_victory_claimed: bcs.u64(),
    last_sui_epoch_claimed: bcs.u64(), claimed_sui_epochs: bcs.vector(bcs.u64()),
  });
}

function missingDynamicField(error) { return error?.code === 'notExists' || /not found/i.test(String(error?.message || error)); }

export async function getVictoryLocks({ client, owner, lockerJson, bcs }) {
  if (!client?.core?.getDynamicField || !bcs?.Address || !/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('VICTORY lock lookup dependencies are unavailable.');
  const tables = [
    [7, lockerJson?.week_locks?.id], [90, lockerJson?.three_month_locks?.id],
    [365, lockerJson?.year_locks?.id], [1095, lockerJson?.three_year_locks?.id],
  ];
  for (const [, tableId] of tables) if (!/^0x[0-9a-f]{64}$/i.test(tableId || '')) throw new Error('A verified VICTORY lock table is unavailable.');
  const name = { type: 'address', bcs: bcs.Address.serialize(owner).toBytes() };
  const Lock = lockBcsType(bcs);
  const pages = await Promise.all(tables.map(async ([term, parentId]) => {
    try {
      const result = await client.core.getDynamicField({ parentId, name });
      const bytes = result?.dynamicField?.value?.bcs;
      if (!(bytes instanceof Uint8Array)) throw new Error(`The ${term}-day VICTORY lock records could not be decoded.`);
      return bcs.vector(Lock).parse(bytes).map((lock) => ({
        id: BigInt(lock.id), amountRaw: BigInt(lock.amount), lockPeriod: Number(lock.lock_period), lockEnd: BigInt(lock.lock_end),
        stakeTimestamp: BigInt(lock.stake_timestamp), lastVictoryClaimTimestamp: BigInt(lock.last_victory_claim_timestamp),
        totalVictoryClaimedRaw: BigInt(lock.total_victory_claimed), lastSuiEpochClaimed: BigInt(lock.last_sui_epoch_claimed),
        claimedSuiEpochs: lock.claimed_sui_epochs.map((epoch) => BigInt(epoch)),
      }));
    } catch (error) {
      if (missingDynamicField(error)) return [];
      throw error;
    }
  }));
  return pages.flat().sort((a, b) => a.id > b.id ? -1 : 1);
}

function validatedLocks(locks) {
  if (!Array.isArray(locks) || !locks.length) throw new Error('No VICTORY locks were found for this wallet.');
  if (locks.length > 100) throw new Error('This wallet has too many locks for one claim transaction.');
  return locks.map((lock) => {
    const id = BigInt(lock.id); const lockPeriod = Number(lock.lockPeriod);
    if (id < 0n || !VICTORY_LOCK_TERMS.includes(lockPeriod)) throw new Error('A VICTORY lock record is invalid.');
    return { id, lockPeriod };
  });
}

export function buildVictoryUnlockTransaction({ Transaction, owner, lock, suiClaim = null }) {
  if (typeof Transaction !== 'function' || !/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('VICTORY unlock dependencies are unavailable.');
  const id = BigInt(lock?.id ?? -1); const lockPeriod = Number(lock?.lockPeriod); const amountRaw = BigInt(lock?.amountRaw ?? 0);
  if (id < 0n || amountRaw <= 0n || !VICTORY_LOCK_TERMS.includes(lockPeriod)) throw new Error('The VICTORY lock record cannot be verified for unlocking.');
  const suiEpochs = Array.isArray(suiClaim?.epochs) ? suiClaim.epochs.map((epoch) => BigInt(epoch)) : [];
  if (suiEpochs.length && BigInt(suiClaim?.lockId ?? -1) !== id) throw new Error('The weekly SUI claim does not belong to this VICTORY lock.');
  if (suiEpochs.length > 156 || suiEpochs.some((epoch) => epoch < 0n)) throw new Error('The weekly SUI claim cannot be verified for this unlock.');
  const transaction = new Transaction(); transaction.setSender(owner);
  if (suiEpochs.length) transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::batch_claim_epochs_for_lock`,
    arguments: [
      transaction.object(VICTORY_LOCKER), transaction.object(VICTORY_SUI_REWARD_VAULT),
      transaction.pure.u64(id), transaction.pure.vector('u64', suiEpochs),
      transaction.object(VICTORY_EMISSION_CONFIG), transaction.object(CLOCK),
    ],
  });
  transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::unlock_tokens`,
    arguments: [
      transaction.object(VICTORY_LOCKER), transaction.object(VICTORY_LOCKED_VAULT),
      transaction.object(VICTORY_REWARD_VAULT), transaction.object(VICTORY_SUI_REWARD_VAULT),
      transaction.object(VICTORY_EMISSION_CONFIG), transaction.pure.u64(id),
      transaction.pure.u64(lockPeriod), transaction.object(CLOCK),
    ],
  });
  assertVictoryCalls(transaction, new Set([
    `${normalizeAddress(V2_PACKAGE)}::victory_token_locker::batch_claim_epochs_for_lock`,
    `${normalizeAddress(V2_PACKAGE)}::victory_token_locker::unlock_tokens`,
  ]));
  return transaction;
}

export function buildVictoryRewardsClaimTransaction({ Transaction, owner, locks }) {
  if (typeof Transaction !== 'function' || !/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('VICTORY reward-claim dependencies are unavailable.');
  const verified = validatedLocks(locks); const transaction = new Transaction(); transaction.setSender(owner);
  for (const lock of verified) transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::claim_victory_rewards`,
    arguments: [transaction.object(VICTORY_LOCKER), transaction.object(VICTORY_REWARD_VAULT), transaction.object(VICTORY_EMISSION_CONFIG), transaction.pure.u64(lock.id), transaction.pure.u64(lock.lockPeriod), transaction.object(CLOCK)],
  });
  assertVictoryCalls(transaction, new Set([`${normalizeAddress(V2_PACKAGE)}::victory_token_locker::claim_victory_rewards`]));
  return transaction;
}

export function buildSuiClaimPreviewTransaction({ Transaction, owner, locks }) {
  if (typeof Transaction !== 'function' || !/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Weekly SUI preview dependencies are unavailable.');
  const verified = validatedLocks(locks); const transaction = new Transaction(); transaction.setSender(owner);
  for (const lock of verified) transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::get_claimable_epochs_for_lock`,
    arguments: [transaction.object(VICTORY_LOCKER), transaction.pure.address(owner), transaction.pure.u64(lock.id), transaction.object(CLOCK)],
  });
  assertVictoryCalls(transaction, new Set([`${normalizeAddress(V2_PACKAGE)}::victory_token_locker::get_claimable_epochs_for_lock`]));
  return transaction;
}

export function decodeSuiClaimPreview(value, locks, bcs) {
  const verified = validatedLocks(locks); const results = value?.commandResults;
  if (!Array.isArray(results) || results.length !== verified.length) throw new Error('The weekly SUI preview returned incomplete results.');
  return results.map((result, index) => {
    const values = result?.returnValues || [];
    if (values.length !== 3) throw new Error('The weekly SUI preview format is invalid.');
    const epochs = bcs.vector(bcs.u64()).parse(values[0].bcs).map((item) => BigInt(item));
    const amounts = bcs.vector(bcs.u64()).parse(values[1].bcs).map((item) => BigInt(item));
    const totalRaw = BigInt(bcs.u64().parse(values[2].bcs));
    if (epochs.length !== amounts.length || amounts.reduce((sum, item) => sum + item, 0n) !== totalRaw) throw new Error('The weekly SUI preview failed reconciliation.');
    return { lockId: verified[index].id, epochs, amounts, totalRaw };
  });
}

export function buildSuiRewardsClaimTransaction({ Transaction, owner, claims }) {
  if (typeof Transaction !== 'function' || !/^0x[0-9a-f]{64}$/i.test(owner || '')) throw new Error('Weekly SUI claim dependencies are unavailable.');
  const verified = (Array.isArray(claims) ? claims : []).filter((claim) => Array.isArray(claim.epochs) && claim.epochs.length).map((claim) => ({ lockId: BigInt(claim.lockId), epochs: claim.epochs.map((epoch) => BigInt(epoch)) }));
  if (!verified.length) throw new Error('No completed weekly SUI epochs are claimable right now.');
  if (verified.some((claim) => claim.epochs.length > 156)) throw new Error('A weekly SUI claim contains too many epochs.');
  const transaction = new Transaction(); transaction.setSender(owner);
  for (const claim of verified) transaction.moveCall({
    target: `${V2_PACKAGE}::victory_token_locker::batch_claim_epochs_for_lock`,
    arguments: [transaction.object(VICTORY_LOCKER), transaction.object(VICTORY_SUI_REWARD_VAULT), transaction.pure.u64(claim.lockId), transaction.pure.vector('u64', claim.epochs), transaction.object(VICTORY_EMISSION_CONFIG), transaction.object(CLOCK)],
  });
  assertVictoryCalls(transaction, new Set([`${normalizeAddress(V2_PACKAGE)}::victory_token_locker::batch_claim_epochs_for_lock`]));
  return transaction;
}

export function buildVictoryEmissionPreviewTransaction({ Transaction }) {
  if (typeof Transaction !== 'function') throw new Error('VICTORY APR preview dependencies are unavailable.');
  const transaction = new Transaction(); transaction.setSender('0x0000000000000000000000000000000000000000000000000000000000000000');
  transaction.moveCall({ target: `${V2_PACKAGE}::global_emission_controller::get_victory_allocation`, arguments: [transaction.object(VICTORY_EMISSION_CONFIG), transaction.object(CLOCK)] });
  assertVictoryCalls(transaction, new Set([`${normalizeAddress(V2_PACKAGE)}::global_emission_controller::get_victory_allocation`]));
  return transaction;
}

export function decodeVictoryEmissionRate(value, bcs) {
  const bytes = value?.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!(bytes instanceof Uint8Array)) throw new Error('The live VICTORY emission rate is unavailable.');
  return BigInt(bcs.u256().parse(bytes));
}

export function calculateVictoryAprs(snapshot, victoryPerSecondRaw) {
  const rate = BigInt(victoryPerSecondRaw || 0); const aprs = {};
  for (const term of VICTORY_LOCK_TERMS) {
    const total = BigInt(snapshot?.termTotals?.[term] || 0); const allocationBps = BigInt(snapshot?.victoryAllocationBps?.[term] || 0);
    const annualRewardsRaw = rate * SECONDS_PER_YEAR * allocationBps / 10_000n;
    aprs[term] = { annualRewardsRaw, aprHundredths: total > 0n ? annualRewardsRaw * 10_000n / total : null };
  }
  return Object.freeze(aprs);
}

export function parseVictoryLockerSnapshot({ lockerJson, vaultJson, victoryRewardJson, suiRewardJson }) {
  const lockCount = requireUnsigned(vaultJson?.lock_count, 'Locker lock count');
  const unlockCount = requireUnsigned(vaultJson?.unlock_count, 'Locker unlock count');
  return {
    totalLockedRaw: requireUnsigned(vaultJson?.locked_balance, 'Total locked VICTORY'),
    activeLocks: lockCount >= unlockCount ? lockCount - unlockCount : 0n,
    totalLocks: lockCount,
    totalUnlocks: unlockCount,
    victoryRewardsRaw: requireUnsigned(victoryRewardJson?.victory_balance, 'VICTORY reward balance'),
    suiRewardsRaw: requireUnsigned(suiRewardJson?.sui_balance, 'SUI reward balance'),
    currentEpoch: requireUnsigned(lockerJson?.current_epoch_id, 'Locker epoch'),
    termTotals: Object.freeze({
      7: requireUnsigned(lockerJson?.week_total_locked, '7-day lock total'),
      90: requireUnsigned(lockerJson?.three_month_total_locked, '90-day lock total'),
      365: requireUnsigned(lockerJson?.year_total_locked, '365-day lock total'),
      1095: requireUnsigned(lockerJson?.three_year_total_locked, '1,095-day lock total'),
    }),
    victoryAllocationBps: Object.freeze({
      7: requireUnsigned(lockerJson?.victory_week_allocation, '7-day VICTORY allocation'),
      90: requireUnsigned(lockerJson?.victory_three_month_allocation, '90-day VICTORY allocation'),
      365: requireUnsigned(lockerJson?.victory_year_allocation, '365-day VICTORY allocation'),
      1095: requireUnsigned(lockerJson?.victory_three_year_allocation, '1,095-day VICTORY allocation'),
    }),
  };
}
