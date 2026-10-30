import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Script, createContext } from 'node:vm';

const source = readFileSync(new URL('../dapp/victory-center.js', import.meta.url), 'utf8');

// Bound each assertion to its actual implementation, not unrelated V2/V3 code.
// Named boundaries must be unique; compiling the expression rejects a partial
// function or accidental inclusion of another top-level declaration.
function functionSource(name, nextName) {
  const boundary = (value) => {
    const matches = [...source.matchAll(new RegExp(`^(?:async )?function ${value}\\(`, 'gm'))];
    assert.equal(matches.length, 1, `Expected one top-level ${value} function`);
    return matches[0].index;
  };
  const start = boundary(name), end = boundary(nextName);
  assert.ok(end > start, `Invalid boundary for ${name}`);
  const result = source.slice(start, end).trim();
  new Script(`(${result})`);
  return result;
}

const receiptSource = functionSource('showVictoryV3ReinvestReceipt', 'executeVictoryV3Reinvest');
const v3Source = functionSource('executeVictoryV3Reinvest', 'executeVictoryReinvest');
const v2Source = functionSource('executeVictoryReinvest', 'init');
const lockReviewSource = functionSource('lockReviewDetails', 'unlockDate');

// No module initialization, imports, network or wallet access in these fixtures.
// The formatter spy verifies exact raw-value/decimal arguments, not localization.
function receiptFixture() {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.hidden = true; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    set innerHTML(_) { assert.fail('V3 receipt must not use innerHTML'); }
    set outerHTML(_) { assert.fail('V3 receipt must not use outerHTML'); }
    insertAdjacentHTML() { assert.fail('V3 receipt must not insert HTML strings'); }
  }
  const root = new Element('div');
  const calls = [];
  const context = createContext({
    el: { reinvestSuccess: root },
    document: { createElement: (tag) => new Element(tag) },
    VICTORY_DECIMALS: 9,
    formatRaw: (raw, decimals, precision) => {
      calls.push([raw, decimals, precision]);
      return `${raw}:${decimals}:${precision}`;
    },
    Date,
  });
  const render = new Script(`(${receiptSource})`).runInContext(context);
  const rows = () => {
    const children = root.children.find((node) => node.tag === 'dl').children;
    assert.equal(children.length % 2, 0);
    return Object.fromEntries(Array.from({ length: children.length / 2 }, (_, i) =>
      [children[i * 2].textContent, children[i * 2 + 1].textContent]));
  };
  return { root, calls, render, rows };
}

const receiptInput = {
  digest: 'fixture/digest?not-a-real-transaction',
  sustainable: true,
  lock: { amountRaw: 9007199254740993123n, lockId: 9007199254740993999n, lockEnd: 1800000000n },
  reinvestRaw: 6000000000123456789n,
  added: { treeRaw: 1234567890123456789n, suiRaw: 987654321012345678n },
  positionId: '0x' + 'ab'.repeat(32),
};

test('V3 receipt assertions are scoped and reject HTML-string rendering', () => {
  for (const field of ['VICTORY locked', 'Lock ID', 'Unlock date', 'VICTORY reinvested', 'TREE added to liquidity', 'SUI added to liquidity', 'Venue', 'Position']) {
    assert.ok(receiptSource.includes(field), field);
  }
  assert.doesNotMatch(receiptSource + v3Source, /\.\s*(?:innerHTML|outerHTML)\b|\binsertAdjacentHTML\s*\(/);
  assert.match(receiptSource, /root\.replaceChildren\(\)/);
  assert.match(receiptSource, /Liquidity addition does not mean the position was staked/);
  // Characterize why the old whole-file prohibition was incorrect. V2 remains
  // covered by the behavior tests below; its implementation is not rewritten.
  assert.equal([...v2Source.matchAll(/reinvestSuccess\.innerHTML/g)].length, 2);
});

test('V3 receipt is invoked only after finalization and reconciliation', () => {
  const finalized = v3Source.indexOf('await submitAndFinalize(finalBuilt.transaction)');
  const guard = v3Source.indexOf('if (!finalizedAdded ||');
  const receipt = v3Source.indexOf('showVictoryV3ReinvestReceipt(');
  assert.ok(finalized >= 0 && guard > finalized && receipt > guard);
  assert.match(v3Source, /if \(!finalizedAdded \|\| extractVictoryLocked\(finalized, owner\) !== amounts\.totalRaw \|\| \(sustainable && !finalizedLock\)\) throw new Error/);
  assert.match(v3Source, /showVictoryV3ReinvestReceipt\(\{ digest: txDigest, sustainable, lock: finalizedLock, reinvestRaw: amounts\.reinvestRaw, added: finalizedAdded, positionId: quote\.positionId \}\)/);
});

test('sustainable V3 receipt renders lock, exact formatter inputs and transaction link', () => {
  const f = receiptFixture();
  f.render(receiptInput);
  assert.equal(f.root.hidden, false);
  assert.equal(f.root.children[0].textContent, 'Sustainable V3 Reinvest Complete');
  assert.deepEqual(f.rows(), {
    'VICTORY locked': `${receiptInput.lock.amountRaw}:9:6`,
    'Lock ID': `#${receiptInput.lock.lockId}`,
    'Unlock date': new Date(Number(receiptInput.lock.lockEnd) * 1000).toLocaleString(),
    'VICTORY reinvested': `${receiptInput.reinvestRaw}:9:6`,
    'TREE added to liquidity': `${receiptInput.added.treeRaw}:6:6`,
    'SUI added to liquidity': `${receiptInput.added.suiRaw}:9:9`,
    Venue: 'SuiDex V3',
    Position: receiptInput.positionId.slice(0, 10) + '…' + receiptInput.positionId.slice(-8),
  });
  assert.deepEqual(f.calls, [
    [receiptInput.lock.amountRaw, 9, 6], [receiptInput.reinvestRaw, 9, 6],
    [receiptInput.added.treeRaw, 6, 6], [receiptInput.added.suiRaw, 9, 9],
  ]);
  const link = f.root.children.find((node) => node.tag === 'a');
  assert.equal(link.href, 'https://suiscan.xyz/mainnet/tx/' + encodeURIComponent(receiptInput.digest));
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
});

test('complete V3 receipt does not invent a lock or new-position identifier', () => {
  const f = receiptFixture();
  f.render({ ...receiptInput, sustainable: false, lock: null, positionId: null });
  assert.equal(f.root.children[0].textContent, 'V3 Reinvest Complete');
  const rows = f.rows();
  for (const field of ['VICTORY locked', 'Lock ID', 'Unlock date']) assert.equal(field in rows, false);
  assert.equal(Object.keys(rows).length, 5);
  assert.equal(rows.Position, 'New position (see transaction)');
  assert.match(f.root.children.find((node) => node.tag === 'small').textContent, /does not mean the position was staked/);
});

test('rendering another V3 receipt replaces rather than duplicates the previous receipt', () => {
  const f = receiptFixture();
  f.render(receiptInput);
  f.render({ ...receiptInput, sustainable: false, lock: null, added: { treeRaw: 0n, suiRaw: 0n } });
  assert.equal(f.root.children.length, 4);
  assert.equal('Lock ID' in f.rows(), false);
  assert.equal(f.rows()['TREE added to liquidity'], '0:6:6');
  assert.equal(f.rows()['SUI added to liquidity'], '0:9:9');
});

// Execute only the extracted V2 coordinator against deterministic stubs. Calls
// counted below are local fixture calls, not wallet signatures or submissions.
function v2Fixture({ sustainable, approvals }) {
  const amounts = { totalRaw: 1000n, reinvestRaw: sustainable ? 600n : 1000n, lockRaw: sustainable ? 400n : 0n };
  const root = { hidden: true, innerHTML: '' };
  const quote = { generatedAt: Date.now(), victoryToSui: { minAmountOut: 1n, priceImpactBps: 1n }, suiToTree: { minAmountOut: 2n, priceImpactBps: 1n } };
  const state = { victoryBalance: 1000n, suiBalance: 1000000000n, reinvest: {
    executing: false, quote, destination: 'v2', mode: sustainable ? 'sustainable' : 'complete',
    reinvestBps: 6000, lockDays: 1095, slippageBps: 50, amount: '1000',
  } };
  let balanceReads = 0, confirmationCalls = 0;
  const submissions = [], statuses = [], stakeAmounts = [];
  const context = createContext({
    state, el: { reinvestSuccess: root, reinvestAmount: { value: '1000' } },
    window: { playerAddress: 'fixture-owner' }, EXECUTION_ENABLED: true,
    client: {}, Transaction: class {}, VICTORY_DECIMALS: 9, TERM_LABELS: { 1095: '3 years' },
    connectIfNeeded: async () => true, reinvestAmounts: () => amounts,
    requestReinvestQuote: () => assert.fail('Fixture quote should be fresh'),
    executeVictoryV3Reinvest: () => assert.fail('V2 must not execute the V3 route'),
    buildVictoryV2SustainableReinvestTransaction: async () => ({ transaction: { fixture: 'liquidity' } }),
    buildVictoryV2ReinvestTransaction: async () => ({ transaction: { fixture: 'liquidity' } }),
    buildV2StakeTransaction: async ({ amount }) => { stakeAmounts.push(amount); return { fixture: 'stake' }; },
    getV2LpBalance: async () => ++balanceReads === 1 ? 500n : 800n,
    simulateTwice: async () => ({}), extractPositiveV2Lp: () => 300n,
    extractVictoryLocked: () => amounts.totalRaw, extractVictoryLockEvent: () => ({ amountRaw: amounts.lockRaw, lockEnd: 1856098656n }),
    formatRaw: (raw) => raw.toString(), formatImpactBps: () => 'fixture-impact', unlockDateForDays: () => 'fixture-date',
    confirmTransaction: async (message) => {
      assert.ok(confirmationCalls < approvals.length, 'Unexpected extra confirmation');
      if (sustainable && confirmationCalls === 0) {
        assert.ok(message.includes(`Contract unlock: ${new Date(1856098656000).toLocaleString()}`));
        assert.match(message, /do not restart a three-year term/);
      }
      return approvals[confirmationCalls++];
    },
    submitAndFinalize: async (transaction) => {
      submissions.push(transaction.fixture);
      return { txDigest: transaction.fixture + '-fixture-digest', finalized: {} };
    },
    setReinvestStatus: (...args) => statuses.push(args), render: () => {}, load: async () => {}, showVictoryView: () => {},
  });
  context.lockReviewDetails = new Script(`(${lockReviewSource})`).runInContext(context);
  const run = new Script(`(${v2Source})`).runInContext(context);
  return { run, root, state, submissions, statuses, stakeAmounts, confirmations: () => confirmationCalls };
}

for (const sustainable of [true, false]) {
  const mode = sustainable ? 'sustainable' : 'complete';
  test(`V2 ${mode}: cancelled staking retains the unstaked receipt and liquidity link`, async () => {
    const f = v2Fixture({ sustainable, approvals: [true, false] });
    await f.run();
    assert.deepEqual(f.submissions, ['liquidity']);
    assert.equal(f.confirmations(), 2);
    assert.deepEqual(f.stakeAmounts, [300n]);
    assert.equal(f.root.hidden, false);
    assert.match(f.root.innerHTML, /The new LP remains unstaked in your wallet/);
    assert.match(f.root.innerHTML, /href="https:\/\/suiscan\.xyz\/mainnet\/tx\/liquidity-fixture-digest"/);
    assert.doesNotMatch(f.root.innerHTML, /new LP was staked|stake-fixture-digest/);
    if (sustainable) assert.match(f.root.innerHTML, /400 VICTORY was locked and 600 VICTORY created/);
    assert.equal(f.statuses.at(-1)[1], 'success');
    assert.equal(f.state.reinvest.executing, false);
  });

  test(`V2 ${mode}: completed staking retains its separate stake and liquidity references`, async () => {
    const f = v2Fixture({ sustainable, approvals: [true, true] });
    await f.run();
    assert.deepEqual(f.submissions, ['liquidity', 'stake']);
    assert.equal(f.confirmations(), 2);
    assert.deepEqual(f.stakeAmounts, [300n]);
    assert.equal(f.root.hidden, false);
    assert.match(f.root.innerHTML, /and the new LP was staked/);
    assert.match(f.root.innerHTML, /href="https:\/\/suiscan\.xyz\/mainnet\/tx\/stake-fixture-digest"/);
    assert.ok(f.root.innerHTML.includes('Liquidity transaction: ' + 'liquidity-fixture-digest'.slice(0, 12)));
    if (sustainable) assert.match(f.root.innerHTML, /400 VICTORY locked; 600 VICTORY reinvested/);
    assert.equal(f.statuses.at(-1)[1], 'success');
    assert.equal(f.state.reinvest.executing, false);
  });
}

test('V2 cancellation before initial wallet approval produces no receipt or fixture submission', async () => {
  const f = v2Fixture({ sustainable: true, approvals: [false] });
  await f.run();
  assert.deepEqual(f.submissions, []);
  assert.equal(f.confirmations(), 1);
  assert.equal(f.root.hidden, true);
  assert.equal(f.root.innerHTML, '');
  assert.match(f.statuses.at(-1)[0], /cancelled before wallet approval/);
  assert.equal(f.state.reinvest.executing, false);
});
