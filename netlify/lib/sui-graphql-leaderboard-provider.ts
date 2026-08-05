import {
  DirectTreeEntry,
  LEADERBOARD_COVERAGE,
  METHODOLOGY_VERSION,
  SUI_GRAPHQL_PROVIDER,
  TREE_COIN_OBJECT_TYPE,
  TREE_DECIMALS,
  TREE_TOTAL_SUPPLY_RAW,
  excludedAddress,
  exclusionMetadata,
  normalizeSuiAddress,
  tierForRank,
} from './leaderboard-provider.ts';

export const DEFAULT_SUI_GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_MAX_PAGES = 40;
export const DEFAULT_MAX_SCAN_MS = 8_000;

export const TREE_COIN_OBJECTS_QUERY = `query TreeCoinObjects(
  $first: Int!
  $after: String
  $coinObjectType: String!
) {
  objects(
    first: $first
    after: $after
    filter: { type: $coinObjectType }
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      address
      owner {
        __typename
        ... on AddressOwner {
          address {
            address
          }
        }
        ... on ObjectOwner {
          address {
            address
          }
        }
      }
      asMoveObject {
        contents {
          json
          balanceField: extract(path: "balance") {
            json
          }
        }
      }
    }
  }
}`;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export type SuiGraphqlConfig = {
  endpoint: string;
  pageSize: number;
  maxPages: number;
  maxScanMs: number;
};

export type ScanCoverage = {
  pagesScanned: number;
  objectsScanned: number;
  addressOwnedCoinObjects: number;
  uniqueAddressOwners: number;
  objectOwnedObjectsSkipped: number;
  sharedObjectsSkipped: number;
  immutableObjectsSkipped: number;
  consensusOwnedObjectsSkipped: number;
  unknownOwnerObjectsSkipped: number;
  malformedOwnerAddresses: number;
  malformedBalances: number;
  excludedAddresses: number;
  duplicateObjectIds: number;
  elapsedMs: number;
  hasNextPage: boolean;
  endCursorPresent: boolean;
  reachedEnd: boolean;
  pageLimitReached: boolean;
  timeLimitReached: boolean;
  rateLimited: boolean;
  graphqlErrors: string[];
  networkError: string | null;
  cursorInconsistent: boolean;
  scanComplete: boolean;
};

export type Reconciliation = {
  valid: boolean;
  totalSupplyRaw: string;
  addressOwnedRaw: string;
  addressOwnedTree: string;
  addressOwnedPercentOfTotal: string;
  nonAddressOwnedOrEmbeddedRawEstimate: string | null;
  nonAddressOwnedOrEmbeddedTreeEstimate: string | null;
  nonAddressOwnedOrEmbeddedLabel: 'TREE not represented by address-owned Coin<TREE> objects';
};

export type SuiGraphqlScanResult = {
  outcome: 'complete' | 'verification-incomplete' | 'error';
  provider: typeof SUI_GRAPHQL_PROVIDER;
  generatedAt: string;
  methodologyVersion: typeof METHODOLOGY_VERSION;
  coverage: ScanCoverage;
  reconciliation: Reconciliation;
  holderCount: number | null;
  displayedCount: number;
  excludedCount: number;
  entries: DirectTreeEntry[];
  warnings: string[];
  sourceCheckpoint: {
    pagesScanned: number;
    objectsScanned: number;
    reachedEnd: boolean;
    endCursorPresent: boolean;
  };
};

type Candidate = { wallet: string; raw: bigint; coinObjectCount: number };

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function readSuiGraphqlConfig(getEnv: (name: string) => string | undefined = (name) => Netlify.env.get(name)): SuiGraphqlConfig {
  const endpointValue = getEnv('SUI_GRAPHQL_URL');
  let endpoint = DEFAULT_SUI_GRAPHQL_URL;
  if (endpointValue) {
    try {
      const parsed = new URL(endpointValue);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') endpoint = parsed.toString();
    } catch { /* Keep the conservative public default. */ }
  }
  return {
    endpoint,
    pageSize: boundedInteger(getEnv('SUI_GRAPHQL_PAGE_SIZE'), DEFAULT_PAGE_SIZE, 1, 50),
    maxPages: boundedInteger(getEnv('SUI_GRAPHQL_MAX_PAGES'), DEFAULT_MAX_PAGES, 1, 100),
    maxScanMs: boundedInteger(getEnv('SUI_GRAPHQL_MAX_SCAN_MS'), DEFAULT_MAX_SCAN_MS, 1_000, 20_000),
  };
}

export function parseRawBalance(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

export function formatBaseUnits(raw: bigint, decimals = TREE_DECIMALS): string {
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = (absolute % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

export function compareBigIntDescending(left: bigint, right: bigint): number {
  return left > right ? -1 : left < right ? 1 : 0;
}

export function formatPercentFromRaw(raw: bigint, total: bigint, precision = 9): string {
  if (total <= 0n) return '0';
  const scale = 10n ** BigInt(precision);
  const scaled = raw * 100n * scale / total;
  return formatBaseUnits(scaled, precision);
}

function initialCoverage(): ScanCoverage {
  return {
    pagesScanned: 0,
    objectsScanned: 0,
    addressOwnedCoinObjects: 0,
    uniqueAddressOwners: 0,
    objectOwnedObjectsSkipped: 0,
    sharedObjectsSkipped: 0,
    immutableObjectsSkipped: 0,
    consensusOwnedObjectsSkipped: 0,
    unknownOwnerObjectsSkipped: 0,
    malformedOwnerAddresses: 0,
    malformedBalances: 0,
    excludedAddresses: 0,
    duplicateObjectIds: 0,
    elapsedMs: 0,
    hasNextPage: false,
    endCursorPresent: false,
    reachedEnd: false,
    pageLimitReached: false,
    timeLimitReached: false,
    rateLimited: false,
    graphqlErrors: [],
    networkError: null,
    cursorInconsistent: false,
    scanComplete: false,
  };
}

function rawBalanceFromNode(node: JsonRecord): unknown {
  const moveObject = record(node.asMoveObject);
  const contents = record(moveObject.contents);
  const extracted = record(contents.balanceField);
  const json = record(contents.json);
  return extracted.json ?? json.balance;
}

function ownerAddress(owner: JsonRecord): unknown {
  const address = owner.address;
  return typeof address === 'string' ? address : record(address).address;
}

function addBalance(map: Map<string, Candidate>, wallet: string, raw: bigint) {
  const prior = map.get(wallet);
  map.set(wallet, prior
    ? { wallet, raw: prior.raw + raw, coinObjectCount: prior.coinObjectCount + 1 }
    : { wallet, raw, coinObjectCount: 1 });
}

function buildEntries(candidates: Map<string, Candidate>): DirectTreeEntry[] {
  return [...candidates.values()]
    .sort((left, right) => compareBigIntDescending(left.raw, right.raw) || left.wallet.localeCompare(right.wallet))
    .slice(0, 50)
    .map((candidate, index) => ({
      rank: index + 1,
      wallet: candidate.wallet,
      directTreeRaw: candidate.raw.toString(),
      directTree: formatBaseUnits(candidate.raw),
      supplyPercent: formatPercentFromRaw(candidate.raw, TREE_TOTAL_SUPPLY_RAW),
      tier: tierForRank(index + 1),
      coinObjectCount: candidate.coinObjectCount,
      moonbagsLocks: null,
      suiDexV2: null,
      suiDexV3: null,
      turbos: null,
      nftreeCount: null,
    }));
}

function reconcile(addressOwnedRaw: bigint): Reconciliation {
  const valid = addressOwnedRaw <= TREE_TOTAL_SUPPLY_RAW;
  const remainder = valid ? TREE_TOTAL_SUPPLY_RAW - addressOwnedRaw : null;
  return {
    valid,
    totalSupplyRaw: TREE_TOTAL_SUPPLY_RAW.toString(),
    addressOwnedRaw: addressOwnedRaw.toString(),
    addressOwnedTree: formatBaseUnits(addressOwnedRaw),
    addressOwnedPercentOfTotal: formatPercentFromRaw(addressOwnedRaw, TREE_TOTAL_SUPPLY_RAW),
    nonAddressOwnedOrEmbeddedRawEstimate: remainder?.toString() ?? null,
    nonAddressOwnedOrEmbeddedTreeEstimate: remainder === null ? null : formatBaseUnits(remainder),
    nonAddressOwnedOrEmbeddedLabel: 'TREE not represented by address-owned Coin<TREE> objects',
  };
}

function graphqlErrorMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((error) => {
    const message = record(error).message;
    return typeof message === 'string' && message ? message : 'Unknown GraphQL error';
  });
}

export async function scanSuiGraphqlLeaderboard(options: Partial<SuiGraphqlConfig> & {
  fetchImpl?: FetchLike;
  now?: () => number;
} = {}): Promise<SuiGraphqlScanResult> {
  const defaults = readSuiGraphqlConfig(() => undefined);
  const config: SuiGraphqlConfig = {
    endpoint: options.endpoint ?? defaults.endpoint,
    pageSize: options.pageSize ?? defaults.pageSize,
    maxPages: options.maxPages ?? defaults.maxPages,
    maxScanMs: options.maxScanMs ?? defaults.maxScanMs,
  };
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const generatedAt = new Date().toISOString();
  const coverage = initialCoverage();
  const seenObjectIds = new Set<string>();
  const allAddressOwners = new Map<string, Candidate>();
  const rankingCandidates = new Map<string, Candidate>();
  const excludedWallets = new Set<string>();
  let addressOwnedRaw = 0n;
  let after: string | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.maxScanMs);

  try {
    while (coverage.pagesScanned < config.maxPages) {
      if (now() - startedAt >= config.maxScanMs) {
        coverage.timeLimitReached = true;
        break;
      }
      let response: Response;
      try {
        response = await fetchImpl(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-sui-rpc-show-usage': 'true',
          },
          body: JSON.stringify({
            query: TREE_COIN_OBJECTS_QUERY,
            variables: { first: config.pageSize, after, coinObjectType: TREE_COIN_OBJECT_TYPE },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted || now() - startedAt >= config.maxScanMs) coverage.timeLimitReached = true;
        else coverage.networkError = error instanceof Error ? error.message : 'Sui GraphQL network request failed';
        break;
      }

      if (response.status === 429) {
        coverage.rateLimited = true;
        break;
      }
      if (!response.ok) {
        coverage.networkError = `Sui GraphQL returned HTTP ${response.status}`;
        break;
      }

      let payload: JsonRecord;
      try {
        payload = record(await response.json());
      } catch {
        coverage.networkError = 'Sui GraphQL returned an unreadable JSON response';
        break;
      }
      const errors = graphqlErrorMessages(payload.errors);
      if (errors.length) {
        coverage.graphqlErrors.push(...errors);
        break;
      }
      const objects = record(record(payload.data).objects);
      const nodes = Array.isArray(objects.nodes) ? objects.nodes : [];
      const pageInfo = record(objects.pageInfo);
      coverage.pagesScanned += 1;
      coverage.objectsScanned += nodes.length;

      for (const rawNode of nodes) {
        const node = record(rawNode);
        const objectId = typeof node.address === 'string' ? node.address.toLowerCase() : null;
        if (objectId && seenObjectIds.has(objectId)) {
          coverage.duplicateObjectIds += 1;
          continue;
        }
        if (objectId) seenObjectIds.add(objectId);

        const owner = record(node.owner);
        const ownerKind = typeof owner.__typename === 'string' ? owner.__typename : 'Unknown';
        if (ownerKind !== 'AddressOwner') {
          if (ownerKind === 'ObjectOwner') coverage.objectOwnedObjectsSkipped += 1;
          else if (ownerKind === 'Shared' || ownerKind === 'SharedOwner') coverage.sharedObjectsSkipped += 1;
          else if (ownerKind === 'Immutable' || ownerKind === 'ImmutableOwner') coverage.immutableObjectsSkipped += 1;
          else if (ownerKind === 'ConsensusAddressOwner') coverage.consensusOwnedObjectsSkipped += 1;
          else coverage.unknownOwnerObjectsSkipped += 1;
          continue;
        }

        const wallet = normalizeSuiAddress(ownerAddress(owner));
        if (!wallet) {
          coverage.malformedOwnerAddresses += 1;
          continue;
        }
        const balance = parseRawBalance(rawBalanceFromNode(node));
        if (balance === null) {
          coverage.malformedBalances += 1;
          continue;
        }

        coverage.addressOwnedCoinObjects += 1;
        addressOwnedRaw += balance;
        addBalance(allAddressOwners, wallet, balance);
        if (excludedAddress(wallet)) {
          coverage.excludedAddresses += 1;
          excludedWallets.add(wallet);
          continue;
        }
        addBalance(rankingCandidates, wallet, balance);
      }

      coverage.hasNextPage = pageInfo.hasNextPage === true;
      coverage.endCursorPresent = typeof pageInfo.endCursor === 'string' && pageInfo.endCursor.length > 0;
      if (!coverage.hasNextPage) {
        coverage.reachedEnd = true;
        break;
      }
      if (!coverage.endCursorPresent) {
        coverage.cursorInconsistent = true;
        break;
      }
      after = pageInfo.endCursor as string;
      if (now() - startedAt >= config.maxScanMs) {
        coverage.timeLimitReached = true;
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  coverage.pageLimitReached = coverage.hasNextPage && coverage.pagesScanned >= config.maxPages && !coverage.reachedEnd;
  coverage.uniqueAddressOwners = allAddressOwners.size;
  coverage.elapsedMs = Math.max(0, now() - startedAt);
  coverage.scanComplete = coverage.reachedEnd
    && coverage.graphqlErrors.length === 0
    && !coverage.networkError
    && !coverage.rateLimited
    && !coverage.pageLimitReached
    && !coverage.timeLimitReached
    && !coverage.cursorInconsistent;

  const reconciliation = reconcile(addressOwnedRaw);
  const complete = coverage.scanComplete && reconciliation.valid;
  const providerError = coverage.graphqlErrors.length > 0 || Boolean(coverage.networkError) || coverage.rateLimited;
  const outcome = complete ? 'complete' : providerError ? 'error' : 'verification-incomplete';
  const entries = complete ? buildEntries(rankingCandidates) : [];
  const warnings = ['Phase 2.2A measures direct wallet-held TREE only, not total TREE exposure.'];
  if (!coverage.scanComplete) warnings.push('The Sui-native Coin<TREE> verification did not complete; partial ranks were not published.');
  if (!reconciliation.valid) warnings.push('Address-owned raw TREE exceeded total supply; reconciliation is invalid and ranks were not published.');
  if (coverage.rateLimited) warnings.push('The public Sui GraphQL endpoint rate-limited the scan.');
  if (coverage.graphqlErrors.length) warnings.push('Sui GraphQL returned one or more errors.');
  if (coverage.networkError) warnings.push('The Sui GraphQL request failed before verification completed.');
  if (coverage.excludedAddresses) warnings.push(`${excludedWallets.size} excluded protocol or system address(es) were omitted from ranking.`);

  return {
    outcome,
    provider: SUI_GRAPHQL_PROVIDER,
    generatedAt,
    methodologyVersion: METHODOLOGY_VERSION,
    coverage,
    reconciliation,
    holderCount: complete ? allAddressOwners.size : null,
    displayedCount: entries.length,
    excludedCount: coverage.excludedAddresses,
    entries,
    warnings,
    sourceCheckpoint: {
      pagesScanned: coverage.pagesScanned,
      objectsScanned: coverage.objectsScanned,
      reachedEnd: coverage.reachedEnd,
      endCursorPresent: coverage.endCursorPresent,
    },
  };
}

export { LEADERBOARD_COVERAGE, METHODOLOGY_VERSION, exclusionMetadata };
