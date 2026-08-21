import assert from 'node:assert/strict';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { VICTORY_TYPE, VICTORY_SUI_POOL, quoteVictoryV2Reinvest } from '../dapp/earn-transactions-core.js';
import {
  SECONDS_PER_YEAR, VICTORY_EMISSION_CONFIG, VICTORY_LOCKED_VAULT, VICTORY_LOCKER, VICTORY_LOCK_TERMS,
  VICTORY_REWARD_VAULT, VICTORY_SUI_REWARD_VAULT, buildSuiClaimPreviewTransaction,
  buildSuiRewardsClaimTransaction, buildVictoryLockTransaction, buildVictoryRewardsClaimTransaction, buildVictoryUnlockTransaction, buildVictoryV2SustainableReinvestTransaction,
  calculateVictoryAprs, decodeSuiClaimPreview, extractSuiClaimedFromEvents, extractVictoryClaimEvents,
  extractVictoryClaimed, extractVictoryLockEvent, extractVictoryLocked, extractVictoryUnlockEvent, getVictoryLocks, parseVictoryLockerSnapshot,
} from '../dapp/victory-transaction-core.js';

for (const objectId of [VICTORY_LOCKER, VICTORY_LOCKED_VAULT, VICTORY_REWARD_VAULT, VICTORY_SUI_REWARD_VAULT, VICTORY_EMISSION_CONFIG]) assert.match(objectId, /^0x[0-9a-f]{64}$/);
assert.deepEqual(VICTORY_LOCK_TERMS, [7, 90, 365, 1095]);

const owner = `0x${'a'.repeat(64)}`;
const fakeClient = { core: { listCoins: async () => ({ objects: [{ objectId: `0x${'1'.repeat(64)}`, balance: '25000000' }], hasNextPage: false }) } };
const built = await buildVictoryLockTransaction({ Transaction, client: fakeClient, owner, amount: 12_500_000n, lockDays: 90 });
const calls = built.transaction.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(calls, ['victory_token_locker::lock_tokens']);
assert.equal(built.amountRaw, 12_500_000n); assert.equal(built.lockDays, 90);
await assert.rejects(() => buildVictoryLockTransaction({ Transaction, client: fakeClient, owner, amount: 1n, lockDays: 30 }), /verified VICTORY lock term/);

const sustainableQuote = quoteVictoryV2Reinvest({
  victorySuiPoolJson: { reserve0: '4000000000000', reserve1: '17000000000000' },
  suiTreePoolJson: { reserve0: '2000000000000', reserve1: '80000000000000000' },
  amountIn: 10_000_000n, slippageBps: 100,
});
assert.equal(sustainableQuote.pairIds.victorySui, VICTORY_SUI_POOL);
const sustainable = await buildVictoryV2SustainableReinvestTransaction({ Transaction, client: fakeClient, owner, totalAmount: 20_000_000n, reinvestBps: 5_000, lockDays: 90, quote: sustainableQuote, slippageBps: 100 });
const sustainableCalls = sustainable.transaction.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(sustainableCalls, ['victory_token_locker::lock_tokens', 'router::swap_exact_tokens1_for_tokens0_composable', 'router::swap_exact_tokens0_for_tokens1_composable', 'router::add_liquidity']);
assert.equal(sustainable.reinvestRaw, 10_000_000n); assert.equal(sustainable.lockRaw, 10_000_000n); assert.equal(sustainable.lockDays, 90);
await assert.rejects(() => buildVictoryV2SustainableReinvestTransaction({ Transaction, client: fakeClient, owner, totalAmount: 20_000_000n, reinvestBps: 10_000, lockDays: 90, quote: sustainableQuote }), /between 1% and 99%/);

assert.equal(extractVictoryLocked({ Transaction: { balanceChanges: [
  { address: owner, coinType: VICTORY_TYPE, amount: '-12500000' },
  { address: owner, coinType: '0x2::sui::SUI', amount: '-2000000' },
] } }, owner), 12_500_000n);
assert.equal(extractVictoryClaimed({ Transaction: { balanceChanges: [{ address: owner, coinType: VICTORY_TYPE, amount: '725000' }] } }, owner), 725_000n);
const victoryEvents = { Transaction: { events: [{ eventType: '0xbfac::victory_token_locker::VictoryRewardsClaimed', json: { user: owner, lock_id: '4', amount: '725000' } }] } };
assert.equal(extractVictoryClaimEvents(victoryEvents, owner).get('4'), 725_000n);
const lockedEvent = extractVictoryLockEvent({ Transaction: { events: [{ eventType: '0xbfac::victory_token_locker::TokensLocked', json: { user: owner, lock_id: '3185', amount: '10000000', lock_period: '90', lock_end: '1795082543' } }] } }, owner, { amountRaw: 10_000_000n, lockDays: 90 });
assert.deepEqual(lockedEvent, { lockId: 3185n, amountRaw: 10_000_000n, lockDays: 90, lockEnd: 1_795_082_543n });
const suiEvents = { Transaction: { events: [{ eventType: '0xbfac::victory_token_locker::BatchEpochsClaimedForLock', json: { user: owner, total_sui_claimed: '99000000' } }] } };
assert.equal(extractSuiClaimedFromEvents(suiEvents, owner), 99_000_000n);

const snapshot = parseVictoryLockerSnapshot({
  lockerJson: { current_epoch_id: '35', week_total_locked: '100', three_month_total_locked: '200', year_total_locked: '300', three_year_total_locked: '400', victory_week_allocation: '200', victory_three_month_allocation: '1800', victory_year_allocation: '1500', victory_three_year_allocation: '6500' },
  vaultJson: { locked_balance: '1000', lock_count: '12', unlock_count: '5' },
  victoryRewardJson: { victory_balance: '600' }, suiRewardJson: { sui_balance: '700' },
});
assert.equal(snapshot.totalLockedRaw, 1000n); assert.equal(snapshot.activeLocks, 7n); assert.equal(snapshot.currentEpoch, 35n);
assert.deepEqual(snapshot.termTotals, { 7: 100n, 90: 200n, 365: 300n, 1095: 400n });
assert.deepEqual(snapshot.victoryAllocationBps, { 7: 200n, 90: 1800n, 365: 1500n, 1095: 6500n });

const locks = [{ id: 4n, lockPeriod: 90 }];
const unlockTx = buildVictoryUnlockTransaction({ Transaction, owner, lock: { id: 4n, lockPeriod: 90, amountRaw: 5_000_000n } });
const unlockData = unlockTx.getData();
assert.deepEqual(unlockData.commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`), ['victory_token_locker::unlock_tokens']);
assert.equal(unlockData.commands[0].MoveCall.arguments.length, 8);
const combinedUnlock = buildVictoryUnlockTransaction({ Transaction, owner, lock: { id: 4n, lockPeriod: 90, amountRaw: 5_000_000n }, suiClaim: { lockId: 4n, epochs: [31n, 32n], totalRaw: 3_500n } });
assert.deepEqual(combinedUnlock.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`), ['victory_token_locker::batch_claim_epochs_for_lock', 'victory_token_locker::unlock_tokens']);
assert.throws(() => buildVictoryUnlockTransaction({ Transaction, owner, lock: { id: 4n, lockPeriod: 90, amountRaw: 5_000_000n }, suiClaim: { lockId: 5n, epochs: [31n] } }), /does not belong/);
const unlockEvent = extractVictoryUnlockEvent({ Transaction: { events: [{ eventType: '0xbfac::victory_token_locker::TokensUnlocked', json: { user: owner, lock_id: '4', amount: '5000000', victory_rewards: '725000', sui_rewards: '0', timestamp: '1800000000' } }] } }, owner, 4n);
assert.deepEqual(unlockEvent, { lockId: 4n, amountRaw: 5_000_000n, victoryRewardsRaw: 725_000n, suiRewardsRaw: 0n, timestamp: 1_800_000_000n });
const victoryClaim = buildVictoryRewardsClaimTransaction({ Transaction, owner, locks });
assert.deepEqual(victoryClaim.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`), ['victory_token_locker::claim_victory_rewards']);
const suiPreviewTx = buildSuiClaimPreviewTransaction({ Transaction, owner, locks });
assert.deepEqual(suiPreviewTx.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`), ['victory_token_locker::get_claimable_epochs_for_lock']);
const preview = decodeSuiClaimPreview({ commandResults: [{ returnValues: [
  { bcs: bcs.vector(bcs.u64()).serialize([31, 32]).toBytes() },
  { bcs: bcs.vector(bcs.u64()).serialize([1000, 2500]).toBytes() },
  { bcs: bcs.u64().serialize(3500).toBytes() },
] }] }, locks, bcs);
assert.deepEqual(preview, [{ lockId: 4n, epochs: [31n, 32n], amounts: [1000n, 2500n], totalRaw: 3500n }]);
const suiClaim = buildSuiRewardsClaimTransaction({ Transaction, owner, claims: preview });
assert.deepEqual(suiClaim.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`), ['victory_token_locker::batch_claim_epochs_for_lock']);

const Lock = bcs.struct('TestVictoryLock', { id: bcs.u64(), amount: bcs.u64(), lock_period: bcs.u64(), lock_end: bcs.u64(), stake_timestamp: bcs.u64(), last_victory_claim_timestamp: bcs.u64(), total_victory_claimed: bcs.u64(), last_sui_epoch_claimed: bcs.u64(), claimed_sui_epochs: bcs.vector(bcs.u64()) });
const lockBytes = bcs.vector(Lock).serialize([{ id: 4, amount: 5_000_000, lock_period: 90, lock_end: 1_800_000_000, stake_timestamp: 1_790_000_000, last_victory_claim_timestamp: 1_790_000_000, total_victory_claimed: 0, last_sui_epoch_claimed: 0, claimed_sui_epochs: [] }]).toBytes();
const tableIds = ['2', '3', '4', '5'].map((digit) => `0x${digit.repeat(64)}`);
const lockClient = { core: { getDynamicField: async ({ parentId }) => {
  if (parentId === tableIds[0]) return { dynamicField: { value: { bcs: lockBytes } } };
  const error = new Error('Object not found'); error.code = 'notExists'; throw error;
} } };
const loadedLocks = await getVictoryLocks({ client: lockClient, owner, lockerJson: { week_locks: { id: tableIds[0] }, three_month_locks: { id: tableIds[1] }, year_locks: { id: tableIds[2] }, three_year_locks: { id: tableIds[3] } }, bcs });
assert.equal(loadedLocks.length, 1); assert.equal(loadedLocks[0].id, 4n); assert.equal(loadedLocks[0].amountRaw, 5_000_000n);

const aprs = calculateVictoryAprs({ termTotals: { 7: SECONDS_PER_YEAR * 1_000_000n, 90: 1n, 365: 1n, 1095: 1n }, victoryAllocationBps: { 7: 10_000n, 90: 0n, 365: 0n, 1095: 0n } }, 1_000_000n);
assert.equal(aprs[7].aprHundredths, 10_000n); assert.equal(aprs[90].aprHundredths, 0n);

console.log('VICTORY transaction core: PASS (locks, sustainable V2 reinvest, unlocks, APRs, and reward claims)');
