import assert from 'node:assert/strict';
import {
  TREE_COIN_TYPE, SUI_COIN_TYPE, SUIDEX_V3_PACKAGE, SUIDEX_V3_POOL, SUIDEX_V3_VERSION, TREE_V3_REWARD_TOKENS,
  TREE_V3_TICK_SPACING, normalizeDecimalInput, decimalToRaw, encodeSignedI32, decodeSignedI32,
  ticksFromDisplayedPrices, minimumAfterSlippage, validateVerifiedPool, buildCreateTreeV3Position,
  buildIncreaseTreeV3Position, buildRemoveTreeV3Position, buildCollectTreeV3Fees, buildCollectTreeV3Rewards,
  assertAllowedIncreaseV3Transaction, assertAllowedRemoveV3Transaction, assertAllowedCollectFeeV3Transaction,
  assertAllowedCollectRewardV3Transaction, simulationSucceeded,
  extractAddLiquidityEvent, extractRemoveLiquidityEvent, extractFeeCollectedEvent, extractRewardCollectedEvents,
} from '../dapp/v3-transaction-core.js';

assert.equal(normalizeDecimalInput('.1'), '0.1');
assert.equal(decimalToRaw('.1', 9), 100_000_000n);
assert.equal(decimalToRaw('1000.123456', 6), 1_000_123_456n);
assert.equal(encodeSignedI32(-50), 0xffff_ffce);
assert.equal(decodeSignedI32(0xffff_ffce), -50);
assert.equal(encodeSignedI32(50), 50);
const ticks = ticksFromDisplayedPrices({ currentTick: 35_704, currentPrice: 0.000028, minPrice: 0.0000252, maxPrice: 0.0000308, tickSpacing: TREE_V3_TICK_SPACING, displayedPriceIncreasesWithTick: false });
assert.equal(ticks.lower % 60, 0); assert.equal(ticks.upper % 60, 0); assert.ok(ticks.lower < 35_704); assert.ok(ticks.upper > 35_704);
assert.equal(minimumAfterSlippage(1_000_000n, 100), 990_000n);
assert.throws(() => minimumAfterSlippage(1_000n, 501), /Slippage/);
assert.equal(validateVerifiedPool({ verified: true, poolId: SUIDEX_V3_POOL, tokenX: SUI_COIN_TYPE, tokenY: TREE_COIN_TYPE, tickSpacing: 60, currentTick: 35_704, priceSuiPerTree: 0.000028 }), true);
assert.throws(() => validateVerifiedPool({ verified: true, poolId: '0x0', tokenX: SUI_COIN_TYPE, tokenY: TREE_COIN_TYPE, tickSpacing: 60, currentTick: 1, priceSuiPerTree: 1 }), /pool ID/);

let next = 0;
class MockPure { u32(value) { return { pure: 'u32', value }; } u64(value) { return { pure: 'u64', value: BigInt(value) }; } u128(value) { return { pure: 'u128', value: BigInt(value) }; } address(value) { return { pure: 'address', value }; } }
class MockTransaction {
  constructor() { this.commands = []; this.pure = new MockPure(); this.gas = { gas: true }; }
  setSender(sender) { this.sender = sender; }
  object(id) { return { object: id }; }
  mergeCoins(primary, others) { this.commands.push({ $kind: 'MergeCoins', MergeCoins: { primary, others } }); }
  splitCoins(coin, amounts) { const result = [{ split: ++next, coin, amounts }]; this.commands.push({ $kind: 'SplitCoins', SplitCoins: { coin, amounts } }); return result; }
  transferObjects(objects, owner) { this.commands.push({ $kind: 'TransferObjects', TransferObjects: { objects, owner } }); }
  moveCall(call) { const [pkg, module, fn] = call.target.split('::'); this.commands.push({ $kind: 'MoveCall', MoveCall: { package: pkg, module, function: fn, ...call } }); if (fn === 'add_liquidity') return [{ result: 'sui-left' }, { result: 'tree-left' }]; if (fn === 'remove_liquidity') return [{ result: 'sui-out' }, { result: 'tree-out' }]; if (module === 'collect' && fn === 'fee') return [{ result: 'sui-fee' }, { result: 'tree-fee' }]; if (module === 'collect' && fn === 'reward') return { result: `reward-${call.typeArguments[2]}` }; return { result: `${module}::${fn}` }; }
  getData() { return { commands: this.commands }; }
}
const owner = `0x${'1'.repeat(64)}`;
const client = { core: { listCoins: async () => ({ objects: [{ objectId: `0x${'2'.repeat(64)}`, balance: '5000000000' }], cursor: null }) } };
const tx = await buildCreateTreeV3Position({ Transaction: MockTransaction, client, owner, treeRaw: 1_000_000n, suiRaw: 100_000_000n, tickLower: 35_040, tickUpper: 36_360, minTreeRaw: 990_000n, minSuiRaw: 99_000_000n });
const calls = tx.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(calls.map((call) => `${call.module}::${call.function}`), ['i32::from','i32::from','liquidity::open_position','liquidity::add_liquidity']);
assert.deepEqual(calls[2].typeArguments, [SUI_COIN_TYPE, TREE_COIN_TYPE]);
assert.equal(calls[2].arguments[0].object, SUIDEX_V3_POOL); assert.equal(calls[2].arguments[3].object, SUIDEX_V3_VERSION);
assert.deepEqual(calls[3].typeArguments, [SUI_COIN_TYPE, TREE_COIN_TYPE]); assert.equal(calls[3].arguments[4].value, 99_000_000n); assert.equal(calls[3].arguments[5].value, 990_000n);
assert.ok(calls.every((call) => [SUIDEX_V3_PACKAGE].includes(call.package)));
const transfers = tx.commands.filter((command) => command.$kind === 'TransferObjects');
assert.ok(transfers.some((command) => command.TransferObjects.objects.some((item) => item?.result === 'liquidity::open_position')));
const positionId = `0x${'3'.repeat(64)}`;
const increaseTx = await buildIncreaseTreeV3Position({ Transaction: MockTransaction, client, owner, positionId, treeRaw: 1_000_000n, suiRaw: 100_000_000n, minTreeRaw: 995_000n, minSuiRaw: 99_500_000n });
const increaseCalls = increaseTx.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(increaseCalls.map((call) => `${call.module}::${call.function}`), ['liquidity::add_liquidity']);
assert.equal(increaseCalls[0].arguments[1].object, positionId);
assert.equal(increaseCalls[0].arguments[4].value, 99_500_000n);
assert.equal(increaseCalls[0].arguments[5].value, 995_000n);
assert.equal(assertAllowedIncreaseV3Transaction(increaseTx), true);
const removeTx = buildRemoveTreeV3Position({ Transaction: MockTransaction, owner, positionId, liquidityRaw: 123_456n, minTreeRaw: 1_000n, minSuiRaw: 2_000n });
const removeCalls = removeTx.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(removeCalls.map((call) => `${call.module}::${call.function}`), ['liquidity::remove_liquidity']);
assert.equal(removeCalls[0].arguments[1].object, positionId);
assert.equal(removeCalls[0].arguments[2].value, 123_456n);
assert.equal(removeCalls[0].arguments[3].value, 2_000n);
assert.equal(removeCalls[0].arguments[4].value, 1_000n);
assert.equal(assertAllowedRemoveV3Transaction(removeTx), true);
const collectFeeTx = buildCollectTreeV3Fees({ Transaction: MockTransaction, owner, positionId });
const collectFeeCalls = collectFeeTx.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(collectFeeCalls.map((call) => `${call.module}::${call.function}`), ['collect::fee']);
assert.deepEqual(collectFeeCalls[0].typeArguments, [SUI_COIN_TYPE, TREE_COIN_TYPE]);
assert.equal(collectFeeCalls[0].arguments[1].object, positionId);
assert.equal(assertAllowedCollectFeeV3Transaction(collectFeeTx), true);
const collectRewardTx = buildCollectTreeV3Rewards({ Transaction: MockTransaction, owner, positionId });
const collectRewardCalls = collectRewardTx.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(collectRewardCalls.map((call) => `${call.module}::${call.function}`), ['collect::reward','collect::reward','collect::reward']);
assert.deepEqual(collectRewardCalls.map((call) => call.typeArguments[2]), TREE_V3_REWARD_TOKENS.map((token) => token.coinType));
assert.equal(assertAllowedCollectRewardV3Transaction(collectRewardTx), true);
assert.throws(() => buildCollectTreeV3Rewards({ Transaction: MockTransaction, owner, positionId, rewardCoinTypes: ['0x2::sui::SUI'] }), /Invalid verified/);
const simulation = {
  $kind: 'Transaction',
  Transaction: {
    status: { success: true },
    events: [{
      eventType: `${SUIDEX_V3_PACKAGE}::liquidity::AddLiquidityEvent`,
      json: { pool_id: SUIDEX_V3_POOL, amount_x: '100000000', amount_y: '1000000', liquidity: '123' },
    }],
  },
};
assert.equal(simulationSucceeded(simulation), true);
assert.deepEqual(extractAddLiquidityEvent(simulation), { suiRaw: 100_000_000n, treeRaw: 1_000_000n, liquidityRaw: 123n });
simulation.Transaction.events[0].json.position_id = positionId;
assert.deepEqual(extractAddLiquidityEvent(simulation, positionId), { suiRaw: 100_000_000n, treeRaw: 1_000_000n, liquidityRaw: 123n });
assert.equal(extractAddLiquidityEvent(simulation, `0x${'4'.repeat(64)}`), null);
simulation.Transaction.events = [{
  eventType: `${SUIDEX_V3_PACKAGE}::liquidity::RemoveLiquidityEvent`,
  json: { pool_id: SUIDEX_V3_POOL, position_id: positionId, amount_x: '2000', amount_y: '1000', liquidity: '123456' },
}];
assert.deepEqual(extractRemoveLiquidityEvent(simulation, positionId), { suiRaw: 2_000n, treeRaw: 1_000n, liquidityRaw: 123_456n });
assert.equal(extractRemoveLiquidityEvent(simulation, `0x${'4'.repeat(64)}`), null);
simulation.Transaction.events = [{
  eventType: `${SUIDEX_V3_PACKAGE}::collect::FeeCollectedEvent`,
  json: { pool_id: SUIDEX_V3_POOL, position_id: positionId, amount_x: '20', amount_y: '10' },
}];
assert.deepEqual(extractFeeCollectedEvent(simulation, positionId), { suiRaw: 20n, treeRaw: 10n });
simulation.Transaction.events[0].json.amount_x = '0'; simulation.Transaction.events[0].json.amount_y = '0';
assert.deepEqual(extractFeeCollectedEvent(simulation, positionId), { suiRaw: 0n, treeRaw: 0n });
assert.equal(extractFeeCollectedEvent(simulation, `0x${'4'.repeat(64)}`), null);
simulation.Transaction.events = TREE_V3_REWARD_TOKENS.map((token, index) => ({
  eventType: `${SUIDEX_V3_PACKAGE}::collect::CollectPoolRewardEvent`,
  json: { pool_id: SUIDEX_V3_POOL, position_id: positionId, reward_coin_type: token.coinType, amount: index === 0 ? '23447' : '0' },
}));
assert.deepEqual(extractRewardCollectedEvents(simulation, positionId).map((reward) => reward.amountRaw), [23_447n, 0n, 0n]);
assert.deepEqual(extractRewardCollectedEvents(simulation, positionId)[0], { ...TREE_V3_REWARD_TOKENS[0], amountRaw: 23_447n });
assert.deepEqual(extractRewardCollectedEvents(simulation, `0x${'4'.repeat(64)}`), []);
console.log('V3 transaction core tests passed.');
