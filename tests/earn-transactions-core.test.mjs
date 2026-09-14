import assert from 'node:assert/strict';
import {
  SUI_TYPE, TREE_TYPE, V2_FARM, V2_POOL, V2_REWARD_VAULT, V2_EMISSION_CONFIG, V2_LP_TYPE, VICTORY_SUI_POOL, VICTORY_TYPE,
  buildV2ClaimRewardsTransaction, buildV2StakeTransaction, buildV2ZapTransaction, buildVictoryV2ReinvestTransaction,
  estimateV2PositionUnderlying, extractPositiveV2Lp, extractPositiveV2VictoryReward, getV2FarmPosition,
  minimumAfterSlippage, normalizeType, parseAmount, quoteVictoryV2Reinvest, validateV2Quote,
} from '../dapp/earn-transactions-core.js';
import { Transaction } from '@mysten/sui/transactions';

assert.equal(parseAmount('1.25', 9, 'SUI'), 1_250_000_000n);
assert.equal(parseAmount('.5', 6, 'TREE'), 500_000n);
assert.throws(() => parseAmount('1.0000001', 6, 'TREE'), /decimal places/);
assert.equal(minimumAfterSlippage(1_000_000n, 100), 990_000n);
assert.equal(normalizeType(`0x0002::coin::Coin<0x0002::sui::SUI>`), '0x2::coin::coin<0x2::sui::sui>');
assert.match(V2_LP_TYPE, /LPCoin/);
for (const objectId of [V2_FARM, V2_POOL, VICTORY_SUI_POOL, V2_REWARD_VAULT, V2_EMISSION_CONFIG]) assert.match(objectId, /^0x[0-9a-f]{64}$/);

const quote = { executionKind: 'suidex-v2-direct', pairId: V2_POOL, tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '500000000', amountOut: '1000000', minAmountOut: '990000' };
assert.equal(validateV2Quote(quote, { tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: 500_000_000n }), quote);
assert.throws(() => validateV2Quote({ ...quote, pairId: '0x0' }, { tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: 500_000_000n }), /verified/);

const fakeClient = { core: {
  listCoins: async ({ coinType }) => ({ objects: coinType === V2_LP_TYPE ? [{ objectId: `0x${'1'.repeat(64)}`, balance: '5000' }] : coinType === VICTORY_TYPE ? [{ objectId: `0x${'4'.repeat(64)}`, balance: '25000000' }] : [], hasNextPage: false }),
  listOwnedObjects: async () => ({ objects: [], hasNextPage: false }),
} };
const zap = await buildV2ZapTransaction({ Transaction, client: fakeClient, owner: `0x${'a'.repeat(64)}`, inputType: SUI_TYPE, amountIn: 1_000_000_000n, quote, slippageBps: 100 });
const zapCalls = zap.transaction.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(zapCalls, ['router::swap_exact_tokens0_for_tokens1_composable', 'router::add_liquidity']);
const reinvestQuote = quoteVictoryV2Reinvest({
  victorySuiPoolJson: { reserve0: '4000000000000', reserve1: '17000000000000' },
  suiTreePoolJson: { reserve0: '2000000000000', reserve1: '80000000000000000' },
  amountIn: 10_000_000n, slippageBps: 100,
});
assert.equal(reinvestQuote.amountIn, 10_000_000n); assert.equal(reinvestQuote.pairIds.victorySui, VICTORY_SUI_POOL);
assert.equal(reinvestQuote.suiToTree.amountIn, reinvestQuote.suiSwapRaw); assert(reinvestQuote.suiToTree.minAmountOut > 0n);
const reinvest = await buildVictoryV2ReinvestTransaction({ Transaction, client: fakeClient, owner: `0x${'a'.repeat(64)}`, amountIn: 10_000_000n, quote: reinvestQuote, slippageBps: 100 });
const reinvestCalls = reinvest.transaction.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(reinvestCalls, ['router::swap_exact_tokens1_for_tokens0_composable', 'router::swap_exact_tokens0_for_tokens1_composable', 'router::add_liquidity']);
const stake = await buildV2StakeTransaction({ Transaction, client: fakeClient, owner: `0x${'a'.repeat(64)}`, amount: 5000n });
const stakeCalls = stake.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(stakeCalls, ['farm::stake_lp']);

const existingPositionClient = { core: {
  ...fakeClient.core,
  listOwnedObjects: async () => ({ objects: [{ objectId: `0x${'2'.repeat(64)}`, json: { vault_id: `0x${'3'.repeat(64)}`, amount: '5000' } }], hasNextPage: false }),
} };
assert.deepEqual(await getV2FarmPosition(existingPositionClient, `0x${'a'.repeat(64)}`), { positionId: `0x${'2'.repeat(64)}`, vaultId: `0x${'3'.repeat(64)}`, stakedLpRaw: 5000n });
assert.deepEqual(estimateV2PositionUnderlying(2500n, { reserve0: '100000', reserve1: '400000', total_supply: '10000' }), { suiRaw: 25000n, treeRaw: 100000n, sharePpm: 250000n });
const addStake = await buildV2StakeTransaction({ Transaction, client: existingPositionClient, owner: `0x${'a'.repeat(64)}`, amount: 5000n });
const addStakeCalls = addStake.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(addStakeCalls, ['farm::add_to_position_lp']);
const claim = await buildV2ClaimRewardsTransaction({ Transaction, client: existingPositionClient, owner: `0x${'a'.repeat(64)}` });
const claimCalls = claim.transaction.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(claimCalls, ['farm::claim_rewards_lp']);
assert.equal(claim.positionId, `0x${'2'.repeat(64)}`);
await assert.rejects(() => buildV2ClaimRewardsTransaction({ Transaction, client: fakeClient, owner: `0x${'a'.repeat(64)}` }), /No SUI\/TREE V2 farm position/);
assert.equal(extractPositiveV2VictoryReward({ Transaction: { balanceChanges: [
  { address: `0x${'a'.repeat(64)}`, coinType: VICTORY_TYPE, amount: '25327557592' },
  { address: `0x${'a'.repeat(64)}`, coinType: SUI_TYPE, amount: '-3781908' },
] } }, `0x${'a'.repeat(64)}`), 25_327_557_592n);
assert.equal(extractPositiveV2VictoryReward({ balanceChanges: [{ address: `0x${'b'.repeat(64)}`, coinType: VICTORY_TYPE, amount: '100' }] }, `0x${'a'.repeat(64)}`), 0n);
assert.equal(extractPositiveV2Lp({ Transaction: { balanceChanges: [{ address: `0x${'a'.repeat(64)}`, coinType: V2_LP_TYPE, amount: '9876' }] } }, `0x${'a'.repeat(64)}`), 9_876n);

console.log('Earn transaction core: PASS (V2 zap, stake, VICTORY reinvest, claim builder, and verified reward extraction)');
