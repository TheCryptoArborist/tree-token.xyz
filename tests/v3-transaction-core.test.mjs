import assert from 'node:assert/strict';
import {
  TREE_COIN_TYPE, SUI_COIN_TYPE, SUIDEX_V3_PACKAGE, SUIDEX_V3_POOL, SUIDEX_V3_VERSION,
  TREE_V3_TICK_SPACING, normalizeDecimalInput, decimalToRaw, encodeSignedI32, decodeSignedI32,
  ticksFromDisplayedPrices, minimumAfterSlippage, validateVerifiedPool, buildCreateTreeV3Position,
} from '../dapp/v3-transaction-core.js';

assert.equal(normalizeDecimalInput('.1'), '0.1');
assert.equal(decimalToRaw('.1', 9), 100_000_000n);
assert.equal(decimalToRaw('1000.123456', 6), 1_000_123_456n);
assert.equal(encodeSignedI32(-50), 0xffff_ffce);
assert.equal(decodeSignedI32(0xffff_ffce), -50);
assert.equal(encodeSignedI32(50), 50);
const ticks = ticksFromDisplayedPrices({ currentTick: -35_700, currentPrice: 0.000028, minPrice: 0.0000252, maxPrice: 0.0000308, tickSpacing: TREE_V3_TICK_SPACING, displayedPriceIncreasesWithTick: true });
assert.equal(ticks.lower % 50, 0); assert.equal(ticks.upper % 50, 0); assert.ok(ticks.lower < -35_700); assert.ok(ticks.upper > -35_700);
assert.equal(minimumAfterSlippage(1_000_000n, 100), 990_000n);
assert.throws(() => minimumAfterSlippage(1_000n, 501), /Slippage/);
assert.equal(validateVerifiedPool({ verified: true, poolId: SUIDEX_V3_POOL, tokenX: TREE_COIN_TYPE, tokenY: SUI_COIN_TYPE, currentTick: -35_700, priceSuiPerTree: 0.000028 }), true);
assert.throws(() => validateVerifiedPool({ verified: true, poolId: '0x0', tokenX: TREE_COIN_TYPE, tokenY: SUI_COIN_TYPE, currentTick: 1, priceSuiPerTree: 1 }), /pool ID/);

let next = 0;
class MockPure { u32(value) { return { pure: 'u32', value }; } u64(value) { return { pure: 'u64', value: BigInt(value) }; } }
class MockTransaction {
  constructor() { this.commands = []; this.pure = new MockPure(); this.gas = { gas: true }; }
  setSender(sender) { this.sender = sender; }
  object(id) { return { object: id }; }
  mergeCoins(primary, others) { this.commands.push({ $kind: 'MergeCoins', MergeCoins: { primary, others } }); }
  splitCoins(coin, amounts) { const result = [{ split: ++next, coin, amounts }]; this.commands.push({ $kind: 'SplitCoins', SplitCoins: { coin, amounts } }); return result; }
  transferObjects(objects, owner) { this.commands.push({ $kind: 'TransferObjects', TransferObjects: { objects, owner } }); }
  moveCall(call) { const [pkg, module, fn] = call.target.split('::'); this.commands.push({ $kind: 'MoveCall', MoveCall: { package: pkg, module, function: fn, ...call } }); if (fn === 'add_liquidity') return [{ result: 'tree-left' }, { result: 'sui-left' }]; return { result: `${module}::${fn}` }; }
  getData() { return { commands: this.commands }; }
}
const owner = `0x${'1'.repeat(64)}`;
const client = { core: { listCoins: async () => ({ objects: [{ objectId: `0x${'2'.repeat(64)}`, balance: '5000000000' }], cursor: null }) } };
const tx = await buildCreateTreeV3Position({ Transaction: MockTransaction, client, owner, treeRaw: 1_000_000n, suiRaw: 100_000_000n, tickLower: -36_000, tickUpper: -35_000, minTreeRaw: 990_000n, minSuiRaw: 99_000_000n });
const calls = tx.commands.filter((command) => command.$kind === 'MoveCall').map((command) => command.MoveCall);
assert.deepEqual(calls.map((call) => `${call.module}::${call.function}`), ['i32::from','i32::from','liquidity::open_position','liquidity::add_liquidity']);
assert.deepEqual(calls[2].typeArguments, [TREE_COIN_TYPE, SUI_COIN_TYPE]);
assert.equal(calls[2].arguments[0].object, SUIDEX_V3_POOL); assert.equal(calls[2].arguments[3].object, SUIDEX_V3_VERSION);
assert.deepEqual(calls[3].typeArguments, [TREE_COIN_TYPE, SUI_COIN_TYPE]); assert.equal(calls[3].arguments[4].value, 990_000n); assert.equal(calls[3].arguments[5].value, 99_000_000n);
assert.ok(calls.every((call) => ['0x2', SUIDEX_V3_PACKAGE].includes(call.package)));
const transfers = tx.commands.filter((command) => command.$kind === 'TransferObjects');
assert.ok(transfers.some((command) => command.TransferObjects.objects.some((item) => item?.result === 'liquidity::open_position')));
console.log('V3 transaction core tests passed.');
