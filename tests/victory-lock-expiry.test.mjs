import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Script, createContext } from 'node:vm';
import { bcs } from '@mysten/sui/bcs';

const source = readFileSync(new URL('../dapp/victory-center.js', import.meta.url), 'utf8');
function functionSource(name, next) {
  const start = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source)?.index;
  const end = new RegExp(`^(?:async )?function ${next}\\(`, 'm').exec(source)?.index;
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end).trim();
}
const scheduleFunctions = source.slice(source.indexOf('function decodeLockSchedule('), source.indexOf('function objectJson('));
const now = 1_793_399_664n;
const expiration = 1_856_098_656n; // Mainnet lock #3613 and the emission config's 156-week end.
const lock = { lockId: 3613n, amountRaw: 7500n, lockEnd: expiration };
function fixture() {
  const state = { lockSchedule: { endSeconds: expiration } };
  const context = createContext({ state, bcs, Uint8Array, Date,
    TERM_LABELS: { 7: '7 days', 90: '90 days', 365: '1 year', 1095: '3 years' },
    formatDate: seconds => new Date(Number(seconds) * 1000).toISOString().slice(0, 10),
  });
  new Script(scheduleFunctions).runInContext(context);
  return { state, context };
}

test('the form derives the fixed expiration from live getter return values', () => {
  const f = fixture();
  const value = raw => ({ bcs: bcs.u64().serialize(raw).toBytes() });
  const preview = { commandResults: [{}, { returnValues: [value(1761749856)] }, { returnValues: [{}, {}, {}, value(156)] }] };
  assert.equal(f.context.decodeLockSchedule(preview).endSeconds, expiration);
  assert.equal(f.context.lockExpiryForDays(1095, now).endSeconds, expiration);
  assert.equal(f.context.lockExpiryForDays(1095, now + 90n * 86400n).endSeconds, expiration);
  assert.match(f.context.lockTermNote(1095), /fixed expiration.*do not restart/);
});

test('shorter options retain their duration and are capped at the same program end', () => {
  const f = fixture();
  for (const days of [7, 90, 365]) {
    const actual = f.context.lockExpiryForDays(days, now);
    assert.equal(actual.endSeconds, now + BigInt(days) * 86400n);
    assert.equal(actual.fixed, false);
  }
  assert.equal(f.context.lockExpiryForDays(90, expiration - 86400n).endSeconds, expiration);
  assert.equal(f.context.lockExpiryForDays(90, expiration - 86400n).fixed, true);
});

test('missing schedule data never invents a new three-year unlock date', () => {
  const f = fixture(); f.state.lockSchedule = null;
  assert.equal(f.context.unlockDateForDays(1095), 'Contract date unavailable');
  assert.throws(() => f.context.decodeLockSchedule({}), /unavailable/);
  assert.throws(() => f.context.lockReviewDetails(null, 1095), /simulation/);
});

test('approval details use the simulated event even when form data is stale or unavailable', () => {
  const f = fixture();
  f.state.lockSchedule.endSeconds = expiration + 86400n;
  const expected = new Date(Number(expiration) * 1000).toLocaleString();
  assert.ok(f.context.lockReviewDetails(lock, 1095).includes(expected));
  f.state.lockSchedule = null;
  assert.ok(f.context.lockReviewDetails(lock, 1095).includes(expected));
  assert.match(f.context.lockReviewDetails(lock, 1095), /do not restart a three-year term/);
});

function reviewFixture(kind) {
  const f = fixture(), messages = [], submissions = [];
  const amounts = { totalRaw: 10000n, lockRaw: 7500n, reinvestRaw: 2500n };
  const quote = { positionId: 'fixture-position', victoryToSui: { minAmountOut: 1n, priceImpactBps: 1n },
    v3PriceImpactBps: 1n, minSwapOutRaw: 1n, tickLower: 33900, tickUpper: 37620 };
  Object.assign(f.state, { executing: false, victoryBalance: 10000n, suiBalance: 1000000000n,
    lockDays: 1095, aprs: null, reinvest: { mode: 'sustainable', lockDays: 1095, reinvestBps: 2500, quote, slippageBps: 100 } });
  Object.assign(f.context, { window: { playerAddress: 'fixture-owner' }, EXECUTION_ENABLED: true,
    el: { success: {}, reinvestSuccess: {} }, client: {}, Transaction: class {}, VICTORY_DECIMALS: 6,
    connectIfNeeded: async () => true, rawAmount: () => amounts.lockRaw, render: () => {},
    buildVictoryLockTransaction: async () => ({ transaction: {} }),
    buildVictoryV3ReinvestTransaction: async () => ({ transaction: {} }),
    simulateTwice: async () => ({}), simulateOnce: async () => ({}),
    extractVictoryLocked: () => kind === 'lock' ? amounts.lockRaw : amounts.totalRaw,
    extractVictoryLockEvent: () => lock, extractAddLiquidityEvent: () => ({ suiRaw: 1n, treeRaw: 1n }),
    minimumAfterSlippage: raw => raw, formatRaw: raw => raw.toString(), formatImpactBps: () => '0.32%',
    v3RangeText: () => 'fixture-position', setStatus: () => {}, setReinvestStatus: () => {},
    confirmTransaction: async message => { messages.push(message); return false; },
    submitAndFinalize: () => { submissions.push('unexpected'); assert.fail('Cancellation must not submit'); },
  });
  const coordinator = kind === 'lock' ? functionSource('executeLock', 'unlockVictoryLock')
    : functionSource('executeVictoryV3Reinvest', 'executeVictoryReinvest');
  return { run: new Script(`(${coordinator})`).runInContext(f.context), messages, submissions, amounts };
}
for (const kind of ['lock', 'v3']) {
  test(`${kind} review shows the exact contract expiry and cancellation submits nothing`, async () => {
    const f = reviewFixture(kind); await f.run(f.amounts);
    assert.equal(f.messages.length, 1);
    assert.ok(f.messages[0].includes(`Contract unlock: ${new Date(Number(expiration) * 1000).toLocaleString()}`));
    assert.match(f.messages[0], /do not restart a three-year term/);
    assert.doesNotMatch(f.messages[0], /Estimated unlock:|VICTORY for 3 years/);
    assert.deepEqual(f.submissions, []);
  });
}
