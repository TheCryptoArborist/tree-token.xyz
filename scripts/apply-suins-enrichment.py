from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


Path("netlify/lib/suins-name-resolver.ts").write_text(
    """import { normalizeSuiAddress } from './leaderboard-provider.ts';

export const DEFAULT_SUINS_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
export const MAX_SUINS_NAMES_PER_REQUEST = 50;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export type SuinsResolutionResult = {
  names: Record<string, string | null>;
  requestedCount: number;
  resolvedCount: number;
  complete: boolean;
  graphqlErrors: string[];
  networkError: string | null;
  generatedAt: string;
};

export type SuinsResolverOptions = {
  endpoint?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function safeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > 255 || /[\\u0000-\\u001f\\u007f]/.test(name)) return null;
  return name;
}

function graphqlErrors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const message = record(item).message;
    return typeof message === 'string' && message ? message : 'Unknown SuiNS GraphQL error';
  });
}

export function buildDefaultSuinsQuery(addresses: string[]) {
  const definitions = addresses.map((_, index) => `$address${index}: SuiAddress!`).join(', ');
  const fields = addresses.map((_, index) => `name${index}: address(address: $address${index}) { defaultSuinsName }`).join('\\n');
  const variables = Object.fromEntries(addresses.map((address, index) => [`address${index}`, address]));
  return {
    query: `query ResolveDefaultSuinsNames(${definitions}) {\\n${fields}\\n}`,
    variables,
  };
}

export async function resolveDefaultSuinsNames(
  addresses: string[],
  options: SuinsResolverOptions = {},
): Promise<SuinsResolutionResult> {
  const normalized = [...new Set(addresses.map(normalizeSuiAddress).filter((value): value is string => Boolean(value)))]
    .slice(0, MAX_SUINS_NAMES_PER_REQUEST);
  const names = Object.fromEntries(normalized.map((address) => [address, null])) as Record<string, string | null>;
  const generatedAt = new Date().toISOString();
  if (!normalized.length) {
    return { names, requestedCount: 0, resolvedCount: 0, complete: true, graphqlErrors: [], networkError: null, generatedAt };
  }

  const endpoint = options.endpoint || DEFAULT_SUINS_GRAPHQL_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  options.abortSignal?.addEventListener('abort', externalAbort, { once: true });
  if (options.abortSignal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, options.timeoutMs ?? 12_000));
  let networkError: string | null = null;
  let errors: string[] = [];

  try {
    const body = buildDefaultSuinsQuery(normalized);
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      networkError = `SuiNS GraphQL returned HTTP ${response.status}`;
    } else {
      const payload = record(await response.json());
      errors = graphqlErrors(payload.errors);
      const data = record(payload.data);
      normalized.forEach((address, index) => {
        names[address] = safeName(record(data[`name${index}`]).defaultSuinsName);
      });
    }
  } catch (error) {
    networkError = controller.signal.aborted
      ? 'SuiNS resolution timed out.'
      : error instanceof Error ? error.message : 'SuiNS resolution failed.';
  } finally {
    clearTimeout(timeout);
    options.abortSignal?.removeEventListener('abort', externalAbort);
  }

  const resolvedCount = Object.values(names).filter(Boolean).length;
  return {
    names,
    requestedCount: normalized.length,
    resolvedCount,
    complete: !networkError && errors.length === 0,
    graphqlErrors: errors,
    networkError,
    generatedAt,
  };
}
""",
    encoding="utf-8",
)

Path("netlify/functions/tree-leaderboard-preview.ts").write_text(
    """import { resolveDefaultSuinsNames } from '../lib/suins-name-resolver.ts';
import type { NetlifyRuntimeContext } from '../lib/leaderboard-scheduled-trigger.ts';

type PreviewDependencies = {
  fetchImpl?: typeof fetch;
  resolveNames?: typeof resolveDefaultSuinsNames;
  productionUrl?: string;
};

function json(value: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

export async function handleTreeLeaderboardPreviewRequest(
  request: Request,
  context: NetlifyRuntimeContext,
  dependencies: PreviewDependencies = {},
) {
  if (request.method !== 'GET') return json({ status: 'error', message: 'Method not allowed.' }, 405);
  if (context?.deploy?.context !== 'deploy-preview') return json({ status: 'error', message: 'Not found.' }, 404);

  const fetchImpl = dependencies.fetchImpl || fetch;
  const resolveNames = dependencies.resolveNames || resolveDefaultSuinsNames;
  const productionUrl = dependencies.productionUrl || 'https://tree-token.xyz/api/tree-leaderboard';
  try {
    const response = await fetchImpl(productionUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) return json({ status: 'error', message: 'Production leaderboard snapshot is unavailable.' }, 502);
    const payload = await response.json() as Record<string, unknown>;
    const entries = Array.isArray(payload.entries) ? payload.entries as Array<Record<string, unknown>> : [];
    const wallets = entries.map((entry) => String(entry.wallet || ''));
    const resolution = await resolveNames(wallets);
    const enriched = entries.map((entry) => {
      const wallet = String(entry.wallet || '').toLowerCase();
      return { ...entry, suinsName: resolution.names[wallet] || null };
    });
    return json({
      ...payload,
      entries: enriched,
      identityResolution: {
        provider: 'sui-graphql-default-suins-name',
        requestedCount: resolution.requestedCount,
        resolvedCount: resolution.resolvedCount,
        complete: resolution.complete,
        generatedAt: resolution.generatedAt,
      },
      warnings: [
        ...(Array.isArray(payload.warnings) ? payload.warnings : []),
        ...(!resolution.complete ? ['Some default SuiNS names could not be resolved for this preview.'] : []),
      ],
    }, 200, 'public, max-age=120, s-maxage=300');
  } catch {
    return json({ status: 'error', message: 'Leaderboard preview enrichment failed.' }, 502);
  }
}

export default async (request: Request, context: NetlifyRuntimeContext) => (
  handleTreeLeaderboardPreviewRequest(request, context)
);

export const config = { path: '/api/tree-leaderboard-preview' };
""",
    encoding="utf-8",
)

provider = Path("netlify/lib/leaderboard-provider.ts")
text = provider.read_text(encoding="utf-8")
text = replace_once(
    text,
    "  wallet: string;\n  directTreeRaw: string;",
    "  wallet: string;\n  suinsName?: string | null;\n  directTreeRaw: string;",
    "DirectTreeEntry",
)
provider.write_text(text, encoding="utf-8")

scanner = Path("netlify/lib/sui-graphql-leaderboard-provider.ts")
text = scanner.read_text(encoding="utf-8")
text = replace_once(
    text,
    "      wallet: candidate.wallet,\n      directTreeRaw: candidate.raw.toString(),",
    "      wallet: candidate.wallet,\n      suinsName: null,\n      directTreeRaw: candidate.raw.toString(),",
    "leaderboard entry builder",
)
scanner.write_text(text, encoding="utf-8")

worker = Path("netlify/lib/leaderboard-background-worker.ts")
text = worker.read_text(encoding="utf-8")
text = replace_once(
    text,
    "} from './sui-graphql-leaderboard-provider.ts';\n",
    "} from './sui-graphql-leaderboard-provider.ts';\nimport { resolveDefaultSuinsNames } from './suins-name-resolver.ts';\n",
    "worker import",
)
text = replace_once(
    text,
    "  scan?: typeof scanSuiGraphqlLeaderboard;\n  store?: LeaderboardStore;",
    "  scan?: typeof scanSuiGraphqlLeaderboard;\n  resolveSuins?: typeof resolveDefaultSuinsNames;\n  store?: LeaderboardStore;",
    "worker dependency",
)
text = replace_once(
    text,
    "  const scan = dependencies.scan ?? scanSuiGraphqlLeaderboard;\n  const logger = dependencies.logger ?? console;",
    "  const scan = dependencies.scan ?? scanSuiGraphqlLeaderboard;\n  const resolveSuins = dependencies.resolveSuins ?? resolveDefaultSuinsNames;\n  const logger = dependencies.logger ?? console;",
    "worker resolver constant",
)
old_block = """    const completedAt = new Date(now()).toISOString();
    const terminalState = result.outcome === 'complete' ? 'complete' : result.outcome;
    let snapshotWritten = false;
    if (terminalState === 'complete') snapshotWritten = await writeCompleteLeaderboardSnapshot(result, storeOptions);
    const effectiveState = terminalState === 'complete' && !snapshotWritten ? 'verification-incomplete' : terminalState;
"""
new_block = """    let snapshotResult = result;
    if (result.outcome === 'complete') {
      try {
        const resolution = await resolveSuins(result.entries.map((entry) => entry.wallet), { endpoint: config.endpoint });
        snapshotResult = {
          ...result,
          entries: result.entries.map((entry) => ({ ...entry, suinsName: resolution.names[entry.wallet] || null })),
          warnings: [
            ...result.warnings,
            ...(!resolution.complete ? ['Some default SuiNS names could not be resolved during this refresh.'] : []),
          ],
        };
      } catch {
        snapshotResult = {
          ...result,
          entries: result.entries.map((entry) => ({ ...entry, suinsName: null })),
          warnings: [...result.warnings, 'Default SuiNS name resolution was unavailable during this refresh.'],
        };
      }
    }
    const completedAt = new Date(now()).toISOString();
    const terminalState = snapshotResult.outcome === 'complete' ? 'complete' : snapshotResult.outcome;
    let snapshotWritten = false;
    if (terminalState === 'complete') snapshotWritten = await writeCompleteLeaderboardSnapshot(snapshotResult, storeOptions);
    const effectiveState = terminalState === 'complete' && !snapshotWritten ? 'verification-incomplete' : terminalState;
"""
text = replace_once(text, old_block, new_block, "worker snapshot block")
for field in (
    "coinMetadataVerified", "coinSymbol", "coinDecimals", "totalSupplyRaw", "pagesScanned",
    "objectsScanned", "addressOwnedCoinObjects", "uniqueAddressOwners", "excludedCoinObjects",
    "excludedUniqueOwners", "excludedAddresses", "elapsedMs", "hasNextPage", "reachedEnd",
):
    text = text.replace(f"result.coverage.{field}", f"snapshotResult.coverage.{field}")
worker.write_text(text, encoding="utf-8")

app_path = Path("dapp/app.js")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    """function shortened(address) {
  return address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;
}


function elementById(id) {""",
    """function shortened(address) {
  return address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;
}

function displayNameForEntry(entry) {
  const name = typeof entry?.suinsName === 'string' ? entry.suinsName.trim() : '';
  return name || shortened(String(entry?.wallet || ''));
}

function elementById(id) {""",
    "DApp display name",
)
app = replace_once(
    app,
    """    const walletLine = document.createElement('div'); walletLine.className = 'leader-wallet';
    const wallet = document.createElement('span'); wallet.textContent = shortened(entry.wallet); wallet.title = entry.wallet; walletLine.append(wallet);
    const tierDefinition = tierForEntry(entry);
    const tier = document.createElement('div'); tier.className = `leader-tier ${tierDefinition?.css || ''}`.trim(); tier.textContent = `${tierDefinition?.icon || '🌿'} ${tierDefinition?.name || entry.tier || 'Ranked'}`;
    identity.append(walletLine, tier);""",
    """    const walletLine = document.createElement('div'); walletLine.className = 'leader-wallet';
    const wallet = document.createElement('span'); wallet.textContent = displayNameForEntry(entry); wallet.title = entry.suinsName || entry.wallet; walletLine.append(wallet);
    const addressLine = document.createElement('div'); addressLine.className = 'leader-address'; addressLine.textContent = shortened(entry.wallet); addressLine.title = entry.wallet;
    const tierDefinition = tierForEntry(entry);
    const tier = document.createElement('div'); tier.className = `leader-tier ${tierDefinition?.css || ''}`.trim(); tier.textContent = `${tierDefinition?.icon || '🌿'} ${tierDefinition?.name || entry.tier || 'Ranked'}`;
    identity.append(walletLine, ...(entry.suinsName ? [addressLine] : []), tier);""",
    "leaderboard identity card",
)
app = replace_once(
    app,
    "return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${tier} with ${row.directTree} direct TREE. https://tree-token.xyz/dapp/#leaderboard`;",
    "return `I’m #${row.rank} on the verified TREE Canopy Leaderboard — ${displayNameForEntry(row)}, ${tier}, with ${row.directTree} direct TREE. https://tree-token.xyz/dapp/#leaderboard`;",
    "rank share",
)
app = replace_once(
    app,
    """  ctx.fillStyle = '#f5fbff'; ctx.font = '700 34px ui-monospace, monospace'; ctx.fillText(shortened(row.wallet), 90, 890);
  ctx.fillStyle = '#35f28c'; ctx.font = '800 34px ui-monospace, monospace'; ctx.fillText('tree-token.xyz/dapp', 90, 1050);""",
    """  ctx.fillStyle = '#f5fbff'; ctx.font = '700 34px ui-monospace, monospace'; ctx.fillText(displayNameForEntry(row), 90, 870);
  if (row.suinsName) { ctx.fillStyle = '#9aa9b8'; ctx.font = '600 27px ui-monospace, monospace'; ctx.fillText(shortened(row.wallet), 90, 915); }
  ctx.fillStyle = '#35f28c'; ctx.font = '800 34px ui-monospace, monospace'; ctx.fillText('tree-token.xyz/dapp', 90, 1050);""",
    "rank card identity",
)
app = replace_once(
    app,
    "[entry.rank, shortened(entry.wallet), entry.directTree, entry.supplyPercent === null || entry.supplyPercent === undefined ? '—' : `${entry.supplyPercent}%`, tierForEntry(entry)?.name || entry.tier || 'Ranked']",
    "[entry.rank, displayNameForEntry(entry), entry.directTree, entry.supplyPercent === null || entry.supplyPercent === undefined ? '—' : `${entry.supplyPercent}%`, tierForEntry(entry)?.name || entry.tier || 'Ranked']",
    "fallback table identity",
)
app = replace_once(
    app,
    "export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, formatSupplyPercentFromRaw, formatTreePrice, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };",
    "export { DAPP_SWAP_EXECUTION_ENABLED, TIER_DEFINITIONS, displayNameForEntry, formatSupplyPercentFromRaw, formatTreePrice, readDashboardCache, renderLeaderboard, tierForEntry, updateYourRank, writeDashboardCache };",
    "DApp export",
)
app_path.write_text(app, encoding="utf-8")

styles_path = Path("dapp/styles.css")
styles = styles_path.read_text(encoding="utf-8").rstrip()
if "/* SuiNS leaderboard identity */" not in styles:
    styles += """

/* SuiNS leaderboard identity */
.leader-address{margin-top:2px;color:var(--muted-2);font:.66rem var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.leader-wallet span{color:var(--text)}
"""
styles_path.write_text(styles, encoding="utf-8")

toml_path = Path("netlify.toml")
toml = toml_path.read_text(encoding="utf-8")
start = toml.find('[[redirects]]\n  from = "/api/tree-leaderboard-preview"')
if start < 0:
    raise SystemExit("preview redirect start not found")
next_header = toml.find("[[headers]]", start)
if next_header < 0:
    raise SystemExit("preview redirect end not found")
toml_path.write_text(toml[:start] + toml[next_header:], encoding="utf-8")

ui_test = Path("tests/leaderboard-ui-state.test.mjs")
test = ui_test.read_text(encoding="utf-8")
test = replace_once(
    test,
    "const { TIER_DEFINITIONS, formatSupplyPercentFromRaw, renderLeaderboard, tierForEntry } = await import('../dapp/app.js');",
    "const { TIER_DEFINITIONS, displayNameForEntry, formatSupplyPercentFromRaw, renderLeaderboard, tierForEntry } = await import('../dapp/app.js');",
    "UI test import",
)
test = replace_once(
    test,
    "assert.equal(tierForEntry({ rank: 1, directTree: '1' }).name, 'Champion Tree');\n",
    """assert.equal(tierForEntry({ rank: 1, directTree: '1' }).name, 'Champion Tree');
assert.equal(displayNameForEntry({ wallet: `0x${'c'.repeat(64)}`, suinsName: 'cryptoarborist.sui' }), 'cryptoarborist.sui');
assert.match(displayNameForEntry({ wallet: `0x${'c'.repeat(64)}`, suinsName: null }), /^0x/);
""",
    "UI SuiNS test",
)
ui_test.write_text(test, encoding="utf-8")

background_test = Path("tests/leaderboard-background-worker.test.ts")
test = background_test.read_text(encoding="utf-8")
test = replace_once(
    test,
    """    return completeScan;
  },
});
assert.equal(successful.outcome, 'complete');""",
    """    return completeScan;
  },
  resolveSuins: async (wallets) => ({
    names: Object.fromEntries(wallets.map((wallet) => [wallet, 'cryptoarborist.sui'])),
    requestedCount: wallets.length, resolvedCount: wallets.length, complete: true,
    graphqlErrors: [], networkError: null, generatedAt: '2026-08-05T00:00:00.000Z',
  }),
});
assert.equal(successful.outcome, 'complete');""",
    "background resolver injection",
)
test = replace_once(
    test,
    "assert.ok(successfulStore.values.get(COMPLETE_SNAPSHOT_KEY));\n",
    """assert.ok(successfulStore.values.get(COMPLETE_SNAPSHOT_KEY));
assert.equal((successfulStore.values.get(COMPLETE_SNAPSHOT_KEY) as { entries: Array<{ suinsName?: string | null }> }).entries[0].suinsName, 'cryptoarborist.sui');
""",
    "background SuiNS assertion",
)
background_test.write_text(test, encoding="utf-8")

Path("tests/suins-name-resolver.test.ts").write_text(
    """import assert from 'node:assert/strict';
import { buildDefaultSuinsQuery, resolveDefaultSuinsNames } from '../netlify/lib/suins-name-resolver.ts';

const first = `0x${'a'.repeat(64)}`;
const second = `0x${'b'.repeat(64)}`;
const built = buildDefaultSuinsQuery([first, second]);
assert.match(built.query, /defaultSuinsName/);
assert.equal(built.variables.address0, first);
assert.equal(built.variables.address1, second);

let requests = 0;
const success = await resolveDefaultSuinsNames([first, second, first, 'invalid'], {
  fetchImpl: async (_url, init) => {
    requests += 1;
    const body = JSON.parse(String(init?.body));
    assert.equal(Object.keys(body.variables).length, 2);
    return new Response(JSON.stringify({ data: {
      name0: { defaultSuinsName: 'cryptoarborist.sui' },
      name1: { defaultSuinsName: null },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(requests, 1);
assert.equal(success.requestedCount, 2);
assert.equal(success.resolvedCount, 1);
assert.equal(success.names[first], 'cryptoarborist.sui');
assert.equal(success.names[second], null);
assert.equal(success.complete, true);

const partial = await resolveDefaultSuinsNames([first], {
  fetchImpl: async () => new Response(JSON.stringify({
    data: { name0: { defaultSuinsName: 'name.sui' } },
    errors: [{ message: 'partial fixture' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
});
assert.equal(partial.names[first], 'name.sui');
assert.equal(partial.complete, false);
assert.deepEqual(partial.graphqlErrors, ['partial fixture']);

const failed = await resolveDefaultSuinsNames([first], {
  fetchImpl: async () => new Response('', { status: 503 }),
});
assert.equal(failed.complete, false);
assert.match(failed.networkError || '', /503/);
console.log('SuiNS name resolver: PASS (batching, deduplication, fallback, and safe failure)');
""",
    encoding="utf-8",
)

Path("tests/leaderboard-preview-function.test.ts").write_text(
    """import assert from 'node:assert/strict';
import { handleTreeLeaderboardPreviewRequest } from '../netlify/functions/tree-leaderboard-preview.ts';

const wallet = `0x${'a'.repeat(64)}`;
const context = { deploy: { context: 'deploy-preview', id: 'preview', published: false }, site: { url: 'https://preview.test' } };
const response = await handleTreeLeaderboardPreviewRequest(new Request('https://preview.test/api/tree-leaderboard-preview'), context, {
  fetchImpl: async () => new Response(JSON.stringify({ status: 'ok', entries: [{ rank: 1, wallet }], warnings: [] }), { status: 200 }),
  resolveNames: async () => ({
    names: { [wallet]: 'cryptoarborist.sui' }, requestedCount: 1, resolvedCount: 1, complete: true,
    graphqlErrors: [], networkError: null, generatedAt: '2026-08-09T00:00:00.000Z',
  }),
});
assert.equal(response.status, 200);
const payload = await response.json() as { entries: Array<{ suinsName: string }>; identityResolution: { resolvedCount: number } };
assert.equal(payload.entries[0].suinsName, 'cryptoarborist.sui');
assert.equal(payload.identityResolution.resolvedCount, 1);

const hidden = await handleTreeLeaderboardPreviewRequest(new Request('https://example.test/api/tree-leaderboard-preview'), {
  ...context, deploy: { ...context.deploy, context: 'production' },
});
assert.equal(hidden.status, 404);
console.log('Leaderboard preview function: PASS (preview-only production snapshot enrichment)');
""",
    encoding="utf-8",
)
