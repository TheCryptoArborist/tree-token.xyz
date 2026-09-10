import assert from 'node:assert/strict';
import {
  VICTORY_SUI_POOL,
  VICTORY_TYPE,
  quoteVictoryToSui,
} from '../dapp/earn-transactions-core.js';
import {
  SUIDEX_V3_POOL,
  SUI_COIN_TYPE,
  TREE_COIN_TYPE,
} from '../dapp/v3-transaction-core.js';
import {
  assertAllowedVictoryV3ReinvestTransaction,
  buildVictoryV3ReinvestTransaction,
  validateVictoryV3Quote,
} from '../dapp/victory-v3-reinvest-core.js';

const victoryToSui = quoteVictoryToSui({
  victorySuiPoolJson: { reserve0: '100000000000', reserve1: '500000000000' },
  amountIn: 100_000_000n,
  slippageBps: 100,
});
assert.equal(victoryToSui.pairId, VICTORY_SUI_POOL);
assert.equal(victoryToSui.amountIn, 100_000_000n);
assert.ok(victoryToSui.minAmountOut > 0n);

const baseQuote = {
  amountIn: 100_000_000n,
  slippageBps: 100,
  victoryToSui,
  v3SwapRaw: victoryToSui.minAmountOut / 2n,
  minSwapOutRaw: 1_000_000n,
  tickLower: 35_040,
  tickUpper: 36_360,
  positionId: null,
};
assert.equal(validateVictoryV3Quote(baseQuote, 100_000_000n, 100), baseQuote);
assert.throws(() => validateVictoryV3Quote({ ...baseQuote, tickUpper: 36_361 }, 100_000_000n, 100), /tick range/);

let resultId = 0;
class MockPure {
  u32(value) { return { pure: 'u32', value }; }
  u64(value) { return { pure: 'u64', value: BigInt(value) }; }
  u128(value) { return { pure: 'u128', value: BigInt(value) }; }
  u256(value) { return { pure: 'u256', value: BigInt(value) }; }
  bool(value) { return { pure: 'bool', value }; }
  address(value) { return { pure: 'address', value }; }
}
class MockTransaction {
  constructor() { this.commands = []; this.pure = new MockPure(); this.gas = { gas: true }; }
  setSender(sender) { this.sender = sender; }
  object(id) { return { object: id }; }
  mergeCoins(primary, others) { this.commands.push({ $kind: 'MergeCoins', MergeCoins: { primary, others } }); }
  splitCoins(coin, amounts) { const result = [{ split: ++resultId, coin, amounts }]; this.commands.push({ $kind: 'SplitCoins', SplitCoins: { coin, amounts } }); return result; }
  transferObjects(objects, owner) { this.commands.push({ $kind: 'TransferObjects', TransferObjects: { objects, owner } }); }
  moveCall(call) {
    const [pkg, module, fn] = call.target.split('::');
    this.commands.push({ $kind: 'MoveCall', MoveCall: { package: pkg, module, function: fn, ...call } });
    if (fn === 'flash_swap') return [{ result: 'balance-sui' }, { result: 'balance-tree' }, { result: 'receipt' }];
    if (fn === 'add_liquidity') return [{ result: 'sui-left' }, { result: 'tree-left' }];
    return { result: `${module}::${fn}` };
  }
  getData() { return { commands: this.commands }; }
}

const owner = `0x${'1'.repeat(64)}`;
const victoryCoinId = `0x${'2'.repeat(64)}`;
const positionId = `0x${'3'.repeat(64)}`;
const client = { core: { listCoins: async ({ coinType }) => {
  assert.equal(coinType, VICTORY_TYPE);
  return { objects: [{ objectId: victoryCoinId, balance: '1000000000' }], cursor: null, hasNextPage: false };
} } };

const complete = await buildVictoryV3ReinvestTransaction({
  Transaction: MockTransaction, client, owner,
  totalAmount: 100_000_000n, reinvestAmount: 100_000_000n,
  quote: baseQuote, minSuiRaw: 10n, minTreeRaw: 20n,
});
const completeCalls = complete.transaction.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(completeCalls.map((call) => `${call.module}::${call.function}`), [
  'router::swap_exact_tokens1_for_tokens0_composable', 'coin::into_balance', 'trade::flash_swap',
  'balance::zero', 'trade::repay_flash_swap', 'balance::destroy_zero', 'coin::from_balance',
  'i32::from', 'i32::from', 'liquidity::open_position', 'liquidity::add_liquidity',
]);
assert.deepEqual(completeCalls[0].typeArguments, [SUI_COIN_TYPE, VICTORY_TYPE]);
assert.equal(completeCalls[0].arguments[2].object, VICTORY_SUI_POOL);
assert.equal(completeCalls[2].arguments[0].object, SUIDEX_V3_POOL);
assert.deepEqual(completeCalls[2].typeArguments, [SUI_COIN_TYPE, TREE_COIN_TYPE]);
assert.equal(completeCalls.at(-1).arguments[4].value, 10n);
assert.equal(completeCalls.at(-1).arguments[5].value, 20n);
assert.equal(assertAllowedVictoryV3ReinvestTransaction(complete.transaction), true);

const sustainableQuote = { ...baseQuote, amountIn: 50_000_000n, victoryToSui: { ...victoryToSui, amountIn: 50_000_000n }, positionId };
const sustainable = await buildVictoryV3ReinvestTransaction({
  Transaction: MockTransaction, client, owner,
  totalAmount: 100_000_000n, reinvestAmount: 50_000_000n, lockAmount: 50_000_000n, lockDays: 90,
  quote: sustainableQuote,
});
const sustainableCalls = sustainable.transaction.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.equal(`${sustainableCalls[0].module}::${sustainableCalls[0].function}`, 'victory_token_locker::lock_tokens');
assert.equal(`${sustainableCalls.at(-1).module}::${sustainableCalls.at(-1).function}`, 'liquidity::add_liquidity');
assert.equal(sustainableCalls.at(-1).arguments[1].object, positionId);
assert.equal(sustainableCalls.some((call) => call.function === 'open_position'), false);
assert.equal(assertAllowedVictoryV3ReinvestTransaction(sustainable.transaction, { sustainable: true, newPosition: false }), true);

console.log('VICTORY V3 reinvest core tests passed.');
