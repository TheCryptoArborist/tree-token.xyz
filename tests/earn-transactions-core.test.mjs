import assert from 'node:assert/strict';
import {
  SUI_TYPE, TREE_TYPE, V2_FARM, V2_POOL, V2_REWARD_VAULT, V2_EMISSION_CONFIG, V2_LP_TYPE,
  buildV2StakeTransaction, buildV2ZapTransaction, getV2FarmPosition, minimumAfterSlippage, parseAmount, validateV2Quote,
} from '../dapp/earn-transactions-core.js';
import { Transaction } from '@mysten/sui/transactions';

assert.equal(parseAmount('1.25', 9, 'SUI'), 1_250_000_000n);
assert.equal(parseAmount('.5', 6, 'TREE'), 500_000n);
assert.throws(() => parseAmount('1.0000001', 6, 'TREE'), /decimal places/);
assert.equal(minimumAfterSlippage(1_000_000n, 100), 990_000n);
assert.match(V2_LP_TYPE, /LPCoin/);
for (const objectId of [V2_FARM, V2_POOL, V2_REWARD_VAULT, V2_EMISSION_CONFIG]) assert.match(objectId, /^0x[0-9a-f]{64}$/);

const quote = { executionKind: 'suidex-v2-direct', pairId: V2_POOL, tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: '500000000', amountOut: '1000000', minAmountOut: '990000' };
assert.equal(validateV2Quote(quote, { tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: 500_000_000n }), quote);
assert.throws(() => validateV2Quote({ ...quote, pairId: '0x0' }, { tokenIn: SUI_TYPE, tokenOut: TREE_TYPE, amountIn: 500_000_000n }), /verified/);

const fakeClient = { core: {
  listCoins: async ({ coinType }) => ({ objects: coinType === V2_LP_TYPE ? [{ objectId: `0x${'1'.repeat(64)}`, balance: '5000' }] : [], hasNextPage: false }),
  listOwnedObjects: async () => ({ objects: [], hasNextPage: false }),
} };
const zap = await buildV2ZapTransaction({ Transaction, client: fakeClient, owner: `0x${'a'.repeat(64)}`, inputType: SUI_TYPE, amountIn: 1_000_000_000n, quote, slippageBps: 100 });
const zapCalls = zap.transaction.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(zapCalls, ['router::swap_exact_tokens0_for_tokens1_composable', 'router::add_liquidity']);
const stake = await buildV2StakeTransaction({ Transaction, client: fakeClient, owner: `0x${'a'.repeat(64)}`, amount: 5000n });
const stakeCalls = stake.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(stakeCalls, ['farm::stake_lp']);

const existingPositionClient = { core: {
  ...fakeClient.core,
  listOwnedObjects: async () => ({ objects: [{ objectId: `0x${'2'.repeat(64)}`, json: { vault_id: `0x${'3'.repeat(64)}` } }], hasNextPage: false }),
} };
assert.deepEqual(await getV2FarmPosition(existingPositionClient, `0x${'a'.repeat(64)}`), { positionId: `0x${'2'.repeat(64)}`, vaultId: `0x${'3'.repeat(64)}` });
const addStake = await buildV2StakeTransaction({ Transaction, client: existingPositionClient, owner: `0x${'a'.repeat(64)}`, amount: 5000n });
const addStakeCalls = addStake.getData().commands.filter((command) => command.$kind === 'MoveCall').map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
assert.deepEqual(addStakeCalls, ['farm::add_to_position_lp']);

console.log('Earn transaction core: PASS (amounts, slippage, new and existing-position V2 farm stake builders)');
