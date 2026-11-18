import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../production/stats-market-static/app.js', import.meta.url), 'utf8');
const cacheKey = 'tree-dashboard-last-success-v1';
const checkedAt = '2026-11-18T05:49:26.468Z';
const olderVerifiedAt = '2026-11-17T17:22:00.000Z';
const checkedLabel = 'Nov 18, 2026, 5:49 AM UTC';
const olderVerifiedLabel = 'Nov 17, 2026, 5:22 PM UTC';

// Run the actual production functions without starting wallet integrations or the page.
function actualFunction(name) {
  const declaration = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(declaration, `Production function ${name} is present`);
  const nextDeclaration = /\n(?:async )?function \w+\(/.exec(source.slice(declaration.index + 1));
  return source.slice(declaration.index, nextDeclaration ? declaration.index + 1 + nextDeclaration.index : undefined);
}

const functionNames = [
  'readDashboardCache', 'writeDashboardCache', 'validHolderCount', 'formatMarket',
  'renderHolderCountMeta', 'renderMarket', 'loadDashboard', 'renderLeaderboard', 'loadChart',
];

function dashboardPayload(overrides = {}) {
  return {
    generatedAt: checkedAt,
    snapshot: {},
    warnings: [],
    live: {
      status: 'ok', source: 'Noodles.fi', verifiedAt: checkedAt,
      data: { holderCount: 606, sourceUpdatedAt: null },
      ...overrides,
    },
  };
}

function exposurePayload() {
  return {
    status: 'ok', provider: 'tree-exposure-snapshot',
    methodologyVersion: 'verified-tree-exposure-v1',
    snapshotGeneratedAt: '2026-11-18T00:28:07.115Z', snapshotAgeMs: 19_279_357,
    source: { direct: { verifiedAddressOwners: 2198, pagesScanned: 409, objectsScanned: 20424 } },
    coverage: { totalExposureComplete: true },
    eligibleOwnerCount: 2198, displayedCount: 0, entries: [], warnings: [],
  };
}

function harness(initialResponses = []) {
  const holder = { dataset: { market: 'holderCount' }, textContent: '—' };
  const meta = { dataset: {}, textContent: '' };
  const storage = new Map();
  const labels = new Map();
  const requests = [];
  const responses = [...initialResponses];
  const chartStates = [];
  let queriedMarketNodes = 0;
  const context = vm.createContext({
    DASHBOARD_CACHE_KEY: cacheKey,
    dashboardUrl: '/api/tree-dashboard',
    chartUrl: '/api/tree-chart',
    activeChartRange: '24h', activeChartPair: 'usd',
    lastLeaderboardPayload: null, leaderboardMode: 'exposure', leaderboardStatus: 'loading', leaderboardEntries: [],
    quantity: new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }),
    compactMoney: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    document: {
      getElementById: (id) => id === 'holderCountMeta' ? meta : null,
      querySelectorAll: (selector) => {
        queriedMarketNodes += 1;
        return selector === '[data-market]' || selector === '[data-market="holderCount"]' ? [holder] : [];
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    fetch: async (url) => {
      requests.push(url);
      assert.ok(responses.length, `Unexpected request: ${url}`);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return { ok: true, json: async () => next };
    },
    setGroupState: () => {},
    renderSnapshot: () => {},
    showWarnings: () => {},
    formatTreePrice: (value) => String(value),
    elementById: () => null,
    setText: (id, value) => labels.set(id, value),
    formatSnapshotAge: (value) => String(value),
    normalizeLeaderboardEntry: (entry) => entry,
    renderBadgeGuideCounts: () => {},
    renderTierLadder: () => {},
    renderLeaderboardCards: () => {},
    updateYourRank: () => {},
    setChartState: (...args) => chartStates.push(args),
    console: { error: () => {} },
  });
  vm.runInContext(functionNames.map(actualFunction).join('\n\n'), context);
  return {
    context, holder, meta, storage, labels, requests, responses, chartStates,
    queriedMarketNodes: () => queriedMarketNodes,
  };
}

for (const order of ['exposure first', 'dashboard first']) {
  test(`Noodles holder count survives ${order} completion order`, async () => {
    const h = harness([dashboardPayload()]);
    if (order === 'exposure first') {
      const pendingDashboard = h.context.loadDashboard();
      h.context.renderLeaderboard(exposurePayload());
      await pendingDashboard;
    } else {
      await h.context.loadDashboard();
      h.context.renderLeaderboard(exposurePayload());
    }
    assert.equal(h.holder.textContent, '606');
    assert.equal(h.labels.get('verifiedAddressOwnerCount'), '2,198', 'Separate scan metric remains available');
    assert.equal(h.meta.textContent, `Noodles.fi · Checked ${checkedLabel}`);
    assert.equal(h.meta.dataset.state, 'live');
    assert.deepEqual(h.requests, ['/api/tree-dashboard']);
  });
}

test('missing and invalid holder values are unavailable, while a real zero is displayed', () => {
  const h = harness();
  const invalid = [null, undefined, '', '   ', NaN, Infinity, -1, 1.5, 'not a count', true, false, [], {}, Number.MAX_SAFE_INTEGER + 1];
  for (const value of invalid) {
    h.context.renderMarket({ holderCount: value }, 'Live', checkedAt, 'Noodles.fi', checkedAt);
    assert.equal(h.holder.textContent, 'Not available', `Rejected ${String(value)}`);
    assert.equal(h.meta.dataset.state, 'unavailable');
  }
  h.context.renderMarket({}, 'Live', checkedAt, 'Noodles.fi', checkedAt);
  assert.equal(h.holder.textContent, 'Not available');
  for (const value of [0, '0', 606, '606']) {
    h.context.renderMarket({ holderCount: value }, 'Live', checkedAt, 'Noodles.fi', checkedAt);
    assert.equal(h.holder.textContent, String(Number(value)));
    assert.equal(h.meta.dataset.state, 'live');
  }
});

test('a newer CoinGecko response cannot fresh-date a cached Noodles holder count', async () => {
  const h = harness([dashboardPayload({
    status: 'fallback', source: 'CoinGecko', verifiedAt: olderVerifiedAt,
    data: { holderCount: 606, sourceUpdatedAt: checkedAt },
  })]);
  await h.context.loadDashboard();
  assert.equal(h.holder.textContent, '606');
  assert.equal(h.meta.textContent, `Noodles.fi · Last verified ${olderVerifiedLabel} · Fallback`);
  assert.ok(!h.meta.textContent.includes(checkedAt));
  assert.ok(!h.meta.textContent.includes(checkedLabel));
  const cached = JSON.parse(h.storage.get(cacheKey));
  assert.equal(cached.verifiedAt, olderVerifiedAt);
  assert.equal(cached.generatedAt, checkedAt, 'Response time stays distinct from holder verification time');
});

for (const failure of ['provider unavailable', 'network error']) {
  test(`cached holders retain their original verification date after ${failure}`, async () => {
    const h = harness([dashboardPayload({ verifiedAt: olderVerifiedAt })]);
    await h.context.loadDashboard();
    if (failure === 'network error') {
      h.responses.push(new Error('Offline'), {}); // The second response is the existing project snapshot fallback.
    } else {
      h.responses.push(dashboardPayload({ status: 'error', data: null }));
    }
    await h.context.loadDashboard();
    assert.equal(h.holder.textContent, '606');
    assert.equal(h.meta.textContent, `Noodles.fi · Last verified ${olderVerifiedLabel} · Cached`);
    assert.equal(h.meta.dataset.state, 'cached');
    assert.ok(!h.meta.textContent.includes(checkedAt));
    assert.ok(!h.meta.textContent.includes(checkedLabel));
  });
}

test('legacy cache without verifiedAt does not substitute its response timestamp', async () => {
  const h = harness([dashboardPayload({ status: 'error', data: null })]);
  h.storage.set(cacheKey, JSON.stringify({ generatedAt: checkedAt, source: 'Noodles.fi', data: { holderCount: 606 } }));
  await h.context.loadDashboard();
  assert.equal(h.holder.textContent, '606');
  assert.equal(h.meta.textContent, 'Noodles.fi · Check time unavailable · Cached');
  assert.ok(!h.meta.textContent.includes(checkedAt));
});

test('invalid verifiedAt is reported as unknown instead of displaying a false check time', () => {
  const h = harness();
  h.context.renderMarket({ holderCount: 606 }, 'Fallback', checkedAt, 'CoinGecko', 'not a date');
  assert.equal(h.meta.textContent, 'Noodles.fi · Check time unavailable · Fallback');
});

test('Noodles chart pages skip the native chart before requests, controls or state changes', async () => {
  const h = harness();
  await h.context.loadChart('7d', 'sui');
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.chartStates, []);
  assert.equal(h.queriedMarketNodes(), 0);
  assert.equal(h.context.activeChartRange, '24h');
  assert.equal(h.context.activeChartPair, 'usd');
});
